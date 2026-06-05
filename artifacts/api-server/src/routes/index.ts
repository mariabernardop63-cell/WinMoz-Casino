import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/complete-registration", async (req, res) => {
  try {
    const { user_id, full_name, phone, invite_code_used } = req.body as {
      user_id?: string;
      full_name?: string;
      phone?: string;
      invite_code_used?: string;
    };

    if (!user_id) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }

    res.json({ success: true, user_id, full_name, phone, invite_code_used });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Recharge code validation ── */
router.post("/recharge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code || code.length !== 15) {
      res.status(400).json({ error: "Código inválido" });
      return;
    }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !supabaseServiceKey) {
      req.log.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
      res.status(500).json({ error: "Serviço indisponível" });
      return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the user JWT and get user id
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      res.status(401).json({ error: "Sessão inválida" });
      return;
    }
    const userId = userData.user.id;

    // Look up the recharge code — must exist, be unused and belong to this platform
    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from("recharge_codes")
      .select("id, amount, used, used_by")
      .eq("code", code)
      .single();

    if (codeError || !codeRow) {
      res.status(400).json({ error: "Código inválido ou não encontrado" });
      return;
    }

    if (codeRow.used) {
      res.status(400).json({ error: "Código já utilizado" });
      return;
    }

    const amount: number = Number(codeRow.amount);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Código sem valor associado" });
      return;
    }

    // Mark code as used
    const { error: markError } = await supabaseAdmin
      .from("recharge_codes")
      .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
      .eq("id", codeRow.id);

    if (markError) {
      req.log.error({ markError }, "Failed to mark recharge code as used");
      res.status(500).json({ error: "Erro ao processar recarga" });
      return;
    }

    // Credit user balance
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      res.status(500).json({ error: "Erro ao obter saldo do utilizador" });
      return;
    }

    const currentBalance = Number(profileData.balance ?? 0);
    const newBalance = currentBalance + amount;

    const { error: balanceError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (balanceError) {
      req.log.error({ balanceError }, "Failed to update user balance");
      res.status(500).json({ error: "Erro ao actualizar saldo" });
      return;
    }

    // Record transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "recharge",
      amount,
      description: "Recarga de saldo",
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, amount });
  } catch (err) {
    req.log.error({ err }, "Recharge error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── AI Support Chat (Groq) ── */
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

const SYSTEM_PROMPT = `Tu és o assistente de suporte da WinMoz, uma plataforma de apostas e jogos online em Moçambique.
Responde SEMPRE em Português de Moçambique.
Sê amigável, profissional e conciso nas respostas.
Ajuda com: depósitos via M-Pesa/e-Mola, levantamentos, apostas, regras dos jogos (Damas, Ludo, Xadrez, Roleta), conta e código promocional.
Nunca inventes saldos, transações ou dados do utilizador.
Se não souberes algo específico, diz que vais encaminhar para a equipa humana de suporte.
Responde em texto simples sem asteriscos, hífens de lista ou markdown.`;

router.post("/support/chat", async (req, res) => {
  try {
    const groqKey = process.env["GROQ_API_KEY"];

    if (!groqKey) {
      res
        .status(200)
        .json({
          reply:
            "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp ou email listados no menu.",
        });
      return;
    }

    const { messages } = req.body as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res
        .status(200)
        .json({
          reply:
            "Ocorreu um erro ao processar a tua mensagem. Por favor tenta novamente.",
        });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "Desculpa, não consegui processar a tua pergunta. Tenta novamente.";

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Support chat error");
    res
      .status(200)
      .json({
        reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes.",
      });
  }
});

/* ── Withdraw ── */
router.post("/withdraw", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { amount, phone } = req.body as { amount?: number; phone?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance, full_name, phone").eq("id", userId).single();
    if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter perfil" }); return; }

    const currentBalance = parseFloat(String(profileData.balance ?? "0"));
    if (currentBalance < amount) {
      res.status(400).json({ error: "Saldo insuficiente" }); return;
    }

    const newBalance = Math.round((currentBalance - amount) * 100) / 100;
    const { error: balanceError } = await admin
      .from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (balanceError) { res.status(500).json({ error: "Erro ao debitar saldo" }); return; }

    const withdrawalPhone = phone ?? profileData.phone ?? null;
    const withdrawalMeta = JSON.stringify({
      method: "M-Pesa",
      phone: withdrawalPhone,
      userName: profileData.full_name ?? "utilizador",
    });

    const { data: txRow, error: txError } = await admin
      .from("transactions").insert({
        user_id: userId,
        type: "withdrawal",
        amount: -amount,
        description: withdrawalMeta,
        status: "pending",
        created_at: new Date().toISOString(),
      }).select("id").single();

    if (txError) {
      req.log.error({ txError }, "Failed to record withdrawal transaction");
      const { error: restoreError } = await admin
        .from("profiles").update({ balance: currentBalance }).eq("id", userId);
      if (restoreError) req.log.error({ restoreError }, "Failed to restore balance after tx error");
      res.status(500).json({ error: "Erro ao registar levantamento" }); return;
    }

    res.json({ success: true, withdrawalId: txRow.id, newBalance });
  } catch (err) {
    req.log.error({ err }, "Withdraw error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Approve withdrawal ── */
router.post("/admin/withdraw/approve", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is authenticated
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    // Fetch the withdrawal transaction
    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    const { error: updateError } = await admin
      .from("transactions").update({ status: "approved" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao aprovar" }); return; }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin approve withdrawal error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Reject withdrawal ── */
router.post("/admin/withdraw/reject", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { data: txData, error: txFetchError } = await admin
      .from("transactions").select("id, amount, user_id, status").eq("id", id).single();
    if (txFetchError || !txData) { res.status(404).json({ error: "Levantamento não encontrado" }); return; }
    if (txData.status !== "pending") { res.status(400).json({ error: "Levantamento já processado" }); return; }

    // Mark as rejected
    const { error: updateError } = await admin
      .from("transactions").update({ status: "rejected" }).eq("id", id);
    if (updateError) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }

    // Restore user balance
    const withdrawalAmount = Math.abs(Number(txData.amount ?? 0));
    if (withdrawalAmount > 0 && txData.user_id) {
      const { data: profileData } = await admin
        .from("profiles").select("balance").eq("id", txData.user_id).single();
      if (profileData) {
        const restored = Math.round((Number(profileData.balance ?? 0) + withdrawalAmount) * 100) / 100;
        await admin.from("profiles").update({ balance: restored }).eq("id", txData.user_id);
      }
    }

    res.json({ success: true, reason: reason ?? "" });
  } catch (err) {
    req.log.error({ err }, "Admin reject withdrawal error");
    res.status(500).json({ error: "Erro interno" });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  ADMIN ROUTES — uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS
// ═══════════════════════════════════════════════════════════════════

async function getAdminDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Replit."), { status: 503 });
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
}

async function verifyToken(authHeader: string) {
  const token = (authHeader ?? "").startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const db = await getAdminDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Sessão inválida"), { status: 401 });
  return { user: data.user, db };
}

type Req = import("express").Request;
type Res = import("express").Response;
function ar(fn: (req: Req, res: Res) => Promise<void>) {
  return async (req: Req, res: Res) => {
    try { await fn(req, res); }
    catch (err: unknown) {
      const e = err as Error & { status?: number };
      res.status(e.status ?? 500).json({ error: e.message ?? "Erro interno" });
    }
  };
}

/* ── Dashboard Stats ── */
router.get("/admin/dashboard-stats", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const twoMin = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const [
    { count: totalPlayers },
    { count: activeBets },
    { data: online },
    { data: pendingWd },
    { data: approvedWd },
    { data: todayWd },
    { data: txToday },
    { data: finishedAll },
    { data: finishedToday },
    { count: pendingReports },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("matches").select("*", { count: "exact", head: true }).in("status", ["active", "live", "in_progress"]),
    db.from("profiles").select("id").gte("last_seen_at", twoMin),
    db.from("transactions").select("id").eq("type", "withdrawal").eq("status", "pending"),
    db.from("transactions").select("amount").eq("type", "withdrawal").eq("status", "approved"),
    db.from("transactions").select("amount").eq("type", "withdrawal").eq("status", "approved").gte("created_at", todayISO),
    db.from("matches").select("id").gte("created_at", todayISO),
    db.from("matches").select("bet_amount").eq("status", "finished"),
    db.from("matches").select("bet_amount").eq("status", "finished").gte("created_at", todayISO),
    db.from("transactions").select("*", { count: "exact", head: true }).eq("type", "report").eq("status", "open"),
  ]);

  const sum = (arr: unknown[] | null, f: (x: Record<string,unknown>) => number) =>
    (arr ?? []).reduce((s, x) => s + f(x as Record<string,unknown>), 0);

  res.json({
    liveMatches:             activeBets ?? 0,
    onlinePlayers:           (online ?? []).length,
    activeBets:              activeBets ?? 0,
    pendingWithdrawals:      (pendingWd ?? []).length,
    totalPlayers:            totalPlayers ?? 0,
    platformRevenue:         sum(finishedAll, m => Number(m.bet_amount ?? 0) * 0.2),
    totalApprovedWithdrawals:sum(approvedWd, w => Math.abs(Number(w.amount ?? 0))),
    pendingReports:          pendingReports ?? 0,
    todayEarnings:           sum(finishedToday, m => Number(m.bet_amount ?? 0) * 0.2),
    todaySaidas:             sum(todayWd, w => Math.abs(Number(w.amount ?? 0))),
    todayTransactions:       (txToday ?? []).length,
    todayOnline:             (online ?? []).length,
  });
}));

/* ── Matches ── */
router.get("/admin/matches", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { status, game } = req.query as Record<string, string>;
  let q = db.from("matches").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "all") {
    if (status === "live" || status === "active") q = q.in("status", ["active","live","in_progress"]) as typeof q;
    else q = q.eq("status", status) as typeof q;
  }
  if (game && game !== "all") q = q.eq("game_type", game) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  res.json(data ?? []);
}));

/* ── Matches over time (7 days) ── */
router.get("/admin/matches-over-time", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const days: { date: string; dama: number; ludo: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    const [{ count: dama }, { count: ludo }] = await Promise.all([
      db.from("matches").select("*",{count:"exact",head:true}).eq("game_type","dama").gte("created_at",start.toISOString()).lte("created_at",end.toISOString()),
      db.from("matches").select("*",{count:"exact",head:true}).eq("game_type","ludo").gte("created_at",start.toISOString()).lte("created_at",end.toISOString()),
    ]);
    days.push({ date: start.toISOString().slice(0,10), dama: dama??0, ludo: ludo??0 });
  }
  res.json(days);
}));

