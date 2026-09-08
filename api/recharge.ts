import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

const CODE_LENGTH = 12;
const MAX_ATTEMPTS_PER_IP = 5;          // tentativas falhadas consecutivas por IP
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_CODE_GUESSES = 10;            // tentativas globais por código

function extractIp(req: VercelRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) ?? "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  return (req.headers["x-real-ip"] as string) ?? "unknown";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Autenticação obrigatória: nenhum anónimo pode tentar usar códigos
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const rawCode = String((req.body as { code?: unknown })?.code ?? "");
  const cleanCode = rawCode.replace(/\D/g, "");

  if (cleanCode.length !== CODE_LENGTH) {
    res.status(400).json({ error: "Código deve ter exatamente 12 dígitos" });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const rateKey = extractIp(req);

    // ── Anti brute-force por IP ────────────────────────────────────────────
    const { data: recentFailures } = await admin
      .from("recharge_attempts")
      .select("id")
      .eq("ip", rateKey)
      .eq("success", false)
      .gte("created_at", new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString());

    if ((recentFailures?.length ?? 0) >= MAX_ATTEMPTS_PER_IP) {
      res.status(429).json({
        error: "Demasiadas tentativas. Aguarda 15 minutos antes de tentar novamente.",
      });
      return;
    }

    // ── Verificações de conta ──────────────────────────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("balance, is_blocked")
      .eq("id", auth.userId)
      .single();

    const p = profile as { balance: number; is_blocked?: boolean } | null;
    if (!p) { res.status(404).json({ error: "Perfil não encontrado" }); return; }
    if (p.is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

    // ── Anti adivinhação por código ────────────────────────────────────────
    const { data: guessRow } = await admin
      .from("recharge_attempts")
      .select("id")
      .eq("code", cleanCode)
      .eq("success", false)
      .gte("created_at", new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString());

    if ((guessRow?.length ?? 0) >= MAX_CODE_GUESSES) {
      res.status(429).json({ error: "Este código foi bloqueado por tentativas excessivas." });
      return;
    }

    // ── Executa RPC atómico (service_role) ─────────────────────────────────
    const { data: rpcData, error: rpcError } = await admin.rpc("use_recharge_code", {
      p_code: cleanCode,
      p_user_id: auth.userId,
    });

    const result = (rpcData ?? null) as { ok?: boolean; error?: string; amount?: number; newBalance?: number } | null;

    // Registo da tentativa (audit trail)
    await admin.from("recharge_attempts").insert({
      ip: rateKey,
      code: cleanCode,
      success: Boolean(result?.ok),
      created_at: new Date().toISOString(),
    });

    if (rpcError || !result?.ok) {
      const msg = result?.error ?? "Código inválido, expirado ou já utilizado";
      res.status(400).json({ error: msg });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      amount: result.amount,
      newBalance: result.newBalance,
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}
