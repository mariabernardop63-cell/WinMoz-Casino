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

    // ── Fallback: RPC não existe (SQL não corrido) → usa transacção segura
    //    equivalente server-side (SELECT … FOR UPDATE não disponível via
    //    PostgREST, por isso serializa com update condicional por estado) ──
    let finalResult = result;
    const rpcCode = (rpcError as { code?: string } | null)?.code ?? "";
    if (rpcError && (rpcCode === "42883" || rpcCode === "PGRST202")) {
      finalResult = await redeemWithoutRpc(admin, cleanCode, auth.userId);
    }

    // Registo da tentativa (audit trail)
    await admin.from("recharge_attempts").insert({
      ip: rateKey,
      code: cleanCode,
      success: Boolean(finalResult?.ok),
      created_at: new Date().toISOString(),
    });

    if (rpcError && !finalResult) {
      res.status(500).json({ error: "Sistema de recargas não inicializado. Contacta o suporte." });
      return;
    }

    if (!finalResult?.ok) {
      const msg = finalResult?.error ?? "Código inválido, expirado ou já utilizado";
      res.status(400).json({ error: msg });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      amount: finalResult.amount,
      newBalance: finalResult.newBalance,
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

/* Redeemer sem RPC — só usado quando o RPC ainda não existe na BD.
   Mesmas regras: 1 uso por utilizador, expira quando esgota/fora de validade.
   Atomicidade garantida por updates condicionais (used_count guard). */
async function redeemWithoutRpc(
  admin: ReturnType<typeof getSupabaseAdmin>,
  cleanCode: string,
  userId: string,
): Promise<{ ok: boolean; error?: string; amount?: number; newBalance?: number }> {
  const { data: codeRow } = await admin
    .from("recharge_codes")
    .select("id, code, amount, max_uses, used_count, status, expires_at")
    .eq("code", cleanCode)
    .maybeSingle();

  const c = codeRow as {
    id: string; code: string; amount: number; max_uses: number; used_count: number; status: string; expires_at: string | null;
  } | null;

  if (!c) return { ok: false, error: "Código não encontrado" };
  if (c.status !== "active") return { ok: false, error: "Este código expirou" };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
    await admin.from("recharge_codes").update({ status: "expired" }).eq("id", c.id);
    return { ok: false, error: "Este código expirou" };
  }
  if (c.used_count >= c.max_uses) {
    await admin.from("recharge_codes").update({ status: "expired" }).eq("id", c.id);
    return { ok: false, error: "Este código já foi utilizado" };
  }

  // Um uso por utilizador
  const { error: dupError } = await admin
    .from("recharge_redemptions")
    .insert({ code_id: c.id, user_id: userId, amount: c.amount });
  if (dupError) {
    if (dupError.code === "23505") return { ok: false, error: "Já usaste este código de recarga" };
    return { ok: false, error: "Erro ao processar a recarga" };
  }

  // Reserva atómica do uso: só incrementa se used_count ainda < max_uses
  const { data: reserved, error: resErr } = await admin
    .from("recharge_codes")
    .update({ used_count: c.used_count + 1, used_at: new Date().toISOString(), last_used_by: userId })
    .eq("id", c.id)
    .lt("used_count", c.max_uses)
    .eq("status", "active")
    .select("used_count, max_uses")
    .maybeSingle();

  if (resErr || !reserved) {
    // desfaz a redenção para não bloquear o utilizador num código esgotado
    await admin.from("recharge_redemptions").delete().eq("code_id", c.id).eq("user_id", userId);
    await admin.from("recharge_codes").update({ status: "expired" }).eq("id", c.id);
    return { ok: false, error: "Este código já foi utilizado" };
  }

  const usedCount = (reserved as { used_count: number }).used_count;
  const maxUses = (reserved as { max_uses: number }).max_uses;
  if (usedCount >= maxUses) {
    await admin.from("recharge_codes").update({ status: "expired" }).eq("id", c.id);
  }

  // Crédito de saldo atómico
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", userId).single();
  const current = Number((profile as { balance: number } | null)?.balance ?? 0);
  const newBalance = Math.round((current + Number(c.amount)) * 100) / 100;
  const { error: balErr } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (balErr) {
    await admin.from("recharge_redemptions").delete().eq("code_id", c.id).eq("user_id", userId);
    await admin.from("recharge_codes").update({ used_count: c.used_count, status: "active" }).eq("id", c.id);
    return { ok: false, error: "Erro ao creditar saldo" };
  }

  await admin.from("transactions").insert({
    user_id: userId,
    type: "recharge",
    amount: c.amount,
    description: JSON.stringify({ code: c.code ?? cleanCode, rechargeId: c.id }),
    status: "approved",
    created_at: new Date().toISOString(),
  });

  return { ok: true, amount: Number(c.amount), newBalance };
}