/* ── Bets over time (7 days) ── */
router.get("/admin/bets-over-time", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const days: { date: string; dama: number; ludo: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    const [{ data: damaData }, { data: ludoData }] = await Promise.all([
      db.from("matches").select("bet_amount").eq("game_type","dama").gte("created_at",start.toISOString()).lte("created_at",end.toISOString()),
      db.from("matches").select("bet_amount").eq("game_type","ludo").gte("created_at",start.toISOString()).lte("created_at",end.toISOString()),
    ]);
    const betSum = (arr: unknown[]|null) => (arr??[]).reduce((s,m) => s + Number((m as Record<string,unknown>).bet_amount??0),0);
    days.push({ date: start.toISOString().slice(0,10), dama: betSum(damaData), ludo: betSum(ludoData) });
  }
  res.json(days);
}));

/* ── Game breakdown ── */
router.get("/admin/game-breakdown", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const games = ["dama","ludo","xadrez","roleta"];
  const results = await Promise.all(games.map(g =>
    db.from("matches").select("bet_amount",{count:"exact"}).eq("game_type",g)
  ));
  const [dama,ludo,xadrez,roleta] = results;
  const total = (dama.count??0)+(ludo.count??0)+(xadrez.count??0)+(roleta.count??0);
  const betSum = (arr: unknown[]|null) => (arr??[]).reduce((s,m) => s+Number((m as Record<string,unknown>).bet_amount??0),0);
  res.json({
    dama:           total > 0 ? Math.round(((dama.count??0)/total)*100) : 0,
    ludo:           total > 0 ? Math.round(((ludo.count??0)/total)*100) : 0,
    damaMatches:    dama.count??0, ludoMatches:  ludo.count??0,
    xadrezMatches:  xadrez.count??0, roletaMatches: roleta.count??0,
    damaBetVolume:  betSum(dama.data),  ludoBetVolume: betSum(ludo.data),
    xadrezBetVolume:betSum(xadrez.data),roletaBetVolume:betSum(roleta.data),
  });
}));

