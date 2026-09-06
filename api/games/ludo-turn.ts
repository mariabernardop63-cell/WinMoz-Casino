import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

type PlayerColor = "blue" | "green";

function colorForPlayer(
  playerId: string,
  match: { player1_id: string; player2_id: string | null }
): PlayerColor | null {
  if (match.player1_id === playerId) return "blue";
  if (match.player2_id === playerId) return "green";
  return null;
}

/**
 * POST /api/games/ludo-turn
 * Authoritative turn hand-off for Ludo.
 *
 * Body:
 *   gameId   — match id
 *   keepTurn — true when the move grants an extra roll (6 / capture / home),
 *              false (default) to pass the turn to the opponent
 *   reopen   — true when both players accepted a rematch on the SAME match
 *              id: clears winner, status back to "active" and resets turn to
 *              blue so the server-side roll validation keeps working.
 *
 * `matches.current_turn` stores the colour ("blue"|"green") of the player who
 * rolls next; blue (player1) starts. Only the current turn owner may mutate
 * it, so a stale or duplicated client hand-off can never steal the turn.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, keepTurn, reopen } = (req.body ?? {}) as {
    gameId?: string;
    keepTurn?: boolean;
    reopen?: boolean;
  };

  if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
    res.status(400).json({ error: "ID de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  const { data: match, error: matchErr } = await admin
    .from("matches")
    .select("player1_id, player2_id, status, current_turn")
    .eq("id", gameId)
    .single();

  if (matchErr || !match) {
    res.status(404).json({ error: "Partida não encontrada" });
    return;
  }

  const m = match as {
    player1_id: string;
    player2_id: string | null;
    status: string;
    current_turn: string | null;
  };

  const myColor = colorForPlayer(auth.userId, m);
  if (!myColor) {
    res.status(403).json({ error: "Não és participante desta partida" });
    return;
  }

  // ── Rematch reopen: both participants may revive a finished match ────────
  if (reopen) {
    if (m.status !== "finished") {
      res.json({ ok: true, turn: "blue" });
      return;
    }
    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("matches")
      .update({
        status: "active",
        winner_id: null,
        current_turn: "blue",
        turn_updated_at: now,
        completed_at: null,
      })
      .eq("id", gameId);
    if (updErr) {
      console.error("[ludo-turn] Erro ao reabrir partida:", updErr);
      res.status(500).json({ error: "Erro ao reabrir partida" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, turn: "blue" });
    return;
  }

  if (m.status === "finished") {
    res.status(409).json({ error: "Partida já terminada" });
    return;
  }

  const expectedTurn = m.current_turn ?? "blue";
  if (expectedTurn !== myColor) {
    res.status(423).json({ error: "Não é a tua vez" });
    return;
  }

  const nextColor: PlayerColor = keepTurn
    ? myColor
    : myColor === "blue" ? "green" : "blue";

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("matches")
    .update({ current_turn: nextColor, turn_updated_at: now })
    .eq("id", gameId)
    .neq("status", "finished");

  if (updateErr) {
    console.error("[ludo-turn] Erro ao actualizar turno:", updateErr);
    res.status(500).json({ error: "Erro ao actualizar turno" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, turn: nextColor, turnUpdatedAt: now });
}
