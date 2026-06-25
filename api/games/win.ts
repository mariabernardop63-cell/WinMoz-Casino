import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

const WIN_RATE = 0.90;
const MAX_PAYOUT = 200000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, gameType, betAmount } = (req.body ?? {}) as {
    gameId?: string;
    gameType?: string;
    betAmount?: number;
  };

  if (!gameId || typeof gameId !== "string") {
    res.status(400).json({ error: "ID de jogo inválido" });
    return;
  }
  if (!gameType || !["damas","ludo","xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }
  if (!betAmount || typeof betAmount !== "number" || betAmount <= 0) {
    res.status(400).json({ error: "Montante inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  const { data: match, error: matchError } = await admin
    .from("matches")
    .select("id, bet_amount, status, winner_id, player1_id, player2_id, game_type")
    .eq("id", gameId)
    .single();

  if (matchError || !match) {
    res.status(404).json({ error: "Partida não encontrada" });
    return;
  }

  const m = match as {
    id: string;
    bet_amount: number;
    status: string;
    winner_id: string | null;
    player1_id: string;
    player2_id: string | null;
    game_type: string;
  };

  if (m.status === "finished" && m.winner_id) {
    res.status(409).json({ error: "Partida já terminada" });
    return;
  }

  const isParticipant =
    m.player1_id === auth.userId ||
    m.player2_id === auth.userId ||
    m.player2_id === null;

  if (!isParticipant) {
    res.status(403).json({ error: "Não és participante desta partida" });
    return;
  }

  const verifiedBet = Math.min(m.bet_amount || betAmount, betAmount);
  const payout = Math.min(Math.floor(verifiedBet * 2 * WIN_RATE), MAX_PAYOUT);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("balance")
    .eq("id", auth.userId)
    .single();

  if (profileError || !profile) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
    return;
  }

  const currentBalance = parseFloat(String((profile as { balance: number }).balance ?? 0));
  const newBalance = Math.round((currentBalance + payout) * 100) / 100;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", auth.userId);

  if (updateError) {
    res.status(500).json({ error: "Erro ao creditar saldo" });
    return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "win",
    amount: payout,
    description: `Vitória (${gameType}) +${payout} MT`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  await admin
    .from("matches")
    .update({
      winner_id: auth.userId,
      status: "finished",
      completed_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  const earningsRecord = {
    match_id: gameId,
    game_type: gameType,
    bet_amount: verifiedBet,
    payout,
    platform_cut: Math.round(verifiedBet * 2 * (1 - WIN_RATE)),
    created_at: new Date().toISOString(),
  };
  await admin.from("platform_earnings").insert(earningsRecord).catch(() => {});

  res.json({ ok: true, payout, newBalance });
}
