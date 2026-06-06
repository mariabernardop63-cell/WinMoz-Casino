import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    const { error: updateError } = await admin.from("transactions").update({ status: "rejected" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }

    const withdrawalAmount = Math.abs(Number(txData.amount ?? 0));
    if (withdrawalAmount > 0 && txData.user_id) {
      const { data: profileData } = await admin.from("profiles").select("balance").eq("id", txData.user_id).single();
      if (profileData) {
        const restored = Math.round((Number(profileData.balance ?? 0) + withdrawalAmount) * 100) / 100;
        await admin.from("profiles").update({ balance: restored }).eq("id", txData.user_id);
      }
    }

    res.status(200).json({ success: true, reason: reason ?? "" });
  } catch (err) {
    console.error("Admin reject error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
