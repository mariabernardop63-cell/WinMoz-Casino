import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import healthRouter from "./health";
import debitoRouter from "./debito";
import ws from "ws";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ── SMS Forwarder In-Memory Store ── */
interface StoredSMS {
  id: string;
  body: string;
  sender: string;
  receivedAt: number;
  used: boolean;
  parsedAmount: number | null;
  parsedTxId: string | null;
}

interface PendingVerification {
  id: string;
  userId: string;
  userSmsBody: string;
  expectedAmount: number;
  mode: "deposit" | "bet";
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  resolvedTxId?: string | null;
}

const smsStore = new Map<string, StoredSMS>();
const pendingStore = new Map<string, PendingVerification>();

// Clean up expired entries every 30 s
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of smsStore.entries()) {
    if (now - v.receivedAt > 90_000) smsStore.delete(k);
  }
  for (const [k, v] of pendingStore.entries()) {
    if (now - v.submittedAt > 180_000) pendingStore.delete(k);
  }
}, 30_000);

/* ── SMS Parsing Helpers ── */
function extractAmount(body: string): number | null {
  const patterns = [
    /(\d[\d\s]*(?:[.,]\d{1,2})?)\s*MT\b/i,
    /(\d[\d\s]*(?:[.,]\d{1,2})?)\s*MZN\b/i,
    /enviou\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i,
    /recebeu\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i,
    /de\s+(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:MT|MZN)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) {
      const raw = m[1].replace(/\s/g, "").replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractTxId(body: string): string | null {
  const patterns = [
    /ID\s+trans\.?\s*([A-Z0-9]{4,})/i,
    /ID\s+de\s+transac[aã]o[:\s]+([A-Z0-9]{4,})/i,
    /\bID[:\s]+([A-Z0-9]{6,})/i,
    /Ref\.?[:\s]+([A-Z0-9]{6,})/i,
    /Transaction\s+ID[:\s]+([A-Z0-9]{6,})/i,
    /\b([A-Z][A-Z0-9]{7,15})\b/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}

function tryMatchForwarderSms(userBody: string, expectedAmount: number): StoredSMS | null {
  const userTxId = extractTxId(userBody);
  const userAmount = extractAmount(userBody);

  for (const sms of smsStore.values()) {
    if (sms.used) continue;

    // TX ID match takes priority
    if (userTxId && sms.parsedTxId && userTxId === sms.parsedTxId) return sms;

    // Fall back: both amounts must agree with each other AND the expected amount
    if (
      userAmount !== null &&
      sms.parsedAmount !== null &&
      amountsMatch(userAmount, sms.parsedAmount) &&
      amountsMatch(userAmount, expectedAmount)
    ) return sms;
  }
  return null;
}

async function creditBalance(
  admin: any,
  userId: string,
  amount: number,
  txId: string | null | undefined,
  note: string
): Promise<boolean> {
  const { data: profileData } = await admin.from("profiles").select("balance").eq("id", userId).single();
  if (!profileData) return false;
  const newBalance = Math.round((Number(profileData.balance ?? 0) + amount) * 100) / 100;
  const { error } = await admin.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (error) return false;
  await admin.from("transactions").insert({
    user_id: userId,
    type: "deposit",
    amount,
    description: JSON.stringify({ method: "M-Pesa/e-Mola", txId: txId ?? null, note }),
    status: "approved",
    created_at: new Date().toISOString(),
  });
  return true;
}

function buildAdminClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as any },
  });
}

const router: IRouter = Router();

/* ── Rate limiting (in-memory, per-IP + per-route) ── */
const rateBuckets = new Map<string, number[]>();
function rateLimit(scope: string, req: any, max: number, windowMs: number): boolean {
  const ip = (req.ip || req.socket?.remoteAddress || "unknown") as string;
  const key = `${scope}:${ip}`;
  const now = Date.now();
  let hits = rateBuckets.get(key);
  if (!hits) { hits = []; rateBuckets.set(key, hits); }
  while (hits.length > 0 && now - hits[0] > windowMs) hits.shift();
  if (hits.length >= max) return false;
  hits.push(now);
  // opportunistic cleanup
  if (rateBuckets.size > 10_000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (v.length === 0 || now - v[v.length - 1] > 300_000) rateBuckets.delete(k);
    }
  }
  return true;
}

/* ── Per-user in-process locks: serialise balance mutations to prevent
      parallel-request double-spend (read-modify-write races) ── */
const userLocks = new Map<string, Promise<void>>();
async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  userLocks.set(userId, prev.then(() => gate));
  await prev.catch(() => { /* previous op failed — continue */ });
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === gate) userLocks.delete(userId);
  }
}

router.use(healthRouter);
router.use(debitoRouter);

/* ── Public ad script — reads platform_settings using admin key, bypasses RLS ── */
router.get("/ad-script", async (req, res) => {
  try {
    const supabaseUrl     = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const supabaseService = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";

    if (!supabaseUrl || !supabaseService) {
      res.json({ script: null });
      return;
    }

    const admin = buildAdminClient(supabaseUrl, supabaseService);
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "ad_banner_script")
      .maybeSingle();

    res.json({ script: (data as { value?: string } | null)?.value ?? null });
  } catch {
    res.json({ script: null });
  }
});

