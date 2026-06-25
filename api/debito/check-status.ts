import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // SECURITY: Require authentication — users can only check their own transactions
  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { txId } = req.body as { txId: string };
  if (!txId || typeof txId !== "string") {
    res.status(400).json({ error: "txId obrigatório" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  const debitoApiKey = process.env["SLACK_LIVE_API_KEY"];

  if (!supabaseUrl || !supabaseServiceKey || !debitoApiKey) {
    res.status(503).json({ error: "Serviço indisponível" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // SECURITY: Verify token and get caller's userId
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  const callerId = userData.user.id;

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, status, description, amount, user_id")
    .eq("id", txId)
    .maybeSingle();

  if (txErr) {
    res.status(200).json({ status: "pending" });
    return;
  }
  if (!tx) {
    res.status(404).json({ error: "Transacção não encontrada" });
    return;
  }

  // SECURITY: Only allow users to check their own transactions
  if ((tx as any).user_id !== callerId) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const currentStatus = (tx as any).status as string;

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

  if (!debitoPaymentId) {
    res.status(200).json({ status: currentStatus });
    return;
  }

  const DEBITO_BASE = "https://gyqoaningqhurhvdugne.supabase.co/functions/v1";
  const DEBITO_URL  = `${DEBITO_BASE}/payment-orchestrator`;

  // SECURITY: Do NOT log the API key or auth headers
  console.log("[debito/check-status] → checking payment:", debitoPaymentId.slice(0, 8) + "...");

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
    try { checkData = JSON.parse(responseText); } catch { checkData = {}; }

    // SECURITY: Do not log full response (may contain sensitive data)
    console.log("[debito/check-status] ← status:", checkRes.status, "| payment status:", checkData?.payment?.status || checkData?.status || "unknown");

    const remoteStatus: string =
      checkData?.payment?.status ||
      checkData?.status ||
      "pending";

    const isSuccess = ["success", "completed", "paid", "approved", "SUCCESS", "COMPLETED"].includes(remoteStatus);
    const isFailed  = ["failed", "expired", "cancelled", "rejected", "declined",
                       "FAILED", "EXPIRED", "CANCELLED"].includes(remoteStatus);

    if (isSuccess && currentStatus === "pending") {
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

      console.log(`[debito/check-status] ✓ Aprovado via polling. tx: ${txId}`);
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

    res.status(200).json({ status: currentStatus });

  } catch (err: any) {
    console.error("[debito/check-status] Erro de rede:", err?.message || "unknown");
    res.status(200).json({ status: currentStatus });
  }
}
