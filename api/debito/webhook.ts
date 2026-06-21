import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Disable Vercel's automatic body parsing so we can read the raw body for HMAC verification
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, service: "MozBet Debito Pay Webhook", version: "2.0" });
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-webhook-signature");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") { res.status(405).end(); return; }

  // Read raw body for HMAC signature verification
  const rawBody = await readRawBody(req);

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch {
    console.error("[debito/webhook] Invalid JSON body");
    res.status(400).json({ ok: false, error: "Invalid JSON" });
    return;
  }

  // Validate HMAC-SHA256 signature — per Debito Pay docs:
  // signature is in header x-webhook-signature
  // hash = HMAC-SHA256(rawBody, webhookSecret).hex
  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  if (configuredSecret) {
    const incomingSig = (req.headers["x-webhook-signature"] as string) || "";
    const expectedSig = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== incomingSig) {
      console.error("[debito/webhook] HMAC signature mismatch — rejected");
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[debito/webhook] Missing Supabase env vars");
    res.status(200).json({ ok: true }); // always 200 to Debito Pay
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[debito/webhook] Received event:", JSON.stringify(body));

  // Per docs webhook payload:
  // { "event": "payment.completed", "data": { "payment_id": "uuid", "method": "emola", ... }, "timestamp": "..." }
  const event: string = body?.event || "unknown";
  const data = body?.data || {};

  // Per docs: payment_id is the key identifier
  const debitoPaymentId: string | null = data?.payment_id || null;

  console.log("[debito/webhook] event:", event, "payment_id:", debitoPaymentId);

  if (!debitoPaymentId) {
    console.error("[debito/webhook] No payment_id in webhook payload");
    res.status(200).json({ ok: true });
    return;
  }

  // Lookup eficiente: pesquisa pelo payment_id dentro do campo description (JSON text)
  let tx: any = null;

  const { data: fastResults } = await supabase
    .from("transactions")
    .select("id, user_id, amount, description, status")
    .like("description", `%${debitoPaymentId}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const t of fastResults ?? []) {
    try {
      const desc = JSON.parse((t as any).description || "{}");
      if (desc.debitoPaymentId === debitoPaymentId) { tx = t; break; }
    } catch { /* skip */ }
  }

  // Fallback: scan por source_id ou reference
  if (!tx && (data?.source_id || data?.reference)) {
    const { data: fallbackResults } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);

    for (const t of fallbackResults ?? []) {
      try {
        const desc = JSON.parse((t as any).description || "{}");
        if (
          desc.sourceId === data?.source_id ||
          desc.reference === data?.reference
        ) {
          tx = t;
          break;
        }
      } catch { /* skip */ }
    }
  }

  if (!tx) {
    console.error("[debito/webhook] Transaction not found for payment_id:", debitoPaymentId);
    res.status(200).json({ ok: true });
    return;
  }

  // Idempotency check — skip if already resolved
  if ((tx as any).status === "approved" || (tx as any).status === "rejected") {
    console.log("[debito/webhook] Transaction already resolved:", (tx as any).status);
    res.status(200).json({ ok: true });
    return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const paymentType: string = desc.paymentType || "deposit";

  // Per docs: "payment.completed" = paid; "payment.failed" = declined/expired
  const isCompleted = event === "payment.completed";
  const isFailed = event === "payment.failed";

  if (isCompleted) {
    // Credit user balance only for deposits
    if (paymentType === "deposit") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", (tx as any).user_id)
        .maybeSingle();

      const currentBalance = Number((profile as any)?.balance ?? 0);
      const newBalance = currentBalance + Number((tx as any).amount);

      const { error: balErr } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", (tx as any).user_id);

      if (balErr) {
        console.error("[debito/webhook] Error crediting balance:", balErr);
        res.status(200).json({ ok: true });
        return;
      }

      console.log(`[debito/webhook] Credited ${(tx as any).amount} MZN to user ${(tx as any).user_id}. New balance: ${newBalance}`);
    }

    await supabase
      .from("transactions")
      .update({
        status: "approved",
        description: JSON.stringify({
          ...desc,
          debitoPaymentId,
          completedAt: data?.paid_at || new Date().toISOString(),
          debitoEvent: event,
        }),
      })
      .eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✓ Payment completed for tx ${(tx as any).id}`);

  } else if (isFailed) {
    const userReason = parseFailReason(data?.method || "", event);

    await supabase
      .from("transactions")
      .update({
        status: "rejected",
        description: JSON.stringify({
          ...desc,
          debitoPaymentId,
          rejectedAt: new Date().toISOString(),
          failReason: userReason,
          debitoEvent: event,
        }),
      })
      .eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✗ Payment failed for tx ${(tx as any).id}`);
  } else {
    console.log(`[debito/webhook] Unhandled event: ${event} — no action taken`);
  }

  // Always respond 200 within 5s (per Debito Pay best practices)
  res.status(200).json({ ok: true });
}

function parseFailReason(method: string, event: string): string {
  if (event === "payment.failed") return "Pagamento recusado ou expirado. Verifica o teu saldo e-Mola e tenta novamente.";
  return "Pagamento não concluído. Tenta novamente.";
}