router.post("/complete-registration", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { full_name, phone, invite_code_used } = req.body as {
      user_id?: string;
      full_name?: string;
      phone?: string;
      invite_code_used?: string;
    };

    const supabaseUrl     = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const supabaseService = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";

    if (!supabaseUrl || !supabaseService) {
      // Env vars missing — still respond ok so OTP flow isn't blocked, but log the issue
      console.error("[complete-registration] Missing Supabase env vars — profile not updated");
      res.json({ success: true, warning: "env_missing" });
      return;
    }

    const admin = buildAdminClient(supabaseUrl, supabaseService);

    // SECURITY: user_id is always taken from the verified session token,
    // never from the request body
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const user_id = userData.user.id;

    /* ── 1. Generate a unique invite code for this user (if they don't already have one) ── */
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0,O,1,I)
    const makeCode = () => Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    // Check if user already has a code
    const { data: existing } = await admin
      .from("profiles")
      .select("my_invite_code")
      .eq("id", user_id)
      .single();

    let myCode = existing?.my_invite_code as string | null | undefined;
    if (!myCode) {
      // Generate one that doesn't clash
      let attempts = 0;
      do {
        myCode = makeCode();
        const { data: clash } = await admin.from("profiles").select("id").eq("my_invite_code", myCode).maybeSingle();
        if (!clash) break;
        attempts++;
      } while (attempts < 10);
    }

    /* ── 2. Update the user profile ── */
    const profileUpdate: Record<string, unknown> = { my_invite_code: myCode };
    if (full_name)        profileUpdate.full_name        = full_name;
    if (phone)            profileUpdate.phone             = phone;
    if (invite_code_used) profileUpdate.invite_code_used = invite_code_used.toUpperCase().trim();

    const { error: profileErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user_id);

    if (profileErr) {
      console.error("[complete-registration] profile update error:", profileErr.message);
    }

    /* ── 3. Record referral if an invite code was used ── */
    if (invite_code_used && invite_code_used.trim().length >= 4) {
      const code = invite_code_used.toUpperCase().trim();

      /* Find the referrer and record WHICH type of code was used.
         This is critical: an affiliate can share their my_invite_code (friend invite)
         and in that case the reward must be 2.50 MT (friend), NOT 5 MT (affiliate).
         We must NOT rely on is_affiliate at reward time — we store referral_type here. */
      let referrerProfile: { id: string } | null = null;
      let referralType: "friend" | "affiliate" = "friend";

      const { data: byMyCode } = await admin
        .from("profiles")
        .select("id")
        .eq("my_invite_code", code)
        .maybeSingle();

      if (byMyCode) {
        referrerProfile = byMyCode as { id: string };
        referralType = "friend";
      } else {
        const { data: byAffCode } = await admin
          .from("profiles")
          .select("id")
          .eq("affiliate_invite_code", code)
          .maybeSingle();
        if (byAffCode) {
          referrerProfile = byAffCode as { id: string };
          referralType = "affiliate";
        }
      }

      if (referrerProfile && referrerProfile.id !== user_id) {
        // Insert referral record — ON CONFLICT DO NOTHING so no duplicates
        const { error: refErr } = await admin.from("referrals").insert({
          referrer_id: referrerProfile.id,
          referred_id: user_id,
          referral_type: referralType,
        });

        if (refErr && !refErr.message.includes("duplicate") && !refErr.message.includes("unique")) {
          console.error("[complete-registration] referral insert error:", refErr.message);
        } else {
          console.log(`[complete-registration] referral recorded: ${referrerProfile.id} → ${user_id}`);
        }
      }
    }

    res.json({ success: true, user_id, my_invite_code: myCode });
  } catch (err) {
    console.error("[complete-registration] unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Record Bet Reward — trigger referral payout when a referred user places a bet ── */
router.post("/record-bet-reward", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const supabaseUrl     = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const supabaseService = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";
    if (!supabaseUrl || !supabaseService) {
      res.json({ success: false, reason: "env_missing" }); return;
    }

    const admin = buildAdminClient(supabaseUrl, supabaseService);

    // Verify JWT and get the user who just bet (the referred user)
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const referredId = userData.user.id;

    // Look up the referral record for this user
    // IMPORTANT: use referral_type (stored at registration) — NOT is_affiliate.
    // An affiliate can share their friend invite code (my_invite_code) and must
    // receive 2.50 MT for that referral, not 5 MT.
    const { data: referralRow, error: refErr } = await admin
      .from("referrals")
      .select("id, referrer_id, reward_paid, referral_type")
      .eq("referred_id", referredId)
      .maybeSingle();

    if (refErr || !referralRow) {
      // No referral — user wasn't referred by anyone
      res.json({ success: false, reason: "no_referral" }); return;
    }

    // SECURITY: only pay a reward when the user actually placed a bet.
    // Check for at least one "bet" transaction newer than the last paid reward
    // (or any at all for the first reward).
    const { data: recentBets } = await admin
      .from("transactions")
      .select("id, created_at")
      .eq("user_id", referredId)
      .eq("type", "bet")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!recentBets || recentBets.length === 0) {
      res.json({ success: false, reason: "no_bets_found" }); return;
    }

    const referrerId: string = (referralRow as any).referrer_id;
    const rewardAlreadyPaid: boolean = !!(referralRow as any).reward_paid;
    // referral_type is the source of truth; fall back to checking is_affiliate
    // only for old rows that predate this fix (referral_type will be null/missing).
    const storedReferralType: string | null = (referralRow as any).referral_type ?? null;

    const { data: referrerProfile } = await admin
      .from("profiles")
      .select("id, is_affiliate, balance, affiliate_pending_earnings")
      .eq("id", referrerId)
      .single();

    if (!referrerProfile) {
      res.json({ success: false, reason: "referrer_not_found" }); return;
    }

    // Determine reward type:
    // 1. If referral_type is stored → use it (most accurate).
    // 2. If referral_type is missing (old row) → fall back to is_affiliate.
    const isAffiliate: boolean =
      storedReferralType !== null
        ? storedReferralType === "affiliate"
        : !!(referrerProfile as any).is_affiliate;

    if (isAffiliate) {
      // ── AFFILIATE LOGIC: 5 MT per bet, up to 5 bets per referred friend ──
      // Use the affiliate_bets table which the dashboard reads for bet counts
      const { data: existingBetRow } = await admin
        .from("affiliate_bets")
        .select("id, bet_count")
        .eq("affiliate_id", referrerId)
        .eq("referred_id", referredId)
        .maybeSingle();

      const betCount: number = (existingBetRow as any)?.bet_count ?? 0;

      if (betCount >= 5) {
        res.json({ success: false, reason: "max_affiliate_bets_reached" }); return;
      }

      const AFFILIATE_REWARD = 5;
      const currentPending = Number((referrerProfile as any).affiliate_pending_earnings ?? 0);
      const newPending = Math.round((currentPending + AFFILIATE_REWARD) * 100) / 100;

      // Update affiliate_pending_earnings
      await admin
        .from("profiles")
        .update({ affiliate_pending_earnings: newPending })
        .eq("id", referrerId);

      // Upsert the affiliate_bets row — this is what the dashboard reads
      if (existingBetRow) {
        await admin
          .from("affiliate_bets")
          .update({ bet_count: betCount + 1 })
          .eq("id", (existingBetRow as any).id);
      } else {
        await admin.from("affiliate_bets").insert({
          affiliate_id: referrerId,
          referred_id: referredId,
          bet_count: 1,
          created_at: new Date().toISOString(),
        });
      }

      // Record the bonus transaction for audit trail
      await admin.from("transactions").insert({
        user_id: referrerId,
        type: "referral_bonus",
        amount: AFFILIATE_REWARD,
        description: JSON.stringify({ referred_id: referredId, bet_num: betCount + 1, type: "affiliate" }),
        status: "approved",
        created_at: new Date().toISOString(),
      });

      console.log(`[record-bet-reward] Affiliate reward paid: ${referrerId} ← ${AFFILIATE_REWARD} MT (referred: ${referredId}, bet #${betCount + 1})`);
      res.json({ success: true, type: "affiliate", rewarded: AFFILIATE_REWARD, bets_rewarded: betCount + 1 });
      return;
    }

    // ── NORMAL REFERRAL LOGIC: 2.50 MT one-time on first bet ──
    if (rewardAlreadyPaid) {
      res.json({ success: false, reason: "already_paid" }); return;
    }

    // Double-check via transactions as fallback (in case reward_paid column doesn't exist)
    const { data: existingBonus } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", referrerId)
      .eq("type", "referral_bonus")
      .ilike("description", `%${referredId}%`)
      .limit(1);

    if (existingBonus && existingBonus.length > 0) {
      res.json({ success: false, reason: "already_paid" }); return;
    }

    const FRIEND_REWARD = 2.5;
    const currentBalance = Number((referrerProfile as any).balance ?? 0);
    const newBalance = Math.round((currentBalance + FRIEND_REWARD) * 100) / 100;

    // Credit referrer balance
    const { error: balErr } = await admin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", referrerId);

    if (balErr) {
      res.status(500).json({ error: "Erro ao creditar bónus" }); return;
    }

    // Record the bonus transaction
    await admin.from("transactions").insert({
      user_id: referrerId,
      type: "referral_bonus",
      amount: FRIEND_REWARD,
      description: JSON.stringify({ referred_id: referredId, type: "friend" }),
      status: "approved",
      created_at: new Date().toISOString(),
    });

    // Mark reward as paid on the referrals record (best-effort — column may not exist yet)
    await admin
      .from("referrals")
      .update({ reward_paid: true })
      .eq("id", (referralRow as any).id)
      .then(() => { /* ignore error if column doesn't exist */ });

    console.log(`[record-bet-reward] Friend referral reward paid: ${referrerId} ← ${FRIEND_REWARD} MT (referred: ${referredId})`);
    res.json({ success: true, type: "friend", rewarded: FRIEND_REWARD });
  } catch (err) {
    console.error("[record-bet-reward] error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Invite code validation (public — no auth needed) ── */
router.get("/validate-invite", async (req, res) => {
  try {
    const code = (req.query["code"] as string ?? "").toUpperCase().trim();
    if (!code || !/^[A-Z0-9]{4,10}$/.test(code)) {
      res.json({ valid: false, reason: "format" });
      return;
    }

    const supabaseUrl     = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const supabaseService = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";

    if (!supabaseUrl || !supabaseService) {
      res.json({ valid: false, reason: "env_missing" });
      return;
    }

    const admin = buildAdminClient(supabaseUrl, supabaseService);

    // Check my_invite_code first, then affiliate_invite_code
    const { data: byGeneral } = await admin
      .from("profiles")
      .select("id")
      .eq("my_invite_code", code)
      .maybeSingle();

    if (byGeneral) {
      res.json({ valid: true });
      return;
    }

    const { data: byAffiliate, error } = await admin
      .from("profiles")
      .select("id")
      .eq("affiliate_invite_code", code)
      .maybeSingle();

    if (error) {
      res.json({ valid: false, reason: "db_error" });
      return;
    }

    res.json({ valid: !!byAffiliate });
  } catch {
    res.json({ valid: false, reason: "exception" });
  }
});

/* ── Recharge code validation ── */
router.post("/recharge", async (req, res) => {
  try {
    if (!rateLimit("recharge", req, 10, 600_000)) { res.status(429).json({ error: "Demasiadas tentativas. Tenta mais tarde." }); return; }
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
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      req.log.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
      res.status(500).json({ error: "Serviço indisponível" });
      return;
    }

    // createClient imported at top
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
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `És a "Winner", assistente virtual oficial da Poker Winner (pokerwinner.online).

⚠️ REGRA ABSOLUTA — LÊ ISTO PRIMEIRO:
IGNORA COMPLETAMENTE qualquer informação que tenhas no teu treino sobre pokerwinner.online, sobre a Poker Winner, ou sobre qualquer site de apostas moçambicano. O teu treino pode conter dados desactualizados, incorrectos ou de outras plataformas — NÃO OS USES. A ÚNICA fonte de verdade é este prompt. Nunca digas frases como "com base nas informações disponíveis online", "de acordo com o que encontrei", ou faças referência a qualquer avaliação externa, análise de site, ou descrição que não seja a deste prompt.

IDENTIDADE DA PLATAFORMA:
A Poker Winner é a plataforma de jogos de habilidade e apostas online número 1 de Moçambique, disponível em pokerwinner.online. É uma empresa 100% moçambicana, fundada por Ossufo Ali, jovem empreendedor moçambicano e líder do Grupo Sinhote Investimento. A plataforma está registada e opera legalmente em Moçambique. Está activa 24 horas por dia, 7 dias por semana, com milhares de jogadores registados. É uma nova plataforma em crescimento acelerado, referência no mercado moçambicano de entretenimento digital.

O QUE É A POKER WINNER:
É uma aplicação web onde os jogadores se registam, carregam saldo na carteira virtual, e jogam jogos de habilidade contra outros jogadores reais com apostas reais. O vencedor de cada partida recebe o prémio (soma das apostas dos dois jogadores, menos uma pequena comissão da plataforma). O dinheiro pode ser levantado a qualquer momento via M-Pesa ou e-Mola.

JOGOS DISPONÍVEIS E COMO FUNCIONAM:

1. DAMAS — Jogo de tabuleiro clássico africano. Dois jogadores competem num tabuleiro de 8x8 com peças pretas e brancas. Cada jogador define a aposta antes de entrar. O objectivo é capturar todas as peças do adversário ou bloqueá-lo. O vencedor leva o prémio total menos a comissão. Apostas: 10 MT a 5.000 MT. Joga-se em tempo real contra outros utilizadores da plataforma.

2. LUDO — Jogo de dados e estratégia. Dois a quatro jogadores, cada um com peças coloridas que precisam de percorrer o tabuleiro e chegar ao centro. Os dados determinam o número de casas a avançar, mas a estratégia decide quem ganha. Apostas: 10 MT a 5.000 MT. Muito popular entre os moçambicanos.

3. XADREZ — Jogo de xadrez clássico internacional. Dois jogadores, peças brancas e pretas, num tabuleiro de 8x8. O objectivo é dar xeque-mate ao rei adversário. Para quem gosta de estratégia e raciocínio. Apostas: 10 MT a 5.000 MT.

4. ROLETA — Roleta de casino clássica. O jogador escolhe um número (0-36), uma cor (vermelho ou preto), ou par/ímpar. A bola gira e o resultado é aleatório. Prémios variam conforme o tipo de aposta. Giro grátis diário disponível para todos os utilizadores registados.

5. BILHAR — Em breve! Jogo de bilhar virtual com apostas. Muito esperado pelos jogadores da comunidade.

COMO SE REGISTA:
O registo é simples e gratuito em pokerwinner.online. O utilizador introduz o seu email e cria uma palavra-passe, ou usa um código de convite de um amigo para ganhar bónus extra. Após o registo, tem acesso imediato a todos os jogos.

COMO JOGAR (PASSO A PASSO):
1. Regista-te em pokerwinner.online
2. Carrega saldo na tua carteira (via código de recarga, M-Pesa ou e-Mola)
3. Escolhe um jogo (Damas, Ludo, Xadrez, Roleta)
4. Define o valor da aposta e entra na sala de espera
5. O sistema emparelha-te com outro jogador automaticamente
6. Joga e ganha — o vencedor recebe o prémio na carteira imediatamente

APOSTAS E VALORES:
- Valor mínimo de aposta: 10 MT
- Valor máximo de aposta: 5.000 MT
- Comissão da plataforma: 10% sobre o prémio total
- Prémio líquido = (aposta1 + aposta2) × 90%
- O saldo é actualizado em tempo real na carteira

COMO DEPOSITAR (CARREGAR SALDO):
Método 1 — Código de recarga: Compra um código de 15 caracteres junto dos agentes autorizados da Poker Winner (via M-Pesa ou e-Mola) e insere-o em "Carteira" > "Recarga". O saldo é creditado imediatamente.
Método 2 — Através de agentes: Os agentes da plataforma recebem o teu dinheiro via M-Pesa/e-Mola e enviam-te o código de recarga.

COMO LEVANTAR DINHEIRO:
Vai a "Carteira" > "Levantar". Introduz o valor e o teu número M-Pesa ou e-Mola. A equipa processa o levantamento normalmente em menos de 24 horas. Valor mínimo: 50 MT.

CARTEIRA E EXTRATOS:
Em "Carteira" tens acesso ao teu saldo actual, histórico de depósitos, levantamentos e apostas. Tudo em tempo real.

SISTEMA DE CONVITES:
Cada utilizador tem um código de convite único. Partilha com amigos — quando eles se registam com o teu código, ganhas bónus. O teu código está em "Perfil" > "Convidar Amigos".

SEGURANÇA:
A plataforma usa encriptação de dados e tem sistema anti-fraude automático. Nunca partilhes a tua palavra-passe. Proibido criar múltiplas contas ou usar bots — resulta em banimento permanente.

CONTACTO DO SUPORTE HUMANO:
WhatsApp: +258 86 338 7488
Email: support@pokerw.co.mz
Disponível 24h/dia, 7 dias/semana.

REGRAS:
Apenas maiores de 18 anos. Joga com responsabilidade.

PROBLEMAS COMUNS:
- Não consigo entrar: Verifica email/senha. Usa "Esqueceu a palavra-passe".
- Saldo não apareceu após recarga: Verifica se o código tem 15 caracteres. Contacta o suporte com o código.
- Levantamento demorado: Até 24h é normal. Acima disso, contacta o suporte.
- Problema técnico numa partida: Contacta o suporte com o ID da partida e hora.

PERSONALIDADE:
Sê calorosa, próxima e natural. Tom descontraído mas profissional. Usa "tu". Responde em Português de Moçambique. Sem asteriscos, sem markdown. Máximo 3-4 frases por resposta. Emojis com moderação (1-2 por resposta). Nunca inventes dados de utilizadores ou garantas resultados.`;

router.post("/support/chat", async (req, res) => {
  try {
    if (!rateLimit("support-chat", req, 20, 60_000)) { res.status(429).json({ error: "Demasiadas mensagens. Aguarda um momento." }); return; }
    const groqKey = process.env["GROQ_API_KEY"];

    if (!groqKey) {
      res.status(200).json({
        reply: "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp: +258 86 338 7488 ou email: support@pokerw.co.mz",
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
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 500,
        temperature: 0.65,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res.status(200).json({
        reply: "Ocorreu um erro ao processar a tua mensagem. Por favor tenta novamente.",
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
    res.status(200).json({
      reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes.",
    });
  }
});

/* ── Withdraw ── */
router.post("/withdraw", async (req, res) => {
  try {
    if (!rateLimit("withdraw", req, 5, 600_000)) { res.status(429).json({ error: "Demasiadas tentativas. Tenta mais tarde." }); return; }
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { amount, phone } = req.body as { amount?: number; phone?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    // createClient imported at top
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance, full_name, phone").eq("id", userId).single();
    if (profileError || !profileData) { res.status(500).json({ error: "Erro ao obter perfil" }); return; }

    const WITHDRAWAL_FEE = 5;
    const currentBalance = parseFloat(String(profileData.balance ?? "0"));
    if (currentBalance < amount + WITHDRAWAL_FEE) {
      res.status(400).json({ error: `Saldo insuficiente. Precisas de ${amount + WITHDRAWAL_FEE} MT (valor + ${WITHDRAWAL_FEE} MT de taxa)` }); return;
    }

    const totalDeduct = Math.round((amount + WITHDRAWAL_FEE) * 100) / 100;
    const newBalance = await withUserLock(userId, async () => {
      const { data: freshProfile } = await admin
        .from("profiles").select("balance").eq("id", userId).single();
      const freshBal = Number((freshProfile as any)?.balance ?? 0);
      if (freshBal < totalDeduct) return null;
      const next = Math.round((freshBal - totalDeduct) * 100) / 100;
      const { error: balanceError } = await admin
        .from("profiles").update({ balance: next }).eq("id", userId).gte("balance", totalDeduct);
      if (balanceError) return null;
      return next;
    });
    if (newBalance === null) { res.status(400).json({ error: "Saldo insuficiente" }); return; }

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
        amount: -(amount + WITHDRAWAL_FEE),
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
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    // createClient imported at top
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }

    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Serviço indisponível" }); return;
    }

    // createClient imported at top
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

/* ── Roleta ── */

// Mozambique is UTC+2 (CAT, no DST). Returns the UTC ISO timestamp for
// midnight of the current day in Mozambique time.
function getMozambiqueStartOfDayUTC(): string {
  const mzOffsetMs = 2 * 60 * 60 * 1000;
  const mzNow = new Date(Date.now() + mzOffsetMs);
  const startOfDayMz = Date.UTC(mzNow.getUTCFullYear(), mzNow.getUTCMonth(), mzNow.getUTCDate(), 0, 0, 0);
  return new Date(startOfDayMz - mzOffsetMs).toISOString();
}

// Shared helper: build Supabase admin client and verify JWT
async function buildAdminAndVerify(authHeader: string): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; supabaseAdmin: any; userId: string }
> {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) return { ok: false, status: 500, error: "Serviço indisponível" };

  const supabaseAdmin = buildAdminClient(supabaseUrl, supabaseServiceKey);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return { ok: false, status: 401, error: "Sessão inválida" };

  return { ok: true, supabaseAdmin, userId: userData.user.id };
}

/* ── Admin: verify JWT AND require profiles.is_admin = true ── */
async function buildAdminAndVerifyAdmin(authHeader: string): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; supabaseAdmin: any; userId: string }
> {
  const result = await buildAdminAndVerify(authHeader);
  if (!result.ok) return result;
  const { supabaseAdmin, userId } = result;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin, is_blocked").eq("id", userId).single();
  if (!profile || !(profile as any).is_admin) {
    return { ok: false, status: 403, error: "Acesso restrito a administradores" };
  }
  return { ok: true, supabaseAdmin, userId };
}

/* ── Admin: session check for the AdminSecurityGate ── */
router.post("/admin/verify", async (req, res) => {
  try {
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ isAdmin: false }); return; }
    res.json({ isAdmin: true, userId: gate.userId });
  } catch (err) {
    req.log.error({ err }, "admin/verify error");
    res.status(500).json({ isAdmin: false });
  }
});

/* ── Admin: security password for the gate (admin-only) ── */
router.get("/admin/security-password", async (req, res) => {
  try {
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { data } = await gate.supabaseAdmin
      .from("platform_settings").select("value").eq("key", "admin_security_password").maybeSingle();
    res.json({ password: (data as { value?: string } | null)?.value ?? null });
  } catch (err) {
    req.log.error({ err }, "admin/security-password error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Approve / Reject Manual Deposit or Bet ── */
router.post("/admin/deposit/approve", async (req, res) => {
  try {
    const result = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    const { supabaseAdmin } = result;

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }

    const { data: txData, error: txErr } = await supabaseAdmin
      .from("transactions").select("id, amount, user_id, type, status").eq("id", id).single();
    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if ((txData as any).status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }

    // Credit balance for both manual_deposit and manual_bet (carteira móvel)
    if ((txData as any).type === "manual_deposit" || (txData as any).type === "manual_bet") {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("balance").eq("id", (txData as any).user_id).single();
      const current = Number((profile as any)?.balance ?? 0);
      const newBalance = Math.round((current + Number((txData as any).amount)) * 100) / 100;
      const { error: balErr } = await supabaseAdmin
        .from("profiles").update({ balance: newBalance }).eq("id", (txData as any).user_id);
      if (balErr) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }
    }

    const { error: upErr } = await supabaseAdmin
      .from("transactions").update({ status: "approved" }).eq("id", id);
    if (upErr) { res.status(500).json({ error: "Erro ao aprovar" }); return; }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin approve deposit error");
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/admin/deposit/reject", async (req, res) => {
  try {
    const result = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    const { supabaseAdmin } = result;

    const { id } = req.body as { id?: string };
    if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }

    const { data: txData, error: txErr } = await supabaseAdmin
      .from("transactions").select("id, status").eq("id", id).single();
    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if ((txData as any).status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }

    const { error: upErr } = await supabaseAdmin
      .from("transactions").update({ status: "rejected" }).eq("id", id);
    if (upErr) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin reject deposit error");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/roleta/status — check if free spin is available today (Moz time)
router.get("/roleta/status", async (req, res) => {
  try {
    const result = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    const { supabaseAdmin, userId } = result;

    const todayStart = getMozambiqueStartOfDayUTC();
    const { data: rows } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "free_spin")
      .gte("created_at", todayStart);

    res.json({ freeSpinAvailable: !rows || rows.length === 0 });
  } catch (err) {
    req.log.error({ err }, "Roleta status error");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/roleta/spin — process a roulette spin (server-side RNG)
router.post("/roleta/spin", async (req, res) => {
  try {
    if (!rateLimit("roleta-spin", req, 30, 60_000)) { res.status(429).json({ error: "Demasiados giros. Aguarda um momento." }); return; }
    const result = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    const { supabaseAdmin, userId } = result;

    const { isFree } = req.body as { isFree?: boolean };

    // ── FREE SPIN ──
    if (isFree) {
      // Validate: not already used today (Moz time)
      const todayStart = getMozambiqueStartOfDayUTC();
      const { data: rows } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "free_spin")
        .gte("created_at", todayStart);

      if (rows && rows.length > 0) {
        res.status(400).json({ error: "Giro grátis já utilizado hoje. Volta amanhã!" });
        return;
      }

      // Get current balance for response
      const { data: profileData } = await supabaseAdmin
        .from("profiles").select("balance").eq("id", userId).single();
      const currentBalance = Number(profileData?.balance ?? 0);

      // Record free spin — always "Boa Sorte" (index 8), no prize
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "free_spin",
        amount: 0,
        description: "Giro grátis diário (Roleta da Sorte)",
        status: "approved",
        created_at: new Date().toISOString(),
      });

      res.json({ sectorIndex: 8, prize: 0, newBalance: currentBalance });
      return;
    }

    // ── PAID SPIN ──
    const COST = 5;

    // Fetch current balance
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    if (profileError || !profileData) {
      res.status(500).json({ error: "Erro ao obter perfil" }); return;
    }
    const currentBalance = Number(profileData.balance ?? 0);

    if (currentBalance < COST) {
      res.status(400).json({ error: "Saldo insuficiente para apostar." }); return;
    }

    // Deduct bet cost immediately
    const balanceAfterBet = Math.round((currentBalance - COST) * 100) / 100;
    const { error: deductError } = await supabaseAdmin
      .from("profiles").update({ balance: balanceAfterBet }).eq("id", userId);
    if (deductError) { res.status(500).json({ error: "Erro ao processar aposta" }); return; }

    // Record bet transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "bet",
      amount: -COST,
      description: "Aposta — Roleta da Sorte (5 MT)",
      status: "approved",
      created_at: new Date().toISOString(),
    });

    // Calculate cumulative net P&L to unlock 5 MT prize
    const { data: txRows } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .in("type", ["bet", "win"]);

    const netPL = txRows
      ? txRows.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0)
      : 0;

    // Server-side RNG algorithm:
    // 80%  → win 1 MT  (sector index 6)
    // 20%  → win 5 MT IF cumulative net loss > 20 MT, ELSE Boa Sorte (index 8)
    const rand = Math.random();
    let sectorIndex: number;
    let prize = 0;

    if (rand < 0.80) {
      sectorIndex = 6; // "1 MT"
      prize = 1;
    } else {
      // 20% — only pays out if user has lost significantly
      if (netPL < -20) {
        sectorIndex = 5; // "5 MT"
        prize = 5;
      } else {
        sectorIndex = 8; // "Boa Sorte"
        prize = 0;
      }
    }

    // Credit prize if any
    let finalBalance = balanceAfterBet;
    if (prize > 0) {
      finalBalance = Math.round((balanceAfterBet + prize) * 100) / 100;
      await supabaseAdmin.from("profiles").update({ balance: finalBalance }).eq("id", userId);
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "win",
        amount: prize,
        description: `Prémio Roleta da Sorte (+${prize} MT)`,
        status: "approved",
        created_at: new Date().toISOString(),
      });
    }

    res.json({ sectorIndex, prize, newBalance: finalBalance });
  } catch (err) {
    req.log.error({ err }, "Roleta spin error");
    res.status(500).json({ error: "Erro interno ao processar aposta" });
  }
});

/* ── Admin: Update / upsert a platform setting ── */
router.post("/admin/settings/update", async (req, res) => {
  try {
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { key, value } = req.body as { key?: string; value?: string };
    if (!key) { res.status(400).json({ error: "key required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({ error: "Supabase não configurado" }); return;
    }

    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { error } = await admin
      .from("platform_settings")
      .upsert({ key, value: value ?? "" }, { onConflict: "key" });

    if (error) {
      req.log.error({ error }, "platform_settings upsert failed");
      res.status(500).json({ error: error.message }); return;
    }

    req.log.info({ key }, "platform setting updated");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "settings update error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* Public settings keys readable without admin — anything matching these
   patterns (tokens, secrets, webhook keys) is never exposed publicly. */
const SENSITIVE_SETTING_RE = /token|secret|password|webhook|service_role|api_key/i;

/* ── Admin: Get a single platform setting (public read, redacted) ── */
function publicSettingHandler(req: any, res: any) {
  const key = req.query["key"] as string | undefined;
  if (!key) { res.status(400).json({ error: "key required" }); return; }
  if (SENSITIVE_SETTING_RE.test(key)) { res.json({ setting: null }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) { res.json({ setting: null }); return; }

  const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
  (async () => {
    try {
      const { data } = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
      res.json({ setting: data ? { value: (data as { value?: string }).value } : null });
    } catch {
      res.json({ setting: null });
    }
  })();
}

router.get("/admin/settings", publicSettingHandler);
router.get("/admin/settings/get", publicSettingHandler);

/* ── Admin: Set a platform setting (server-side service role) ── */
router.post("/admin/settings/set", async (req, res) => {
  const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
  if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
  const { key, value } = req.body as { key?: string; value?: string };
  if (!key) { res.status(400).json({ error: "key required" }); return; }
  if (value === undefined || value === null) { res.status(400).json({ error: "value required" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) { res.status(503).json({ error: "Serviço indisponível" }); return; }

  try {
    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: rows } = await admin.from("platform_settings").select("id").eq("key", key).limit(1);
    const existing = rows && rows.length > 0 ? rows[0] : null;
    if (existing) {
      const { error } = await admin.from("platform_settings").update({ value }).eq("key", key);
      if (error) { res.status(500).json({ error: error.message }); return; }
    } else {
      const { error } = await admin.from("platform_settings").insert({ key, value });
      if (error) { res.status(500).json({ error: error.message }); return; }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "settings/set error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Update admin credentials (email or password) via service role ── */
router.post("/admin/update-admin-credentials", async (req, res) => {
  const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
  if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
  const { type, value, adminEmail } = req.body as { type?: string; value?: string; adminEmail?: string };
  if (!type || !value || !adminEmail) {
    res.status(400).json({ error: "Parâmetros em falta (type, value, adminEmail)" });
    return;
  }
  if (type !== "email" && type !== "password") {
    res.status(400).json({ error: "Tipo inválido" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: "Serviço indisponível (credenciais do servidor não configuradas)" });
    return;
  }

  try {
    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);

    // Find user by their current email
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      res.status(500).json({ error: "Erro ao procurar utilizador: " + listErr.message });
      return;
    }
    const users = (listData?.users ?? []);
    const user = users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase().trim());
    if (!user) {
      res.status(404).json({ error: "Nenhuma conta encontrada com o e-mail: " + adminEmail });
      return;
    }

    const updateData: { email?: string; password?: string } = {};
    if (type === "email") updateData.email = value.trim();
    if (type === "password") updateData.password = value;

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, updateData);
    if (updateErr) {
      res.status(500).json({ error: "Erro ao actualizar: " + updateErr.message });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "update-admin-credentials error");
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

/* ── Admin: Send support message (service role — bypasses RLS) ── */
router.post("/admin/support/send", async (req, res) => {
  try {
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { userId, userName, content } = req.body as {
      userId?: string; userName?: string; content?: string;
    };
    if (!userId || !content?.trim()) {
      res.status(400).json({ error: "userId e content são obrigatórios" }); return;
    }
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: "Faltam variáveis de ambiente do servidor." }); return;
    }
    const admin = buildAdminClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("support_messages").insert({
      user_id:   userId,
      user_name: userName ?? "Admin",
      sender:    "admin",
      content:   content.trim(),
    });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin/support/send error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Admin: Send notification to users (service role — bypasses RLS) ── */
router.post("/admin/notifications/send", async (req, res) => {
  try {
    const gate = await buildAdminAndVerifyAdmin(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const {
      title, subtitle, type, target,
      targetUserIds, imageUrl, actionButtonLabel, actionButtonUrl, sentBy,
    } = req.body as {
      title?: string; subtitle?: string; type?: string; target?: string;
      targetUserIds?: string[]; imageUrl?: string;
      actionButtonLabel?: string; actionButtonUrl?: string; sentBy?: string;
    };
    if (!title?.trim()) {
      res.status(400).json({ error: "O campo 'title' é obrigatório." }); return;
    }
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: "Faltam variáveis de ambiente do servidor." }); return;
    }
    const admin = buildAdminClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("notifications").insert({
      title:               title.trim(),
      subtitle:            subtitle ?? null,
      type:                type ?? "notification",
      target:              target ?? "all",
      target_user_ids:     targetUserIds ?? null,
      image_url:           imageUrl ?? null,
      action_button_label: actionButtonLabel ?? null,
      action_button_url:   actionButtonUrl ?? null,
      sent_by:             sentBy ?? null,
    });
    if (error) {
      req.log.error({ error }, "notifications insert failed");
      res.status(500).json({ error: error.message }); return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin/notifications/send error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Wallet: atomic server-side bet deduct (replaces client-side balance writes) ── */
router.post("/bet/deduct", async (req, res) => {
  try {
    if (!rateLimit("bet-deduct", req, 60, 60_000)) { res.status(429).json({ error: "Demasiados pedidos." }); return; }
    const gate = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { supabaseAdmin, userId } = gate;

    const { amount, gameType, description } = req.body as {
      amount?: number; gameType?: string; description?: string;
    };
    if (!amount || typeof amount !== "number" || amount < 1 || amount > 5000) {
      res.status(400).json({ error: "Montante de aposta inválido" }); return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("balance, is_blocked").eq("id", userId).single();
    if (!profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }
    if ((profile as any).is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

    /* Per-user lock + atomic guard: parallel requests cannot double-spend */
    const result = await withUserLock(userId, async () => {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ balance: Math.round((Number((profile as any).balance ?? 0) - amount) * 100) / 100 })
        .eq("id", userId)
        .gte("balance", amount)
        .select("balance")
        .maybeSingle();

      if (updErr || !updated) return null;

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "bet",
        amount: -Math.abs(amount),
        description: description || `Aposta (${gameType ?? "jogo"}) - ${amount} MT`,
        status: "approved",
        created_at: new Date().toISOString(),
      });

      return (updated as any).balance as number;
    });

    if (result === null) { res.status(400).json({ error: "Saldo insuficiente" }); return; }
    res.json({ ok: true, newBalance: result });
  } catch (err) {
    req.log.error({ err }, "bet/deduct error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Wallet: server-side bet refund (cancelled room / match) ── */
router.post("/bet/refund", async (req, res) => {
  try {
    const gate = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { supabaseAdmin, userId } = gate;

    const { amount, description } = req.body as { amount?: number; description?: string };
    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 5000) {
      res.status(400).json({ error: "Montante de reembolso inválido" }); return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    if (!profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }

    const newBalance = await withUserLock(userId, async () => {
      const fresh = Math.round((Number((profile as any).balance ?? 0) + amount) * 100) / 100;
      const { error: updErr } = await supabaseAdmin
        .from("profiles").update({ balance: fresh }).eq("id", userId);
      if (updErr) return null;

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "win",
        amount,
        description: description || "Reembolso de aposta",
        status: "approved",
        created_at: new Date().toISOString(),
      });
      return fresh;
    });
    if (newBalance === null) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }

    res.json({ ok: true, newBalance });
  } catch (err) {
    req.log.error({ err }, "bet/refund error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Games: atomic server-side bet (port of Vercel api/games/bet) ── */
router.post("/games/bet", async (req, res) => {
  try {
    if (!rateLimit("games-bet", req, 60, 60_000)) { res.status(429).json({ error: "Demasiados pedidos." }); return; }
    const gate = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { supabaseAdmin, userId } = gate;

    const { amount, gameType, gameId, description } = req.body as {
      amount?: number; gameType?: string; gameId?: string; description?: string;
    };

    if (!amount || typeof amount !== "number" || amount < 1 || amount > 100000) {
      res.status(400).json({ error: "Montante de aposta inválido" }); return;
    }
    if (!gameType || !["damas", "ludo", "xadrez"].includes(gameType)) {
      res.status(400).json({ error: "Tipo de jogo inválido" }); return;
    }
    const isLocalOrBotGame = gameId === "local" || gameId?.startsWith("bot_");
    if (gameId && !isLocalOrBotGame && !UUID_RE.test(gameId)) {
      res.status(400).json({ error: "ID de jogo inválido" }); return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("balance, is_blocked").eq("id", userId).single();
    if (profileError || !profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }
    if ((profile as any).is_blocked) { res.status(403).json({ error: "Conta bloqueada" }); return; }

    const deductResult = await withUserLock(userId, async () => {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ balance: Math.round((Number((profile as any).balance ?? 0) - amount) * 100) / 100 })
        .eq("id", userId)
        .gte("balance", amount)
        .select("balance")
        .maybeSingle();

      if (updateError || !updated) return null;

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "bet",
        amount: -Math.abs(amount),
        description: description || `Aposta (${gameType}) - ${amount} MT`,
        status: "approved",
        created_at: new Date().toISOString(),
      });

      return (updated as any).balance as number;
    });

    if (deductResult === null) { res.status(400).json({ error: "Saldo insuficiente" }); return; }
    const updated = { balance: deductResult };

    if (gameId && UUID_RE.test(gameId)) {
      await supabaseAdmin
        .from("matches")
        .upsert({
          id: gameId,
          game_type: gameType,
          player1_id: userId,
          bet_amount: amount,
          winner_payout: Math.floor(amount * 2 * 0.9),
          status: "active",
          created_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .eq("player1_id", userId);
    }

    res.json({ ok: true, newBalance: (updated as any).balance });
  } catch (err) {
    req.log.error({ err }, "games/bet error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Games: settle win (port of Vercel api/games/win) ── */
router.post("/games/win", async (req, res) => {
  try {
    const gate = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { supabaseAdmin, userId } = gate;

    const { gameId, gameType } = req.body as { gameId?: string; gameType?: string };

    if (!gameId || typeof gameId !== "string") {
      res.status(400).json({ error: "ID de jogo inválido" }); return;
    }
    if (!UUID_RE.test(gameId)) {
      res.status(400).json({ error: "ID de jogo inválido" }); return;
    }
    if (!gameType || !["damas", "ludo", "xadrez"].includes(gameType)) {
      res.status(400).json({ error: "Tipo de jogo inválido" }); return;
    }

    /* Atomic idempotency: only the first caller flips status → finished and
       only real participants can ever match this filter */
    const { data: updated, error: updateMatchErr } = await supabaseAdmin
      .from("matches")
      .update({
        winner_id: userId,
        status: "finished",
        completed_at: new Date().toISOString(),
      })
      .eq("id", gameId)
      .neq("status", "finished")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .select("id, bet_amount, player1_id, player2_id, game_type")
      .maybeSingle();

    if (updateMatchErr) {
      req.log.error({ updateMatchErr }, "games/win match update failed");
      res.status(500).json({ error: "Erro ao processar vitória" }); return;
    }

    if (!updated) {
      const { data: match } = await supabaseAdmin
        .from("matches").select("status, winner_id").eq("id", gameId).maybeSingle();
      if (!match) { res.status(404).json({ error: "Partida não encontrada" }); return; }
      if ((match as any).status === "finished") { res.status(409).json({ error: "Partida já terminada" }); return; }
      res.status(403).json({ error: "Não és participante desta partida" }); return;
    }

    const m = updated as { bet_amount: number; game_type: string };
    const verifiedBet = Math.abs(Number(m.bet_amount) || 0);
    if (verifiedBet <= 0) { res.status(400).json({ error: "Aposta inválida na partida" }); return; }

    const WIN_RATE = 0.90;
    const MAX_PAYOUT = 200000;
    const payout = Math.min(Math.floor(verifiedBet * 2 * WIN_RATE), MAX_PAYOUT);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("balance").eq("id", userId).single();
    if (profileError || !profile) { res.status(500).json({ error: "Erro ao carregar perfil" }); return; }

    const newBalance = await withUserLock(userId, async () => {
      const fresh = Math.round((Number((profile as any).balance ?? 0) + payout) * 100) / 100;
      const { error: updateError } = await supabaseAdmin
        .from("profiles").update({ balance: fresh }).eq("id", userId);
      if (updateError) return null;

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "win",
        amount: payout,
        description: `Vitória (${gameType}) +${payout} MT`,
        status: "approved",
        created_at: new Date().toISOString(),
      });
      return fresh;
    });
    if (newBalance === null) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }

    try {
      await supabaseAdmin.from("platform_earnings").insert({
        match_id: gameId,
        game_type: gameType,
        bet_amount: verifiedBet,
        payout,
        platform_cut: Math.round(verifiedBet * 2 * (1 - WIN_RATE)),
        created_at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }

    res.json({ ok: true, payout, newBalance });
  } catch (err) {
    req.log.error({ err }, "games/win error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Games: secure dice roll (port of Vercel api/games/ludo-dice) ── */
router.post("/games/ludo-dice", async (req, res) => {
  try {
    const gate = await buildAdminAndVerify(req.headers.authorization ?? "");
    if (!gate.ok) { res.status(gate.status).json({ error: gate.error }); return; }
    const { supabaseAdmin, userId } = gate;

    const { gameId, allInBase, stuckTurns, consecutiveSixes } = req.body as {
      gameId?: string; allInBase?: boolean; stuckTurns?: number; consecutiveSixes?: number;
    };

    if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
      res.status(400).json({ error: "ID de jogo inválido" }); return;
    }

    if (gameId !== "local" && !gameId.startsWith("bot_") && !UUID_RE.test(gameId)) {
      res.status(400).json({ error: "ID de jogo inválido" }); return;
    }

    if (gameId !== "local" && !gameId.startsWith("bot_")) {
      const { data: match } = await supabaseAdmin
        .from("matches").select("player1_id, player2_id, status").eq("id", gameId).single();
      if (match) {
        const m = match as { player1_id: string; player2_id: string | null; status: string };
        if (m.player1_id !== userId && m.player2_id !== userId) {
          res.status(403).json({ error: "Não és participante desta partida" }); return;
        }
        if (m.status === "finished") {
          res.status(409).json({ error: "Partida já terminada" }); return;
        }
      }
    }

    const buf = new Uint32Array(1);
    (globalThis.crypto as any).getRandomValues(buf);
    const secureRandom = buf[0] / 0x100000000;

    let diceValue: number;
    if (Number(consecutiveSixes) >= 2) {
      diceValue = Math.floor(secureRandom * 5) + 1;
    } else if (allInBase && Number(stuckTurns) >= 9) {
      diceValue = 6;
    } else {
      diceValue = Math.floor(secureRandom * 6) + 1;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ value: diceValue, timestamp: Date.now() });
  } catch (err) {
    req.log.error({ err }, "games/ludo-dice error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── SMS Forwarder Webhook ── */
router.post("/sms/webhook", async (req, res) => {
  if (!rateLimit("sms-webhook", req, 60, 60_000)) { res.status(429).json({ error: "Rate limited" }); return; }
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  // SECURITY: webhook credits real money — token is mandatory.
  // Configure 'sms_webhook_token' em platform_settings ou SMS_WEBHOOK_TOKEN no ambiente.
  if (supabaseUrl && supabaseServiceKey) {
    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenRow } = await admin
      .from("platform_settings").select("value").eq("key", "sms_webhook_token").maybeSingle();
    const expectedToken = tokenRow?.value ?? process.env["SMS_WEBHOOK_TOKEN"] ?? null;

    if (!expectedToken) {
      req.log.error("sms/webhook rejected: no sms_webhook_token configured");
      res.status(503).json({ error: "Webhook não configurado (falta sms_webhook_token)" });
      return;
    }

    const authHeader = req.headers.authorization ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7)
      : (req.query["token"] as string | undefined ?? "");
    if (!provided || provided !== expectedToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else {
    res.status(503).json({ error: "Serviço indisponível" });
    return;
  }

  const { body: smsBody, sender, id: smsId } = req.body as {
    body?: string; sender?: string; id?: string;
  };
  if (!smsBody) { res.status(400).json({ error: "body required" }); return; }

  const id = smsId ?? `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const parsedAmount = extractAmount(smsBody);
  const parsedTxId = extractTxId(smsBody);

  const stored: StoredSMS = {
    id, body: smsBody, sender: sender ?? "unknown",
    receivedAt: Date.now(), used: false, parsedAmount, parsedTxId,
  };
  smsStore.set(id, stored);
  req.log.info({ id, parsedAmount, parsedTxId }, "SMS received from forwarder");

  // Try to auto-resolve any pending verifications
  if (supabaseUrl && supabaseServiceKey) {
    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    for (const pending of pendingStore.values()) {
      if (pending.status !== "pending") continue;
      const match = tryMatchForwarderSms(pending.userSmsBody, pending.expectedAmount);
      if (!match) continue;
      match.used = true;
      pending.status = "approved";
      pending.resolvedTxId = match.parsedTxId;
      req.log.info({ pendingId: pending.id }, "Auto-resolved pending verification");

      if (pending.mode === "deposit") {
        await creditBalance(admin, pending.userId, pending.expectedAmount, match.parsedTxId, "Depósito via M-Pesa/e-Mola");
      }
    }
  }

  res.json({ success: true, id, parsedAmount, parsedTxId });
});

/* ── Deposit: Verify SMS ── */
router.post("/deposit/verify", async (req, res) => {
  try {
    if (!rateLimit("deposit-verify", req, 20, 600_000)) { res.status(429).json({ error: "Demasiadas tentativas. Tenta mais tarde." }); return; }
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { smsText, expectedAmount, mode } = req.body as {
      smsText?: string; expectedAmount?: number; mode?: "deposit" | "bet";
    };
    if (!smsText || !expectedAmount || expectedAmount <= 0) {
      res.status(400).json({ error: "Dados inválidos" }); return;
    }

    const depositMode: "deposit" | "bet" = mode ?? "deposit";

    // Try to match against a stored forwarder SMS
    const matchedSms = tryMatchForwarderSms(smsText, expectedAmount);
    if (matchedSms) {
      matchedSms.used = true;
      if (depositMode === "deposit") {
        await creditBalance(admin, userId, expectedAmount, matchedSms.parsedTxId, "Depósito via M-Pesa/e-Mola");
      }
      req.log.info({ userId, expectedAmount, mode: depositMode, txId: matchedSms.parsedTxId }, "Deposit verified immediately");
      res.json({ status: "approved", amount: expectedAmount, txId: matchedSms.parsedTxId });
      return;
    }

    // No forwarder SMS yet — create a pending verification (poll-based)
    const pendingId = `pv_${userId.slice(0, 8)}_${Date.now()}`;
    pendingStore.set(pendingId, {
      id: pendingId, userId, userSmsBody: smsText, expectedAmount,
      mode: depositMode, submittedAt: Date.now(), status: "pending",
    });
    req.log.info({ pendingId, expectedAmount, mode: depositMode }, "Pending verification created");
    res.json({ status: "pending", pendingId });
  } catch (err) {
    req.log.error({ err }, "Deposit verify error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Deposit: Poll Status ── */
router.get("/deposit/status/:pendingId", async (req, res) => {
  const { pendingId } = req.params;
  const pending = pendingStore.get(pendingId);

  if (!pending) { res.json({ status: "not_found" }); return; }

  // SECURITY: only the owner polls their own verification
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ status: "unauthorized" }); return; }
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
      const { data: userData } = await admin.auth.getUser(token);
      if (!userData?.user || userData.user.id !== pending.userId) {
        res.status(403).json({ status: "forbidden" });
        return;
      }
    } catch {
      res.status(401).json({ status: "unauthorized" });
      return;
    }
  }

  if (pending.status === "approved") {
    pendingStore.delete(pendingId);
    res.json({ status: "approved", amount: pending.expectedAmount, txId: pending.resolvedTxId ?? null });
    return;
  }

  // Check TTL (90 s)
  if (Date.now() - pending.submittedAt > 90_000) {
    pending.status = "rejected";
    pendingStore.delete(pendingId);
    res.json({ status: "rejected", reason: "timeout" });
    return;
  }

  res.json({ status: "pending" });
});

/* ── Deposit: Manual Request (Carteira Móvel) ── */
router.post("/deposit/manual-request", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { mode, amount, phone, confirmationMsg } = req.body as {
      mode?: "deposit" | "bet";
      amount?: number;
      phone?: string;
      confirmationMsg?: string;
    };

    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }
    if (!confirmationMsg?.trim()) { res.status(400).json({ error: "Mensagem de confirmação obrigatória" }); return; }

    const depositMode: "deposit" | "bet" = mode ?? "deposit";

    const { data: profileData } = await admin.from("profiles").select("full_name, phone").eq("id", userId).single();
    const userName = (profileData as any)?.full_name ?? "Utilizador";
    const userPhone = phone ?? (profileData as any)?.phone ?? "";

    const { data: txRow, error: txError } = await (admin.from("transactions").insert({
      user_id: userId,
      type: depositMode === "bet" ? "manual_bet" : "manual_deposit",
      amount,
      description: JSON.stringify({
        phone: userPhone,
        confirmationMsg: confirmationMsg.trim(),
        userName,
        mode: depositMode,
      }),
      status: "pending",
      created_at: new Date().toISOString(),
    }) as any).select("id").single();

    if (txError || !txRow) {
      req.log.error({ txError }, "Failed to create manual deposit request");
      res.status(500).json({ error: "Erro ao criar pedido" }); return;
    }

    req.log.info({ userId, amount, mode: depositMode, txId: (txRow as any).id }, "Manual deposit request created");
    res.json({ pendingId: (txRow as any).id });
  } catch (err) {
    req.log.error({ err }, "Manual deposit request error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Deposit: Manual Status Check ── */
router.get("/deposit/manual-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) { res.status(400).json({ error: "id required" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: txData, error: txError } = await admin
      .from("transactions").select("id, status, amount, type").eq("id", id).single();

    if (txError || !txData) { res.json({ status: "not_found" }); return; }
    res.json({ status: (txData as any).status, amount: (txData as any).amount, type: (txData as any).type });
  } catch (err) {
    req.log.error({ err }, "Manual status check error");
    res.status(500).json({ error: "Erro interno" });
  }
});

/* ── Deposit: Credit after cancelled bet ── */
router.post("/deposit/credit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";
    if (!supabaseUrl || !supabaseServiceKey) { res.status(500).json({ error: "Serviço indisponível" }); return; }

    const admin = buildAdminClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const userId = userData.user.id;

    const { amount, txId } = req.body as { amount?: number; txId?: string };
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }

    // Guard against double-credit: check for existing deposit with this txId
    if (txId) {
      const { data: existing } = await admin
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "deposit")
        .ilike("description", `%${txId}%`)
        .limit(1);
      if (existing && existing.length > 0) {
        res.json({ success: true, message: "already_credited" }); return;
      }
    }

    const ok = await creditBalance(admin, userId, amount, txId, "Crédito por aposta não encontrada");
    if (!ok) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }

    req.log.info({ userId, amount, txId }, "Balance credited after cancelled bet");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Deposit credit error");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
