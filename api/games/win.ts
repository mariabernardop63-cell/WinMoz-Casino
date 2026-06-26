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

  // SECURITY: Atomically mark the match as finished BEFORE crediting.
  // The .neq("status","finished") filter ensures only one concurrent call wins —
  // any duplicate or race-condition call finds status already "finished" and is rejected.
  const { data: updated, error: updateMatchErr } = await admin
    .from("matches")
    .update({
      winner_id: auth.userId,
      status: "finished",
      completed_at: new Date().toISOString(),
    })
    .eq("id", gameId)
    .neq("status", "finished") // atomic idempotency guard
    .or(`player1_id.eq.${auth.userId},player2_id.eq.${auth.userId}`) // SECURITY: only real participants
    .select("id, bet_amount, player1_id, player2_id, game_type")
    .maybeSingle();

  if (updateMatchErr) {
    console.error("[games/win] Erro ao actualizar partida:", updateMatchErr);
    res.status(500).json({ error: "Erro ao processar vitória" });
    return;
  }

  if (!updated) {
    // Either match not found, already finished, or caller is not a participant
    const { data: match } = await admin
      .from("matches")
      .select("status, winner_id, player1_id, player2_id")
      .eq("id", gameId)
      .maybeSingle();

    if (!match) {
      res.status(404).json({ error: "Partida não encontrada" });
      return;
    }
    if ((match as { status: string }).status === "finished") {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }
    // Caller is not a participant
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

  // SECURITY: payout is always calculated from the DB's bet_amount, never from client input
  const verifiedBet = Math.abs(Number(m.bet_amount) || 0);
  if (verifiedBet <= 0) {
    res.status(400).json({ error: "Aposta inválida na partida" });
    return;
  }

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
