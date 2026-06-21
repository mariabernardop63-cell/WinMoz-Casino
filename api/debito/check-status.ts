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

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];

  if (!supabaseUrl || !supabaseServiceKey || !debitoApiKey) {
    res.status(503).json({ error: "Serviço indisponível" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, status, description, amount, user_id")
    .eq("id", txId)
    .maybeSingle();

  if (!tx) { res.status(404).json({ error: "Transacção não encontrada" }); return; }

  const currentStatus = (tx as any).status as string;

  // Já resolvida — retornar imediatamente
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

  const debitoPaymentId: string | null = desc.debitoPaymentId || null;

  if (!debitoPaymentId) {
    // payment_id não guardado — a iniciação pode ter retornado o ID num campo diferente
    // Registar para diagnóstico e retornar estado atual
    console.warn("[debito/check-status] debitoPaymentId é null para tx:", txId,
      "| sourceId:", desc.sourceId,
      "| initiatedAt:", desc.initiatedAt,
      "| status:", currentStatus);
    res.status(200).json({ status: currentStatus });
    return;
  }

  const debitoBaseUrl = "https://gyqoaningqhurhvdugne.supabase.co/functions/v1";

  try {
    // Per docs: POST com { "action": "check-status", "payment_id": "uuid" }
    const checkRes = await fetch(`${debitoBaseUrl}/payment-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${debitoApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({ action: "check-status", payment_id: debitoPaymentId }),
    });

    const responseText = await checkRes.text();
    let checkData: any = {};
    try { checkData = JSON.parse(responseText); } catch { checkData = { raw: responseText }; }

    console.log("[debito/check-status] resposta Debito Pay:", checkRes.status, JSON.stringify(checkData));

    // Per docs: { "success": true, "payment": { "id": "...", "status": "success"|"pending"|"failed"|"expired" } }
    const remoteStatus: string =
      checkData?.payment?.status ||
      checkData?.status ||
      "pending";

    const isSuccess =
      remoteStatus === "success" || remoteStatus === "SUCCESS" ||
      remoteStatus === "completed" || remoteStatus === "COMPLETED" ||
      remoteStatus === "paid" || remoteStatus === "approved";

    const isFailed =
      remoteStatus === "failed" || remoteStatus === "FAILED" ||
      remoteStatus === "expired" || remoteStatus === "EXPIRED" ||
      remoteStatus === "cancelled" || remoteStatus === "CANCELLED" ||
      remoteStatus === "rejected" || remoteStatus === "declined";

    if (isSuccess && currentStatus === "pending") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", (tx as any).user_id)
        .maybeSingle();

      const currentBalance = Number((profile as any)?.balance ?? 0);
      const txAmount = Number((tx as any).amount ?? 0);

      await supabase
        .from("profiles")
        .update({ balance: currentBalance + txAmount })
        .eq("id", (tx as any).user_id);

      await supabase
        .from("transactions")
        .update({
          status: "approved",
          description: JSON.stringify({
            ...desc,
            approvedAt: new Date().toISOString(),
            approvedVia: "check-status",
          }),
        })
        .eq("id", txId);

      res.status(200).json({ status: "approved" });
      return;
    }

    if (isFailed && currentStatus === "pending") {
      let failReason = "Pagamento recusado ou expirado. Tenta novamente.";
      if (remoteStatus === "expired" || remoteStatus === "EXPIRED") {
        failReason = "Tempo esgotado. Não confirmaste o PIN a tempo.";
      }

      await supabase
        .from("transactions")
        .update({
          status: "rejected",
          description: JSON.stringify({
            ...desc,
            failReason,
            rejectedAt: new Date().toISOString(),
            rejectedVia: "check-status",
            debitoStatus: remoteStatus,
          }),
        })
        .eq("id", txId);

      res.status(200).json({ status: "rejected", reason: failReason });
      return;
    }

    res.status(200).json({ status: currentStatus });
  } catch (err: any) {
    console.error("[debito/check-status] erro:", err);
    res.status(200).json({ status: currentStatus });
  }
}
