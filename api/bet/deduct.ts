import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

/* ─── /api/bet/deduct ──────────────────────────────────────────────────────────
   Dedução atómica de saldo (usada pelo sistema de salas do Explorar).
   - adjust_balance RPC: incremento atómico em SQL — elimina double-spend e
     a perda de créditos que aterram entre a leitura e a escrita.
   - O cliente nunca escreve em profiles.balance directamente (RLS).
   ────────────────────────────────────────────────────────────────────────────── */

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, description } = (req.body ?? {}) as { amount?: number; description?: string };

  if (!amount || typeof amount !== "number" || !Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    res.status(400).json({ error: "Montante inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

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
