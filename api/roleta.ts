import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// ─── Constants ───────────────────────────────────────────────────────────────
const FREE_SPINS_PER_WEEK = 3;
const PRIZE_5MT = 5;
const PRIZE_1MT = 1;
const WEEKLY_BUDGET_5MT = 30; // max 30MT in 5MT prizes per week (6 winners)

// Sector indices: 0=100, 1=200, 2=50, 3=25, 4=10, 5=5, 6=1, 7=jackpot, 8=Boa Sorte
const SECTOR_WIN_5 = 5;  // 5 MT
const SECTOR_WIN_1 = 6;  // 1 MT
const SECTOR_LOSE = 8;   // Boa Sorte (0)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMozambiqueNow(): Date {
  return new Date(Date.now() + 2 * 60 * 60 * 1000);
}

function getWeekKey(mzNow: Date): string {
  // ISO week: Monday-start week key like "2026-W38"
  const d = new Date(Date.UTC(mzNow.getUTCFullYear(), mzNow.getUTCMonth(), mzNow.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getWeekStartUTC(weekKey: string): string {
  const [yearStr, wStr] = weekKey.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  const targetMon = new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000);
  return targetMon.toISOString();
}

function setCors(res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function getAdminClient() {
  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Prize Pattern Logic ─────────────────────────────────────────────────────
// Patterns determine which spin wins 5MT (if budget allows):
// Pattern "A": spin 1 = LOSE, spin 2 = WIN 5MT, spin 3 = LOSE
// Pattern "B": spin 1 = WIN 5MT, spin 2 = LOSE, spin 3 = LOSE
// Pattern "C": all lose
// The pattern is deterministically assigned per user per week (stored in DB).

function assignPattern(userId: string): "A" | "B" | "C" {
  // Deterministic based on userId + week — same user always gets same pattern in a week
  let hash = 0;
  const str = userId + getWeekKey(getMozambiqueNow());
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const pick = Math.abs(hash) % 100;
  // Pattern A: 30%, Pattern B: 25%, Pattern C: 45%
  if (pick < 30) return "A";
  if (pick < 55) return "B";
  return "C";
}

// ─── /api/roleta/spin ────────────────────────────────────────────────────────
async function handleSpin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) { res.status(500).json({ error: "Serviço indisponível" }); return; }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
  const userId = userData.user.id;

  const mzNow = getMozambiqueNow();
  const weekKey = getWeekKey(mzNow);
  const weekStart = getWeekStartUTC(weekKey);

  // ── 1. Count spins used this week ──
  const { data: weekSpins } = await supabaseAdmin
    .from("roleta_spins")
    .select("id, spin_number")
    .eq("user_id", userId)
    .gte("created_at", weekStart);

  const spinsUsed = weekSpins?.length ?? 0;
  if (spinsUsed >= FREE_SPINS_PER_WEEK) {
    res.status(400).json({ error: "Giros gratuitos esgotados esta semana." }); return;
  }

  const spinNumber = spinsUsed + 1; // 1, 2, or 3

  // ── 2. Anti-replay: check if this exact spin already exists ──
  // (prevents double-submit from network issues)
  const { data: existingSpin } = await supabaseAdmin
    .from("roleta_spins")
    .select("id, prize")
    .eq("user_id", userId)
    .eq("spin_number", spinNumber)
    .eq("week_key", weekKey)
    .maybeSingle();

  if (existingSpin) {
    // Already recorded — return cached result
    const { data: profileData } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    res.json({
      sectorIndex: existingSpin.prize >= PRIZE_5MT ? SECTOR_WIN_5 : existingSpin.prize >= PRIZE_1MT ? SECTOR_WIN_1 : SECTOR_LOSE,
      prize: existingSpin.prize,
      newBalance: Number(profileData?.balance ?? 0),
      spinsLeft: FREE_SPINS_PER_WEEK - spinsUsed,
      spinNumber,
    });
    return;
  }

  // ── 3. Determine prize ──
  const pattern = assignPattern(userId);

  // Check which spin in the pattern should win
  let shouldWin5MT = false;
  if (pattern === "A" && spinNumber === 2) shouldWin5MT = true;
  if (pattern === "B" && spinNumber === 1) shouldWin5MT = true;
  // Pattern C: never wins 5MT

  let prize = 0;
  let sectorIndex = SECTOR_LOSE;

  if (shouldWin5MT) {
    // ── 4. Check global 5MT budget ──
    const { data: budgetSpins } = await supabaseAdmin
      .from("roleta_spins")
      .select("prize")
      .gte("created_at", weekStart)
      .eq("won_5mt", true);

    const totalPaid5MT = (budgetSpins?.length ?? 0) * PRIZE_5MT;

    if (totalPaid5MT < WEEKLY_BUDGET_5MT) {
      // Budget allows — award 5MT
      prize = PRIZE_5MT;
      sectorIndex = SECTOR_WIN_5;
    } else {
      // Budget exhausted — fallback to 1MT
      prize = PRIZE_1MT;
      sectorIndex = SECTOR_WIN_1;
    }
  } else {
    // Pattern says this spin loses — but give a small 1MT consolation sometimes
    // 40% chance of 1MT on losing spins (keeps engagement)
    const consolation = Math.random();
    if (consolation < 0.40) {
      prize = PRIZE_1MT;
      sectorIndex = SECTOR_WIN_1;
    }
    // else prize = 0 (Boa Sorte)
  }

  // ── 5. Record spin ──
  const { error: insertError } = await supabaseAdmin
    .from("roleta_spins")
    .insert({
      user_id: userId,
      week_key: weekKey,
      spin_number: spinNumber,
      prize,
      won_5mt: prize >= PRIZE_5MT,
      created_at: mzNow.toISOString(),
    });

  if (insertError) {
    // Unique constraint violation = double-submit
    if (insertError.code === "23505") {
      const { data: profileData } = await supabaseAdmin
        .from("profiles").select("balance").eq("id", userId).single();
      res.json({
        sectorIndex: SECTOR_LOSE, prize: 0,
        newBalance: Number(profileData?.balance ?? 0),
        spinsLeft: FREE_SPINS_PER_WEEK - spinsUsed, spinNumber,
      });
      return;
    }
    res.status(500).json({ error: "Erro ao registar giro." }); return;
  }

  // ── 6. Credit prize atomically ──
  let finalBalance = 0;
  if (prize > 0) {
    const { data: newBalRow, error: creditErr } = await supabaseAdmin
      .rpc("adjust_balance", { p_user_id: userId, p_delta: prize, p_min: 0 });

    if (!creditErr && newBalRow !== null && newBalRow !== undefined) {
      finalBalance = Number(newBalRow);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId, type: "win", amount: prize,
        description: `Prémio Roleta da Sorte (Giro ${spinNumber}/3) +${prize} MT`,
        status: "approved", created_at: mzNow.toISOString(),
      });
    } else {
      // Fallback: read current balance
      const { data: p } = await supabaseAdmin
        .from("profiles").select("balance").eq("id", userId).single();
      finalBalance = Number(p?.balance ?? 0);
    }
  } else {
    const { data: p } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    finalBalance = Number(p?.balance ?? 0);
  }

  res.json({
    sectorIndex,
    prize,
    newBalance: finalBalance,
    spinsLeft: FREE_SPINS_PER_WEEK - (spinsUsed + 1),
    spinNumber,
    pattern, // debug: remove in production if desired
  });
}

// ─── /api/roleta/status ──────────────────────────────────────────────────────
async function handleStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) { res.status(500).json({ error: "Serviço indisponível" }); return; }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
  const userId = userData.user.id;

  const mzNow = getMozambiqueNow();
  const weekKey = getWeekKey(mzNow);
  const weekStart = getWeekStartUTC(weekKey);

  const { data: weekSpins } = await supabaseAdmin
    .from("roleta_spins")
    .select("id, prize")
    .eq("user_id", userId)
    .gte("created_at", weekStart);

  const spinsUsed = weekSpins?.length ?? 0;
  const spinsLeft = Math.max(0, FREE_SPINS_PER_WEEK - spinsUsed);
  const totalWon = (weekSpins ?? []).reduce((sum: number, s: any) => sum + Number(s.prize ?? 0), 0);

  res.json({
    spinsLeft,
    spinsUsed,
    totalWon,
    freeSpinAvailable: spinsLeft > 0,
  });
}

// ─── Main router ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "spin":   return handleSpin(req, res);
    case "status": return handleStatus(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
