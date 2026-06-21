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

  // Validate HMAC-SHA256 signature (se DEBITO_WEBHOOK_SECRET estiver configurado)
  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  if (configuredSecret) {
    const rawSig = (req.headers["x-webhook-signature"] as string) || "";
    // Alguns gateways prefixam a assinatura com "sha256=", "v1=", etc.
    const incomingSig = rawSig.replace(/^(sha256=|v1=|sha1=|hmac=)/, "");
    const expectedSig = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== incomingSig) {
      // Log detalhado para diagnóstico — ver nos logs do Vercel
      console.error("[debito/webhook] HMAC mismatch. esperado:", expectedSig, "| recebido:", incomingSig, "| header raw:", rawSig);
      // AVISO: para desativar esta validação enquanto não tens o secret correto,
      // apaga a variável DEBITO_WEBHOOK_SECRET no Vercel.
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
    console.log("[debito/webhook] Assinatura HMAC válida ✓");
  } else {
    console.log("[debito/webhook] Sem DEBITO_WEBHOOK_SECRET — validação HMAC ignorada");
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

  // Estratégia 2: match por debitoReference (guardado na iniciação, se DebitoPay o retornar)
  if (!tx && data?.reference) {
    const { data: refResults } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .like("description", `%${data.reference}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of refResults ?? []) {
      try {
        const desc = JSON.parse((t as any).description || "{}");
        if (desc.debitoReference === data.reference) {
          tx = t;
          console.log("[debito/webhook] Estratégia 2 (debitoReference) encontrou tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }
  }

  // Estratégia 3 (último recurso): montante + pending + recente (últimos 3 min)
  // Só usa se houver exatamente UMA transação pendente com este montante (evita ambiguidade)
  if (!tx && data?.amount) {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: recentResults } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("status", "pending")
      .gte("created_at", threeMinAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    const webhookAmount = Number(data.amount);
    const matching = (recentResults ?? []).filter(t => Math.abs(Number((t as any).amount) - webhookAmount) < 0.5);

    if (matching.length === 1) {
      tx = matching[0];
      console.log("[debito/webhook] Estratégia 3 (amount+recente único) encontrou tx:", (tx as any).id);
    } else if (matching.length > 1) {
      console.warn("[debito/webhook] Estratégia 3: múltiplos matches ambíguos — a ignorar");
    }
  }

  if (!tx) {
    console.error("[debito/webhook] Transação não encontrada para payment_id:", debitoPaymentId, "| reference:", data?.reference, "| amount:", data?.amount);
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
