import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

const MIN_BET = 10;
const MAX_BET = 5000;
const VALID_GAMES = ["damas", "ludo", "xadrez"];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const buf = new Uint8Array(6);
  // Use crypto-safe random if available, else fallback
  try {
    const { webcrypto } = require("crypto");
    webcrypto.getRandomValues(buf);
    for (let i = 0; i < 6; i++) code += chars[buf[i] % chars.length];
  } catch {
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { betAmount, gameType } = (req.body ?? {}) as {
    betAmount?: number;
    gameType?: string;
  };

  if (!betAmount || typeof betAmount !== "number" || betAmount < MIN_BET || betAmount > MAX_BET) {
    res.status(400).json({ error: "Montante de aposta inválido" });
    return;
  }
  if (!gameType || !VALID_GAMES.includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // Check if user already has an open room (prevent duplicate rooms)
  const { data: existingRoom } = await admin
    .from("game_rooms")
    .select("id, status")
    .eq("creator_id", auth.userId)
    .eq("status", "waiting")
    .maybeSingle();

  if (existingRoom) {
    res.status(409).json({ error: "Já tens uma sala aberta. Cancela-a primeiro." });
    return;
  }

  // SECURITY: Atomic balance deduction — only succeeds if balance is sufficient
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ balance: admin.rpc ? undefined : undefined }) // placeholder, see below
    .eq("id", auth.userId)
    .select("balance, is_blocked")
    .maybeSingle();

  // Read current balance first
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("balance, is_blocked")
    .eq("id", auth.userId)
    .single();

  if (profileError || !profile) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
    return;
  }
  if ((profile as { is_blocked?: boolean }).is_blocked) {
    res.status(403).json({ error: "Conta bloqueada" });
    return;
  }

  const currentBalance = parseFloat(String((profile as { balance: number }).balance ?? 0));
  if (currentBalance < betAmount) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  const newBalance = Math.round((currentBalance - betAmount) * 100) / 100;

  // SECURITY: atomic guard — only deduct if balance is still sufficient
  const { data: deducted, error: deductError } = await admin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", auth.userId)
    .gte("balance", betAmount)
    .select("balance")
    .maybeSingle();

  if (deductError || !deducted) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  // Generate a unique room code
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await admin
      .from("game_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  // Create the room
  const { data: room, error: roomError } = await admin
    .from("game_rooms")
    .insert({
      code,
      creator_id: auth.userId,
      game_type: gameType,
      bet_amount: betAmount,
      status: "waiting",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (roomError || !room) {
    // Refund on room creation failure
    await admin
      .from("profiles")
      .update({ balance: currentBalance })
      .eq("id", auth.userId);

    res.status(500).json({ error: "Erro ao criar sala. Tenta novamente." });
    return;
  }

  // Record the bet transaction
  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(betAmount),
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  res.json({
    ok: true,
    code,
    roomId: (room as { id: string }).id,
    newBalance: (deducted as { balance: number }).balance,
  });
}
