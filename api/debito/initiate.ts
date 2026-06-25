import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 120 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // SECURITY: Extract userId from JWT, never trust the request body for userId
  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  let parsedBody: Record<string, any> = {};
  try {
    if (typeof req.body === "string") {
      parsedBody = JSON.parse(req.body);
    } else if (req.body && typeof req.body === "object") {
      parsedBody = req.body as Record<string, any>;
    } else {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        (req as any).on("data", (c: Buffer) => chunks.push(c));
        (req as any).on("end", resolve);
        (req as any).on("error", reject);
      });
      parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
  } catch (e) {
    res.status(400).json({ error: "Pedido inválido — não foi possível ler os dados." });
    return;
  }

  const amount: number = Number(parsedBody["amount"]);
  const phoneRaw: string = String(parsedBody["phone"] ?? "");
  const paymentMethod: string = String(parsedBody["provider"] ?? "emola");
  const type: string = String(parsedBody["type"] ?? "deposit");

  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: `Montante inválido (recebido: ${parsedBody["amount"]})` });
    return;
  }
  if (!phoneRaw || phoneRaw.replace(/\D/g, "").length < 9) {
    res.status(400).json({ error: "Número de telefone inválido" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: "Serviço de base de dados indisponível" });
    return;
  }
  if (!debitoApiKey) {
    res.status(503).json({ error: "Gateway de pagamento não configurado. Contacta o suporte." });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // SECURITY: Verify token and extract the real userId from Supabase Auth
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: "Sessão inválida. Faz login novamente." });
    return;
  }
  const userId = userData.user.id; // always from JWT, never from body

  console.log("[debito/initiate] auth ok — userId:", userId ? "ok" : "MISSING", "amount:", amount, "method:", paymentMethod);

  const { data: settingsRows } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["debito_api_base_url", "debito_public_id", "debito_wallet_code", "debito_mpesa_wallet_code"]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[(row as any).key] = (row as any).value;
  }

  const debitoBaseUrl = (settings["debito_api_base_url"] || "https://gyqoaningqhurhvdugne.supabase.co/functions/v1").replace(/\/$/, "");
  const merchantId = (settings["debito_public_id"] || process.env["DEBITO_MERCHANT_ID"] || "1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c").trim();
  const walletCode = paymentMethod === "mpesa"
    ? (settings["debito_mpesa_wallet_code"] || process.env["DEBITO_MPESA_WALLET_CODE"] || "58335").trim()
    : (settings["debito_wallet_code"] || process.env["DEBITO_WALLET_CODE"] || "55291").trim();

  if (walletCode.length > 10 || !/^\d+$/.test(walletCode)) {
    res.status(503).json({ error: "Configuração do gateway inválida (wallet_code). Contacta o suporte." });
    return;
  }

  const cleanPhone = phoneRaw.replace(/\D/g, "").replace(/^258/, "");
  const fullPhone = `258${cleanPhone}`;

  const sourceId = `MOZBET-${type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  let customerName = "Cliente WinMoz";
  try {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    if ((profileData as any)?.full_name) {
      customerName = (profileData as any).full_name;
    }
  } catch { /* best-effort */ }

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: type === "deposit" ? "deposit" : "manual_bet",
      amount,
      status: "pending",
      description: JSON.stringify({
        paymentMethod,
        phone: fullPhone,
        sourceId,
        debitoPaymentId: null,
        debitoTransactionId: null,
        debitoReference: null,
        paymentType: type,
        paymentGateway: "debitopay",
        initiatedAt: new Date().toISOString(),
        customerName,
      }),
    })
    .select("id")
    .single();

  if (txError || !txRow) {
    console.error("[debito/initiate] Supabase pre-insert error:", txError);
    res.status(500).json({ error: "Erro ao criar registo de pagamento. Tenta novamente." });
    return;
  }

  const txId = (txRow as any).id as string;
  console.log("[debito/initiate] TX criada (pending):", txId);

  try {
    const debitoBody: Record<string, any> = {
      action: "process",
      payment_method: paymentMethod === "mpesa" ? "mpesa" : "emola",
      merchant_id: merchantId,
      wallet_code: walletCode,
      amount: Math.round(amount),
      currency: "MZN",
      phone: fullPhone,
      source: "gateway",
      source_id: sourceId,
      customer_name: customerName,
      customer_phone: `+${fullPhone}`,
    };

    const debitoUrl = `${debitoBaseUrl}/payment-orchestrator`;
    // SECURITY: Never log API keys or auth headers
    console.log("[debito/initiate] → Debito Pay:", debitoUrl, "provider:", paymentMethod, "amount:", amount);

    const timeoutMs = paymentMethod === "mpesa" ? 110_000 : 30_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let debitoRes: Response;
    let responseText: string;
    let debitoData: any = {};

    try {
      debitoRes = await fetch(debitoUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${debitoApiKey}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(debitoBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      responseText = await debitoRes.text();
      try { debitoData = JSON.parse(responseText); } catch { debitoData = { raw: responseText }; }

      console.log("[debito/initiate] ← Debito Pay status:", debitoRes.status);
    } catch (fetchErr: any) {
      clearTimeout(timeoutHandle);

      if (fetchErr?.name === "AbortError") {
        console.log("[debito/initiate] M-Pesa AbortError (timeout) — USSD sent, aguardando PIN. txId:", txId);

        await supabase.from("transactions").update({
          description: JSON.stringify({
            paymentMethod,
            phone: fullPhone,
            sourceId,
            debitoPaymentId: null,
            debitoTransactionId: null,
            debitoReference: null,
            paymentType: type,
            paymentGateway: "debitopay",
            initiatedAt: new Date().toISOString(),
            customerName,
            note: "mpesa_ussd_sent_awaiting_pin",
          }),
        }).eq("id", txId);

        res.status(200).json({ ok: true, txId, paymentId: null, sourceId, mpesaSync: false, ussdSent: true });
        return;
      }

      console.error("[debito/initiate] Network/fetch error:", fetchErr?.message || "unknown");
      await supabase.from("transactions").update({ status: "rejected", description: JSON.stringify({ paymentMethod, phone: fullPhone, sourceId, paymentType: type, paymentGateway: "debitopay", failReason: "network_error", initiatedAt: new Date().toISOString() }) }).eq("id", txId);
      res.status(500).json({ error: "Erro de ligação ao gateway de pagamento. Tenta novamente." });
      return;
    }

    if (!debitoRes.ok) {
      const userMessage = parseDebitoError(debitoData, debitoRes.status, paymentMethod);
      console.error("[debito/initiate] Debito Pay error:", debitoRes.status);

      await supabase.from("transactions").update({
        status: "rejected",
        description: JSON.stringify({
          paymentMethod,
          phone: fullPhone,
          sourceId,
          paymentType: type,
          paymentGateway: "debitopay",
          failReason: userMessage,
          debitoStatus: debitoRes.status,
          initiatedAt: new Date().toISOString(),
        }),
      }).eq("id", txId);

      res.status(400).json({ error: userMessage });
      return;
    }

    if (debitoData?.error && !debitoData?.status && !debitoData?.payment_id && !debitoData?.id) {
      const inferred = typeof debitoData.error === "string" && debitoData.error.includes("408") ? 408 : 400;
      const userMessage = parseDebitoError(debitoData, inferred, paymentMethod);
      await supabase.from("transactions").update({
        status: "rejected",
        description: JSON.stringify({
          paymentMethod, phone: fullPhone, sourceId, paymentType: type,
          paymentGateway: "debitopay", failReason: userMessage,
          debitoStatus: 200, initiatedAt: new Date().toISOString(),
        }),
      }).eq("id", txId);
      res.status(400).json({ error: userMessage });
      return;
    }

    const debitoPaymentId: string | null =
      debitoData?.payment_id ||
      debitoData?.payment?.id ||
      debitoData?.payment?.payment_id ||
      debitoData?.data?.payment_id ||
      debitoData?.id ||
      null;

    const debitoTransactionId: string | null =
      debitoData?.transaction_id ||
      debitoData?.transactionId ||
      debitoData?.data?.transaction_id ||
      debitoData?.txid ||
      debitoData?.uuid ||
      null;

    const debitoReference: string | null =
      debitoData?.reference ||
      debitoData?.provider_reference ||
      debitoData?.payment?.provider_reference ||
      debitoData?.payment?.reference ||
      debitoData?.data?.reference ||
      null;

    const mpesaSync = paymentMethod === "mpesa" && (debitoData?.status === "success" || debitoData?.success === true);

    const txStatus = mpesaSync ? "approved" : "pending";
    await supabase.from("transactions").update({
      status: txStatus,
      description: JSON.stringify({
        paymentMethod,
        phone: fullPhone,
        sourceId,
        debitoPaymentId,
        debitoTransactionId,
        debitoReference,
        paymentType: type,
        paymentGateway: "debitopay",
        initiatedAt: new Date().toISOString(),
        customerName,
        ...(mpesaSync ? { approvedVia: "mpesa_sync", approvedAt: new Date().toISOString() } : {}),
      }),
    }).eq("id", txId);

    if (mpesaSync && type === "deposit") {
      const { data: profile } = await supabase
        .from("profiles").select("balance").eq("id", userId).maybeSingle();
      const currentBalance = Number((profile as any)?.balance ?? 0);
      const newBalance = currentBalance + Number(amount);
      const { error: balErr } = await supabase
        .from("profiles").update({ balance: newBalance }).eq("id", userId);
      if (balErr) {
        console.error("[debito/initiate] Erro ao creditar saldo M-Pesa:", balErr);
      } else {
        console.log(`[debito/initiate] ✓ M-Pesa +${amount} MZN → user OK`);
      }
    }

    res.status(200).json({ ok: true, txId, paymentId: debitoPaymentId, sourceId, mpesaSync });
  } catch (err: any) {
    console.error("[debito/initiate] Unexpected error:", err?.message || "unknown");
    await supabase.from("transactions").update({ status: "rejected" }).eq("id", txId);
    res.status(500).json({ error: "Erro inesperado. Tenta novamente." });
  }
}

function parseDebitoError(data: any, status: number, paymentMethod: string): string {
  const msg: string = data?.message || data?.error || data?.detail || "";
  const low = msg.toLowerCase();

  if (status === 401) return "Chave API inválida — contacta o suporte.";
  if (status === 403) return "Domínio não autorizado no gateway de pagamento. Contacta o suporte.";
  if (status === 404) return "Configuração do gateway inválida (wallet_code). Contacta o suporte.";
  if (status === 408) return paymentMethod === "mpesa"
    ? "O utilizador não confirmou o PIN M-Pesa a tempo. Abre o menu *155# e confirma o pagamento pendente."
    : "O utilizador não confirmou o USSD a tempo. Tenta novamente.";
  if (status === 429) return "Demasiados pedidos ao gateway. Aguarda alguns segundos e tenta novamente.";

  if (status === 400) {
    if (low.includes("authentication") || low.includes("auth")) {
      if (paymentMethod === "mpesa") {
        return "Serviço M-Pesa temporariamente indisponível. Usa e-Mola ou tenta mais tarde.";
      }
      return "Erro de autenticação no gateway. Contacta o suporte.";
    }
    if (low.includes("phone") || low.includes("msisdn") || low.includes("mobile")) return "Número de telefone inválido para este operador.";
    if (low.includes("amount") || low.includes("minimum") || low.includes("mínimo") || low.includes("minimo")) return "Montante inválido — mínimo é 10 MZN.";
    if (low.includes("payment_method") || low.includes("unsupported")) return "Método de pagamento não suportado de momento.";
    if (low.includes("wallet_code") || low.includes("wallet")) return "Código de carteira inválido. Contacta o suporte.";
    if (low.includes("required")) return "Dados em falta no pedido. Contacta o suporte.";
    if (low.includes("timeout") || low.includes("time out")) return "Tempo esgotado — o utilizador não confirmou o PIN a tempo.";
    return msg ? `Erro do gateway: ${msg}` : "Pedido rejeitado pelo gateway. Tenta novamente.";
  }

  if (status >= 500) return "Erro temporário do gateway de pagamento. Tenta novamente mais tarde.";
  return msg ? `Erro do gateway: ${msg}` : "Erro ao iniciar pagamento. Tenta novamente.";
}
