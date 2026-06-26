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
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
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

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter perfil" }); return; }
  const currentBalance = Number(profileData.balance ?? 0);

  if (currentBalance < PAID_SPIN_COST) {
    res.status(400).json({ error: "Saldo insuficiente para apostar." }); return;
  }

  const balanceAfterBet = Math.round((currentBalance - PAID_SPIN_COST) * 100) / 100;
  const { error: deductError } = await supabaseAdmin
    .from("profiles").update({ balance: balanceAfterBet }).eq("id", userId);
  if (deductError) { res.status(500).json({ error: "Erro ao processar aposta" }); return; }

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
    finalBalance = Math.round((balanceAfterBet + prize) * 100) / 100;
    await supabaseAdmin.from("profiles").update({ balance: finalBalance }).eq("id", userId);
    await supabaseAdmin.from("transactions").insert({
      user_id: userId, type: "win", amount: prize,
      description: `Prémio Roleta da Sorte (+${prize} MT)`,
      status: "approved", created_at: new Date().toISOString(),
    });
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
