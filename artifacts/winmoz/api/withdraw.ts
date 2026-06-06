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

    const { amount, phone } = req.body as { amount?: number; phone?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

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

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance, full_name, phone").eq("id", userId).single();
    if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter perfil" }); return; }

    const currentBalance = parseFloat(String(profileData.balance ?? "0"));
    if (currentBalance < amount) { res.status(400).json({ error: "Saldo insuficiente" }); return; }

    const newBalance = Math.round((currentBalance - amount) * 100) / 100;
    const { error: balanceError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (balanceError) { res.status(500).json({ error: "Erro ao debitar saldo" }); return; }

    const withdrawalPhone = phone ?? profileData.phone ?? null;
    const withdrawalMeta = JSON.stringify({
      method: "M-Pesa", phone: withdrawalPhone,
      userName: profileData.full_name ?? "utilizador",
    });

    const { data: txRow, error: txError } = await admin
      .from("transactions").insert({
        user_id: userId, type: "withdrawal", amount: -amount,
        description: withdrawalMeta, status: "pending", created_at: new Date().toISOString(),
      }).select("id").single();

    if (txError) {
      await admin.from("profiles").update({ balance: currentBalance }).eq("id", userId);
      res.status(500).json({ error: "Erro ao registar levantamento" }); return;
    }

    res.status(200).json({ success: true, withdrawalId: txRow.id, newBalance });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
