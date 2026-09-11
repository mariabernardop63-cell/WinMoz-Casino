import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

const WIN_RATE = 0.90;
const MAX_PAYOUT = 200000;

/* ── Guardas de payout de bots ────────────────────────────────────────────────
   Partidas contra bots têm player2_id = NULL (o bot não tem conta). O payout
   excede a escrow do jogador (a "casa" cobre o lado do bot), por isso é
   limitado:
   - id TEM de começar por "wmb_" (gerado pelo servidor em /games/bot-session)
   - duração mínima da partida: 90s (uma partida real demora minutos)
   - limite diário: 25 vitórias pagas contra bots por utilizador
   Sem estas guardas, "bet sozinho + win" voltava a ser uma máquina de dinheiro.
   ──────────────────────────────────────────────────────────────────────────── */
const BOT_ID_PREFIX = "wmb_";
const BOT_MIN_DURATION_MS = 90_000;
const BOT_DAILY_WIN_CAP = 25;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, gameType } = (req.body ?? {}) as {
    gameId?: string;
    gameType?: string;
    betAmount?: number; // accepted but IGNORED — always use DB value for security
  };

  if (!gameId || typeof gameId !== "string") {
    res.status(400).json({ error: "ID de jogo inválido" });
    return;
  }
  if (!gameType || !["damas","ludo","xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // 1) Ler a partida para decidir o caminho (2 jogadores vs bot)
  const { data: matchRow } = await admin
    .from("matches")
    .select("id, status, paid_out, player1_id, player2_id, bet_amount, created_at")
    .eq("id", gameId)
    .maybeSingle();

  if (!matchRow) {
    res.status(404).json({ error: "Partida não encontrada" });
    return;
  }
  const m0 = matchRow as {
    status: string; paid_out: boolean;
    player1_id: string; player2_id: string | null;
    bet_amount: number; created_at: string;
  };

  if (m0.player1_id !== auth.userId && m0.player2_id !== auth.userId) {
    res.status(403).json({ error: "Não és participante desta partida" });
    return;
  }
  if (m0.status === "finished" || m0.paid_out) {
    res.status(409).json({ error: "Partida já terminada" });
    return;
  }

  const isBotMatch = m0.player2_id === null;

  // 2) Guardas para partidas de bot
  if (isBotMatch) {
    if (!gameId.startsWith(BOT_ID_PREFIX)) {
      // Ids "solo" sem marca de bot continuam bloqueados (anti money-printing)
      res.status(400).json({ error: "Partida sem adversário confirmado" });
      return;
    }
    const createdAt = new Date(m0.created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt < BOT_MIN_DURATION_MS) {
      res.status(400).json({ error: "A partida ainda não pode ser fechada" });
      return;
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: paidToday } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("player1_id", auth.userId)
      .is("player2_id", null)
      .eq("paid_out", true)
      .gte("completed_at", startOfDay.toISOString());

    if ((paidToday ?? 0) >= BOT_DAILY_WIN_CAP) {
      res.status(429).json({ error: "Limite diário de vitórias contra bots atingido" });
      return;
    }
  }

  // 3) Claim atómico do payout — único por partida
  //    (`paid_out` garante payout ÚNICO mesmo que a partida seja reaberta)
  const { data: updated, error: updateMatchErr } = await admin
    .from("matches")
    .update({
      winner_id: auth.userId,
      status: "finished",
      completed_at: new Date().toISOString(),
      paid_out: true,
    })
    .eq("id", gameId)
    .eq("paid_out", false)       // payout único
    .neq("status", "finished")   // atomic idempotency guard
    .or(`player1_id.eq.${auth.userId},player2_id.eq.${auth.userId}`) // SECURITY: only real participants
    .select("id, bet_amount, player1_id, player2_id, game_type")
    .maybeSingle();

  if (updateMatchErr) {
    console.error("[games/win] Erro ao actualizar partida:", updateMatchErr);
    res.status(500).json({ error: "Erro ao processar vitória" });
    return;
  }

  if (!updated) {
    // Perdeu a corrida atómica — reconcilia o estado para a mensagem certa
    const { data: match } = await admin
      .from("matches")
      .select("status, winner_id, player1_id, player2_id, paid_out")
      .eq("id", gameId)
      .maybeSingle();

    if (!match) {
      res.status(404).json({ error: "Partida não encontrada" });
      return;
    }
    const row = match as { status: string; paid_out: boolean; player2_id: string | null };
    if (row.status === "finished" || row.paid_out) {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }
    if (!row.player2_id) {
      res.status(400).json({ error: "Partida sem adversário confirmado" });
      return;
    }
    res.status(403).json({ error: "Não és participante desta partida" });
    return;
  }

  const m = updated as {
    id: string;
    bet_amount: number;
    player1_id: string;
    player2_id: string | null;
    game_type: string;
  };

  // SECURITY: payout is always calculated from the DB's bet_amount, never from client input.
  const verifiedBet = Math.abs(Number(m.bet_amount) || 0);
  if (verifiedBet <= 0) {
    res.status(400).json({ error: "Aposta inválida na partida" });
    return;
  }

  const payout = Math.min(Math.floor(verifiedBet * 2 * WIN_RATE), MAX_PAYOUT);

  // Crédito ATÓMICO via RPC (hardening v2): nunca sobrescreve saldo concorrente
  const { data: newBalanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: payout, p_min: 0 });

  if (adjustError || newBalanceRow === null || newBalanceRow === undefined) {
    console.error("[games/win] Erro ao creditar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao creditar saldo" });
    return;
  }
  const newBalance = Number(newBalanceRow);

  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "win",
    amount: payout,
    description: `Vitória (${gameType}) +${payout} MT`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  const earningsRecord = {
    match_id: gameId,
    game_type: gameType,
    bet_amount: verifiedBet,
    payout,
    platform_cut: Math.round(verifiedBet * 2 * (1 - WIN_RATE)),
    created_at: new Date().toISOString(),
  };
  try { await admin.from("platform_earnings").insert(earningsRecord); } catch { /* best-effort */ }

  res.json({ ok: true, payout, newBalance });
}
