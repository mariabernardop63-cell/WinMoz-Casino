-- ============================================================
-- WELCOME BONUS SYSTEM (10 MT — one-time per user)
-- ============================================================

-- 1. Add welcome_bonus_claimed flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN DEFAULT FALSE;

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_bonus
  ON profiles (id, welcome_bonus_claimed)
  WHERE welcome_bonus_claimed = FALSE;

-- 3. Add bonus_blacklist column to track bonus funds that require a bet before withdrawal
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(12,2) DEFAULT 0;

-- 4. Ensure adjust_balance RPC exists (needed for atomic balance ops)
CREATE OR REPLACE FUNCTION adjust_balance(p_user_id UUID, p_delta NUMERIC, p_min NUMERIC DEFAULT 0)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bal NUMERIC;
BEGIN
  UPDATE profiles
  SET balance = balance + p_delta
  WHERE id = p_user_id AND balance + p_delta >= p_min
  RETURNING balance INTO new_bal;

  IF new_bal IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN new_bal;
END;
$$;
