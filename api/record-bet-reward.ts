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
    // Look up referral relationship — who referred this user?
    const { data: referral } = await admin
      .from("referrals")
      .select("referrer_id, bet_count")
      .eq("referred_id", betUserId)
      .maybeSingle();

    if (!referral) {
      // No referral relationship — nothing to do
      res.json({ ok: true, rewarded: false });
      return;
    }

    const r = referral as { referrer_id: string; bet_count: number };
    const currentBetCount = Number(r.bet_count ?? 0);

    // Affiliate max bets check
    if (currentBetCount >= AFFILIATE_MAX_BETS) {
      res.json({ ok: true, rewarded: false, reason: "max_bets_reached" });
      return;
    }

    // Check if referrer is an affiliate
    const { data: referrerProfile } = await admin
      .from("profiles")
      .select("is_affiliate, balance")
      .eq("id", r.referrer_id)
      .maybeSingle();

    if (!referrerProfile) {
      res.json({ ok: true, rewarded: false });
      return;
    }

    const rp = referrerProfile as { is_affiliate?: boolean; balance: number };
    const reward = rp.is_affiliate ? AFFILIATE_REWARD : INVITE_REWARD;
    const currentReferrerBalance = parseFloat(String(rp.balance ?? 0));
    const newReferrerBalance = Math.round((currentReferrerBalance + reward) * 100) / 100;

    // Credit the referrer
    await admin
      .from("profiles")
      .update({ balance: newReferrerBalance })
      .eq("id", r.referrer_id);

    // Record the reward transaction
    await admin.from("transactions").insert({
      user_id: r.referrer_id,
      type: "win",
      amount: reward,
      description: `Bónus de convite — aposta do convidado`,
      status: "approved",
      created_at: new Date().toISOString(),
    });

    // Increment bet count on the referral record
    await admin
      .from("referrals")
      .update({ bet_count: currentBetCount + 1 })
      .eq("referred_id", betUserId)
      .eq("referrer_id", r.referrer_id);

    res.json({ ok: true, rewarded: true, reward });
  } catch (err) {
    console.error("[record-bet-reward] Error:", err instanceof Error ? err.message : "unknown");
    res.json({ ok: true, rewarded: false }); // Non-critical — don't block game flow
  }
}
