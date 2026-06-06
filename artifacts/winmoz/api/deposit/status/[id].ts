import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const pendingId = req.query["id"] as string;
  if (!pendingId) { res.status(400).json({ error: "id required" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pending, error } = await admin
    .from("deposit_verifications").select("*").eq("id", pendingId).maybeSingle();

  if (error || !pending) { res.json({ status: "not_found" }); return; }

  const submittedAt = new Date(pending.submitted_at).getTime();
  const timedOut = Date.now() - submittedAt > 90_000;

  if (pending.status === "approved") {
    res.json({ status: "approved", amount: pending.expected_amount, txId: pending.resolved_tx_id ?? null });
    return;
  }

  if (timedOut && pending.status === "pending") {
    await admin.from("deposit_verifications").update({ status: "rejected" }).eq("id", pendingId);
    res.json({ status: "rejected", reason: "timeout" }); return;
  }

  res.json({ status: "pending" });
}
