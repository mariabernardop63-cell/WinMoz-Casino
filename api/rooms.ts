import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";
import crypto from "crypto";

const MIN_BET = 10;
const MAX_BET = 5000;
const VALID_GAMES = ["damas", "ludo", "xadrez"];
const WIN_RATE = 0.90;

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

  // SECURITY: débito ATÓMICO via RPC — nunca perde créditos que aterram entre
  // a leitura e a escrita (depósito/levantamento concorrente) e impede
  // double-spend de duas criações de sala concorrentes.
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -betAmount, p_min: 0 });

  if (adjustError) {
    console.error("[rooms/create] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" }); return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);
  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" }); return;
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
    // Rollback atómico — nunca sobrescreve saldo concorrente
    await admin.rpc("adjust_balance", { p_user_id: auth.userId, p_delta: betAmount, p_min: 0 });
    res.status(500).json({ error: "Erro ao criar sala. Tenta novamente." }); return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId, type: "bet",
    amount: -Math.abs(betAmount),
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved", created_at: new Date().toISOString(),
  });

  res.json({ ok: true, code, roomId: (room as { id: string }).id, newBalance });
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

  const betAmount = Math.abs(Number(r.bet_amount) || 0);
  if (betAmount <= 0) { res.status(500).json({ error: "Sala com aposta inválida" }); return; }

  // SECURITY: débito atómico do JOINER (RPC)
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -betAmount, p_min: 0 });

  if (adjustError) {
    console.error("[rooms/join] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" }); return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);
  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" }); return;
  }

  // SECURITY: claim atómico da sala — só succeede se ainda estiver "waiting"
  const { data: updatedRoom, error: updateRoomErr } = await admin
    .from("game_rooms").update({ status: "matched", joiner_id: auth.userId })
    .eq("id", r.id).eq("status", "waiting")
    .select("id").maybeSingle();

  if (updateRoomErr || !updatedRoom) {
    // Rollback atómico do joiner
    await admin.rpc("adjust_balance", { p_user_id: auth.userId, p_delta: betAmount, p_min: 0 });
    res.status(409).json({ error: "Sala já preenchida por outro jogador." }); return;
  }

  // CRÍTICO: criar a linha em `matches` AQUI — sem ela o win.ts nunca paga
  // (player2_id vazio = "Partida sem adversário confirmado") e as duas apostas
  // ficavam presas para sempre (buraco negro de saldo das salas privadas).
  const gameId = `sala_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const bet = Math.round(betAmount * 100) / 100;

  const { error: matchErr } = await admin.from("matches").insert({
    id: gameId,
    game_type: gameType,
    player1_id: r.creator_id,
    player2_id: auth.userId,
    bet_amount: bet,
    winner_payout: Math.floor(bet * 2 * WIN_RATE),
    status: "active",
    created_at: new Date().toISOString(),
  });

  if (matchErr) {
    // Rollback completo: devolve o joiner e liberta a sala para nova entrada
    await admin.rpc("adjust_balance", { p_user_id: auth.userId, p_delta: betAmount, p_min: 0 });
    await admin.from("game_rooms")
      .update({ status: "waiting", joiner_id: null })
      .eq("id", r.id).eq("status", "matched").eq("joiner_id", auth.userId);
    console.error("[rooms/join] Erro ao criar partida:", matchErr);
    res.status(500).json({ error: "Erro ao preparar a partida. Tenta novamente." }); return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId, type: "bet",
    amount: -bet,
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved", created_at: new Date().toISOString(),
  });

  // Cleanup: a sala cumpriu o seu propósito — liberta o criador para criar
  // novas salas e evita que o efeito de recuperação volte a apanhar esta sala.
  await admin.from("game_rooms").delete().eq("id", r.id).eq("status", "matched");

  res.json({ ok: true, gameId, betAmount: bet, newBalance });
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

  const betAmount = Math.abs(Number(r.bet_amount) || 0);

  // SECURITY: reembolso ATÓMICO via RPC — o bug "elimina mas não reembolsa"
  // acontecia porque o reembolso reescrevia o saldo absoluto lido antes do
  // delete (write-back obsoleto que perdia créditos concorrentes).
  const { data: balanceRow, error: refundError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: betAmount, p_min: 0 });

  if (refundError || balanceRow === null || balanceRow === undefined) {
    console.error("[rooms/cancel] Erro ao reembolsar:", refundError);
    // A sala já foi apagada — registra a dívida para reconciliação manual
    await admin.from("transactions").insert({
      user_id: auth.userId, type: "win", amount: 0,
      description: `REEMBOLSO PENDENTE: sala cancelada (${r.game_type}) — ${betAmount} MT`,
      status: "pending", created_at: new Date().toISOString(),
    });
    res.status(500).json({ error: "Sala cancelada mas o reembolso falhou — contacta o suporte." });
    return;
  }
  const newBalance = Number(balanceRow);

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
