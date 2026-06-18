import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const PLATFORM_COMMISSION = 0.10;

function buildAdmin(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function handleBet(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { gameId, gameType, betAmount, opponentName } = (req.body ?? {}) as {
    gameId?: string; gameType?: string; betAmount?: number; opponentName?: string;
  };
  if (!gameId || !gameType || !betAmount || betAmount <= 0) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  const { data: existing } = await admin
    .from("transactions").select("id").eq("user_id", userId).eq("type", "bet")
    .ilike("description", `%${gameId}%`).maybeSingle();
  if (existing) { res.json({ ok: true, duplicate: true }); return; }

  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  if (currentBalance < betAmount) { res.status(400).json({ ok: false, error: "Saldo insuficiente" }); return; }

  const newBalance = Math.round((currentBalance - betAmount) * 100) / 100;
  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao debitar saldo" }); return; }

  await admin.from("transactions").insert({
    user_id: userId, type: "bet", amount: -betAmount,
    description: JSON.stringify({ gameId, gameType, opponentName: opponentName ?? "adversário" }),
    status: "approved", created_at: new Date().toISOString(),
  });
  res.json({ ok: true, newBalance });
}

async function handleWin(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { gameId, gameType, betAmount } = (req.body ?? {}) as {
    gameId?: string; gameType?: string; betAmount?: number;
  };
  if (!gameId || !gameType || !betAmount || betAmount <= 0) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  const { data: existing } = await admin
    .from("transactions").select("id").eq("user_id", userId).eq("type", "win")
    .ilike("description", `%${gameId}%`).maybeSingle();
  if (existing) { res.json({ ok: true, duplicate: true }); return; }

  const prize = Math.floor(betAmount * 2 * (1 - PLATFORM_COMMISSION));
  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  const newBalance = Math.round((currentBalance + prize) * 100) / 100;

  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao creditar saldo" }); return; }

  await admin.from("transactions").insert({
    user_id: userId, type: "win", amount: prize,
    description: JSON.stringify({ gameId, gameType, betAmount, prize }),
    status: "approved", created_at: new Date().toISOString(),
  });
  res.json({ ok: true, prize, newBalance });
}

async function handleRefund(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { roomCode, amount, gameType } = (req.body ?? {}) as {
    roomCode?: string; amount?: number; gameType?: string;
  };
  if (!roomCode || !amount || amount <= 0) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  const { data: betTx } = await admin
    .from("transactions").select("id").eq("user_id", userId).eq("type", "bet")
    .ilike("description", `%${roomCode}%`).maybeSingle();
  if (!betTx) { res.json({ ok: true, skipped: true }); return; }

  const { data: existingRefund } = await admin
    .from("transactions").select("id").eq("user_id", userId).eq("type", "refund")
    .ilike("description", `%${roomCode}%`).maybeSingle();
  if (existingRefund) { res.json({ ok: true, duplicate: true }); return; }

  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  const newBalance = Math.round((currentBalance + amount) * 100) / 100;

  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao creditar reembolso" }); return; }

  await admin.from("transactions").insert({
    user_id: userId, type: "refund", amount,
    description: JSON.stringify({ roomCode, gameType: gameType ?? "unknown", reason: "game_cancelled" }),
    status: "approved", created_at: new Date().toISOString(),
  });
  res.json({ ok: true, newBalance });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const pathParts = Array.isArray(req.query["path"]) ? req.query["path"] : [req.query["path"] as string];
  const route = pathParts.join("/");

  if (route !== "bet" && route !== "win" && route !== "refund" && route !== "ludo/dice") {
    res.status(404).json({ error: "Not found" }); return;
  }

  // ludo/dice needs no auth, just returns a random number
  if (route === "ludo/dice") {
    res.json({ value: Math.floor(Math.random() * 6) + 1 });
    return;
  }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ ok: false, error: "Serviço indisponível" }); return;
  }

  try {
    const admin = buildAdmin(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ ok: false, error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    if (route === "bet")    return void await handleBet(req, res, admin, userId);
    if (route === "win")    return void await handleWin(req, res, admin, userId);
    if (route === "refund") return void await handleRefund(req, res, admin, userId);
  } catch (err) {
    console.error(`games/${route} error:`, err);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
}
