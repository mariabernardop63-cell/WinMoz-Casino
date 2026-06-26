import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";
import crypto from "crypto";

const MIN_BET = 10;
const MAX_BET = 5000;
const VALID_GAMES = ["damas", "ludo", "xadrez"];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const buf = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += chars[buf[i] % chars.length];
  return code;
}

// ─── /api/rooms/create ───────────────────────────────────────────────────────
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { betAmount, gameType } = (req.body ?? {}) as { betAmount?: number; gameType?: string };

  if (!betAmount || typeof betAmount !== "number" || betAmount < MIN_BET || betAmount > MAX_BET) {
    res.status(400).json({ error: "Montante de aposta inválido" }); return;
  }
  if (!gameType || !VALID_GAMES.includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" }); return;
  }

  const admin = getSupabaseAdmin();

  const { data: existingRoom } = await admin
    .from("game_rooms").select("id, status")
    .eq("creator_id", auth.userId).eq("status", "waiting").maybeSingle();

  if (existingRoom) {
    res.status(409).json({ error: "Já tens uma sala aberta. Cancela-a primeiro." }); return;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles").select("balance, is_blocked").eq("id", auth.userId).single();

  if (profileError || !profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }
  if ((profile as { is_blocked?: boolean }).is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

  const currentBalance = parseFloat(String((profile as { balance: number }).balance ?? 0));
  if (currentBalance < betAmount) { res.status(400).json({ error: "Saldo insuficiente" }); return; }

  const newBalance = Math.round((currentBalance - betAmount) * 100) / 100;

  // SECURITY: atomic guard — only deduct if balance is still sufficient
  const { data: deducted, error: deductError } = await admin
    .from("profiles").update({ balance: newBalance })
    .eq("id", auth.userId).gte("balance", betAmount)
    .select("balance").maybeSingle();

  if (deductError || !deducted) {
    res.status(400).json({ error: "Saldo insuficiente" }); return;
  }

  let code = generateRoomCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data: existing } = await admin.from("game_rooms").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
    code = generateRoomCode();
  }

  const { data: room, error: roomError } = await admin
    .from("game_rooms").insert({
      code,
      creator_id: auth.userId,
      game_type: gameType,
      bet_amount: betAmount,
      status: "waiting",
      created_at: new Date().toISOString(),
    }).select("id").single();

  if (roomError || !room) {
    await admin.from("profiles").update({ balance: currentBalance }).eq("id", auth.userId);
    res.status(500).json({ error: "Erro ao criar sala. Tenta novamente." }); return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId, type: "bet",
    amount: -Math.abs(betAmount),
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved", created_at: new Date().toISOString(),
  });

  res.json({ ok: true, code, roomId: (room as { id: string }).id, newBalance: (deducted as { balance: number }).balance });
}

