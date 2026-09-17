import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const CONFIG_KEY = "roleta_config";

const DEFAULT_CONFIG = {
  enabled: true,
  spinsPerWeek: 3,
  winningHoursEnabled: false,
  winningHoursStart: 8,
  winningHoursEnd: 22,
  weeklyBudgetEnabled: false,
  weeklyBudgetAmount: 30,
  weeklyBudgetPrize: 1,
  weeklyBudgetUsed: 0,
  weeklyBudgetWeek: "",
  multipliersEnabled: false,
  multipliers: { spin1: 1, spin2: 1, spin3: 1 },
  alwaysWinEnabled: false,
  alwaysWinPrize: 1,
};

function getWeekKey(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  return start.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Missing env vars" });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify admin auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    res.status(403).json({ error: "Not admin" });
    return;
  }

  if (req.method === "GET") {
    const { data } = await admin.from("platform_settings").select("value").eq("key", CONFIG_KEY).maybeSingle();
    const stored = data?.value ? JSON.parse(data.value) : {};
    // Reset weekly budget if new week
    const weekKey = getWeekKey();
    if (stored.weeklyBudgetWeek !== weekKey) {
      stored.weeklyBudgetUsed = 0;
      stored.weeklyBudgetWeek = weekKey;
    }
    res.status(200).json({ ...DEFAULT_CONFIG, ...stored });
    return;
  }

  if (req.method === "POST") {
    const config = req.body;
    // Validate
    if (typeof config !== "object" || config === null) {
      res.status(400).json({ error: "Invalid config" });
      return;
    }
    // Merge with defaults
    const merged = { ...DEFAULT_CONFIG, ...config };
    const weekKey = getWeekKey();
    if (merged.weeklyBudgetWeek !== weekKey) {
      merged.weeklyBudgetUsed = 0;
      merged.weeklyBudgetWeek = weekKey;
    }
    const { error } = await admin.from("platform_settings").upsert(
      { key: CONFIG_KEY, value: JSON.stringify(merged) },
      { onConflict: "key" }
    );
    if (error) {
      res.status(500).json({ error: "Failed to save config" });
      return;
    }
    res.status(200).json({ ok: true, config: merged });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
