import { Router, type IRouter } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
// @ts-expect-error — ws não tem declarações neste projeto (padrão já usado em routes/index.ts)
import ws from "ws";
import { withUserLock } from "../lib/userLock";

/* ── Debito Pay gateway — port of Vercel api/debito.ts for the Express server ──
   Rotas:
     POST /api/debito/initiate      (JWT obrigatório)
     POST /api/debito/check-status  (JWT obrigatório, dono da transacção)
     POST /api/debito/webhook       (HMAC x-webhook-signature)
     GET  /api/debito/webhook       (healthcheck do webhook)
*/

const DEBITO_ORCHESTRATOR_URL =
  process.env["DEBITO_API_BASE_URL"] ||
  "https://gyqoaningqhurhvdugne.supabase.co/functions/v1/payment-orchestrator";

function getSupabaseAdmin(): any | null {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as any },
  });
}

async function verifyUser(token: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id ?? null;
}

function parseDebitoError(data: any, status: number, paymentMethod: string): string {
  const msg: string = data?.message || data?.error || data?.detail || "";
  const low = msg.toLowerCase();
  /* Mínimos reais medidos no gateway: e-Mola 50 MZN, M-Pesa 10 MZN */
  const minLabel = paymentMethod === "mpesa" ? "10 MZN" : "50 MZN";
  if (status === 401) return "Chave API inválida — contacta o suporte.";
  if (status === 403) return "Domínio não autorizado no gateway de pagamento. Contacta o suporte.";
  if (status === 404) return "Configuração do gateway inválida (wallet_code). Contacta o suporte.";
  if (status === 408) return paymentMethod === "mpesa" ? "O utilizador não confirmou o PIN M-Pesa a tempo. Abre o menu *150# e confirma o pagamento pendente." : "O utilizador não confirmou o PIN e-Mola a tempo. Abre o menu *898# e confirma o pagamento pendente.";
  if (status === 429) return "Demasiados pedidos ao gateway. Aguarda alguns segundos e tenta novamente.";
  if (status === 400) {
    if (low.includes("authentication") || low.includes("auth")) return paymentMethod === "mpesa" ? "Serviço M-Pesa temporariamente indisponível. Usa e-Mola ou tenta mais tarde." : "Erro de autenticação no gateway. Contacta o suporte.";
    if (low.includes("phone") || low.includes("msisdn") || low.includes("mobile")) return "Número de telefone inválido para este operador.";
    if (low.includes("abaixo do mínimo") || low.includes("amount") || low.includes("minimum") || low.includes("mínimo") || low.includes("minimo")) return `Montante abaixo do mínimo permitido (${minLabel}). Introduz um valor igual ou superior.`;
    if (low.includes("payment_method") || low.includes("unsupported")) return "Método de pagamento não suportado de momento.";
    if (low.includes("wallet_code") || low.includes("wallet")) return "Código de carteira inválido. Contacta o suporte.";
    if (low.includes("required")) return "Dados em falta no pedido. Contacta o suporte.";
    if (low.includes("timeout") || low.includes("time out")) return "Tempo esgotado — o utilizador não confirmou o PIN a tempo.";
    if (low.includes("recusado pelo operador") || low.includes("rejected by operator")) {
      if (paymentMethod === "mpesa") {
        return "Pagamento recusado pelo operador. Confirma que tens saldo suficiente na tua carteira M-Pesa e que o número está correcto. Se o problema persistir, contacta o suporte.";
      }
      /* e-Mola: o operador está a recusar a CRIAÇÃO do pagamento (antes do USSD)
         — tipicamente wallet do merchant inactiva ou indisponível no gateway */
      return "O pagamento e-Mola não pôde ser iniciado neste momento (recusado pelo operador). Verifica que a tua carteira e-Mola está activa e com saldo. Se o problema persistir, usa M-Pesa ou contacta o suporte — estamos a resolver com o operador.";
    }
    return msg ? `Erro do gateway: ${msg}` : "Pedido rejeitado pelo gateway. Tenta novamente.";
  }
  if (status >= 500) return "Erro temporário do gateway de pagamento. Tenta novamente mais tarde.";
  return msg ? `Erro do gateway: ${msg}` : "Erro ao iniciar pagamento. Tenta novamente.";
}

