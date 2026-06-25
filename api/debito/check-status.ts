import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { txId } = req.body as { txId: string };
  if (!txId) { res.status(400).json({ error: "txId required" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];

  if (!supabaseUrl || !supabaseServiceKey || !debitoApiKey) {
    console.error("[debito/check-status] Variáveis de ambiente em falta:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasDebitoKey: !!debitoApiKey,
    });
    res.status(503).json({ error: "Serviço indisponível" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, status, description, amount, user_id")
    .eq("id", txId)
    .maybeSingle();

  if (txErr) {
    console.error("[debito/check-status] Erro Supabase:", txErr);
    res.status(200).json({ status: "pending" });
    return;
  }
  if (!tx) {
    res.status(404).json({ error: "Transacção não encontrada" });
    return;
  }

  const currentStatus = (tx as any).status as string;

  // Já resolvida — retornar imediatamente sem chamar a Debito Pay
  if (currentStatus === "approved") {
    res.status(200).json({ status: "approved" });
    return;
  }
  if (currentStatus === "rejected") {
    let reason = "";
    try { reason = JSON.parse((tx as any).description || "{}").failReason || ""; } catch { /* ok */ }
    res.status(200).json({ status: "rejected", reason });
    return;
  }

  let desc: Record<string, any> = {};
  try { desc = JSON.parse((tx as any).description || "{}"); } catch { /* ok */ }

  const debitoPaymentId: string | null = desc.debitoPaymentId ?? null;

  // Se não temos o payment_id da Debito Pay, não conseguimos fazer check-status na API deles
  // Retornamos o estado atual e aguardamos o webhook
  if (!debitoPaymentId) {
    console.warn("[debito/check-status] payment_id não guardado para tx:", txId,
      "| Aguardando webhook. sourceId:", desc.sourceId);
    res.status(200).json({ status: currentStatus });
    return;
  }

  // Chamar a API da Debito Pay — endpoint correto conforme documentação oficial:
  // POST /payment-orchestrator com body { "action": "check-status", "payment_id": "uuid" }
  // NÃO colocar action na URL — vai SEMPRE no body
  const DEBITO_BASE = "https://gyqoaningqhurhvdugne.supabase.co/functions/v1";
  const DEBITO_URL  = `${DEBITO_BASE}/payment-orchestrator`;

  console.log("[debito/check-status] → chamando Debito Pay:", DEBITO_URL,
    "| payment_id:", debitoPaymentId);

  try {
    const checkRes = await fetch(DEBITO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${debitoApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        action: "check-status",
        payment_id: debitoPaymentId,
      }),
    });

    const responseText = await checkRes.text();
    let checkData: any = {};
    try { checkData = JSON.parse(responseText); } catch { checkData = { raw: responseText }; }

    console.log("[debito/check-status] ← Debito Pay status:", checkRes.status, "| body:", JSON.stringify(checkData));

    // Resposta conforme docs: { "success": true, "payment": { "id": "...", "status": "success|pending|failed|expired" } }
    const remoteStatus: string =
      checkData?.payment?.status ||
      checkData?.status ||
      "pending";

    console.log("[debito/check-status] status remoto:", remoteStatus);

    const isSuccess = ["success", "completed", "paid", "approved", "SUCCESS", "COMPLETED"].includes(remoteStatus);
    const isFailed  = ["failed", "expired", "cancelled", "rejected", "declined",
                       "FAILED", "EXPIRED", "CANCELLED"].includes(remoteStatus);

    if (isSuccess && currentStatus === "pending") {
      // Creditar saldo
      const { data: profile } = await supabase
        .from("profiles").select("balance").eq("id", (tx as any).user_id).maybeSingle();

      const currentBalance = Number((profile as any)?.balance ?? 0);
      const txAmount       = Number((tx as any).amount ?? 0);
      const newBalance     = currentBalance + txAmount;

      await supabase.from("profiles")
        .update({ balance: newBalance }).eq("id", (tx as any).user_id);

      await supabase.from("transactions").update({
        status: "approved",
        description: JSON.stringify({
          ...desc,
          approvedAt: new Date().toISOString(),
          approvedVia: "check-status",
        }),
      }).eq("id", txId);

      console.log(`[debito/check-status] ✓ Aprovado via polling. tx: ${txId}, novo saldo: ${newBalance}`);
      res.status(200).json({ status: "approved" });
      return;
    }

    if (isFailed && currentStatus === "pending") {
      const label = (desc.paymentMethod === "mpesa") ? "M-Pesa" : "e-Mola";
      const failReason = remoteStatus === "expired" || remoteStatus === "EXPIRED"
        ? "Tempo esgotado. Não confirmaste o PIN a tempo."
        : `Pagamento recusado. Verifica o teu saldo ${label} e tenta novamente.`;

      await supabase.from("transactions").update({
        status: "rejected",
        description: JSON.stringify({
          ...desc,
          failReason,
          rejectedAt: new Date().toISOString(),
          rejectedVia: "check-status",
          debitoStatus: remoteStatus,
        }),
      }).eq("id", txId);

      console.log(`[debito/check-status] ✗ Rejeitado via polling. tx: ${txId}`);
      res.status(200).json({ status: "rejected", reason: failReason });
      return;
    }

    // Ainda pendente
    res.status(200).json({ status: currentStatus });

  } catch (err: any) {
    console.error("[debito/check-status] Erro de rede:", err?.message || err);
    res.status(200).json({ status: currentStatus });
  }
}
