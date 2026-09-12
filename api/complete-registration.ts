import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/* ── /api/complete-registration ─────────────────────────────────────────────
   Upserts profile + credits welcome bonus (10 MT, one-time, atomic).
   SECURITY: user_id is ALWAYS resolved from the Bearer token — never from body.
   The bonus claim uses a conditional UPDATE to prevent TOCTOU race conditions.
   ───────────────────────────────────────────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env["ALLOWED_ORIGIN"] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { return res.status(405).json({ error: "Method not allowed" }); }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
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

  // SECURITY: ALWAYS resolve user_id from Bearer token — NEVER from body
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.id) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const resolvedUserId = user.id;

  const { email, full_name, phone, invite_code_used } = (req.body ?? {}) as {
    email?: string;
    full_name?: string;
    phone?: string;
    invite_code_used?: string | null;
  };

  try {
    /* ── 1. Upsert profile ───────────────────────────────────────────── */
    const profileData: Record<string, unknown> = { id: resolvedUserId };
    if (email) profileData.email = email;
    if (full_name) profileData.full_name = full_name;
    if (phone) profileData.phone = phone.replace(/\D/g, "");
    if (invite_code_used !== undefined)
      profileData.invite_code_used = invite_code_used ?? null;

    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(profileData, { onConflict: "id", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("[complete-registration] upsert error:", upsertErr);
    }

    /* ── 2. Welcome bonus (10 MT — ATOMIC one-time claim) ────────────── */
    // SECURITY: Conditional UPDATE prevents TOCTOU race — only ONE concurrent
    // request can flip welcome_bonus_claimed from false to true.
    const { data: claimedRows, error: claimError } = await admin
      .from("profiles")
      .update({ welcome_bonus_claimed: true })
      .eq("id", resolvedUserId)
      .eq("welcome_bonus_claimed", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("[complete-registration] bonus claim error:", claimError);
    }

    // Only credit if we successfully flipped the flag (claimedRows != null)
    if (claimedRows) {
      const WELCOME_BONUS = 10;
      const { error: bonusErr } = await admin.rpc("adjust_balance", {
        p_user_id: resolvedUserId,
        p_delta: WELCOME_BONUS,
        p_min: 0,
      });

      if (!bonusErr) {
        // Track bonus balance for withdrawal lock
        await admin
          .from("profiles")
          .update({ bonus_balance: WELCOME_BONUS })
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
        console.error("[complete-registration] bonus credit error:", bonusErr);
        // Rollback the flag so it can be retried
        await admin
          .from("profiles")
          .update({ welcome_bonus_claimed: false })
          .eq("id", resolvedUserId);
      }
    }

    /* ── 3. Link referral if invite code provided ────────────────────── */
    if (invite_code_used) {
      const code = invite_code_used.toUpperCase().trim();

      const { data: existingRef } = await admin
        .from("referrals")
        .select("id")
        .eq("referred_id", resolvedUserId)
        .maybeSingle();

      if (!existingRef) {
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

    return res.status(200).json({ ok: true, bonusCredited: !!claimedRows });
  } catch (err) {
    console.error("[complete-registration] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
