import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

/* ─── /api/bet — função consolidada (limite de serverless functions) ──────────
   Rotas (vercel.json reescreve /api/bet/:action → /api/bet?_action=…):
     ?_action=deduct  (POST)  dedução atómica de saldo (salas do Explorar)
     ?_action=refund  (POST)  reembolso atómico idempotente
   ───────────────────────────────────────────────────────────────────────────── */

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

async function handleDeduct(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, description } = (req.body ?? {}) as { amount?: number; description?: string };

  if (!amount || typeof amount !== "number" || !Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    res.status(400).json({ error: "Montante inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // SECURITY: dedução ATÓMICA via RPC — incrementa no SQL, elimina double-spend
  // e a perda de créditos que aterram entre a leitura e a escrita.
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -amount, p_min: 0 });

  if (adjustError) {
    console.error("[bet/deduct] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);

  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" });
    return;
  }

  const txDesc = (description || "Aposta").slice(0, 160);

  const { error: txError } = await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(amount),
    description: txDesc,
    status: "approved",
    created_at: new Date().toISOString(),
  });
  if (txError) console.error("[bet/deduct] Erro ao registar transacção:", txError);

  res.json({ ok: true, newBalance });
}

async function handleRefund(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, description, refId } = (req.body ?? {}) as {
    amount?: number; description?: string; refId?: string;
  };

  if (!amount || typeof amount !== "number" || !Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    res.status(400).json({ error: "Montante inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // Idempotência: mesmo refId → só credita uma vez (protege duplo-clique e
  // corrida entre o botão cancelar e o temporizador de expiração).
  if (refId && typeof refId === "string" && refId.length <= 80) {
    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("type", "win")
      .eq("description", `Reembolso ${refId}`)
      .limit(1);

    if (existing && existing.length > 0) {
      res.json({ ok: true, alreadyRefunded: true });
      return;
    }
  }

  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: amount, p_min: 0 });

  if (adjustError) {
    console.error("[bet/refund] Erro ao creditar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao creditar reembolso" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);

  if (newBalance === null) {
    res.status(400).json({ error: "Não foi possível creditar o reembolso" });
    return;
  }

  const txDesc = refId
    ? `Reembolso ${refId}`
    : `Reembolso ${(description || "").slice(0, 120)}`;

  const { error: txError } = await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "win",
    amount: Math.abs(amount),
    description: txDesc.slice(0, 160),
    status: "approved",
    created_at: new Date().toISOString(),
  });
  if (txError) console.error("[bet/refund] Erro ao registar transacção:", txError);

  res.json({ ok: true, newBalance });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "deduct": return handleDeduct(req, res);
    case "refund": return handleRefund(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
