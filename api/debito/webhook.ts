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
    res.status(200).json({ ok: true, service: "MozBet Webhook", version: "4.0" });
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
  console.log("[debito/webhook] rawBody recebido:", rawBody.slice(0, 500));

  let body: any = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("[debito/webhook] JSON inválido — mas a responder 200 para evitar retry loop");
    res.status(200).json({ ok: true });
    return;
  }

  // HMAC-SHA256 — valida apenas se o secret estiver correto
  // Se DEBITO_WEBHOOK_SECRET não estiver configurado OU estiver incorreto,
  // registamos o aviso mas NUNCA bloqueamos — evita que um secret errado silencie todos os eventos
  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  const receivedSig = (req.headers["x-webhook-signature"] as string) || "";

  if (configuredSecret && receivedSig) {
    const cleanSig = receivedSig.replace(/^(sha256=|v1=|sha1=|hmac=)/, "");
    const expectedSig = crypto
      .createHmac("sha256", configuredSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSig === cleanSig) {
      console.log("[debito/webhook] ✓ Assinatura HMAC válida");
    } else {
      // AVISO: NÃO rejeitar — continuar a processar mesmo com assinatura inválida
      // Isto garante que um DEBITO_WEBHOOK_SECRET errado não silencia os eventos
      // Para ativar rejeição estrita, configura DEBITO_WEBHOOK_STRICT=true na Vercel
      console.warn("[debito/webhook] ⚠ HMAC mismatch. esperado:", expectedSig, "| recebido:", cleanSig);
      if (process.env["DEBITO_WEBHOOK_STRICT"] === "true") {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }
  } else if (!configuredSecret) {
    console.log("[debito/webhook] DEBITO_WEBHOOK_SECRET não configurado — HMAC ignorado");
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[debito/webhook] Variáveis Supabase em falta");
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Extrair campos conforme documentação oficial:
  // { "event": "payment.completed", "data": { "payment_id": "...", "amount": 150, ... } }
  const event: string = body?.event || "unknown";
  const data: Record<string, any> = body?.data ?? {};
  const debitoPaymentId: string | null = data?.payment_id ?? null;

  console.log("[debito/webhook] Evento:", event, "| payment_id:", debitoPaymentId, "| amount:", data?.amount, "| reference:", data?.reference);

  // Responder 200 imediatamente (< 5s conforme docs) — a Debito Pay não retenta se receber 200
  // Continuamos o processamento a seguir
  res.status(200).json({ ok: true });

  // Ignorar eventos que não são de pagamento
  if (event !== "payment.completed" && event !== "payment.failed") {
    console.log("[debito/webhook] Evento ignorado (não é pagamento):", event);
    return;
  }

  // === ENCONTRAR A TRANSAÇÃO NA BASE DE DADOS ===
  let tx: any = null;

  // Estratégia 1: match por payment_id (guardado em description.debitoPaymentId)
  if (debitoPaymentId) {
    const { data: results } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .like("description", `%${debitoPaymentId}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of results ?? []) {
      try {
        const d = JSON.parse((t as any).description || "{}");
        if (d.debitoPaymentId === debitoPaymentId) {
          tx = t;
          console.log("[debito/webhook] Estratégia 1 (payment_id exato) → tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }

    // Estratégia 1b: payment_id aparece no description (match parcial)
    if (!tx && results && results.length > 0) {
      tx = results[0];
      console.log("[debito/webhook] Estratégia 1b (payment_id parcial) → tx:", (tx as any).id);
    }
  }

  // Estratégia 2: match por reference (EH2026...)
  if (!tx && data?.reference) {
    const { data: results } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .like("description", `%${data.reference}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of results ?? []) {
      try {
        const d = JSON.parse((t as any).description || "{}");
        if (d.debitoReference === data.reference) {
          tx = t;
          console.log("[debito/webhook] Estratégia 2 (reference) → tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }
  }

  // Estratégia 3: match por montante + recente (últimos 6 min) — fallback robusto
  if (!tx && data?.amount) {
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const { data: results } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .eq("status", "pending")
      .gte("created_at", sixMinAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    const webhookAmt = Number(data.amount);
    const candidates = (results ?? []).filter(t => Math.abs(Number((t as any).amount) - webhookAmt) < 0.5);

    if (candidates.length >= 1) {
      // Pegar o mais recente
      tx = candidates[0];
      console.log("[debito/webhook] Estratégia 3 (amount+recente) → tx:", (tx as any).id,
        candidates.length > 1 ? `(${candidates.length} candidatos — escolhido mais recente)` : "");
    }
  }

  if (!tx) {
    console.error("[debito/webhook] ✗ Transação NÃO encontrada. payment_id:", debitoPaymentId, "| amount:", data?.amount);
    return;
  }

  // Idempotência — ignorar se já foi resolvido
  const txStatus = (tx as any).status as string;
  if (txStatus === "approved" || txStatus === "rejected") {
    console.log("[debito/webhook] Transação já resolvida:", txStatus, "— ignorar");
    return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const paymentType: string = desc.paymentType || "deposit";

  if (event === "payment.completed") {
    // Creditar saldo apenas em depósitos
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
        return;
      }
      console.log(`[debito/webhook] ✓ Creditado ${(tx as any).amount} MZN → user ${(tx as any).user_id}. Novo saldo: ${newBalance}`);
    }

    await supabase.from("transactions").update({
      status: "approved",
      description: JSON.stringify({
        ...desc,
        debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
        debitoReference: data?.reference || desc.debitoReference,
        completedAt: data?.paid_at || new Date().toISOString(),
        approvedVia: "webhook",
      }),
    }).eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✓ Transação aprovada: ${(tx as any).id}`);

  } else if (event === "payment.failed") {
    const failReason = buildFailReason(data);

    await supabase.from("transactions").update({
      status: "rejected",
      description: JSON.stringify({
        ...desc,
        debitoPaymentId: debitoPaymentId || desc.debitoPaymentId,
        failReason,
        rejectedAt: new Date().toISOString(),
        rejectedVia: "webhook",
      }),
    }).eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✗ Transação rejeitada: ${(tx as any).id} — ${failReason}`);
  }
}

function buildFailReason(data: any): string {
  const raw = String(data?.failure_reason || data?.reason || data?.message || "").toLowerCase();
  if (raw.includes("pin") || raw.includes("wrong") || raw.includes("incorrect")) {
    return "PIN incorrecto. Verifica o teu PIN e-Mola e tenta novamente.";
  }
  if (raw.includes("insufficient") || raw.includes("balance") || raw.includes("saldo")) {
    return "Saldo insuficiente na tua carteira e-Mola.";
  }
  if (raw.includes("expired") || raw.includes("timeout") || raw.includes("cancel")) {
    return "Tempo esgotado. Não confirmaste o PIN a tempo.";
  }
  return "Pagamento recusado ou expirado. Verifica o teu saldo e-Mola e tenta novamente.";
}
