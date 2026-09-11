import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

/* ─── /api/recharge ────────────────────────────────────────────────────────────
   Redenção de códigos de recarga — resiliente ao estado da base de dados.

   Funciona em TODOS os estados em que o admin consegue gerar códigos:
   1) RPC use_recharge_code (caminho ideal, atómico)
   2) Fallback transaccional só com recharge_codes + profiles + transactions
      (tabelas garantidas pelo próprio fluxo de geração do admin), sem depender
      de recharge_redemptions / recharge_attempts existirem.

   IMPORTANTE: uma falha de INFRAESTRUTURA nunca marca um código como expirado
   nem consome o seu uso — só falhas reais de negócio o fazem.
   ────────────────────────────────────────────────────────────────────────────── */

const CODE_LENGTH = 12;
const MAX_ATTEMPTS_PER_IP = 5;             // tentativas falhadas consecutivas por IP
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;  // 15 minutos
const MAX_CODE_GUESSES = 10;               // tentativas por código+IP

// Rate limit em memória (fallback quando recharge_attempts não existe)
const memFailures = new Map<string, number[]>();

function extractIp(req: VercelRequest): string {
  // SECURITY: NÃO confiar no primeiro valor de X-Forwarded-For (client-controlled)
  const real = (req.headers["x-real-ip"] as string) ?? "";
  if (real) return real.trim();
  const vercelFwd = (req.headers["x-vercel-forwarded-for"] as string) ?? "";
  if (vercelFwd) return vercelFwd.split(",")[0].trim();
  const fwd = (req.headers["x-forwarded-for"] as string) ?? "";
  const parts = fwd.split(",").map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "unknown";
}

type RedeemResult = { ok: boolean; error?: string; amount?: number; newBalance?: number };

