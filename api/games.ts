import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";
import crypto from "crypto";

/* ─── /api/games — função consolidada (limite de serverless functions) ────────
   Rotas (vercel.json reescreve /api/games/:action → /api/games?_action=…):
     ?_action=bet              (POST)  aposta atómica + claim de player2
     ?_action=win              (POST)  payout único do vencedor (2 jogadores/bot)
     ?_action=match            (POST)  registo idempotente de partida de sala
     ?_action=bot-session      (POST)  sessão contra bot (server-side)
     ?_action=ludo-dice        (POST)  dado autoritativo do Ludo
     ?_action=ludo-turn        (POST)  passagem/reabertura de turno do Ludo
     ?_action=record-bet-reward (POST) bónus de convite/afiliado por aposta
   ───────────────────────────────────────────────────────────────────────────── */

const WIN_RATE = 0.90;
const MAX_PAYOUT = 200000;

/* ── Guardas de payout de bots ────────────────────────────────────────────────
   Partidas contra bots têm player2_id = NULL (o bot não tem conta). O payout
   excede a escrow do jogador (a "casa" cobre o lado do bot), por isso é
   limitado:
   - id TEM de começar por "wmb_" (gerado pelo servidor em bot-session)
   - duração mínima da partida: 90s (uma partida real demora minutos)
   - limite diário: 25 vitórias pagas contra bots por utilizador
   Sem estas guardas, "bet sozinho + win" voltava a ser uma máquina de dinheiro.
   ──────────────────────────────────────────────────────────────────────────── */
