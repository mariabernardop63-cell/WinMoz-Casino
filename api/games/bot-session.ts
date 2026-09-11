import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";
import crypto from "crypto";

/* ─── /api/games/bot-session ───────────────────────────────────────────────────
   Cria uma sessão de jogo contra um bot, do lado do SERVIDOR.

   Porque existe: os jogos contra bots têm um único jogador real, pelo que a
   linha em `matches` fica com player2_id = NULL — e o win.ts (correctamente)
   recusa payout sem adversário. Resultado: vitórias contra bots nunca eram
   creditadas. Este endpoint cria a partida com a marcação de bot controlada
   pelo servidor, permitindo o payout guardado no win.ts.

   SECURITY:
   - A aposta é debitada aqui (RPC atómico) — nunca no browser.
   - O id da partida é gerado no servidor (prefixo "wmb_") — o cliente não
     pode forjar partidas de bot com ids próprios.
   - O win.ts só paga partidas "wmb_" com duração mínima e limite diário.
   ────────────────────────────────────────────────────────────────────────────── */

const GAME_ID_RE = /^wmb_[a-z0-9]{10,24}$/;
const WIN_RATE = 0.90;

const BOT_NAMES = [
  "Miguel Pro", "SuraBot", "Kácia", "Xitique", "Dama Mestre",
  "Rafa Joga", "Tio Zeca", "Prof Komba", "Lady Pawns", "Rei da Rua",
];

function pickBotName(recent: string[] | null): { name: string; balance: number } {
  let name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  for (let i = 0; i < 6 && recent && recent.includes(name); i++) {
    name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  }
  const balance = Math.floor(Math.random() * 400) + 100;
  return { name, balance };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameType, betAmount } = (req.body ?? {}) as { gameType?: string; betAmount?: number };

  if (!gameType || !["damas", "xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }
  if (!betAmount || typeof betAmount !== "number" || betAmount < 10 || betAmount > 5000) {
    res.status(400).json({ error: "Montante de aposta inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // Débito atómico — "Saldo insuficiente" se falhar
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -betAmount, p_min: 0 });

  if (adjustError) {
    console.error("[games/bot-session] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);
  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" });
    return;
  }

  const { name: botName, balance: botBalance } = pickBotName(null);
  const gameId = `wmb_${crypto.randomBytes(9).toString("hex")}`;

  const { error: matchErr } = await admin.from("matches").insert({
    id: gameId,
    game_type: gameType,
    player1_id: auth.userId,
    player2_id: null, // bot — resolvido pelo win.ts com guards próprios
    player1_name: `Aposta (${gameType}) vs ${botName}`,
    bet_amount: betAmount,
    winner_payout: Math.floor(betAmount * 2 * WIN_RATE),
    status: "active",
    created_at: new Date().toISOString(),
  });

  if (matchErr) {
    // Rollback atómico do débito
    await admin.rpc("adjust_balance", { p_user_id: auth.userId, p_delta: betAmount, p_min: 0 });
    console.error("[games/bot-session] Erro ao criar partida:", matchErr);
    res.status(500).json({ error: "Erro ao criar sessão de jogo" });
    return;
  }

  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(betAmount),
    description: `Aposta (${gameType}) vs ${botName}`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  res.json({ ok: true, gameId, botName, botBalance, newBalance });
}