/* Erro é "tabela/coluna em falta" (infraestrutura) e não falha de negócio? */
function isInfraError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||                       // undefined_table
    code === "42703" ||                       // undefined_column
    code === "PGRST205" || code === "PGRST204" ||
    msg.includes("does not exist") || msg.includes("schema cache") ||
    msg.includes("could not find")
  );
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
    const ipKey = extractIp(req);
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
    const now = Date.now();

    // ── Anti brute-force (tabela opcional + memória) ─────────────────────────
    const bumpMemory = (key: string) => {
      const hits = (memFailures.get(key) ?? []).filter(t => now - t < ATTEMPT_WINDOW_MS);
      hits.push(now);
      memFailures.set(key, hits);
    };
    const memCount = (key: string) =>
      (memFailures.get(key) ?? []).filter(t => now - t < ATTEMPT_WINDOW_MS).length;

    const { error: attErr } = await admin
      .from("recharge_attempts")
      .select("id")
      .eq("ip", ipKey)
      .eq("success", false)
      .gte("created_at", windowStart)
      .limit(MAX_ATTEMPTS_PER_IP + 1);

    const attemptsTableMissing = isInfraError(attErr as { code?: string; message?: string } | null);
    if (!attemptsTableMissing) {
      const { data: recentFailures } = await admin
        .from("recharge_attempts")
        .select("id")
        .eq("ip", ipKey)
        .eq("success", false)
        .gte("created_at", windowStart);
      if ((recentFailures?.length ?? 0) >= MAX_ATTEMPTS_PER_IP || memCount(`ip:${ipKey}`) >= MAX_ATTEMPTS_PER_IP) {
        res.status(429).json({ error: "Demasiadas tentativas. Aguarda 15 minutos antes de tentar novamente." });
        return;
      }

      const { data: userFailures } = await admin
        .from("recharge_attempts")
        .select("id")
        .eq("ip", `user:${auth.userId}`)
        .eq("success", false)
        .gte("created_at", windowStart);
      if ((userFailures?.length ?? 0) >= MAX_ATTEMPTS_PER_IP) {
        res.status(429).json({ error: "Demasiadas tentativas. Aguarda 15 minutos antes de tentar novamente." });
        return;
      }

      const { data: guessRow } = await admin
        .from("recharge_attempts")
        .select("id")
        .eq("code", cleanCode)
        .eq("ip", ipKey)
        .eq("success", false)
        .gte("created_at", windowStart);
      if ((guessRow?.length ?? 0) >= MAX_CODE_GUESSES) {
        res.status(429).json({ error: "Este código foi bloqueado por tentativas excessivas." });
        return;
      }
    }

    // ── Verificações de conta ────────────────────────────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("is_blocked")
      .eq("id", auth.userId)
      .single();

    const p = profile as { is_blocked?: boolean } | null;
    if (!p) { res.status(404).json({ error: "Perfil não encontrado" }); return; }
    if (p.is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

    // ── Caminho 1: RPC atómico (ideal) ───────────────────────────────────────
    let finalResult: RedeemResult | null = null;
    {
      const { data: rpcData, error: rpcError } = await admin.rpc("use_recharge_code", {
        p_code: cleanCode,
        p_user_id: auth.userId,
      });
      const result = (rpcData ?? null) as RedeemResult | null;

      // Erros de negócio definitivos do RPC — respeitar tal como estão
      const BUSINESS_ERRORS = [
        "código inválido",
        "código não encontrado",
        "este código expirou",
        "este código já foi utilizado",
        "já usaste este código",
        "este código foi revogado",
        "perfil não encontrado",
        "já usaste este código de recarga",
      ];
      const isBusinessError = (msg: string) =>
        BUSINESS_ERRORS.some(b => msg.toLowerCase().includes(b));

      if (result?.ok) {
        finalResult = result;
      } else if (result && !result.ok && isBusinessError(result.error ?? "")) {
        finalResult = result;
      } else {
        // RPC ausente, quebrado ou erro interno → fallback transaccional
        // (só com tabelas garantidas pelo fluxo de geração do admin)
        finalResult = await redeemTransactional(admin, cleanCode, auth.userId);
      }
      void rpcError;
    }

    // ── Auditoria (best-effort; falha de infra não afecta o resultado) ───────
    const success = Boolean(finalResult?.ok);
    if (!attemptsTableMissing) {
      await admin.from("recharge_attempts").insert([
        { ip: ipKey, code: cleanCode, success, created_at: new Date().toISOString() },
        { ip: `user:${auth.userId}`, code: cleanCode, success, created_at: new Date().toISOString() },
      ]);
    }
    if (!success) bumpMemory(`ip:${ipKey}`);

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
  } catch (err) {
    console.error("[recharge] Erro interno:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Erro interno" });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Redeemer transaccional — usa APENAS tabelas garantidas pelo fluxo de
   geração do admin (recharge_codes, profiles, transactions).

   · Um uso por utilizador: para max_uses = 1 é garantido pelo claim atómico
     used_count 0 → 1; para max_uses > 1 tenta a tabela recharge_redemptions
     (se existir) e, na sua falta, dedup por last_used_by.
   · Atómico: update condicional (used_count < max_uses AND status active).
   · NUNCA marca expirado por falha de infraestrutura.
   ───────────────────────────────────────────────────────────────────────────── */
