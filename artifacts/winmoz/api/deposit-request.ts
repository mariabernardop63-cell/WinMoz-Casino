import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) { res.status(500).json({ error: "Missing env" }); return; }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !user) { res.status(401).json({ error: "Invalid token" }); return; }

  const { amount, confirmationMsg } = req.body ?? {};
  if (!amount || !confirmationMsg || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();

  const { error: insertError } = await admin.from("transactions").insert({
    user_id: user.id,
    type: "manual_deposit",
    amount,
    status: "pending",
    description: JSON.stringify({
      confirmationMsg,
      amount,
      userName: profile?.full_name ?? profile?.email ?? "Utilizador",
      phone: "",
      mode: "deposit",
    }),
  });

  if (insertError) {
    res.status(500).json({ error: "Erro ao criar pedido: " + insertError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
