import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { id, action } = req.body as { id?: string; action?: "approve" | "reject" };
  if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action deve ser 'approve' ou 'reject'" }); return;
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: txData, error: txErr } = await admin
      .from("transactions")
      .select("id, amount, user_id, type, status")
      .eq("id", id)
      .single();

    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const tx = txData as { id: string; amount: number; user_id: string; type: string; status: string };
    if (tx.status !== "pending") {
      res.status(400).json({ error: "Pedido já processado" }); return;
    }

    if (action === "approve") {
      if (tx.type === "manual_deposit" || tx.type === "manual_bet" || tx.type === "deposit") {
        const { data: profile } = await admin
          .from("profiles")
          .select("balance")
          .eq("id", tx.user_id)
          .single();

        const current = Number((profile as { balance: number } | null)?.balance ?? 0);
        const newBalance = Math.round((current + Number(tx.amount)) * 100) / 100;

        const { error: balErr } = await admin
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", tx.user_id);

        if (balErr) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }
      }

      const { error: upErr } = await admin
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", id);
      if (upErr) { res.status(500).json({ error: "Erro ao aprovar" }); return; }
    } else {
      const { error: upErr } = await admin
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", id);
      if (upErr) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}
