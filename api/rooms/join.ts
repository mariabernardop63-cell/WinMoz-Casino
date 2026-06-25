import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { code, gameType } = (req.body ?? {}) as {
    code?: string;
    gameType?: string;
  };

  if (!code || typeof code !== "string" || code.length !== 6) {
    res.status(400).json({ error: "Código de sala inválido" });
    return;
  }
  if (!gameType || !["damas", "ludo", "xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // Find the room
  const { data: room, error: roomError } = await admin
    .from("game_rooms")
    .select("id, creator_id, game_type, bet_amount, status")
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .maybeSingle();

  if (roomError || !room) {
    res.status(404).json({ error: "Sala não encontrada ou já preenchida." });
    return;
  }

  const r = room as {
    id: string;
    creator_id: string;
    game_type: string;
    bet_amount: number;
    status: string;
  };

  // SECURITY: Cannot join your own room
  if (r.creator_id === auth.userId) {
    res.status(400).json({ error: "Não podes entrar na tua própria sala." });
    return;
  }

  // Game type must match
  if (r.game_type !== gameType) {
    res.status(400).json({ error: `Esta sala é de ${r.game_type}. Muda o jogo.` });
    return;
  }

  const betAmount = Number(r.bet_amount);

  // Check user balance
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

  // SECURITY: Atomic balance deduction
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

  // SECURITY: Atomic room status update — only succeeds if still "waiting"
  const { data: updatedRoom, error: updateRoomErr } = await admin
    .from("game_rooms")
    .update({ status: "matched", joiner_id: auth.userId })
    .eq("id", r.id)
    .eq("status", "waiting") // atomic guard
    .select("id")
    .maybeSingle();

  if (updateRoomErr || !updatedRoom) {
    // Room was taken — refund the balance
    await admin
      .from("profiles")
      .update({ balance: currentBalance })
      .eq("id", auth.userId);

    res.status(409).json({ error: "Sala já preenchida por outro jogador." });
    return;
  }

  // Record bet transaction
  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(betAmount),
    description: `Sala privada (${gameType}) — código ${code}`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  const gameId = `sala_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  res.json({
    ok: true,
    gameId,
    betAmount,
    newBalance: (deducted as { balance: number }).balance,
  });
}
