import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

/* ─── /api/bet/refund ──────────────────────────────────────────────────────────
   Reembolso atómico de saldo (usado pelo sistema de salas do Explorar quando
   o criador cancela a sala ou o tempo de espera expira).
   - adjust_balance RPC: crédito atómico — nunca perde créditos concorrentes
     (depósitos/levanta-mentos aterra entre a leitura e a escrita).
   - Idempotência por referência: o cliente envia refId; se já existir uma
     transacção de reembolso com a mesma referência, devolve ok sem creditar.
   ────────────────────────────────────────────────────────────────────────────── */

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

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
