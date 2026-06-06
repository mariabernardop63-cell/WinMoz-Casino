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

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { amount, txId } = req.body as { amount?: number; txId?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

    // Guard against double-credit
    if (txId) {
      const { data: existing } = await admin
        .from("transactions").select("id")
        .eq("user_id", userId).eq("type", "deposit")
        .ilike("description", `%${txId}%`).limit(1);
      if (existing && existing.length > 0) {
        res.json({ success: true, message: "already_credited" }); return;
      }
    }

    const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
    if (!prof) { res.status(500).json({ error: "Perfil não encontrado" }); return; }

    const newBal = Math.round((Number(prof.balance ?? 0) + amount) * 100) / 100;
    const { error: balErr } = await admin.from("profiles").update({ balance: newBal }).eq("id", userId);
    if (balErr) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }

    await admin.from("transactions").insert({
      user_id: userId, type: "deposit", amount,
      description: JSON.stringify({ method: "M-Pesa/e-Mola", txId: txId ?? null, note: "Crédito por aposta não encontrada" }),
      status: "approved", created_at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Deposit credit error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
