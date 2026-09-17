import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface RoletaConfig {
  enabled: boolean;
  spinsPerWeek: number;
  winningHoursEnabled: boolean;
  winningHoursStart: number;
  winningHoursEnd: number;
  weeklyBudgetEnabled: boolean;
  weeklyBudgetAmount: number;
  weeklyBudgetPrize: number;
  weeklyBudgetUsed: number;
  weeklyBudgetWeek: string;
  multipliersEnabled: boolean;
  multipliers: { spin1: number; spin2: number; spin3: number };
  alwaysWinEnabled: boolean;
  alwaysWinPrize: number;
}

function getWeekKey(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  return start.toISOString().slice(0, 10);
}

function getSpinNumber(count: number): number {
  if (count === 0) return 1;
  if (count === 1) return 2;
  return 3;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) { res.status(500).json({ error: "Missing env" }); return; }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !user) { res.status(401).json({ error: "Invalid token" }); return; }

  // Load config
  const { data: configRow } = await admin.from("platform_settings").select("value").eq("key", "roleta_config").maybeSingle();
  const config: RoletaConfig = configRow?.value ? { ...JSON.parse(configRow.value) } : {
    enabled: true, spinsPerWeek: 3, winningHoursEnabled: false, winningHoursStart: 8, winningHoursEnd: 22,
    weeklyBudgetEnabled: false, weeklyBudgetAmount: 30, weeklyBudgetPrize: 1, weeklyBudgetUsed: 0, weeklyBudgetWeek: "",
    multipliersEnabled: false, multipliers: { spin1: 1, spin2: 1, spin3: 1 }, alwaysWinEnabled: false, alwaysWinPrize: 1,
  };

  // Check enabled
  if (!config.enabled) {
    res.status(400).json({ error: "Roleta desactivada" });
    return;
  }

  // Check winning hours
  if (config.winningHoursEnabled) {
    const hour = new Date().getHours();
    if (hour < config.winningHoursStart || hour > config.winningHoursEnd) {
      res.status(400).json({ error: "Fora do horário de vitórias" });
      return;
    }
  }

  // Check spins left
  const weekKey = getWeekKey();
  if (config.weeklyBudgetWeek !== weekKey) {
    config.weeklyBudgetUsed = 0;
    config.weeklyBudgetWeek = weekKey;
  }

  const { count } = await admin
    .from("roleta_spins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", weekKey + "T00:00:00");

  const spinsUsed = count ?? 0;
  if (spinsUsed >= config.spinsPerWeek) {
    res.status(400).json({ error: "Sem giros restantes" });
    return;
  }

  // Check weekly budget
  if (config.weeklyBudgetEnabled && config.weeklyBudgetUsed >= config.weeklyBudgetAmount) {
    res.status(400).json({ error: "Orçamento semanal esgotado" });
    return;
  }

  // Calculate prize
  let prize: number;
  if (config.alwaysWinEnabled) {
    prize = config.alwaysWinPrize;
  } else if (config.multipliersEnabled) {
    const spinNum = getSpinNumber(spinsUsed);
    prize = spinNum === 1 ? config.multipliers.spin1 : spinNum === 2 ? config.multipliers.spin2 : config.multipliers.spin3;
  } else {
    prize = config.weeklyBudgetPrize || 1;
  }

  // Cap prize to remaining budget
  if (config.weeklyBudgetEnabled) {
    const remaining = config.weeklyBudgetAmount - config.weeklyBudgetUsed;
    if (prize > remaining) prize = remaining;
    if (prize <= 0) {
      res.status(400).json({ error: "Orçamento semanal esgotado" });
      return;
    }
  }

  // Record spin
  const { error: spinError } = await admin.from("roleta_spins").insert({
    user_id: user.id,
    prize,
    created_at: new Date().toISOString(),
  });
  if (spinError) {
    res.status(500).json({ error: "Erro ao registar giro" });
    return;
  }

  // Credit balance
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", user.id).single();
  const newBalance = (profile?.balance ?? 0) + prize;
  await admin.from("profiles").update({ balance: newBalance }).eq("id", user.id);

  // Update budget used
  if (config.weeklyBudgetEnabled) {
    config.weeklyBudgetUsed += prize;
    await admin.from("platform_settings").upsert(
      { key: "roleta_config", value: JSON.stringify(config) },
      { onConflict: "key" }
    );
  }

  res.status(200).json({ prize, spinsLeft: config.spinsPerWeek - spinsUsed - 1, newBalance });
}
