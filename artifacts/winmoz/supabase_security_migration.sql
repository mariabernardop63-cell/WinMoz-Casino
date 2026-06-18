-- ============================================================
-- MOZBET SECURITY MIGRATION — Apply in Supabase SQL Editor
-- ============================================================
-- This migration:
--   1. Adds is_admin_user() helper function
--   2. Adds admin-level RLS policies for read access
--   3. CRITICALLY: prevents clients from directly updating balance
-- ============================================================

-- ── Helper: check if current JWT belongs to an admin ─────────
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  )
$$;

-- ── PROFILES TABLE ──────────────────────────────────────────

-- Drop old permissive update policy and replace with one that
-- locks the balance column from client-side modification.
-- ALL balance changes must now go through server-side API endpoints.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_profile_no_balance" ON public.profiles;
DROP POLICY IF EXISTS "admins_update_all_profiles" ON public.profiles;

CREATE POLICY "users_update_profile_no_balance" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Prevent client from changing balance directly
    balance IS NOT DISTINCT FROM (
      SELECT p.balance FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "admins_update_all_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Admin read policy for profiles
DROP POLICY IF EXISTS "admins_read_all_profiles" ON public.profiles;
CREATE POLICY "admins_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_user());

-- ── TRANSACTIONS TABLE ──────────────────────────────────────

-- Restrict what clients can insert directly
DROP POLICY IF EXISTS "Users can insert own pending transactions" ON public.transactions;
DROP POLICY IF EXISTS "users_insert_restricted_transactions" ON public.transactions;

CREATE POLICY "users_insert_restricted_transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    -- Clients can only insert withdrawal/recharge requests (status must be pending)
    type IN ('withdrawal', 'recharge') AND
    status = 'pending'
  );

-- Admins can insert any transaction type
DROP POLICY IF EXISTS "admins_insert_all_transactions" ON public.transactions;
CREATE POLICY "admins_insert_all_transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- Admins can read all transactions
DROP POLICY IF EXISTS "admins_read_all_transactions" ON public.transactions;
CREATE POLICY "admins_read_all_transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user());

-- Admins can update transactions (approve/reject)
DROP POLICY IF EXISTS "admins_update_all_transactions" ON public.transactions;
CREATE POLICY "admins_update_all_transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── MATCHES TABLE ──────────────────────────────────────────

DROP POLICY IF EXISTS "admins_read_all_matches" ON public.matches;
CREATE POLICY "admins_read_all_matches" ON public.matches
  FOR SELECT TO authenticated
  USING (
    player1_id = auth.uid() OR
    player2_id = auth.uid() OR
    public.is_admin_user()
  );

DROP POLICY IF EXISTS "admins_update_all_matches" ON public.matches;
CREATE POLICY "admins_update_all_matches" ON public.matches
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── PLATFORM EARNINGS TABLE ────────────────────────────────

DROP POLICY IF EXISTS "admins_read_platform_earnings" ON public.platform_earnings;
CREATE POLICY "admins_read_platform_earnings" ON public.platform_earnings
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- ── SERVICE ROLE BYPASS NOTE ───────────────────────────────
-- The SUPABASE_SERVICE_ROLE_KEY used in server-side API endpoints
-- (/api/games/win, /api/games/bet, /api/withdraw, etc.) bypasses
-- ALL RLS policies by design — this is correct because those
-- endpoints perform their own authentication checks (JWT validation).
-- NEVER expose SUPABASE_SERVICE_ROLE_KEY as a VITE_ env var.
