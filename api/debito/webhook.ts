import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, service: "MozBet Debito Pay Webhook", version: "1.0" });
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Webhook-Secret");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[debito/webhook] Missing Supabase env vars");
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = req.body as any;
  console.log("[debito/webhook] Received event:", JSON.stringify(body));

  const event: string =
    body?.event ||
    body?.type ||
    body?.status ||
    (body?.data?.status ? `payment.${body.data.status}` : "unknown");

  const data = body?.data || body;

  const debitoPaymentId: string | null =
    data?.id ||
    data?.payment_id ||
    data?.transaction_id ||
    body?.id ||
    null;

  const reference: string | null =
    data?.external_id ||
    data?.tx_ref ||
    data?.reference ||
    body?.external_id ||
    body?.tx_ref ||
    null;

  const txIdDirect: string | null = data?.tx_ref || body?.tx_ref || null;

  console.log("[debito/webhook] event:", event, "paymentId:", debitoPaymentId, "reference:", reference, "txId:", txIdDirect);

  if (!debitoPaymentId && !reference && !txIdDirect) {
    console.error("[debito/webhook] Cannot identify payment — no id, reference, or tx_ref");
    res.status(200).json({ ok: true });
    return;
  }

  let tx: any = null;

  if (txIdDirect) {
    const { data: txByid } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("id", txIdDirect)
      .maybeSingle();
    if (txByid) tx = txByid;
  }

  if (!tx) {
    const { data: pendingTxs } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);

    for (const t of pendingTxs ?? []) {
      try {
        const desc = JSON.parse((t as any).description || "{}");
        const matchId = debitoPaymentId && desc.debitoPaymentId === debitoPaymentId;
        const matchRef = reference && desc.reference === reference;
        if (matchId || matchRef) { tx = t; break; }
      } catch { /* skip */ }
    }
  }

  if (!tx) {
    console.error("[debito/webhook] Transaction not found for event:", event, "paymentId:", debitoPaymentId, "ref:", reference);
    res.status(200).json({ ok: true });
    return;
  }

  const isCompleted =
    event === "payment.completed" ||
    event === "completed" ||
    event === "COMPLETED" ||
    data?.status === "completed" ||
    data?.status === "COMPLETED" ||
    data?.status === "success" ||
    data?.status === "SUCCESS";

  const isFailed =
    event === "payment.failed" ||
    event === "failed" ||
    event === "FAILED" ||
    event === "payment.cancelled" ||
    event === "cancelled" ||
    data?.status === "failed" ||
    data?.status === "FAILED" ||
    data?.status === "cancelled" ||
    data?.status === "CANCELLED" ||
    data?.status === "rejected" ||
    data?.status === "REJECTED" ||
    data?.status === "timeout" ||
    data?.status === "expired";

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const paymentType: string = desc.paymentType || "deposit";

  if (isCompleted) {
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
          debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
          completedAt: new Date().toISOString(),
          debitoEvent: event,
        }),
      })
      .eq("id", (tx as any).id);

  } else if (isFailed) {
    const failReason =
      data?.failure_reason ||
      data?.reason ||
      data?.message ||
      data?.description ||
      body?.reason ||
      "Pagamento não concluído";

    const userReason = parseFailReason(failReason, data?.status || event);

    await supabase
      .from("transactions")
      .update({
        status: "rejected",
        description: JSON.stringify({
          ...desc,
          debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
          rejectedAt: new Date().toISOString(),
          failReason: userReason,
          rawReason: failReason,
          debitoEvent: event,
        }),
      })
      .eq("id", (tx as any).id);

    console.log(`[debito/webhook] Payment failed tx ${(tx as any).id}: ${failReason}`);
  } else {
    console.log(`[debito/webhook] Unhandled event type: ${event} — no action taken`);
  }

  res.status(200).json({ ok: true });
}

function parseFailReason(raw: string, status: string): string {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("pin") || lower.includes("invalid pin") || lower.includes("wrong pin")) return "PIN incorrecto. O pagamento foi cancelado.";
  if (lower.includes("insufficient") || lower.includes("balance") || lower.includes("funds")) return "Saldo insuficiente na carteira móvel.";
  if (lower.includes("timeout") || lower.includes("expired") || status === "timeout" || status === "expired") return "Tempo esgotado. Não respondeste ao USSD a tempo.";
  if (lower.includes("cancelled") || lower.includes("cancel") || status === "cancelled") return "Pagamento cancelado pelo utilizador.";
  if (lower.includes("limit") || lower.includes("exceed")) return "Limite diário/mensal da carteira atingido.";
  if (lower.includes("blocked") || lower.includes("restricted")) return "A tua conta móvel está bloqueada ou restrita.";
  if (lower.includes("network") || lower.includes("unavailable")) return "Serviço e-Mola temporariamente indisponível. Tenta mais tarde.";
  return raw || "Pagamento não concluído. Tenta novamente.";
}
