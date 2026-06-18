import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = (req.body ?? {}) as { id?: string };
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    "";
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: "Serviço indisponível" }); return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    const { error: updateError } = await admin
      .from("transactions").update({ status: "approved" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao aprovar" }); return; }

    res.json({ success: true });
  } catch (err) {
    console.error("Admin approve withdrawal error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
