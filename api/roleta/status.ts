import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getMozambiqueStartOfDayUTC(): string {
  const mzOffsetMs = 2 * 60 * 60 * 1000;
  const mzNow = new Date(Date.now() + mzOffsetMs);
  const startOfDayMz = Date.UTC(mzNow.getUTCFullYear(), mzNow.getUTCMonth(), mzNow.getUTCDate(), 0, 0, 0);
  return new Date(startOfDayMz - mzOffsetMs).toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: "Serviço indisponível" }); return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
  const userId = userData.user.id;

  const todayStart = getMozambiqueStartOfDayUTC();
  const { data: rows } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "free_spin")
    .gte("created_at", todayStart);

  res.json({ freeSpinAvailable: !rows || rows.length === 0 });
}
