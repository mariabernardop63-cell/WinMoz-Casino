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

    const { code } = req.body as { code?: string };
    if (!code || code.length !== 15) { res.status(400).json({ error: "Código inválido" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { data: codeRow, error: codeError } = await admin
      .from("recharge_codes").select("id, amount, used, used_by").eq("code", code).single();
    if (codeError || !codeRow) { res.status(400).json({ error: "Código inválido ou não encontrado" }); return; }
    if (codeRow.used) { res.status(400).json({ error: "Código já utilizado" }); return; }

    const amount = Number(codeRow.amount);
    if (!amount || amount <= 0) { res.status(400).json({ error: "Código sem valor associado" }); return; }

    const { error: markError } = await admin
      .from("recharge_codes")
      .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
      .eq("id", codeRow.id);
    if (markError) { res.status(500).json({ error: "Erro ao processar recarga" }); return; }

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance").eq("id", userId).single();
    if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter saldo" }); return; }

    const newBalance = Number(profileData.balance ?? 0) + amount;
    const { error: balanceError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (balanceError) { res.status(500).json({ error: "Erro ao actualizar saldo" }); return; }

    await admin.from("transactions").insert({
      user_id: userId, type: "recharge", amount,
      description: "Recarga de saldo", created_at: new Date().toISOString(),
    });

    res.status(200).json({ success: true, amount });
  } catch (err) {
    console.error("Recharge error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
