import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

/* ─── /api/games/match ─────────────────────────────────────────────────────────
   Registo server-side de uma partida de sala (fluxo Explorar). Ambos os
   participantes podem chamar — a criação é idempotente.

   Porque existe: no fluxo de salas ambos os jogadores já escrowaram a aposta
   via /api/bet/deduct; sem uma linha em `matches` o payout ficava impossível
   (win.ts exige player2_id + participante). Isto fecha o "buraco negro" de
   dinheiro das salas privadas.

   SECURITY:
   - Só participantes reais: o chamador tem de ser player1 ou player2.
   - Verificação de escrow: EXIGE que AMBOS tenham uma transacção `bet` de
     -betAmount nas últimas 2h. Impede criar partidas com aposta inflada.
   - Idempotente: se a partida já existe com estes participantes → ok.
   ────────────────────────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const WIN_RATE = 0.90;
const ESCROW_WINDOW_HOURS = 2;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, gameType, betAmount, opponentId } = (req.body ?? {}) as {
    gameId?: string; gameType?: string; betAmount?: number; opponentId?: string;
  };

  if (!gameId || !GAME_ID_RE.test(gameId)) { res.status(400).json({ error: "ID de jogo inválido" }); return; }
  if (!gameType || !["damas", "ludo", "xadrez"].includes(gameType)) { res.status(400).json({ error: "Tipo de jogo inválido" }); return; }
  if (!betAmount || typeof betAmount !== "number" || betAmount < 10 || betAmount > 5000) {
    res.status(400).json({ error: "Montante de aposta inválido" }); return;
  }
  if (!opponentId || !UUID_RE.test(opponentId) || opponentId === auth.userId) {
    res.status(400).json({ error: "Adversário inválido" }); return;
  }

  const admin = getSupabaseAdmin();

  // Idempotência — partida já registada
  const { data: existing } = await admin
    .from("matches")
    .select("id, player1_id, player2_id, status, paid_out")
    .eq("id", gameId)
    .maybeSingle();

  if (existing) {
    const e = existing as { player1_id: string; player2_id: string | null; status: string; paid_out: boolean };
    const isParticipant = e.player1_id === auth.userId || e.player2_id === auth.userId;
    if (!isParticipant) { res.status(403).json({ error: "Não és participante desta partida" }); return; }
    res.json({ ok: true, alreadyRegistered: true });
    return;
  }

  // Verificação de escrow: ambos os participantes têm de ter escrowado o valor
  const since = new Date(Date.now() - ESCROW_WINDOW_HOURS * 3600_000).toISOString();
  const { data: callerTx } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("type", "bet")
    .eq("amount", -Math.abs(betAmount))
    .gte("created_at", since)
    .limit(1);

  const { data: oppTx } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", opponentId)
    .eq("type", "bet")
    .eq("amount", -Math.abs(betAmount))
    .gte("created_at", since)
    .limit(1);

  if (!callerTx || callerTx.length === 0 || !oppTx || oppTx.length === 0) {
    res.status(403).json({ error: "Aposta não verificada para ambos os jogadores" });
    return;
  }

  const { error: insertErr } = await admin.from("matches").insert({
    id: gameId,
    game_type: gameType,
    player1_id: opponentId,
    player2_id: auth.userId,
    bet_amount: betAmount,
    winner_payout: Math.floor(betAmount * 2 * WIN_RATE),
    status: "active",
    created_at: new Date().toISOString(),
  });

  if (insertErr) {
    // Corrida benigna: o adversário registou em paralelo
    const code = (insertErr as { code?: string }).code ?? "";
    if (code === "23505" || /duplicate|unique/i.test(String(insertErr.message ?? ""))) {
      res.json({ ok: true, alreadyRegistered: true });
      return;
    }
    console.error("[games/match] Erro ao criar partida:", insertErr);
    res.status(500).json({ error: "Erro ao registar partida" });
    return;
  }

  res.json({ ok: true });
}
