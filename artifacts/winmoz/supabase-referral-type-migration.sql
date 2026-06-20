-- Migration: Add referral_type column to referrals table
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- PURPOSE:
--   The referrals table previously had no way to distinguish whether a referral
--   was created via the "Convidar Amigos" code (my_invite_code → 'friend') or via
--   the official affiliate code (affiliate_invite_code → 'affiliate').
--   The reward logic was incorrectly using is_affiliate from the referrer's profile,
--   which caused affiliate users who shared their friend invite code to be credited
--   5 MT instead of 2.50 MT, and their referrals to appear in the affiliate dashboard.
--
-- AFTER THIS MIGRATION:
--   - referral_type = 'friend'    → reward is 2.50 MT (one-time, on first bet)
--   - referral_type = 'affiliate' → reward is 5 MT (per bet, up to 5 bets)

-- Step 1: Add the column (idempotent — safe to run multiple times)
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_type TEXT
  CHECK (referral_type IN ('friend', 'affiliate'));

-- Step 2: Back-fill existing rows using the referrer's is_affiliate flag.
--   Rows created before this fix don't have referral_type, so we set a sensible
--   default. This back-fill uses is_affiliate as a best-effort guess for old rows.
UPDATE public.referrals r
SET referral_type = CASE
  WHEN p.is_affiliate = TRUE THEN 'affiliate'
  ELSE 'friend'
END
FROM public.profiles p
WHERE r.referrer_id = p.id
  AND r.referral_type IS NULL;

-- Step 3: Verify the migration
SELECT
  referral_type,
  COUNT(*) AS total
FROM public.referrals
GROUP BY referral_type
ORDER BY referral_type;