// ─── /api/rooms/join ─────────────────────────────────────────────────────────
async function handleJoin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { code, gameType } = (req.body ?? {}) as { code?: string; gameType?: string };

  if (!code || typeof code !== "string" || code.length !== 6) {
    res.status(400).json({ error: "Código de sala inválido" }); return;
  }
  if (!gameType || !VALID_GAMES.includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" }); return;
  }

  const admin = getSupabaseAdmin();

  const { data: room, error: roomError } = await admin
    .from("game_rooms").select("id, creator_id, game_type, bet_amount, status")
    .eq("code", code.toUpperCase()).eq("status", "waiting").maybeSingle();

  if (roomError || !room) {
    res.status(404).json({ error: "Sala não encontrada ou já preenchida." }); return;
  }

  const r = room as { id: string; creator_id: string; game_type: string; bet_amount: number; status: string };

  if (r.creator_id === auth.userId) {
    res.status(400).json({ error: "Não podes entrar na tua própria sala." }); return;
  }
  if (r.game_type !== gameType) {
    res.status(400).json({ error: `Esta sala é de ${r.game_type}. Muda o jogo.` }); return;
  }

  const betAmount = Number(r.bet_amount);

  const { data: profile, error: profileError } = await admin
    .from("profiles").select("balance, is_blocked").eq("id", auth.userId).single();

  if (profileError || !profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }
  if ((profile as { is_blocked?: boolean }).is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

  const currentBalance = parseFloat(String((profile as { balance: number }).balance ?? 0));
  if (currentBalance < betAmount) { res.status(400).json({ error: "Saldo insuficiente" }); return; }

  const newBalance = Math.round((currentBalance - betAmount) * 100) / 100;

  // SECURITY: Atomic balance deduction
  const { data: deducted, error: deductError } = await admin
    .from("profiles").update({ balance: newBalance })
    .eq("id", auth.userId).gte("balance", betAmount)
    .select("balance").maybeSingle();

  if (deductError || !deducted) { res.status(400).json({ error: "Saldo insuficiente" }); return; }

  // SECURITY: Atomic room status update — only succeeds if still "waiting"
  const { data: updatedRoom, error: updateRoomErr } = await admin
    .from("game_rooms").update({ status: "matched", joiner_id: auth.userId })
    .eq("id", r.id).eq("status", "waiting")
    .select("id").maybeSingle();

  if (updateRoomErr || !updatedRoom) {
    await admin.from("profiles").update({ balance: currentBalance }).eq("id", auth.userId);
    res.status(409).json({ error: "Sala já preenchida por outro jogador." }); return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId, type: "bet",
    amount: -Math.abs(betAmount),
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved", created_at: new Date().toISOString(),
  });

  const gameId = `sala_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  res.json({ ok: true, gameId, betAmount, newBalance: (deducted as { balance: number }).balance });
}

// ─── /api/rooms/cancel ───────────────────────────────────────────────────────
async function handleCancel(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { roomId } = (req.body ?? {}) as { roomId?: string };
  if (!roomId || typeof roomId !== "string") {
    res.status(400).json({ error: "roomId obrigatório" }); return;
  }

  const admin = getSupabaseAdmin();

  const { data: room, error: roomError } = await admin
    .from("game_rooms").select("id, creator_id, bet_amount, status, game_type")
    .eq("id", roomId).maybeSingle();

  if (roomError || !room) { res.status(404).json({ error: "Sala não encontrada" }); return; }

  const r = room as { id: string; creator_id: string; bet_amount: number; status: string; game_type: string };

  if (r.creator_id !== auth.userId) {
    res.status(403).json({ error: "Não és o criador desta sala" }); return;
  }
  if (r.status !== "waiting") {
    res.status(409).json({ error: "Sala já está em jogo ou foi cancelada" }); return;
  }

  // SECURITY: Atomic delete — only delete if still "waiting" (prevents double refund)
  const { error: deleteError, count } = await admin
    .from("game_rooms").delete({ count: "exact" })
    .eq("id", roomId).eq("creator_id", auth.userId).eq("status", "waiting");

  if (deleteError || count === 0) {
    res.status(409).json({ error: "Sala já foi preenchida — não é possível cancelar" }); return;
  }

  const betAmount = Number(r.bet_amount);
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", auth.userId).single();
  const currentBalance = parseFloat(String((profile as { balance: number } | null)?.balance ?? 0));
  const newBalance = Math.round((currentBalance + betAmount) * 100) / 100;

  await admin.from("profiles").update({ balance: newBalance }).eq("id", auth.userId);
  await admin.from("transactions").insert({
    user_id: auth.userId, type: "win", amount: betAmount,
    description: `Reembolso: sala cancelada (${r.game_type})`,
    status: "approved", created_at: new Date().toISOString(),
  });

  res.json({ ok: true, refund: betAmount, newBalance });
}

// ─── Main router ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "create": return handleCreate(req, res);
    case "join":   return handleJoin(req, res);
    case "cancel": return handleCancel(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
