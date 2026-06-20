import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const REGULAR_REWARD   = 2.5;  // MT credited to referrer on referred user's first bet
const AFFILIATE_REWARD = 5.0;  // MT credited per bet to affiliate's pending earnings
const AFFILIATE_MAX    = 5;    // Max rewarded bets per referred user for affiliates

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user_id } = req.body as { user_id?: string };
  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const supabaseUrl  = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const serviceKey   = process.env["SUPABASE_SERVICE_ROLE_KEY"]
    ?? process.env["VITE_SUPABASE_SERVICE_ROLE"]
    ?? process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ?? "";

  if (!supabaseUrl || !serviceKey) {
    return res.status(200).json({ credited: false, reason: "env_missing" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    /* 1. Find referral record for this user */
    const { data: referral } = await admin
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", user_id)
      .maybeSingle();

    if (!referral?.referrer_id) {
      return res.status(200).json({ credited: false, reason: "no_referral" });
    }

    const referrerId = referral.referrer_id as string;

    /* 2. Get referrer profile */
    const { data: referrer } = await admin
      .from("profiles")
      .select("id, is_affiliate, balance, affiliate_pending_earnings")
      .eq("id", referrerId)
      .single();

    if (!referrer) {
      return res.status(200).json({ credited: false, reason: "referrer_not_found" });
    }

    /* 3. Affiliate flow */
    if (referrer.is_affiliate) {
      const { data: existingBet } = await admin
        .from("affiliate_bets")
        .select("bet_count")
        .eq("affiliate_id", referrerId)
        .eq("referred_user_id", user_id)
        .maybeSingle();

      const currentCount = (existingBet?.bet_count as number | null) ?? 0;

      if (currentCount >= AFFILIATE_MAX) {
        return res.status(200).json({ credited: false, reason: "max_bets_reached" });
      }

      /* Upsert affiliate_bets row */
      if (existingBet) {
        await admin
          .from("affiliate_bets")
          .update({ bet_count: currentCount + 1 })
          .eq("affiliate_id", referrerId)
          .eq("referred_user_id", user_id);
      } else {
        await admin.from("affiliate_bets").insert({
          affiliate_id:     referrerId,
          referred_user_id: user_id,
          bet_count:        1,
        });
      }

      /* Credit pending earnings */
      const currentPending = parseFloat(String(referrer.affiliate_pending_earnings ?? 0));
      await admin
        .from("profiles")
        .update({ affiliate_pending_earnings: currentPending + AFFILIATE_REWARD })
        .eq("id", referrerId);

      /* Record transaction for visibility */
      await admin.from("transactions").insert({
        user_id:     referrerId,
        type:        "affiliate_bonus",
        amount:      AFFILIATE_REWARD,
        description: `Bónus de afiliado (aposta do referido #${currentCount + 1}/5)`,
        status:      "approved",
      });

      return res.status(200).json({ credited: true, type: "affiliate", amount: AFFILIATE_REWARD });
    }

    /* 4. Regular referral flow — reward 2.5 MT only on first bet */
    const { count } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", referrerId)
      .eq("type", "referral_bonus")
      .ilike("description", `%${user_id}%`);

    if ((count ?? 0) > 0) {
      return res.status(200).json({ credited: false, reason: "already_rewarded" });
    }

    /* Credit balance */
    const currentBal = parseFloat(String(referrer.balance ?? 0));
    await admin
      .from("profiles")
      .update({ balance: currentBal + REGULAR_REWARD })
      .eq("id", referrerId);

    /* Record transaction */
    await admin.from("transactions").insert({
      user_id:     referrerId,
      type:        "referral_bonus",
      amount:      REGULAR_REWARD,
      description: `Bónus de convite: amigo ${user_id} fez a primeira aposta`,
      status:      "approved",
    });

    return res.status(200).json({ credited: true, type: "referral", amount: REGULAR_REWARD });
  } catch (err) {
    console.error("[record-bet-reward] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
