import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  try {
    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }

    const admin = getSupabaseAdmin();

    const { data: txData, error: txErr } = await admin
      .from("transactions")
      .select("id, status")
      .eq("id", id)
      .single();

    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if ((txData as { status: string }).status !== "pending") {
      res.status(400).json({ error: "Pedido já processado" }); return;
    }

    const { error: upErr } = await admin
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", id);

    if (upErr) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}