const BOT_ID_PREFIX = "wmb_";
const BOT_MIN_DURATION_MS = 90_000;
const BOT_DAILY_WIN_CAP = 25;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const ESCROW_WINDOW_HOURS = 2;

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=bet
// ═════════════════════════════════════════════════════════════════════════════
async function handleBet(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, gameType, gameId, description } = (req.body ?? {}) as {
    amount?: number;
    gameType?: string;
    gameId?: string;
    description?: string;
  };

  if (!amount || typeof amount !== "number" || amount < 1 || amount > 100000) {
    res.status(400).json({ error: "Montante de aposta inválido" });
    return;
  }
  if (!gameType || !["damas","ludo","xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  const validGameId = gameId && GAME_ID_RE.test(gameId) ? gameId : null;

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
      // atomicamente. Fecha o buraco negro em que a aposta do 2.º jogador era
      // cobrada mas a partida ficava sem player2 e o vencedor nunca recebia.
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
    const { error: insertErr } = await admin.from("matches").insert({
      id: validGameId,
      game_type: gameType,
      player1_id: auth.userId,
      player1_name: (description || "").slice(0, 120) || null,
      bet_amount: amount,
      winner_payout: Math.floor(amount * 2 * WIN_RATE),
      status: "active",
      created_at: new Date().toISOString(),
    });
    if (insertErr) console.error("[games/bet] Erro ao criar partida:", insertErr);
  }

  res.json({ ok: true, newBalance });
}

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=win
// ═════════════════════════════════════════════════════════════════════════════
async function handleWin(req: VercelRequest, res: VercelResponse) {
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

  // 1) Ler a partida para decidir o caminho (2 jogadores vs bot)
  const { data: matchRow } = await admin
    .from("matches")
    .select("id, status, paid_out, player1_id, player2_id, bet_amount, created_at")
    .eq("id", gameId)
    .maybeSingle();

  if (!matchRow) {
    res.status(404).json({ error: "Partida não encontrada" });
    return;
  }
  const m0 = matchRow as {
    status: string; paid_out: boolean;
    player1_id: string; player2_id: string | null;
    bet_amount: number; created_at: string;
  };

  if (m0.player1_id !== auth.userId && m0.player2_id !== auth.userId) {
    res.status(403).json({ error: "Não és participante desta partida" });
    return;
  }
  if (m0.status === "finished" || m0.paid_out) {
    res.status(409).json({ error: "Partida já terminada" });
    return;
  }

  const isBotMatch = m0.player2_id === null;

  // 2) Guardas para partidas de bot
  if (isBotMatch) {
    if (!gameId.startsWith(BOT_ID_PREFIX)) {
      // Ids "solo" sem marca de bot continuam bloqueados (anti money-printing)
      res.status(400).json({ error: "Partida sem adversário confirmado" });
      return;
    }
    const createdAt = new Date(m0.created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt < BOT_MIN_DURATION_MS) {
      res.status(400).json({ error: "A partida ainda não pode ser fechada" });
      return;
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: paidToday } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("player1_id", auth.userId)
      .is("player2_id", null)
      .eq("paid_out", true)
      .gte("completed_at", startOfDay.toISOString());

    if ((paidToday ?? 0) >= BOT_DAILY_WIN_CAP) {
      res.status(429).json({ error: "Limite diário de vitórias contra bots atingido" });
      return;
    }
  }

  // 3) Claim atómico do payout — único por partida
  const { data: updated, error: updateMatchErr } = await admin
    .from("matches")
    .update({
      winner_id: auth.userId,
      status: "finished",
      completed_at: new Date().toISOString(),
      paid_out: true,
    })
    .eq("id", gameId)
    .eq("paid_out", false)       // payout único
    .neq("status", "finished")   // atomic idempotency guard
    .or(`player1_id.eq.${auth.userId},player2_id.eq.${auth.userId}`) // SECURITY: only real participants
    .select("id, bet_amount, player1_id, player2_id, game_type")
    .maybeSingle();

  if (updateMatchErr) {
    console.error("[games/win] Erro ao actualizar partida:", updateMatchErr);
    res.status(500).json({ error: "Erro ao processar vitória" });
    return;
  }

  if (!updated) {
    // Perdeu a corrida atómica — reconcilia o estado para a mensagem certa
    const { data: match } = await admin
      .from("matches")
      .select("status, winner_id, player1_id, player2_id, paid_out")
      .eq("id", gameId)
      .maybeSingle();

    if (!match) {
      res.status(404).json({ error: "Partida não encontrada" });
      return;
    }
    const row = match as { status: string; paid_out: boolean; player2_id: string | null };
    if (row.status === "finished" || row.paid_out) {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }
    if (!row.player2_id) {
      res.status(400).json({ error: "Partida sem adversário confirmado" });
      return;
    }
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

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=match — registo idempotente de partida de sala (fluxo Explorar)
// ═════════════════════════════════════════════════════════════════════════════
async function handleMatch(req: VercelRequest, res: VercelResponse) {
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

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=bot-session — cria sessão contra bot no servidor
// ═════════════════════════════════════════════════════════════════════════════
const BOT_NAMES = [
  "Miguel Pro", "SuraBot", "Kácia", "Xitique", "Dama Mestre",
  "Rafa Joga", "Tio Zeca", "Prof Komba", "Lady Pawns", "Rei da Rua",
];

async function handleBotSession(req: VercelRequest, res: VercelResponse) {
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

  let botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const botBalance = Math.floor(Math.random() * 400) + 100;
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

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=ludo-dice — dado autoritativo do Ludo
// ═════════════════════════════════════════════════════════════════════════════
import { webcrypto } from "crypto";

function secureRandom(): number {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function generateSecureDice(allInBase: boolean, stuckTurns: number, consecutiveSixes: number): number {
  if (consecutiveSixes >= 2) {
    return Math.floor(secureRandom() * 5) + 1;
  }
  if (allInBase && stuckTurns >= 9) {
    return 6;
  }
  return Math.floor(secureRandom() * 6) + 1;
}

function colorForPlayer(
  playerId: string,
  match: { player1_id: string; player2_id: string | null }
): "blue" | "green" | null {
  if (match.player1_id === playerId) return "blue";
  if (match.player2_id === playerId) return "green";
  return null;
}

async function handleLudoDice(req: VercelRequest, res: VercelResponse) {
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

  if (gameId !== "local" && !gameId.startsWith("bot_") && !gameId.startsWith("wm")) {
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

    const isParticipant = m.player1_id === auth.userId || m.player2_id === auth.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Não és participante desta partida" });
      return;
    }
    if (m.status === "finished") {
      res.status(409).json({ error: "Partida já terminada" });
      return;
    }

    // ── Authoritative turn enforcement ─────────────────────────────────────
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

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=ludo-turn — passagem/reabertura de turno do Ludo
// ═════════════════════════════════════════════════════════════════════════════
type PlayerColor = "blue" | "green";

async function handleLudoTurn(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { gameId, keepTurn, reopen, force } = (req.body ?? {}) as {
    gameId?: string;
    keepTurn?: boolean;
    reopen?: boolean;
    force?: boolean;
  };

  if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
    res.status(400).json({ error: "ID de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

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
  let flippingForAbsent = false;
  if (expectedTurn !== myColor) {
    // Auto-play continuation: a participant may flip a STALE turn (>30s,
    // well past the 30s move timer) on behalf of an absent player so the
    // game keeps flowing when someone leaves mid-turn.
    let stale = false;
    if (force && m.current_turn && m.turn_updated_at) {
      stale = Date.now() - new Date(m.turn_updated_at).getTime() > 30_000;
    }
    if (!stale) {
      res.status(423).json({ error: "Não é a tua vez", turn: expectedTurn });
      return;
    }
    flippingForAbsent = true;
  }

  let nextColor: PlayerColor;
  if (flippingForAbsent) {
    nextColor = myColor;
  } else {
    nextColor = keepTurn
      ? myColor
      : myColor === "blue" ? "green" : "blue";
  }

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

// ═════════════════════════════════════════════════════════════════════════════
// ?_action=record-bet-reward — bónus de convite/afiliado por aposta
// ═════════════════════════════════════════════════════════════════════════════
const INVITE_REWARD = 2.5;       // MT per invite
const AFFILIATE_REWARD = 5;      // MT per bet by affiliate's referral
const AFFILIATE_MAX_BETS = 5;    // Max bets tracked per referral

async function handleRecordBetReward(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const betUserId = auth.userId; // The user who just placed a bet

  const admin = getSupabaseAdmin();

  try {
    // SECURITY (auditoria v2): incremento ATÓMICO do contador via RPC.
    const { data: incremented, error: incrError } = await admin
      .rpc("increment_referral_bets", { p_referred: betUserId, p_max: AFFILIATE_MAX_BETS });

    if (incrError) {
      console.error("[record-bet-reward] Erro no contador atómico:", incrError.message);
      res.json({ ok: true, rewarded: false });
      return;
    }

    if (!incremented || (incremented as number[])?.length === 0) {
      res.json({ ok: true, rewarded: false, reason: "no_referral_or_max_bets" });
      return;
    }

    const { data: referral } = await admin
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", betUserId)
      .maybeSingle();

    if (!referral) {
      res.json({ ok: true, rewarded: false });
      return;
    }
    const referrerId = (referral as { referrer_id: string }).referrer_id;

    const { data: referrerProfile } = await admin
      .from("profiles")
      .select("is_affiliate")
      .eq("id", referrerId)
      .maybeSingle();

    if (!referrerProfile) {
      res.json({ ok: true, rewarded: false });
      return;
    }

    const rp = referrerProfile as { is_affiliate?: boolean };
    const reward = rp.is_affiliate ? AFFILIATE_REWARD : INVITE_REWARD;

    const { error: creditError } = await admin
      .rpc("adjust_balance", { p_user_id: referrerId, p_delta: reward, p_min: 0 });

    if (creditError) {
      console.error("[record-bet-reward] Erro ao creditar:", creditError.message);
      res.json({ ok: true, rewarded: false });
      return;
    }

    await admin.from("transactions").insert({
      user_id: referrerId,
      type: "win",
      amount: reward,
      description: `Bónus de convite — aposta do convidado`,
      status: "approved",
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, rewarded: true, reward });
  } catch (err) {
    console.error("[record-bet-reward] Error:", err instanceof Error ? err.message : "unknown");
    res.json({ ok: true, rewarded: false }); // Non-critical — don't block game flow
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "bet":               return handleBet(req, res);
    case "win":               return handleWin(req, res);
    case "match":             return handleMatch(req, res);
    case "bot-session":       return handleBotSession(req, res);
    case "ludo-dice":         return handleLudoDice(req, res);
    case "ludo-turn":         return handleLudoTurn(req, res);
    case "record-bet-reward": return handleRecordBetReward(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
