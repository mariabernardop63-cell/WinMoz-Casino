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

  // SECURITY (auditoria v2):
  // 1) `paid_out` garante payout ÚNICO por partida — mesmo que a partida seja
  //    reaberta/reiniciada, nunca paga duas vezes.
  // 2) `player2_id NOT NULL` exige que a aposta do adversário tenha sido
  //    escrowada — partidas solo não geram payout (elimina a máquina de
  //    dinheiro "bet sozinho + win").
  // 3) O update atómico (.neq status+paid_out) mantém a idempotência por
  //    partida; quem chega segundo encontra paid_out=true e é rejeitado.
  const { data: updated, error: updateMatchErr } = await admin
    .from("matches")
    .update({
      winner_id: auth.userId,
      status: "finished",
      completed_at: new Date().toISOString(),
      paid_out: true,
    })
    .eq("id", gameId)
    .eq("paid_out", false) // payout único
    .neq("status", "finished") // atomic idempotency guard
    .not("player2_id", "is", null) // exige adversário com aposta escrowada
    .or(`player1_id.eq.${auth.userId},player2_id.eq.${auth.userId}`) // SECURITY: only real participants
    .select("id, bet_amount, player1_id, player2_id, game_type")
    .maybeSingle();

  if (updateMatchErr) {
    console.error("[games/win] Erro ao actualizar partida:", updateMatchErr);
    res.status(500).json({ error: "Erro ao processar vitória" });
    return;
  }

  if (!updated) {
    const { data: match } = await admin
      .from("matches")
      .select("status, winner_id, player1_id, player2_id, paid_out")
      .eq("id", gameId)
      .maybeSingle();

    if (!match) {
      res.status(404).json({ error: "Partida não encontrada" });
      return;
    }
    const row = match as { status: string; paid_out: boolean };
    if (row.status === "finished" || row.paid_out) {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }
    if (!row.player2_id) {
      res.status(400).json({ error: "Partida sem adversário confirmado" });
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

  // SECURITY: payout is always calculated from the DB's bet_amount, never from client input.
  // bet_amount é criado pelo servidor no momento da aposta (RLS impede edição).
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
