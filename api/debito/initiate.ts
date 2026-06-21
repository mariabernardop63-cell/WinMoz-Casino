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
      // Read raw body from stream as last resort
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        (req as any).on("data", (c: Buffer) => chunks.push(c));
        (req as any).on("end", resolve);
        (req as any).on("error", reject);
      });
      parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
  } catch (e) {
    console.error("[debito/initiate] Body parse error:", e, "raw body type:", typeof req.body, "raw:", String(req.body).slice(0, 200));
    res.status(400).json({ error: "Pedido inválido — não foi possível ler os dados." });
    return;
  }

  const amount: number = Number(parsedBody["amount"]);
  const phone: string = String(parsedBody["phone"] ?? "");
  const provider: string = String(parsedBody["provider"] ?? "emola");
  const type: string = String(parsedBody["type"] ?? "deposit");
  const userId: string = String(parsedBody["userId"] ?? "");

  console.log("[debito/initiate] Parsed body — amount:", amount, "phone:", phone, "provider:", provider, "type:", type, "userId:", userId ? "ok" : "MISSING");

  if (!amount || isNaN(amount) || amount <= 0) { res.status(400).json({ error: `Montante inválido (recebido: ${parsedBody["amount"]})` }); return; }
  if (!phone || phone.replace(/\D/g, "").length < 9) { res.status(400).json({ error: "Número de telefone inválido" }); return; }
  if (!userId || userId === "undefined") { res.status(400).json({ error: "Utilizador não autenticado" }); return; }

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

  // Use the production domain — VERCEL_URL is the deployment preview URL, not the custom domain
  const siteOrigin =
    process.env["SITE_URL"] ||
    process.env["NEXT_PUBLIC_SITE_URL"] ||
    (process.env["VERCEL_PROJECT_PRODUCTION_URL"] ? `https://${process.env["VERCEL_PROJECT_PRODUCTION_URL"]}` : null) ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "") ||
    "";

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

    const debitoUrl = `${debitoBaseUrl}/payment-orchestrator`;
    console.log("[debito/initiate] Calling Debito Pay:", debitoUrl, JSON.stringify(debitoBody));

    const debitoRes = await fetch(debitoUrl, {
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
  const msg: string = data?.message || data?.error || data?.detail || "";
  const low = msg.toLowerCase();
  if (status === 401 || status === 403) return "Gateway não autorizado — verifica a API key no Vercel.";
  if (status === 422 || status === 400) {
    if (low.includes("phone") || low.includes("msisdn") || low.includes("mobile")) return "Número de telefone inválido para este operador.";
    if (low.includes("amount")) return "Montante inválido.";
    if (low.includes("provider")) return "Operador não suportado de momento.";
    if (low.includes("reference")) return "Referência duplicada. Tenta novamente.";
    // Return raw Debito Pay error so we can debug, avoid misleading messages
    return msg ? `Erro do gateway: ${msg}` : "Dados de pagamento rejeitados pelo gateway. Tenta novamente.";
  }
  if (status >= 500) return "Erro temporário do gateway de pagamento. Tenta novamente.";
  return msg ? `Erro do gateway: ${msg}` : "Erro ao iniciar pagamento. Tenta novamente.";
}
