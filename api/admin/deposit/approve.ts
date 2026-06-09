import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const authHeader = (req.headers.authorization as string) ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { data: txData, error: txErr } = await admin
      .from("transactions")
      .select("id, amount, user_id, type, status")
      .eq("id", id)
      .single();

    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if ((txData as any).status !== "pending") {
      res.status(400).json({ error: "Pedido já processado" }); return;
    }

    if ((txData as any).type === "manual_deposit") {
      const { data: profile } = await admin
        .from("profiles")
        .select("balance")
        .eq("id", (txData as any).user_id)
        .single();

      const current = Number((profile as any)?.balance ?? 0);
      const newBalance = Math.round((current + Number((txData as any).amount)) * 100) / 100;

      const { error: balErr } = await admin
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", (txData as any).user_id);

      if (balErr) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }
    }

    const { error: upErr } = await admin
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", id);

    if (upErr) { res.status(500).json({ error: "Erro ao aprovar" }); return; }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Admin deposit approve error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
