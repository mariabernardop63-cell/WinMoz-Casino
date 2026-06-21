import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { amount, phone, provider, type, userId } = req.body as {
    amount: number;
    phone: string;
    provider: "emola" | "mpesa";
    type: "deposit" | "bet";
    userId: string;
  };

  if (!amount || amount <= 0) { res.status(400).json({ error: "Montante inválido" }); return; }
  if (!phone || phone.replace(/\D/g, "").length < 9) { res.status(400).json({ error: "Número de telefone inválido" }); return; }
  if (!userId) { res.status(400).json({ error: "Utilizador não autenticado" }); return; }

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

  const { data: settingsRows } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["debito_api_base_url", "debito_public_id"]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[(row as any).key] = (row as any).value;
  }

  const debitoBaseUrl = (settings["debito_api_base_url"] || "https://gyqoaningqhurhvdugne.supabase.co/functions/v1").replace(/\/$/, "");
  const merchantId = settings["debito_public_id"] || "1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c";

  const cleanPhone = phone.replace(/\D/g, "").replace(/^258/, "");
  const fullPhone = `258${cleanPhone}`;

  const reference = `MOZBET-${type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: type === "deposit" ? "deposit" : "manual_bet",
      amount,
      status: "pending",
      description: JSON.stringify({
        provider,
        phone: fullPhone,
        reference,
        debitoPaymentId: null,
        paymentType: type,
        paymentGateway: "debitopay",
        initiatedAt: new Date().toISOString(),
      }),
    })
    .select("id")
    .single();

  if (txError || !txRow) {
    console.error("[debito/initiate] Supabase insert error:", txError);
    res.status(500).json({ error: "Erro ao criar registo de pagamento. Tenta novamente." });
    return;
  }

  const txId = (txRow as any).id as string;

  const siteOrigin = process.env["VERCEL_URL"]
    ? `https://${process.env["VERCEL_URL"]}`
    : (process.env["NEXT_PUBLIC_SITE_URL"] || "");

  try {
    const debitoBody = {
      action: "process",
      amount: Number(amount.toFixed(2)),
      currency: "MZN",
      mobile: fullPhone,
      provider: provider === "emola" ? "emola" : "mpesa",
      reference,
      description: `${type === "deposit" ? "Deposito" : "Aposta"} MozBet - ${reference}`,
      callback_url: `${siteOrigin}/api/debito/webhook`,
    };

    console.log("[debito/initiate] Calling Debito Pay:", `${debitoBaseUrl}/payment-orchestrator`, JSON.stringify(debitoBody));

    const debitoRes = await fetch(`${debitoBaseUrl}/payment-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${debitoApiKey}`,
      },
      body: JSON.stringify(debitoBody),
    });

    const responseText = await debitoRes.text();
    let debitoData: any = {};
    try { debitoData = JSON.parse(responseText); } catch { debitoData = { raw: responseText }; }

    console.log("[debito/initiate] Debito Pay response status:", debitoRes.status, "body:", JSON.stringify(debitoData));

    if (!debitoRes.ok) {
      await supabase
        .from("transactions")
        .update({
          status: "rejected",
          description: JSON.stringify({
            provider, phone: fullPhone, reference, paymentGateway: "debitopay",
            error: debitoData?.message || debitoData?.error || "Erro do gateway de pagamento",
            httpStatus: debitoRes.status,
            rejectedAt: new Date().toISOString(),
          }),
        })
        .eq("id", txId);

      const userMessage = parseDebitoError(debitoData, debitoRes.status);
      res.status(400).json({ error: userMessage });
      return;
    }

    const debitoPaymentId =
      debitoData?.id ||
      debitoData?.payment_id ||
      debitoData?.data?.id ||
      debitoData?.data?.payment_id ||
      debitoData?.transaction_id ||
      null;

    await supabase
      .from("transactions")
      .update({
        description: JSON.stringify({
          provider,
          phone: fullPhone,
          reference,
          debitoPaymentId,
          paymentType: type,
          paymentGateway: "debitopay",
          initiatedAt: new Date().toISOString(),
        }),
      })
      .eq("id", txId);

    res.status(200).json({ ok: true, txId, paymentId: debitoPaymentId, reference });
  } catch (err: any) {
    console.error("[debito/initiate] Network/fetch error:", err);
    await supabase
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", txId);
    res.status(500).json({ error: "Erro de ligação ao gateway de pagamento. Tenta novamente." });
  }
}

function parseDebitoError(data: any, status: number): string {
  const msg = data?.message || data?.error || data?.detail || "";
  if (status === 401 || status === 403) return "Gateway não autorizado. Contacta o suporte.";
  if (status === 422 || status === 400) {
    if (msg.toLowerCase().includes("phone") || msg.toLowerCase().includes("msisdn")) return "Número de telefone inválido para este operador.";
    if (msg.toLowerCase().includes("amount")) return "Montante inválido.";
    if (msg.toLowerCase().includes("provider")) return "Operador não suportado de momento.";
    return msg || "Dados de pagamento inválidos.";
  }
  if (status >= 500) return "Erro temporário do gateway de pagamento. Tenta novamente.";
  return msg || "Erro ao iniciar pagamento. Tenta novamente.";
}
