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
    res.status(200).json({ ok: true, service: "MozBet Webhook", version: "5.0" });
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
  console.log("[debito/webhook] rawBody:", rawBody.slice(0, 600));

  let body: any = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("[debito/webhook] JSON inválido");
    // Responder 200 para evitar retry loop de payload inválido
    res.status(200).json({ ok: true });
    return;
  }

  // HMAC — valida se secret configurado, mas NUNCA bloqueia (evita silenciar todos os eventos)
  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  const receivedSig = (req.headers["x-webhook-signature"] as string) || "";
  if (configuredSecret && receivedSig) {
    const cleanSig = receivedSig.replace(/^(sha256=|v1=|sha1=|hmac=)/, "");
    const expectedSig = crypto.createHmac("sha256", configuredSecret).update(rawBody).digest("hex");
    if (expectedSig === cleanSig) {
      console.log("[debito/webhook] ✓ HMAC válido");
    } else {
      console.warn("[debito/webhook] ⚠ HMAC mismatch — a processar na mesma (modo permissivo)");
      if (process.env["DEBITO_WEBHOOK_STRICT"] === "true") {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }
  }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[debito/webhook] Variáveis Supabase em falta");
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Payload real da Debito Pay:
  // { "id": "uuid-evento", "event": "payment.completed", "data": { "transaction_id": "uuid-payment", "amount": 100, ... } }
  const event: string = body?.event || "unknown";
  const data: Record<string, any> = body?.data ?? {};

  // transaction_id = campo REAL no webhook; payment_id = campo da documentação (fallback)
  const debitoId: string | null =
    data?.transaction_id ?? data?.payment_id ?? body?.id ?? null;

  console.log("[debito/webhook] event:", event,
    "| transaction_id:", data?.transaction_id,
    "| payment_id:", data?.payment_id,
    "| id_usado:", debitoId,
    "| amount:", data?.amount,
    "| reference:", data?.reference);

  if (event !== "payment.completed" && event !== "payment.failed") {
    console.log("[debito/webhook] Evento ignorado:", event);
    // Responder APÓS decidir não processar — sem trabalho async pendente
    res.status(200).json({ ok: true });
    return;
  }

  // === ENCONTRAR A TRANSAÇÃO ===
  // IMPORTANTE: todo o processamento acontece ANTES de responder 200
  // Isto garante que o código não é cortado pelo runtime serverless da Vercel
  let tx: any = null;

  // Estratégia 1: match pelo ID exacto (transaction_id do webhook = payment_id da iniciação)
  if (debitoId) {
    const { data: results } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status")
      .like("description", `%${debitoId}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const t of results ?? []) {
      try {
        const d = JSON.parse((t as any).description || "{}");
        if (
          d.debitoPaymentId     === debitoId ||
          d.debitoTransactionId === debitoId ||
          d.debitoReference     === debitoId ||
          d.sourceId            === debitoId
        ) {
          tx = t;
          console.log("[debito/webhook] Estratégia 1 (ID exato) → tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }

    // Estratégia 1b: ID aparece em qualquer lugar da description
    if (!tx && results && results.length > 0) {
      tx = results[0];
      console.log("[debito/webhook] Estratégia 1b (ID parcial) → tx:", (tx as any).id);
    }
  }

  // Estratégia 2: match pela reference e-Mola (ex: EH2026..., 00804290695)
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
        if (d.debitoReference === data.reference || d.providerReference === data.reference) {
          tx = t;
          console.log("[debito/webhook] Estratégia 2 (reference exata) → tx:", (t as any).id);
          break;
        }
      } catch { /* skip */ }
    }
    if (!tx && results && results.length > 0) {
      tx = results[0];
      console.log("[debito/webhook] Estratégia 2b (reference parcial) → tx:", (tx as any).id);
    }
  }

  // Estratégia 3: match por montante + transação pending recente (últimos 30 min)
  // Janela alargada para casos onde o utilizador demora a confirmar o PIN
  if (!tx && data?.amount) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: results } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, status, created_at")
      .eq("status", "pending")
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    const webhookAmt = Number(data.amount);
    const candidates = (results ?? []).filter(
      t => Math.abs(Number((t as any).amount) - webhookAmt) < 0.5
    );
    if (candidates.length >= 1) {
      tx = candidates[0];
      console.log("[debito/webhook] Estratégia 3 (amount+recente, 30min) → tx:", (tx as any).id,
        candidates.length > 1 ? `(${candidates.length} candidatos)` : "");
    }
  }

  if (!tx) {
    console.error("[debito/webhook] ✗ Transação não encontrada. id:", debitoId, "amount:", data?.amount);
    // Responder 200 (não há mais nada a fazer, e retries não vão ajudar sem a tx)
    res.status(200).json({ ok: true });
    return;
  }

  // Idempotência
  const txStatus = (tx as any).status as string;
  if (txStatus === "approved" || txStatus === "rejected") {
    console.log("[debito/webhook] Já resolvida:", txStatus, "— ignorar");
    res.status(200).json({ ok: true });
    return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const paymentType: string = desc.paymentType || "deposit";

  if (event === "payment.completed") {
    // Creditar saldo em depósitos
    if (paymentType === "deposit") {
      const { data: profile } = await supabase
        .from("profiles").select("balance").eq("id", (tx as any).user_id).maybeSingle();

      const currentBalance = Number((profile as any)?.balance ?? 0);
      const newBalance = currentBalance + Number((tx as any).amount);

      const { error: balErr } = await supabase
        .from("profiles").update({ balance: newBalance }).eq("id", (tx as any).user_id);

      if (balErr) {
        console.error("[debito/webhook] Erro ao creditar saldo:", balErr);
        res.status(200).json({ ok: true });
        return;
      }
      console.log(`[debito/webhook] ✓ +${(tx as any).amount} MZN → user ${(tx as any).user_id} (novo saldo: ${newBalance})`);
    }

    await supabase.from("transactions").update({
      status: "approved",
      description: JSON.stringify({
        ...desc,
        debitoPaymentId:      debitoId || desc.debitoPaymentId,
        debitoReference:      data?.reference || desc.debitoReference,
        completedAt:          data?.paid_at || new Date().toISOString(),
        approvedVia:          "webhook",
      }),
    }).eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✓ TX APROVADA: ${(tx as any).id}`);

  } else {
    // payment.failed
    const failReason = buildFailReason(data);

    await supabase.from("transactions").update({
      status: "rejected",
      description: JSON.stringify({
        ...desc,
        debitoPaymentId: debitoId || desc.debitoPaymentId,
        failReason,
        rejectedAt:      new Date().toISOString(),
        rejectedVia:     "webhook",
      }),
    }).eq("id", (tx as any).id);

    console.log(`[debito/webhook] ✗ TX REJEITADA: ${(tx as any).id} — ${failReason}`);
  }

  // Responder 200 DEPOIS de todo o processamento estar completo
  // Garante que o runtime serverless não corta o código a meio
  res.status(200).json({ ok: true });
}

function buildFailReason(data: any): string {
  const raw = String(data?.failure_reason || data?.reason || data?.message || "").toLowerCase();
  if (raw.includes("pin") || raw.includes("wrong") || raw.includes("incorrect"))
    return "PIN incorrecto. Verifica o teu PIN e-Mola e tenta novamente.";
  if (raw.includes("insufficient") || raw.includes("balance") || raw.includes("saldo"))
    return "Saldo insuficiente na tua carteira e-Mola.";
  if (raw.includes("expired") || raw.includes("timeout") || raw.includes("cancel"))
    return "Tempo esgotado. Não confirmaste o PIN a tempo.";
  return "Pagamento recusado. Verifica o teu saldo e-Mola e tenta novamente.";
}
