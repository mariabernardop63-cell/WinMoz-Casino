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
    const { data: match } = await admin
      .from("matches")
      .select("player1_id, player2_id, status")
      .eq("id", gameId)
      .single();

    if (match) {
      const m = match as { player1_id: string; player2_id: string | null; status: string };
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