function buildFailReason(data: any, paymentMethod = "emola"): string {
  const raw = String(data?.failure_reason || data?.reason || data?.message || "").toLowerCase();
  const label = paymentMethod === "mpesa" ? "M-Pesa" : "e-Mola";
  if (raw.includes("pin") || raw.includes("wrong") || raw.includes("incorrect")) return `PIN incorrecto. Verifica o teu PIN ${label} e tenta novamente.`;
  if (raw.includes("insufficient") || raw.includes("balance") || raw.includes("saldo")) return `Saldo insuficiente na tua carteira ${label}.`;
  if (raw.includes("expired") || raw.includes("timeout") || raw.includes("cancel")) return "Tempo esgotado. Não confirmaste o PIN a tempo.";
  if (raw.includes("authentication") || raw.includes("auth")) return `Serviço ${label} temporariamente indisponível. Tenta novamente mais tarde.`;
  return `Pagamento recusado. Verifica o teu saldo ${label} e tenta novamente.`;
}

/* ── initiate ── */
async function handleInitiate(req: any, res: any) {
  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Não autenticado" }); return; }

  const body = req.body ?? {};
  const amount: number = Number(body.amount);
  const phoneRaw: string = String(body.phone ?? "");
  const paymentMethod: string = String(body.provider ?? "emola");
  const type: string = String(body.type ?? "deposit");

  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: `Montante inválido (recebido: ${body.amount})` }); return;
  }
  if (!phoneRaw || phoneRaw.replace(/\D/g, "").length < 9) {
    res.status(400).json({ error: "Número de telefone inválido" }); return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) { res.status(503).json({ error: "Serviço de base de dados indisponível" }); return; }

  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];

  const userId = await verifyUser(token);
  if (!userId) { res.status(401).json({ error: "Sessão inválida. Faz login novamente." }); return; }

  const { data: settingsRows } = await supabase
    .from("platform_settings").select("key, value")
    .in("key", ["debito_api_base_url", "debito_public_id", "debito_wallet_code", "debito_mpesa_wallet_code", "mpesa_wallet_enabled", "emola_wallet_enabled"]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) settings[(row as any).key] = (row as any).value;

  /* Carteira desactivada pelo admin → recusar antes de tocar no gateway */
  const walletEnabled = paymentMethod === "mpesa"
    ? (settings["mpesa_wallet_enabled"] !== "false")
    : (settings["emola_wallet_enabled"] !== "false");
  if (!walletEnabled) {
    const label = paymentMethod === "mpesa" ? "M-Pesa" : "e-Mola";
    res.status(403).json({ error: `A carteira ${label} está temporariamente indisponível. Tenta outra carteira ou contacta o suporte.` });
    return;
  }

  if (!debitoApiKey) { res.status(503).json({ error: "Gateway de pagamento não configurado. Contacta o suporte." }); return; }

  const debitoBaseUrl = (settings["debito_api_base_url"] || DEBITO_ORCHESTRATOR_URL).replace(/\/payment-orchestrator$/, "").replace(/\/$/, "");
  const merchantId = (settings["debito_public_id"] || process.env["DEBITO_MERCHANT_ID"] || "1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c").trim();
  const walletCode = paymentMethod === "mpesa"
    ? (settings["debito_mpesa_wallet_code"] || process.env["DEBITO_MPESA_WALLET_CODE"] || "58335").trim()
    : (settings["debito_wallet_code"] || process.env["DEBITO_WALLET_CODE"] || "55291").trim();

  if (walletCode.length > 10 || !/^\d+$/.test(walletCode)) {
    res.status(503).json({ error: "Configuração do gateway inválida (wallet_code). Contacta o suporte." }); return;
  }

  const cleanPhone = phoneRaw.replace(/\D/g, "").replace(/^258/, "");
  const fullPhone = `258${cleanPhone}`;
  const sourceId = `MOZBET-${type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  let customerName = "Cliente WinMoz";
  try {
    const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    if ((profileData as any)?.full_name) customerName = (profileData as any).full_name;
  } catch { /* best-effort */ }

  const { data: txRow, error: txError } = await supabase
    .from("transactions").insert({
      user_id: userId,
      type: type === "deposit" ? "deposit" : "manual_bet",
      amount, status: "pending",
      description: JSON.stringify({
        paymentMethod, phone: fullPhone, sourceId,
        debitoPaymentId: null, debitoTransactionId: null, debitoReference: null,
        paymentType: type, paymentGateway: "debitopay",
        initiatedAt: new Date().toISOString(), customerName,
      }),
    }).select("id").single();

  if (txError || !txRow) {
    res.status(500).json({ error: "Erro ao criar registo de pagamento. Tenta novamente." }); return;
  }
  const txId = (txRow as any).id as string;

  try {
    const debitoBody: Record<string, any> = {
      action: "process",
      payment_method: paymentMethod === "mpesa" ? "mpesa" : "emola",
      merchant_id: merchantId, wallet_code: walletCode,
      amount: Math.round(amount), currency: "MZN",
      phone: fullPhone, source: "gateway", source_id: sourceId,
      customer_name: customerName, customer_phone: `+${fullPhone}`,
    };

    const debitoUrl = `${debitoBaseUrl}/payment-orchestrator`;
    const timeoutMs = paymentMethod === "mpesa" ? 110_000 : 30_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let debitoRes: Response;
    let debitoData: any = {};

    try {
      debitoRes = await fetch(debitoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${debitoApiKey}`, "Accept": "application/json" },
        body: JSON.stringify(debitoBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);
      const responseText = await debitoRes.text();
      try { debitoData = JSON.parse(responseText); } catch { debitoData = { raw: responseText }; }
    } catch (fetchErr: any) {
      clearTimeout(timeoutHandle);
      if (fetchErr?.name === "AbortError") {
        await supabase.from("transactions").update({
          description: JSON.stringify({
            paymentMethod, phone: fullPhone, sourceId,
            debitoPaymentId: null, debitoTransactionId: null, debitoReference: null,
            paymentType: type, paymentGateway: "debitopay",
            initiatedAt: new Date().toISOString(), customerName,
            note: "mpesa_ussd_sent_awaiting_pin",
          }),
        }).eq("id", txId);
        res.status(200).json({ ok: true, txId, paymentId: null, sourceId, mpesaSync: false, ussdSent: true });
        return;
      }
      await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ paymentMethod, phone: fullPhone, sourceId, paymentType: type, paymentGateway: "debitopay", failReason: "network_error", initiatedAt: new Date().toISOString() }) }).eq("id", txId);
      res.status(500).json({ error: "Erro de ligação ao gateway de pagamento. Tenta novamente." }); return;
    }

    if (!debitoRes.ok) {
      const userMessage = parseDebitoError(debitoData, debitoRes.status, paymentMethod);
      await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ paymentMethod, phone: fullPhone, sourceId, paymentType: type, paymentGateway: "debitopay", failReason: userMessage, debitoStatus: debitoRes.status, initiatedAt: new Date().toISOString() }) }).eq("id", txId);
      res.status(400).json({ error: userMessage }); return;
    }

    if (debitoData?.error && !debitoData?.status && !debitoData?.payment_id && !debitoData?.id) {
      const inferred = typeof debitoData.error === "string" && debitoData.error.includes("408") ? 408 : 400;
      const userMessage = parseDebitoError(debitoData, inferred, paymentMethod);
      await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ paymentMethod, phone: fullPhone, sourceId, paymentType: type, paymentGateway: "debitopay", failReason: userMessage, debitoStatus: 200, initiatedAt: new Date().toISOString() }) }).eq("id", txId);
      res.status(400).json({ error: userMessage }); return;
    }

    const debitoPaymentId: string | null = debitoData?.payment_id || debitoData?.payment?.id || debitoData?.payment?.payment_id || debitoData?.data?.payment_id || debitoData?.id || null;
    const debitoTransactionId: string | null = debitoData?.transaction_id || debitoData?.transactionId || debitoData?.data?.transaction_id || debitoData?.txid || debitoData?.uuid || null;
    const debitoReference: string | null = debitoData?.reference || debitoData?.provider_reference || debitoData?.payment?.provider_reference || debitoData?.payment?.reference || debitoData?.data?.reference || null;

    const mpesaSync = paymentMethod === "mpesa" && (debitoData?.status === "success" || debitoData?.success === true);
    const txStatus = mpesaSync ? "approved" : "pending";

    await supabase.from("transactions").update({
      status: txStatus,
      description: JSON.stringify({
        paymentMethod, phone: fullPhone, sourceId,
        debitoPaymentId, debitoTransactionId, debitoReference,
        paymentType: type, paymentGateway: "debitopay",
        initiatedAt: new Date().toISOString(), customerName,
        ...(mpesaSync ? { approvedVia: "mpesa_sync", approvedAt: new Date().toISOString() } : {}),
      }),
    }).eq("id", txId);

    if (mpesaSync && type === "deposit") {
      await withUserLock(userId, async () => {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", userId).maybeSingle();
        const currentBalance = Number((profile as any)?.balance ?? 0);
        const newBalance = Math.round((currentBalance + Number(amount)) * 100) / 100;
        const { error: balErr } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", userId);
        if (balErr) console.error("[debito/initiate] Erro ao creditar saldo M-Pesa:", balErr);
      });
    }

    res.status(200).json({ ok: true, txId, paymentId: debitoPaymentId, sourceId, mpesaSync });
  } catch (err: any) {
    console.error("[debito/initiate] Unexpected error:", err?.message || "unknown");
    await supabase.from("transactions").update({ status: "rejected" }).eq("id", txId);
    res.status(500).json({ error: "Erro inesperado. Tenta novamente." });
  }
}

