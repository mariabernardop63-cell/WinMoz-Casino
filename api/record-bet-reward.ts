import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

const INVITE_REWARD = 2.5;       // MT per invite
const AFFILIATE_REWARD = 5;      // MT per bet by affiliate's referral
const AFFILIATE_MAX_BETS = 5;    // Max bets tracked per referral

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // SECURITY: Authenticate — userId ALWAYS comes from the JWT, never from the body
  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const betUserId = auth.userId; // The user who just placed a bet

  const admin = getSupabaseAdmin();

  try {
    // SECURITY (auditoria v2): incremento ATÓMICO do contador via RPC.
    // O bónus só é pago se o UPDATE devolver linha (bet_count < max) —
    // chamadas concorrentes não conseguem exceder o limite (era uma
    // "máquina de dinheiro" com leitura-escrita separada).
    const { data: incremented, error: incrError } = await admin
      .rpc("increment_referral_bets", { p_referred: betUserId, p_max: AFFILIATE_MAX_BETS });

    if (incrError) {
      console.error("[record-bet-reward] Erro no contador atómico:", incrError.message);
      res.json({ ok: true, rewarded: false });
      return;
    }

    if (!incremented || (incremented as number[])?.length === 0) {
      // Sem relação de referência, ou limite atingido (ou corrida perdida)
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

    // Check if referrer is an affiliate
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

    // Credit the referrer ATOMICALLY
    const { error: creditError } = await admin
      .rpc("adjust_balance", { p_user_id: referrerId, p_delta: reward, p_min: 0 });

    if (creditError) {
      console.error("[record-bet-reward] Erro ao creditar:", creditError.message);
      res.json({ ok: true, rewarded: false });
      return;
    }

    // Record the reward transaction
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