async function redeemTransactional(
  admin: ReturnType<typeof getSupabaseAdmin>,
  cleanCode: string,
  userId: string,
): Promise<RedeemResult> {
  const { data: codeRow, error: readErr } = await admin
    .from("recharge_codes")
    .select("id, code, amount, max_uses, used_count, status, expires_at, last_used_by")
    .eq("code", cleanCode)
    .maybeSingle();

  if (readErr && isInfraError(readErr as { code?: string; message?: string } | null)) {
    return { ok: false, error: "Sistema de recargas indisponível. Contacta o suporte." };
  }

  const c = codeRow as {
    id: string; code: string; amount: number; max_uses: number;
    used_count: number; status: string; expires_at: string | null; last_used_by: string | null;
  } | null;

  if (!c) return { ok: false, error: "Código não encontrado" };

  // Expiração temporal é verificada SEM escrever (não destrutiva)
  if (c.status === "revoked") return { ok: false, error: "Este código foi revogado" };
  if (c.status !== "active") return { ok: false, error: "Este código expirou" };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Este código expirou" };
  }
  if (c.used_count >= c.max_uses) {
    return { ok: false, error: "Este código já foi utilizado" };
  }

  // Um uso por utilizador (tabela opcional — existe no schema completo)
  {
    const { error: dupError } = await admin
      .from("recharge_redemptions")
      .insert({ code_id: c.id, user_id: userId, amount: c.amount });

    if (dupError && !isInfraError(dupError as { code?: string; message?: string } | null)) {
      if (dupError.code === "23505") return { ok: false, error: "Já usaste este código de recarga" };
      return { ok: false, error: "Erro ao processar a recarga" };
    }
    // Se a tabela não existir (infra), continuamos — o claim atómico abaixo
    // garante o limite de usos; para max_uses = 1 isso equivale a 1 por pessoa.

    // Dedup por last_used_by para códigos de uso único quando a tabela falta
    if (dupError && c.max_uses === 1 && c.last_used_by === userId) {
      return { ok: false, error: "Já usaste este código de recarga" };
    }
  }

  // Reserva atómica do uso: só incrementa se used_count ainda < max_uses
  const { data: reserved, error: resErr } = await admin
    .from("recharge_codes")
    .update({
      used_count: c.used_count + 1,
      used_at: new Date().toISOString(),
      last_used_by: userId,
    })
    .eq("id", c.id)
    .lt("used_count", c.max_uses)
    .eq("status", "active")
    .select("used_count, max_uses")
    .maybeSingle();

  if (resErr || !reserved) {
    // desfaz a redenção registada (se a tabela existir)
    await admin.from("recharge_redemptions").delete().eq("code_id", c.id).eq("user_id", userId);
    return { ok: false, error: resErr ? "Erro ao processar a recarga" : "Este código já foi utilizado" };
  }

  const usedCount = (reserved as { used_count: number }).used_count;
  const maxUses = (reserved as { max_uses: number }).max_uses;
  if (usedCount >= maxUses) {
    // Esgotado de verdade — agora sim, marcar expirado
    await admin.from("recharge_codes").update({ status: "expired" }).eq("id", c.id);
  }

  // Crédito de saldo atómico via RPC (com fallback de escrita)
  let newBalance: number | null = null;
  {
    const { data: balRow, error: rpcErr } = await admin
      .rpc("adjust_balance", { p_user_id: userId, p_delta: Number(c.amount), p_min: 0 });
    if (!rpcErr && balRow !== null && balRow !== undefined) {
      newBalance = Number(balRow);
    }
  }
  if (newBalance === null) {
    const { data: profile } = await admin.from("profiles").select("balance").eq("id", userId).single();
    const current = Number((profile as { balance: number } | null)?.balance ?? 0);
    newBalance = Math.round((current + Number(c.amount)) * 100) / 100;
    const { error: balErr } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (balErr) {
      // rollback do uso
      await admin.from("recharge_codes").update({ used_count: c.used_count, last_used_by: c.last_used_by ?? null }).eq("id", c.id);
      await admin.from("recharge_redemptions").delete().eq("code_id", c.id).eq("user_id", userId);
      return { ok: false, error: "Erro ao creditar saldo" };
    }
  }

  // Transacção no extrato — 'recharge' com fallback para 'deposit' se o
  // CHECK constraint da base de dados ainda não incluir 'recharge'.
  {
    const description = JSON.stringify({ code: c.code ?? cleanCode, rechargeId: c.id });
    let txErr: { code?: string; message?: string } | null = null;
    ({ error: txErr } = await admin.from("transactions").insert({
      user_id: userId, type: "recharge", amount: c.amount,
      description, status: "approved", created_at: new Date().toISOString(),
    }));
    if (txErr && (txErr.code === "23514" || /check/i.test(txErr.message ?? ""))) {
      ({ error: txErr } = await admin.from("transactions").insert({
        user_id: userId, type: "deposit", amount: c.amount,
        description: `Recarga ${cleanCode.slice(-4)}`,
        status: "approved", created_at: new Date().toISOString(),
      }));
    }
    if (txErr && !isInfraError(txErr as { code?: string; message?: string } | null)) {
      console.error("[recharge] Erro ao registar transacção:", txErr.message);
    }
  }

  return { ok: true, amount: Number(c.amount), newBalance };
}