/* ── check-status ── */
async function handleCheckStatus(req: any, res: any) {
  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Não autenticado" }); return; }

  const txId = (req.body ?? {}).txId as string;
  if (!txId || typeof txId !== "string") { res.status(400).json({ error: "txId obrigatório" }); return; }

  const supabase = getSupabaseAdmin();
  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];
  if (!supabase || !debitoApiKey) { res.status(503).json({ error: "Serviço indisponível" }); return; }

  const callerId = await verifyUser(token);
  if (!callerId) { res.status(401).json({ error: "Sessão inválida" }); return; }

  const { data: tx, error: txErr } = await supabase
    .from("transactions").select("id, status, description, amount, user_id")
    .eq("id", txId).maybeSingle();

  if (txErr) { res.status(200).json({ status: "pending" }); return; }
  if (!tx) { res.status(404).json({ error: "Transacção não encontrada" }); return; }
  if ((tx as any).user_id !== callerId) { res.status(403).json({ error: "Acesso negado" }); return; }

  const currentStatus = (tx as any).status as string;
  if (currentStatus === "approved") { res.status(200).json({ status: "approved" }); return; }
  if (currentStatus === "rejected") {
    let reason = "";
    try { reason = JSON.parse((tx as any).description || "{}").failReason || ""; } catch { /* ok */ }
    res.status(200).json({ status: "rejected", reason }); return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }
  const debitoPaymentId: string | null = desc.debitoPaymentId ?? null;
  if (!debitoPaymentId) { res.status(200).json({ status: currentStatus }); return; }

  try {
    const checkRes = await fetch(DEBITO_ORCHESTRATOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${debitoApiKey}`, "Accept": "application/json" },
      body: JSON.stringify({ action: "check-status", payment_id: debitoPaymentId }),
    });

    let checkData: any = {};
    try { checkData = JSON.parse(await checkRes.text()); } catch { checkData = {}; }

    const remoteStatus: string = checkData?.payment?.status || checkData?.status || "pending";
    const isSuccess = ["success", "completed", "paid", "approved", "SUCCESS", "COMPLETED"].includes(remoteStatus);
    const isFailed  = ["failed", "expired", "cancelled", "rejected", "declined", "FAILED", "EXPIRED", "CANCELLED"].includes(remoteStatus);

    if (isSuccess && currentStatus === "pending") {
      const credited = await withUserLock((tx as any).user_id, async () => {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", (tx as any).user_id).maybeSingle();
        const currentBalance = Number((profile as any)?.balance ?? 0);
        const newBalance = Math.round((currentBalance + Number((tx as any).amount ?? 0)) * 100) / 100;
        const { error: balErr } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", (tx as any).user_id);
        return !balErr;
      });
      if (credited) {
        await supabase.from("transactions").update({ status: "approved", description: JSON.stringify({ ...desc, approvedAt: new Date().toISOString(), approvedVia: "check-status" }) }).eq("id", txId);
        res.status(200).json({ status: "approved" }); return;
      }
      res.status(200).json({ status: currentStatus }); return;
    }

    if (isFailed && currentStatus === "pending") {
      const label = (desc.paymentMethod === "mpesa") ? "M-Pesa" : "e-Mola";
      const failReason = remoteStatus === "expired" || remoteStatus === "EXPIRED"
        ? "Tempo esgotado. Não confirmaste o PIN a tempo."
        : `Pagamento recusado. Verifica o teu saldo ${label} e tenta novamente.`;
      await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ ...desc, failReason, rejectedAt: new Date().toISOString(), rejectedVia: "check-status", debitoStatus: remoteStatus }) }).eq("id", txId);
      res.status(200).json({ status: "rejected", reason: failReason }); return;
    }

    res.status(200).json({ status: currentStatus });
  } catch (err: any) {
    console.error("[debito/check-status] Erro de rede:", err?.message || "unknown");
    res.status(200).json({ status: currentStatus });
  }
}

/* ── webhook (HMAC) ── */
async function handleWebhook(req: any, res: any, rawBody: string) {
  if (req.method === "GET") { res.status(200).json({ ok: true, service: "MozBet Webhook", version: "5.2" }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch {
    console.error("[debito/webhook] JSON inválido");
    res.status(200).json({ ok: true }); return;
  }

  const configuredSecret = process.env["DEBITO_WEBHOOK_SECRET"];
  const receivedSig = (req.headers["x-webhook-signature"] as string) || "";

  if (configuredSecret) {
    if (!receivedSig) {
      res.status(401).json({ ok: false, error: "Unauthorized" }); return;
    }
    const cleanSig = receivedSig.replace(/^(sha256=|v1=|sha1=|hmac=)/, "");
    const expectedSig = crypto.createHmac("sha256", configuredSecret).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSig, "hex") as unknown as Uint8Array,
      Buffer.from(cleanSig.padEnd(expectedSig.length, "0").slice(0, expectedSig.length), "hex") as unknown as Uint8Array
    )) {
      console.error("[debito/webhook] ✗ HMAC inválido — pedido rejeitado");
      res.status(401).json({ ok: false, error: "Unauthorized" }); return;
    }
  } else {
    console.warn("[debito/webhook] ⚠ DEBITO_WEBHOOK_SECRET não configurado — HMAC não validado");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) { res.status(200).json({ ok: true }); return; }

  const event: string = body?.event || "unknown";
  const data: Record<string, any> = body?.data ?? {};
  const debitoId: string | null = data?.transaction_id ?? data?.payment_id ?? body?.id ?? null;

  if (event !== "payment.completed" && event !== "payment.failed") {
    res.status(200).json({ ok: true }); return;
  }

  let tx: any = null;

  if (debitoId) {
    const { data: results } = await supabase.from("transactions").select("id, user_id, amount, description, status").like("description", `%${debitoId}%`).order("created_at", { ascending: false }).limit(10);
    for (const t of results ?? []) {
      try {
        const d = JSON.parse((t as any).description || "{}");
        if (d.debitoPaymentId === debitoId || d.debitoTransactionId === debitoId || d.debitoReference === debitoId || d.sourceId === debitoId) {
          tx = t; break;
        }
      } catch { /* skip */ }
    }
    if (!tx && results && results.length > 0) tx = results[0];
  }

  if (!tx && data?.reference) {
    const { data: results } = await supabase.from("transactions").select("id, user_id, amount, description, status").like("description", `%${data.reference}%`).order("created_at", { ascending: false }).limit(10);
    for (const t of results ?? []) {
      try {
        const d = JSON.parse((t as any).description || "{}");
        if (d.debitoReference === data.reference || d.providerReference === data.reference) {
          tx = t; break;
        }
      } catch { /* skip */ }
    }
    if (!tx && results && results.length > 0) tx = results[0];
  }

  if (!tx && data?.amount) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: results } = await supabase.from("transactions").select("id, user_id, amount, description, status, created_at").eq("status", "pending").gte("created_at", thirtyMinAgo).order("created_at", { ascending: false }).limit(50);
    const webhookAmt = Number(data.amount);
    const candidates = (results ?? []).filter((t: any) => Math.abs(Number(t.amount) - webhookAmt) < 0.5);
    if (candidates.length >= 1) tx = candidates[0];
  }

  if (!tx) {
    console.error("[debito/webhook] ✗ Transação não encontrada. id:", debitoId, "amount:", data?.amount);
    res.status(200).json({ ok: true }); return;
  }

  const txStatus = (tx as any).status as string;
  if (txStatus === "approved" || txStatus === "rejected") { res.status(200).json({ ok: true }); return; }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }
  const paymentType: string = desc.paymentType || "deposit";
  const paymentMethod: string = desc.paymentMethod || "emola";

  if (event === "payment.completed") {
    if (paymentType === "deposit") {
      const credited = await withUserLock((tx as any).user_id, async () => {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", (tx as any).user_id).maybeSingle();
        const currentBalance = Number((profile as any)?.balance ?? 0);
        const newBalance = Math.round((currentBalance + Number((tx as any).amount)) * 100) / 100;
        const { error: balErr } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", (tx as any).user_id);
        return !balErr;
      });
      if (!credited) { res.status(200).json({ ok: true }); return; }
    }
    await supabase.from("transactions").update({ status: "approved", description: JSON.stringify({ ...desc, debitoPaymentId: debitoId || desc.debitoPaymentId, debitoReference: data?.reference || desc.debitoReference, completedAt: data?.paid_at || new Date().toISOString(), approvedVia: "webhook" }) }).eq("id", (tx as any).id);
    console.log(`[debito/webhook] ✓ TX APROVADA: ${(tx as any).id}`);
  } else {
    const failReason = buildFailReason(data, paymentMethod);
    await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ ...desc, debitoPaymentId: debitoId || desc.debitoPaymentId, failReason, rejectedAt: new Date().toISOString(), rejectedVia: "webhook" }) }).eq("id", (tx as any).id);
    console.log(`[debito/webhook] ✗ TX REJEITADA: ${(tx as any).id} — ${failReason}`);
  }

  res.status(200).json({ ok: true });
}

const router: IRouter = Router();

/* O raw body é capturado pelo verify() do express.json() (app.ts) */
router.post("/debito/webhook", (req: any, res: any) => {
  void handleWebhook(req, res, (req as any).rawBody ?? "");
});
router.get("/debito/webhook", (req: any, res: any) => {
  void handleWebhook(req, res, "");
});

router.post("/debito/initiate", (req, res) => { void handleInitiate(req, res); });
router.post("/debito/check-status", (req, res) => { void handleCheckStatus(req, res); });

export default router;
