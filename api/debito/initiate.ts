import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Explicit body parsing — Vercel may deliver body as pre-parsed object or raw string
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
    console.error("[debito/initiate] Body parse error:", e);
    res.status(400).json({ error: "Pedido inválido — não foi possível ler os dados." });
    return;
  }

  const amount: number = Number(parsedBody["amount"]);
  // frontend sends field "phone" (9 digits, no country code)
  const phoneRaw: string = String(parsedBody["phone"] ?? "");
  // frontend sends field "provider" ("emola" | "mpesa")
  const paymentMethod: string = String(parsedBody["provider"] ?? "emola");
  const type: string = String(parsedBody["type"] ?? "deposit");
  const userId: string = String(parsedBody["userId"] ?? "");

  console.log("[debito/initiate] Parsed — amount:", amount, "phone:", phoneRaw, "method:", paymentMethod, "type:", type, "userId:", userId ? "ok" : "MISSING");

  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: `Montante inválido (recebido: ${parsedBody["amount"]})` });
    return;
  }
  if (!phoneRaw || phoneRaw.replace(/\D/g, "").length < 9) {
    res.status(400).json({ error: "Número de telefone inválido" });
    return;
  }
  if (!userId || userId === "undefined") {
    res.status(400).json({ error: "Utilizador não autenticado" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
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

  // Read merchant settings from platform_settings table
  const { data: settingsRows } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["debito_api_base_url", "debito_public_id", "debito_wallet_code"]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[(row as any).key] = (row as any).value;
  }

  const debitoBaseUrl = (settings["debito_api_base_url"] || "https://gyqoaningqhurhvdugne.supabase.co/functions/v1").replace(/\/$/, "");
  // merchant_id: o UUID do merchant no painel Debito Pay → Settings → API
  const merchantId = (settings["debito_public_id"] || process.env["DEBITO_MERCHANT_ID"] || "1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c").trim();
  // wallet_code: código PÚBLICO de 5 dígitos (NÃO o UUID interno da carteira)
  // Ordem de prioridade: platform_settings → env var → fallback hardcoded "55291"
  const walletCode = (settings["debito_wallet_code"] || process.env["DEBITO_WALLET_CODE"] || "55291").trim();

  console.log("[debito/initiate] wallet_code a usar:", walletCode, "| merchant_id:", merchantId ? "ok" : "VAZIO");

  // Validação: wallet_code deve ser numérico e curto (5 dígitos) — nunca um UUID longo
  if (walletCode.length > 10 || !/^\d+$/.test(walletCode)) {
    console.error("[debito/initiate] wallet_code inválido:", walletCode, "— deve ser o código de 5 dígitos, não um UUID");
    res.status(503).json({ error: "Configuração do gateway inválida (wallet_code). Contacta o suporte." });
    return;
  }

  // Build phone in format accepted by Debito Pay: 258XXXXXXXXX
  const cleanPhone = phoneRaw.replace(/\D/g, "").replace(/^258/, "");
  const fullPhone = `258${cleanPhone}`;

  // source_id used for our own reference tracking
  const sourceId = `MOZBET-${type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // NOTE: We only create the transaction record AFTER Debito Pay confirms the payment
  // was successfully initiated — so it never appears in the user's history until real

  try {
    // Build request body exactly as per Debito Pay API documentation
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
    };

    const debitoUrl = `${debitoBaseUrl}/payment-orchestrator`;
    console.log("[debito/initiate] → Debito Pay:", debitoUrl, JSON.stringify({ ...debitoBody, merchant_id: merchantId ? `${merchantId.slice(0,8)}...` : "VAZIO" }));

    const debitoRes = await fetch(debitoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${debitoApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(debitoBody),
    });

    const responseText = await debitoRes.text();
    let debitoData: any = {};
    try { debitoData = JSON.parse(responseText); } catch { debitoData = { raw: responseText }; }

    console.log("[debito/initiate] ← Debito Pay status:", debitoRes.status, "body:", JSON.stringify(debitoData));

    if (!debitoRes.ok) {
      const userMessage = parseDebitoError(debitoData, debitoRes.status);
      res.status(400).json({ error: userMessage });
      return;
    }

    // Log completo da resposta para diagnóstico nos logs da Vercel
    console.log("[debito/initiate] RESPOSTA COMPLETA Debito Pay:", JSON.stringify(debitoData));

    // Extrair payment_id — campo standard da documentação
    const debitoPaymentId: string | null =
      debitoData?.payment_id ||
      debitoData?.payment?.id ||
      debitoData?.payment?.payment_id ||
      debitoData?.data?.payment_id ||
      debitoData?.id ||
      null;

    // Extrair transaction_id — campo REAL que a Debito Pay envia no webhook
    // (o campo "payment_id" da doc e o "transaction_id" do webhook podem ser valores diferentes)
    const debitoTransactionId: string | null =
      debitoData?.transaction_id ||
      debitoData?.transactionId ||
      debitoData?.data?.transaction_id ||
      debitoData?.txid ||
      debitoData?.uuid ||
      null;

    // Extrair reference — provider reference (ex: EH2026...)
    const debitoReference: string | null =
      debitoData?.reference ||
      debitoData?.provider_reference ||
      debitoData?.payment?.provider_reference ||
      debitoData?.payment?.reference ||
      debitoData?.data?.reference ||
      null;

    console.log("[debito/initiate] IDs extraídos — payment_id:", debitoPaymentId,
      "| transaction_id:", debitoTransactionId,
      "| reference:", debitoReference,
      "| sourceId:", sourceId);

    if (!debitoPaymentId && !debitoTransactionId) {
      console.warn("[debito/initiate] AVISO: nem payment_id nem transaction_id encontrados na resposta. " +
        "O webhook vai usar fallback por montante+tempo. Verifica os logs acima.");
    }

    // Criar registo da transação APENAS após confirmação do Debito Pay
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
          debitoPaymentId,
          debitoTransactionId,
          debitoReference,
          paymentType: type,
          paymentGateway: "debitopay",
          initiatedAt: new Date().toISOString(),
        }),
      })
      .select("id")
      .single();

    if (txError) {
      console.error("[debito/initiate] Supabase insert error (post-success):", txError);
    }

    const txId = (txRow as any)?.id ?? null;
    console.log("[debito/initiate] TX criada após confirmação Debito Pay:", txId);

    res.status(200).json({ ok: true, txId, paymentId: debitoPaymentId, sourceId });
  } catch (err: any) {
    console.error("[debito/initiate] Network/fetch error:", err);
    res.status(500).json({ error: "Erro de ligação ao gateway de pagamento. Tenta novamente." });
  }
}

function parseDebitoError(data: any, status: number): string {
  const msg: string = data?.message || data?.error || data?.detail || "";
  const low = msg.toLowerCase();
  if (status === 401) return "API key inválida — verifica a configuração no Vercel.";
  if (status === 403) return "Domínio não autorizado no gateway de pagamento. Contacta o suporte.";
  if (status === 404) return "Configuração do gateway inválida (wallet_code). Contacta o suporte.";
  if (status === 429) return "Demasiados pedidos ao gateway. Aguarda alguns segundos e tenta novamente.";
  if (status === 400) {
    if (low.includes("phone") || low.includes("msisdn") || low.includes("mobile")) return "Número de telefone inválido para este operador.";
    if (low.includes("amount") || low.includes("minimum")) return "Montante inválido — mínimo é 10 MZN.";
    if (low.includes("payment_method") || low.includes("unsupported")) return "Método de pagamento não suportado de momento.";
    if (low.includes("wallet_code") || low.includes("wallet")) return "Código de carteira inválido. Contacta o suporte.";
    if (low.includes("required")) return "Dados em falta no pedido. Contacta o suporte.";
    return msg ? `Erro do gateway: ${msg}` : "Pedido rejeitado pelo gateway. Tenta novamente.";
  }
  if (status >= 500) return "Erro temporário do gateway de pagamento. Tenta novamente mais tarde.";
  return msg ? `Erro do gateway: ${msg}` : "Erro ao iniciar pagamento. Tenta novamente.";
}