/* ── Players ── */
router.get("/admin/players", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { data, error } = await db.from("profiles").select("*").order("created_at",{ascending:false}).limit(200);
  if (error) throw new Error(error.message);
  res.json(data ?? []);
}));

router.get("/admin/players/search", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) { res.json([]); return; }
  const { data, error } = await db.from("profiles")
    .select("id,username,full_name,balance,avatar_url,phone")
    .or(`username.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);
  if (error) throw new Error(error.message);
  res.json(data ?? []);
}));

/* ── Ranking ── */
router.get("/admin/ranking", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { data, error } = await db.from("profiles")
    .select("id,username,total_wins,total_games,balance")
    .order("total_wins",{ascending:false}).limit(50);
  if (error) throw new Error(error.message);
  res.json((data ?? []).map((p: Record<string,unknown>, i: number) => {
    const wins  = Number(p.total_wins??0);
    const total = Number(p.total_games??0);
    return {
      playerId: p.id, rank: i+1,
      username: (p.username as string)??"utilizador",
      wins, losses: Math.max(0, total-wins),
      winRate: total > 0 ? Math.round((wins/total)*1000)/10 : 0,
      totalEarnings: Number(p.balance??0),
    };
  }));
}));

/* ── Reports (stored in transactions with type='report') ── */
router.post("/admin/report-submit", ar(async (req, res) => {
  const db = await getAdminDb();
  const { user_id, user_name, user_email, accused_name, category, priority, description, ticket_id } = req.body as Record<string, string>;
  const meta = JSON.stringify({ user_name, user_email, accused_name: accused_name??null, category, priority, description, ticket_id });
  const { data, error } = await db.from("transactions").insert({
    user_id: user_id || null, type: "report", amount: 0,
    description: meta, status: "open", created_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(error.message);
  res.json({ success: true, id: (data as Record<string,unknown>).id });
}));

router.get("/admin/reports", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { status } = req.query as Record<string,string>;
  let q = db.from("transactions").select("id,user_id,description,status,created_at")
    .eq("type","report").order("created_at",{ascending:false}).limit(100);
  if (status && status !== "all") {
    const dbStatus = status === "pending" ? "open" : status === "reviewed" ? "resolved" : status;
    q = q.eq("status", dbStatus) as typeof q;
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((tx: Record<string, unknown>) => {
    let m: Record<string,string> = {};
    try { m = JSON.parse(tx.description as string); } catch { /* ok */ }
    return {
      id: tx.id, user_id: tx.user_id,
      user_name: m.user_name ?? "utilizador",
      user_email: m.user_email ?? null,
      accused_name: m.accused_name ?? m.ticket_id ?? "—",
      category: m.category ?? "Outro",
      priority: m.priority ?? "Média",
      description: m.description ?? "",
      ticket_id: m.ticket_id ?? null,
      status: tx.status, created_at: tx.created_at,
    };
  });
  res.json(rows);
}));

router.patch("/admin/reports/:id", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { id } = req.params;
  const { action, notes } = req.body as { action?: string; notes?: string };
  const dbStatus = action === "reviewed" ? "resolved" : "dismissed";
  const { data: existing } = await db.from("transactions").select("description").eq("id",id).single();
  let meta: Record<string,string> = {};
  try { meta = JSON.parse((existing as Record<string,string>)?.description ?? "{}"); } catch { /* ok */ }
  meta.admin_notes = notes ?? "";
  const { error } = await db.from("transactions").update({ status: dbStatus, description: JSON.stringify(meta) }).eq("id",id);
  if (error) throw new Error(error.message);
  res.json({ ok: true });
}));

/* ── Anti-fraud ── */
router.get("/admin/antifraud", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const [{ data: blocked }, { data: reportsTx }, { count: resolved }] = await Promise.all([
    db.from("blocked_users").select("*").eq("is_active",true).limit(50),
    db.from("transactions").select("id,user_id,description,status,created_at").eq("type","report").eq("status","open").order("created_at",{ascending:false}).limit(20),
    db.from("transactions").select("*",{count:"exact",head:true}).eq("type","report").eq("status","resolved"),
  ]);
  const parseMeta = (tx: Record<string,unknown>) => { let m: Record<string,string>={};try{m=JSON.parse(tx.description as string);}catch{/* ok */}return m; };
  const alerts = (blocked??[]).map((b: Record<string,unknown>) => ({
    id:b.id, playerName:(b.user_name as string)??"utilizador",
    type:(b.block_type as string)??"account", severity:"high" as const,
    description:(b.reason as string)??"Conta bloqueada.",createdAt:b.created_at,
  }));
  const reportAlerts = (reportsTx??[]).slice(0,Math.max(0,4-alerts.length)).map((tx: Record<string,unknown>) => {
    const m = parseMeta(tx);
    return { id:tx.id, playerName:m.user_name??"utilizador", type:m.category??"report",
      severity:(m.priority==="Urgente"||m.priority==="Alta")?"high" as const:"medium" as const,
      description:m.description??"", createdAt:tx.created_at };
  });
  res.json({
    flaggedAccounts:(blocked??[]).length, suspiciousBets:resolved??0,
    unusualPatterns:(reportsTx??[]).filter((tx: Record<string,unknown>) => {
      const m=parseMeta(tx);return m.priority==="Alta"||m.priority==="Urgente";
    }).length,
    resolvedToday:resolved??0,
    alerts:[...alerts,...reportAlerts].slice(0,4),
  });
}));

/* ── Balance Adjust ── */
router.post("/admin/balance-adjust", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { userId, amount, type, reason, note } = req.body as {
    userId: string; amount: number; type: "add"|"subtract"; reason: string; note?: string;
  };
  if (!userId || !amount || Number(amount) <= 0) throw Object.assign(new Error("Parâmetros inválidos"),{status:400});
  const { data: profileData, error: fetchErr } = await db.from("profiles")
    .select("balance,username,full_name,avatar_url").eq("id",userId).single();
  if (fetchErr || !profileData) throw new Error("Jogador não encontrado");
  const p = profileData as Record<string,unknown>;
  const current = Number(p.balance??0);
  const delta = type === "add" ? Number(amount) : -Number(amount);
  const newBal = Math.max(0, current + delta);
  const playerName = ((p.username ?? p.full_name ?? "utilizador") as string);
  const { error: upErr } = await db.from("profiles").update({ balance: newBal }).eq("id",userId);
  if (upErr) throw new Error("Erro ao actualizar saldo: " + upErr.message);
  const meta = JSON.stringify({ player_name:playerName, avatar_url:p.avatar_url??null, balance_before:current, balance_after:newBal, reason:reason??"manual_adjustment", note:note??null });
  await db.from("transactions").insert({ user_id:userId, type:"balance_adjustment", amount:delta, description:meta, status:"approved", created_at:new Date().toISOString() });
  res.json({ ok:true, newBalance:newBal, playerName });
}));

router.get("/admin/balance-adjustments", ar(async (req, res) => {
  const { db } = await verifyToken(req.headers.authorization ?? "");
  const { data, error } = await db.from("transactions")
    .select("id,user_id,amount,description,created_at")
    .eq("type","balance_adjustment").order("created_at",{ascending:false}).limit(100);
  if (error) throw new Error(error.message);
  res.json((data??[]).map((tx: Record<string,unknown>) => {
    let m: Record<string,unknown>={};try{m=JSON.parse(tx.description as string);}catch{/* ok */}
    return { id:tx.id, user_id:tx.user_id, amount:Number(tx.amount??0),
      balance_before:Number(m.balance_before??0), balance_after:Number(m.balance_after??0),
      reason:(m.reason as string)??"manual_adjustment", note:m.note??null,
      created_at:tx.created_at, player_name:(m.player_name as string)??"utilizador", avatar_url:m.avatar_url??null };
  }));
}));

export default router;

