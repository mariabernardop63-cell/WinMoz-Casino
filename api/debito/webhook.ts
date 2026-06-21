import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    res.status(200).json({ ok: true, service: "MozBet Debito Pay Webhook", version: "3.0" });
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

  const rawBody = await readRawBody(req);

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch {
    console.error("[debito/webhook] Invalid JSON body");
    res.status(400).json({ ok: false, error: "Invalid JSON" });
    return;
  }

  // Validação HMAC-SHA256 (se DEBITO_WEBHOOK_SECRET estiver configurado)
  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  if (configuredSecret) {
    const rawSig = (req.headers["x-webhook-signature"] as string) || "";
    const incomingSig = rawSig.replace(/^(sha256=|v1=|sha1=|hmac=)/, "");
    const expectedSig = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== incomingSig) {
      console.error("[debito/webhook] HMAC mismatch. esperado:", expectedSig, "| recebido:", incomingSig);
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
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Extrair event e data — suporta {event, data} e {event, payment_id} (formatos alternativos)
  const event: string = body?.event || "unknown";
  const data = body?.data || body || {};
  const debitoPaymentId: string | null =
    data?.payment_id ||
    body?.payment_id ||
    null;

  console.log("[debito/webhook] ===PAYLOAD===", JSON.stringify({
    event,
    payment_id: debitoPaymentId,
    amount: data?.amount,
    method: data?.method,
    reference: data?.reference,
    wallet_code: data?.wallet_code,
    phone: data?.phone || data?.msisdn,
    timestamp: body?.timestamp,
  }));

  // Ignorar eventos que não são de pagamento
  if (event !== "payment.completed" && event !== "payment.failed") {
    console.log("[debito/webhook] Evento ignorado:", event);
    res.status(200).json({ ok: true });
    return;
  }

  // === ESTRATÉGIAS DE MATCHING ===
  let tx: any = null;

  // Estratégia 1: pesquisa pelo debitoPaymentId no campo description
  if (debitoPaymentId) {
    const { data: fastResults } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .like("description", `%${debitoPaymentId}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of fastResults ?? []) {
      try {
        const desc = JSON.parse((t as any).description || "{}");
        if (desc.debitoPaymentId === debitoPaymentId) {
          tx = t;
          console.log("[debito/webhook] Estratégia 1 (payment_id exact) encontrou tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }

    // Estratégia 1b: payment_id aparece em qualquer parte do description (like match)
    if (!tx && fastResults && fastResults.length > 0) {
      tx = fastResults[0];
      console.log("[debito/webhook] Estratégia 1b (payment_id like) encontrou tx:", (tx as any).id);
    }
  }

  // Estratégia 2: match por debitoReference
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

  // Estratégia 3: match por phone + amount + pending + recente (5 min)
  if (!tx) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentResults } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("status", "pending")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(30);

    const webhookAmount = data?.amount ? Number(data.amount) : null;
    const webhookPhone: string | null =
      data?.phone || data?.msisdn || data?.wallet_code || null;

    let candidates = recentResults ?? [];

    // Filtrar por montante (tolerância de 0.5 MZN)
    if (webhookAmount !== null) {
      candidates = candidates.filter(t => Math.abs(Number((t as any).amount) - webhookAmount) < 0.5);
    }

    if (candidates.length === 1) {
      tx = candidates[0];
      console.log("[debito/webhook] Estratégia 3 (amount único) encontrou tx:", (tx as any).id);
    } else if (candidates.length > 1 && webhookPhone) {
      // Desambiguar por número de telefone (guardado em description.phone como 258XXXXXXXXX)
      const cleanWebhookPhone = String(webhookPhone).replace(/\D/g, "");
      for (const t of candidates) {
        try {
          const desc = JSON.parse((t as any).description || "{}");
          const storedPhone = String(desc.phone || "").replace(/\D/g, "");
          if (storedPhone && cleanWebhookPhone && storedPhone.endsWith(cleanWebhookPhone.slice(-9))) {
            tx = t;
            console.log("[debito/webhook] Estratégia 3 (amount+phone) encontrou tx:", (t as any).id);
            break;
          }
        } catch { /* skip */ }
      }
      // Se ainda ambíguo, pega o mais recente de qualquer forma
      if (!tx && candidates.length > 0) {
        tx = candidates[0];
        console.log("[debito/webhook] Estratégia 3 (amount+mais recente) encontrou tx:", (tx as any).id);
      }
    } else if (candidates.length > 1) {
      // Sem phone — pega o mais recente
      tx = candidates[0];
      console.log("[debito/webhook] Estratégia 3 (mais recente de múltiplos) encontrou tx:", (tx as any).id);
    }
  }

  if (!tx) {
    console.error("[debito/webhook] Transação NÃO encontrada. payment_id:", debitoPaymentId, "| reference:", data?.reference, "| amount:", data?.amount);
    res.status(200).json({ ok: true });
    return;
  }

  // Idempotency — skip se já resolvido
  if ((tx as any).status === "approved" || (tx as any).status === "rejected") {
    console.log("[debito/webhook] Transação já resolvida:", (tx as any).status, "— ignorar");
    res.status(200).json({ ok: true });
    return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const paymentType: string = desc.paymentType || "deposit";
  const isCompleted = event === "payment.completed";
  const isFailed = event === "payment.failed";

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
        console.error("[debito/webhook] Erro ao creditar saldo:", balErr);
        res.status(200).json({ ok: true });
        return;
      }

      console.log(`[debito/webhook] ✓ Creditado ${(tx as any).amount} MZN ao user ${(tx as any).user_id}. Novo saldo: ${newBalance}`);
    }

    await supabase
      .from("transactions")
      .update({
        status: "approved",
        description: JSON.stringify({
          ...desc,
          debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
          completedAt: data?.paid_at || new Date().toISOString(),
          debitoEvent: event,
          debitoReference: data?.reference || desc.debitoReference,
        }),
      })
      .eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✓ Pagamento concluído para tx ${(tx as any).id}`);

  } else if (isFailed) {
    const failReason = resolveFailReason(data);

    await supabase
      .from("transactions")
      .update({
        status: "rejected",
        description: JSON.stringify({
          ...desc,
          debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
          rejectedAt: new Date().toISOString(),
          failReason,
          debitoEvent: event,
        }),
      })
      .eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✗ Pagamento falhado para tx ${(tx as any).id} — motivo: ${failReason}`);
  }

  res.status(200).json({ ok: true });
}

function resolveFailReason(data: any): string {
  const reason = String(data?.failure_reason || data?.reason || data?.message || "").toLowerCase();
  if (reason.includes("pin") || reason.includes("wrong") || reason.includes("incorrect")) {
    return "PIN incorrecto. Verifica o teu PIN e-Mola e tenta novamente.";
  }
  if (reason.includes("insufficient") || reason.includes("saldo") || reason.includes("balance")) {
    return "Saldo insuficiente na tua carteira e-Mola.";
  }
  if (reason.includes("expired") || reason.includes("timeout") || reason.includes("cancel")) {
    return "Tempo esgotado. Não confirmaste o PIN a tempo.";
  }
  return "Pagamento recusado ou expirado. Verifica o teu saldo e-Mola e tenta novamente.";
}
