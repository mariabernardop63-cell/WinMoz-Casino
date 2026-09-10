import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

const MIN_BET = 1;
const MAX_BET = 100000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, gameType, gameId, description } = (req.body ?? {}) as {
    amount?: number;
    gameType?: string;
    gameId?: string;
    description?: string;
  };

  if (!amount || typeof amount !== "number" || amount < MIN_BET || amount > MAX_BET) {
    res.status(400).json({ error: "Montante de aposta inválido" });
    return;
  }
  if (!gameType || !["damas","ludo","xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  // SECURITY (auditoria v2): dedução ATÓMICA via RPC — incrementa no SQL,
  // elimina double-spend (duas apostas concorrentes) e perda de créditos
  // que aterram entre a leitura e a escrita.
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -amount, p_min: 0 });

  if (adjustError) {
    console.error("[games/bet] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);

  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  const txDesc = description || `Aposta (${gameType}) - ${amount} MT`;

  const { error: txError } = await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(amount),
    description: txDesc,
    status: "approved",
    created_at: new Date().toISOString(),
  });
  if (txError) {
    // Transacção é o registo de auditoria — falha não pode passar silenciosa
    console.error("[games/bet] Erro ao registar transacção:", txError);
  }

  if (gameId && /^[A-Za-z0-9_-]{6,64}$/.test(gameId)) {
    // SECURITY (auditoria v2): nunca sobrescrever partida existente.
    // Cria apenas se o id não existir (bot/local ids já podem existir).
    const { data: existing } = await admin
      .from("matches")
      .select("id, player1_id, status")
      .eq("id", gameId)
      .maybeSingle();

    if (!existing) {
      await admin.from("matches").insert({
        id: gameId,
        game_type: gameType,
        player1_id: auth.userId,
        player1_name: (description || "").slice(0, 120) || null,
        bet_amount: amount,
        winner_payout: Math.floor(amount * 2 * 0.9),
        status: "active",
        created_at: new Date().toISOString(),
      });
    } else {
      // Partida já existe (criada pelo fluxo de salas/matchmaking):
      // só actualiza o valor da aposta se for o dono e estiver activa.
      const e = existing as { player1_id: string; status: string };
      if (e.player1_id === auth.userId && e.status === "active") {
        await admin.from("matches").update({
          bet_amount: amount,
          winner_payout: Math.floor(amount * 2 * 0.9),
        }).eq("id", gameId).eq("player1_id", auth.userId).eq("status", "active");
      }
    }
  }

  res.json({ ok: true, newBalance });
}
