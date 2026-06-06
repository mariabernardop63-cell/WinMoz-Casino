import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function extractAmount(body: string): number | null {
  const patterns = [
    /(\d[\d\s]*(?:[.,]\d{1,2})?)\s*MT\b/i,
    /(\d[\d\s]*(?:[.,]\d{1,2})?)\s*MZN\b/i,
    /enviou\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i,
    /recebeu\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i,
    /de\s+(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:MT|MZN)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) {
      const raw = m[1].replace(/\s/g, "").replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractTxId(body: string): string | null {
  const patterns = [
    /ID\s+trans\.?\s*([A-Z0-9]{4,})/i,
    /ID\s+de\s+transac[aã]o[:\s]+([A-Z0-9]{4,})/i,
    /\bID[:\s]+([A-Z0-9]{6,})/i,
    /Ref\.?[:\s]+([A-Z0-9]{6,})/i,
    /Transaction\s+ID[:\s]+([A-Z0-9]{6,})/i,
    /\b([A-Z][A-Z0-9]{7,15})\b/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

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

    const { smsText, expectedAmount, mode } = req.body as {
      smsText?: string; expectedAmount?: number; mode?: "deposit" | "bet";
    };
    if (!smsText || !expectedAmount || expectedAmount <= 0) {
      res.status(400).json({ error: "Dados inválidos" }); return;
    }
    const depositMode: "deposit" | "bet" = mode ?? "deposit";

    const userTxId = extractTxId(smsText);
    const userAmount = extractAmount(smsText);

    // Look for matching SMS in sms_logs (not used, received in last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: smsLogs } = await admin
      .from("sms_logs")
      .select("*")
      .eq("used", false)
      .gte("received_at", fiveMinAgo);

    let matchedSms: { id: string; parsed_amount: number | null; parsed_tx_id: string | null } | null = null;

    if (smsLogs) {
      for (const sms of smsLogs) {
        const txMatch = userTxId && sms.parsed_tx_id && userTxId === sms.parsed_tx_id;
        const amtMatch =
          userAmount !== null && sms.parsed_amount !== null &&
          Math.abs(Number(sms.parsed_amount) - userAmount) < 0.5 &&
          Math.abs(userAmount - expectedAmount) < 0.5;
        if (txMatch || amtMatch) { matchedSms = sms; break; }
      }
    }

    if (matchedSms) {
      await admin.from("sms_logs").update({ used: true }).eq("id", matchedSms.id);

      if (depositMode === "deposit") {
        const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
        if (prof) {
          const newBal = Math.round((Number(prof.balance ?? 0) + expectedAmount) * 100) / 100;
          await admin.from("profiles").update({ balance: newBal }).eq("id", userId);
          await admin.from("transactions").insert({
            user_id: userId, type: "deposit", amount: expectedAmount,
            description: JSON.stringify({ method: "M-Pesa/e-Mola", txId: matchedSms.parsed_tx_id ?? null, note: "Depósito via SMS Forwarder" }),
            status: "approved", created_at: new Date().toISOString(),
          });
        }
      }

      res.json({ status: "approved", amount: expectedAmount, txId: matchedSms.parsed_tx_id ?? null });
      return;
    }

    // No match yet — create pending verification
    const pendingId = `pv_${userId.slice(0, 8)}_${Date.now()}`;
    await admin.from("deposit_verifications").insert({
      id: pendingId, user_id: userId, user_sms_body: smsText,
      expected_amount: expectedAmount, mode: depositMode,
      status: "pending", submitted_at: new Date().toISOString(),
    });

    res.json({ status: "pending", pendingId });
  } catch (err) {
    console.error("Deposit verify error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
