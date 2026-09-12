import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user_id, email, full_name, phone, invite_code_used } = req.body as {
    user_id?: string;
    email?: string;
    full_name?: string;
    phone?: string;
    invite_code_used?: string | null;
  };

  const supabaseUrl =
    process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const serviceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve user_id from body or auth token
  let resolvedUserId = user_id;
  if (!resolvedUserId) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (user?.id) resolvedUserId = user.id;
    }
  }

  if (!resolvedUserId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    /* ── 1. Upsert profile ───────────────────────────────────────────── */
    const profileData: Record<string, unknown> = { id: resolvedUserId };
    if (email)     profileData.email     = email;
    if (full_name) profileData.full_name = full_name;
    if (phone)     profileData.phone     = phone.replace(/\D/g, "");
    if (invite_code_used !== undefined)
      profileData.invite_code_used = invite_code_used ?? null;

    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(profileData, { onConflict: "id", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("[complete-registration] upsert error:", upsertErr);
    }

    /* ── 2. Welcome bonus (10 MT — one-time) ─────────────────────────── */
    const { data: profileRow } = await admin
      .from("profiles")
      .select("welcome_bonus_claimed, balance")
      .eq("id", resolvedUserId)
      .maybeSingle();

    const p = profileRow as { welcome_bonus_claimed?: boolean; balance?: number } | null;
    if (p && !p.welcome_bonus_claimed) {
      const WELCOME_BONUS = 10;
      const { error: bonusErr } = await admin.rpc("adjust_balance", {
        p_user_id: resolvedUserId,
        p_delta: WELCOME_BONUS,
        p_min: 0,
      });

      if (!bonusErr) {
        await admin
          .from("profiles")
          .update({
            welcome_bonus_claimed: true,
            bonus_balance: WELCOME_BONUS,
          })
          .eq("id", resolvedUserId);

        await admin.from("transactions").insert({
          user_id: resolvedUserId,
          type: "bonus",
          amount: WELCOME_BONUS,
          description: "Bónus de boas-vindas — 10 MT",
          status: "approved",
          created_at: new Date().toISOString(),
        });
      } else {
        console.error("[complete-registration] welcome bonus error:", bonusErr);
      }
    }

    /* ── 3. Link referral if invite code provided ────────────────────── */
    if (invite_code_used) {
      const code = invite_code_used.toUpperCase().trim();

      /* Check if referral already exists for this user */
      const { data: existingRef } = await admin
        .from("referrals")
        .select("id")
        .eq("referred_id", resolvedUserId)
        .maybeSingle();

      if (!existingRef) {
        /* Find referrer by my_invite_code first, then affiliate_invite_code.
           IMPORTANT: store which type of code was used so the reward logic
           does NOT rely on is_affiliate (an affiliate can also share their
           friend invite code and should receive 2.50 MT, not 5 MT). */
        let referrerId: string | null = null;
        let referralType: "friend" | "affiliate" = "friend";

        const { data: byGeneral } = await admin
          .from("profiles")
          .select("id")
          .eq("my_invite_code", code)
          .neq("id", resolvedUserId)
          .maybeSingle();

        if (byGeneral?.id) {
          referrerId = byGeneral.id;
          referralType = "friend";
        } else {
          const { data: byAffiliate } = await admin
            .from("profiles")
            .select("id")
            .eq("affiliate_invite_code", code)
            .neq("id", resolvedUserId)
            .maybeSingle();

          if (byAffiliate?.id) {
            referrerId = byAffiliate.id;
            referralType = "affiliate";
          }
        }

        if (referrerId) {
          const { error: refErr } = await admin.from("referrals").insert({
            referrer_id: referrerId,
            referred_id: resolvedUserId,
            referral_type: referralType,
          });

          if (refErr) {
            console.error("[complete-registration] referrals insert error:", refErr);
          }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[complete-registration] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
