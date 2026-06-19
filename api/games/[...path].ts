import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const PLATFORM_COMMISSION = 0.10;
const ALLOWED_GAME_TYPES = new Set(["Ludo", "Damas", "Xadrez"]);
const MAX_BET = 50_000;

function buildAdmin(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function handleBet(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { gameId, gameType, betAmount, opponentName } = (req.body ?? {}) as {
    gameId?: string; gameType?: string; betAmount?: number; opponentName?: string;
  };

  if (
    typeof gameId !== "string" || gameId.length === 0 || gameId.length > 120 ||
    typeof gameType !== "string" || !ALLOWED_GAME_TYPES.has(gameType) ||
    typeof betAmount !== "number" || betAmount <= 0 || betAmount > MAX_BET
  ) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  // Duplicate check — same approach as the original individual bet.ts that was working
  const { data: existingBet } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "bet")
    .like("description", `%[${gameId}]%`)
    .maybeSingle();

  if (existingBet) {
    const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
    res.json({ ok: true, duplicate: true, newBalance: parseFloat(String(prof?.balance ?? 0)) }); return;
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  if (currentBalance < betAmount) {
    res.status(400).json({ ok: false, error: "Saldo insuficiente", balance: currentBalance }); return;
  }

  const newBalance = Math.round((currentBalance - betAmount) * 100) / 100;
  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao debitar saldo" }); return; }

  const opp = typeof opponentName === "string" ? opponentName.slice(0, 60) : "adversário";
  await admin.from("transactions").insert({
    user_id: userId,
    type: "bet",
    amount: -betAmount,
    description: `Aposta (${gameType}) [${gameId}] vs ${opp}`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  res.json({ ok: true, newBalance });
}

async function handleWin(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { gameId, gameType, betAmount } = (req.body ?? {}) as {
    gameId?: string; gameType?: string; betAmount?: number;
  };

  if (
    typeof gameId !== "string" || gameId.length === 0 || gameId.length > 120 ||
    typeof gameType !== "string" || !ALLOWED_GAME_TYPES.has(gameType) ||
    typeof betAmount !== "number" || betAmount <= 0 || betAmount > MAX_BET
  ) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  // Duplicate check — same approach as the original individual win.ts that was working
  const { data: existingWin } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "win")
    .like("description", `%[${gameId}]%`)
    .maybeSingle();

  if (existingWin) {
    const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
    res.json({ ok: true, duplicate: true, newBalance: parseFloat(String(prof?.balance ?? 0)) }); return;
  }

  const payout = Math.floor(betAmount * 2 * (1 - PLATFORM_COMMISSION));
  const platformFee = betAmount * 2 - payout;

  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  const newBalance = Math.round((currentBalance + payout) * 100) / 100;

  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao creditar saldo" }); return; }

  await admin.from("transactions").insert({
    user_id: userId,
    type: "win",
    amount: payout,
    description: `Vitória (${gameType}) [${gameId}]`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  if (platformFee > 0) {
    await admin.from("platform_earnings").insert({
      amount: platformFee,
      source: "game_fee",
      description: `Taxa de jogo (${gameType}) — aposta ${betAmount} MT`,
      reference_id: gameId,
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});
  }

  res.json({ ok: true, prize: payout, newBalance });
}

async function handleRefund(req: VercelRequest, res: VercelResponse, admin: ReturnType<typeof buildAdmin>, userId: string) {
  const { roomCode, amount, gameType } = (req.body ?? {}) as {
    roomCode?: string; amount?: number; gameType?: string;
  };

  if (
    typeof roomCode !== "string" || roomCode.length === 0 || roomCode.length > 120 ||
    typeof amount !== "number" || amount <= 0 || amount > MAX_BET ||
    typeof gameType !== "string" || !ALLOWED_GAME_TYPES.has(gameType)
  ) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" }); return;
  }

  // Duplicate check — same approach as the original individual refund.ts
  const { data: existingRefund } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .like("description", `%Reembolso sala ${roomCode}%`)
    .maybeSingle();

  if (existingRefund) {
    const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
    res.json({ ok: true, duplicate: true, newBalance: parseFloat(String(prof?.balance ?? 0)) }); return;
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profileError || !profileData) { res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return; }

  const currentBalance = Math.round(Number((profileData as any).balance ?? 0) * 100) / 100;
  const newBalance = Math.round((currentBalance + amount) * 100) / 100;

  const { error: updateError } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateError) { res.status(500).json({ ok: false, error: "Erro ao creditar reembolso" }); return; }

  await admin.from("transactions").insert({
    user_id: userId,
    type: "win",
    amount,
    description: `Reembolso sala ${roomCode}`,
    status: "approved",
    created_at: new Date().toISOString(),
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

  if (route === "ludo/dice") {
    res.json({ value: Math.floor(Math.random() * 6) + 1 });
    return;
  }

  if (route !== "bet" && route !== "win" && route !== "refund") {
    res.status(404).json({ error: "Not found" }); return;
  }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`games/${route}: missing env vars SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
    res.status(500).json({ ok: false, error: "Serviço indisponível — variáveis de ambiente em falta" }); return;
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
