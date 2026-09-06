import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";
import { webcrypto } from "crypto";

function secureRandom(): number {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function generateSecureDice(
  allInBase: boolean,
  stuckTurns: number,
  consecutiveSixes: number
): number {
  if (consecutiveSixes >= 2) {
    return Math.floor(secureRandom() * 5) + 1;
  }
  if (allInBase && stuckTurns >= 9) {
    return 6;
  }
  return Math.floor(secureRandom() * 6) + 1;
}

/**
 * Colour is derived from match ownership: player1 = blue, player2 = green.
 * This matches how matchmaking/rooms assign the ?color= URL param, so the
 * server can authoritatively decide whose turn it is without trusting the
 * client-supplied colour.
 */
function colorForPlayer(
  playerId: string,
  match: { player1_id: string; player2_id: string | null }
): "blue" | "green" | null {
  if (match.player1_id === playerId) return "blue";
  if (match.player2_id === playerId) return "green";
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, allInBase, stuckTurns, consecutiveSixes } = (req.body ?? {}) as {
    gameId?: string;
    allInBase?: boolean;
    stuckTurns?: number;
    consecutiveSixes?: number;
  };

  if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
    res.status(400).json({ error: "ID de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  if (gameId !== "local" && !gameId.startsWith("bot_")) {
    const { data: match, error: matchErr } = await admin
      .from("matches")
      .select("player1_id, player2_id, status, current_turn, turn_updated_at")
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
      turn_updated_at: string | null;
    };

    const isParticipant =
      m.player1_id === auth.userId || m.player2_id === auth.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Não és participante desta partida" });
      return;
    }
    if (m.status === "finished") {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }

    // ── Authoritative turn enforcement ─────────────────────────────────────
    // Blue (player1) always moves first. current_turn stores the colour of
    // the player whose roll is next; null means the game hasn't started yet.
    // A turn left untouched for >45s (player quit/crashed mid-turn) may be
    // reclaimed by the opponent so the game can never freeze permanently.
    const TURN_STALE_MS = 45_000;
    const myColor = colorForPlayer(auth.userId, m);
    const expectedTurn = m.current_turn ?? "blue";
    let turnStale = false;
    if (m.current_turn && m.turn_updated_at) {
      turnStale = Date.now() - new Date(m.turn_updated_at).getTime() > TURN_STALE_MS;
    }
    if (myColor && expectedTurn !== myColor && !turnStale) {
      res.status(423).json({ error: "Não é a tua vez de jogar" });
      return;
    }

    // Claim the turn for this roll. Keeping current_turn on the same player
    // is correct: a 6 / capture / home-entry grants an extra roll, and the
    // /api/games/ludo-turn hand-off flips it after a non-bonus move.
    if (myColor) {
      await admin
        .from("matches")
        .update({ current_turn: myColor, turn_updated_at: new Date().toISOString() })
        .eq("id", gameId);
    }
  }

  const diceValue = generateSecureDice(
    Boolean(allInBase),
    Number(stuckTurns) || 0,
    Number(consecutiveSixes) || 0
  );

  res.setHeader("Cache-Control", "no-store");
  res.json({ value: diceValue, timestamp: Date.now() });
}
