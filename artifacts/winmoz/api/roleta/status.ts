import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getWeekKey(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  return start.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) { res.status(500).json({ error: "Missing env" }); return; }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !user) { res.status(401).json({ error: "Invalid token" }); return; }

  const { data: configRow } = await admin.from("platform_settings").select("value").eq("key", "roleta_config").maybeSingle();
  const config = configRow?.value ? JSON.parse(configRow.value) : {};
  const spinsPerWeek = config.spinsPerWeek ?? 3;

  if (!config.enabled) {
    res.status(200).json({ spinsLeft: 0, enabled: false });
    return;
  }

  const weekKey = getWeekKey();
  const { count } = await admin
    .from("roleta_spins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", weekKey + "T00:00:00");

  const spinsLeft = Math.max(0, spinsPerWeek - (count ?? 0));
  res.status(200).json({ spinsLeft, enabled: true, spinsPerWeek });
}
