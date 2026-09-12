import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function getMozambiqueStartOfDayUTC(): string {
  const mzOffsetMs = 2 * 60 * 60 * 1000;
  const mzNow = new Date(Date.now() + mzOffsetMs);
  const startOfDayMz = Date.UTC(mzNow.getUTCFullYear(), mzNow.getUTCMonth(), mzNow.getUTCDate(), 0, 0, 0);
  return new Date(startOfDayMz - mzOffsetMs).toISOString();
}

const PAID_SPIN_COST = 5;

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

  const { isFree } = (req.body ?? {}) as { isFree?: boolean };

  if (isFree) {
    const todayStart = getMozambiqueStartOfDayUTC();
    const { data: rows } = await supabaseAdmin
      .from("transactions").select("id")
      .eq("user_id", userId).eq("type", "free_spin").gte("created_at", todayStart);

    if (rows && rows.length > 0) {
      res.status(400).json({ error: "Giro grátis já utilizado hoje. Volta amanhã!" }); return;
    }

    const { data: profileData } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    const currentBalance = Number(profileData?.balance ?? 0);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId, type: "free_spin", amount: 0,
      description: "Giro grátis diário (Roleta da Sorte)",
      status: "approved", created_at: new Date().toISOString(),
    });

    res.json({ sectorIndex: 8, prize: 0, newBalance: currentBalance });
    return;
  }

  // SECURITY: Atomic deduction via RPC — eliminates race condition
  const { data: newBalRow, error: deductError } = await supabaseAdmin
    .rpc("adjust_balance", { p_user_id: userId, p_delta: -PAID_SPIN_COST, p_min: 0 });

  if (deductError || newBalRow === null || newBalRow === undefined) {
    res.status(400).json({ error: "Saldo insuficiente para apostar." }); return;
  }
  const balanceAfterBet = Number(newBalRow);

  await supabaseAdmin.from("transactions").insert({
    user_id: userId, type: "bet", amount: -PAID_SPIN_COST,
    description: "Aposta — Roleta da Sorte (5 MT)",
    status: "approved", created_at: new Date().toISOString(),
  });

  const { data: txRows } = await supabaseAdmin
    .from("transactions").select("amount")
    .eq("user_id", userId).in("type", ["bet", "win"]);

  const netPL = txRows
    ? txRows.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0)
    : 0;

  const rand = Math.random();
  let sectorIndex: number;
  let prize = 0;

  if (rand < 0.80) {
    sectorIndex = 6; prize = 1;
  } else {
    if (netPL < -20) {
      sectorIndex = 5; prize = 5;
    } else {
      sectorIndex = 8; prize = 0;
    }
  }

  let finalBalance = balanceAfterBet;
  if (prize > 0) {
    // SECURITY: Atomic prize credit via RPC — eliminates race condition
    const { data: prizeBalRow, error: prizeErr } = await supabaseAdmin
      .rpc("adjust_balance", { p_user_id: userId, p_delta: prize, p_min: 0 });

    if (!prizeErr && prizeBalRow !== null && prizeBalRow !== undefined) {
      finalBalance = Number(prizeBalRow);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId, type: "win", amount: prize,
        description: `Prémio Roleta da Sorte (+${prize} MT)`,
        status: "approved", created_at: new Date().toISOString(),
      });
    }
  }

  res.json({ sectorIndex, prize, newBalance: finalBalance });
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

  const todayStart = getMozambiqueStartOfDayUTC();
  const { data: rows } = await supabaseAdmin
    .from("transactions").select("id")
    .eq("user_id", userId).eq("type", "free_spin").gte("created_at", todayStart);

  res.json({ freeSpinAvailable: !rows || rows.length === 0 });
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
