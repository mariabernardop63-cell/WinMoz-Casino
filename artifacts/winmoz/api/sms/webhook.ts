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

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: "Supabase não configurado no servidor" }); return;
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenRow } = await admin
    .from("platform_settings").select("value").eq("key", "sms_webhook_token").maybeSingle();
  const expectedToken = tokenRow?.value ?? null;

  if (expectedToken) {
    const authHeader = (req.headers.authorization as string) ?? "";
    const provided = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : ((req.query["token"] as string) ?? "");
    if (!provided || provided !== expectedToken) {
      res.status(401).json({ error: "Unauthorized" }); return;
    }
  }

  const { body: smsBody, sender, id: smsId } = req.body as {
    body?: string; sender?: string; id?: string;
  };
  if (!smsBody) { res.status(400).json({ error: "body required" }); return; }

  const id = smsId ?? `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const parsedAmount = extractAmount(smsBody);
  const parsedTxId = extractTxId(smsBody);

  const { error: insertError } = await admin.from("sms_logs").upsert(
    { id, body: smsBody, sender: sender ?? "unknown", parsed_amount: parsedAmount, parsed_tx_id: parsedTxId, received_at: new Date().toISOString(), used: false },
    { onConflict: "id" }
  );

  if (insertError) {
    console.error("sms_logs insert error:", insertError.message);
    res.status(500).json({ error: "Erro ao guardar SMS. Certifica-te que a tabela sms_logs existe.", detail: insertError.message }); return;
  }

  const { data: pendingList } = await admin
    .from("deposit_verifications").select("*").eq("status", "pending");

  if (pendingList && pendingList.length > 0) {
    for (const pending of pendingList) {
      const userTxId = extractTxId(pending.user_sms_body ?? "");
      const userAmount = extractAmount(pending.user_sms_body ?? "");
      const txMatch = parsedTxId && userTxId && parsedTxId === userTxId;
      const amtMatch =
        parsedAmount !== null && userAmount !== null &&
        Math.abs(parsedAmount - userAmount) < 0.5 &&
        Math.abs(parsedAmount - Number(pending.expected_amount)) < 0.5;

      if (!txMatch && !amtMatch) continue;

      await admin.from("sms_logs").update({ used: true }).eq("id", id);
      await admin.from("deposit_verifications").update({
        status: "approved", sms_log_id: id,
        resolved_tx_id: parsedTxId, verified_at: new Date().toISOString(),
      }).eq("id", pending.id);

      if (pending.mode === "deposit") {
        const { data: prof } = await admin.from("profiles").select("balance").eq("id", pending.user_id).single();
        if (prof) {
          const newBal = Math.round((Number(prof.balance ?? 0) + Number(pending.expected_amount)) * 100) / 100;
          await admin.from("profiles").update({ balance: newBal }).eq("id", pending.user_id);
          await admin.from("transactions").insert({
            user_id: pending.user_id, type: "deposit", amount: Number(pending.expected_amount),
            description: JSON.stringify({ method: "M-Pesa/e-Mola", txId: parsedTxId ?? null, note: "Depósito via SMS Forwarder" }),
            status: "approved", created_at: new Date().toISOString(),
          });
        }
      }
      break;
    }
  }

  console.log("SMS received:", { id, parsedAmount, parsedTxId, sender });
  res.json({ success: true, id, parsedAmount, parsedTxId });
}
