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

  const validGameId = gameId && /^[A-Za-z0-9_-]{6,64}$/.test(gameId) ? gameId : null;

  // ── SECURITY: IDEMPOTÊNCIA POR PARTIDA ─────────────────────────────────────
  // A flag sessionStorage wm_bet_deducted_* vive por TAB — ao reabrir o jogo
  // num novo separador a flag perde-se e o cliente volta a chamar /bet,
  // cobrando a aposta DUAS VEZES. Com a partida já registada e o chamador
  // como participante, a aposta já foi escrowada → devolve ok SEM cobrar.
  if (validGameId) {
    const { data: existing } = await admin
      .from("matches")
      .select("id, player1_id, player2_id, status, paid_out, bet_amount")
      .eq("id", validGameId)
      .maybeSingle();

    if (existing) {
      const e = existing as {
        player1_id: string; player2_id: string | null;
        status: string; paid_out: boolean; bet_amount: number;
      };
      const isParticipant = e.player1_id === auth.userId || e.player2_id === auth.userId;

      if (isParticipant) {
        if (e.status === "active" && !e.paid_out) {
          // Já pagou esta partida — idempotente
          const { data: bal } = await admin.from("profiles").select("balance")
            .eq("id", auth.userId).maybeSingle();
          res.json({ ok: true, newBalance: Number((bal as { balance: number } | null)?.balance ?? 0), alreadyPaid: true });
          return;
        }
        // Partida terminada — não cobrar de novo com o mesmo id
        res.status(409).json({ error: "Partida já terminada" });
        return;
      }

      // Não é participante:
      if (e.status !== "active" || e.paid_out) {
        res.status(409).json({ error: "Partida já terminada" });
        return;
      }
      if (e.player2_id) {
        res.status(409).json({ error: "Partida já completa" });
        return;
      }

      // Slot de player2 livre (matchmaking público): cobra e reclama o slot
      // atomicamente. Isto fecha o buraco negro do matchmaking público, em que
      // a aposta do 2.º jogador era cobrada mas a partida ficava sem player2
      // e o vencedor nunca recebia o prémio.
      const { data: balanceRow, error: adjustError } = await admin
        .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -amount, p_min: 0 });

      if (adjustError) {
        console.error("[games/bet] Erro ao debitar saldo:", adjustError);
        res.status(500).json({ error: "Erro ao debitar saldo" });
        return;
      }
      const nb = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);
      if (nb === null) {
        res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" });
        return;
      }

      const { data: claimed, error: claimErr } = await admin
        .from("matches")
        .update({ player2_id: auth.userId })
        .eq("id", validGameId)
        .eq("status", "active")
        .is("player2_id", null)
        .select("id").maybeSingle();

      if (claimErr || !claimed) {
        // Outro jogador reclamou o slot em paralelo — devolve o saldo
        await admin.rpc("adjust_balance", { p_user_id: auth.userId, p_delta: amount, p_min: 0 });
        res.status(409).json({ error: "Partida já completa" });
        return;
      }

      await admin.from("transactions").insert({
        user_id: auth.userId,
        type: "bet",
        amount: -Math.abs(amount),
        description: (description || `Aposta (${gameType}) - ${amount} MT`).slice(0, 160),
        status: "approved",
        created_at: new Date().toISOString(),
      });

      res.json({ ok: true, newBalance: nb });
      return;
    }
  }

  // ── Fluxo normal: cobrar atómicamente ──────────────────────────────────────
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -amount, p_min: 0 });

  if (adjustError) {
    console.error("[games/bet] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);

  if (newBalance === null) {
    res.status(400).json({ error: "Saldo insuficiente", code: "INSUFFICIENT_BALANCE" });
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

  if (validGameId) {
    // Cria apenas se o id não existir (verificado acima — sem corrida real,
    // mas mantido por defesa).
    await admin.from("matches").insert({
      id: validGameId,
      game_type: gameType,
      player1_id: auth.userId,
      player1_name: (description || "").slice(0, 120) || null,
      bet_amount: amount,
      winner_payout: Math.floor(amount * 2 * 0.9),
      status: "active",
      created_at: new Date().toISOString(),
    });
  }

  res.json({ ok: true, newBalance });
}
