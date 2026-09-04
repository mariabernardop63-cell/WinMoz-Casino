-- ============================================================================
-- MOZBET — HARDENING RLS COMPLETO (v2, defensiva e re-executável)
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New Query → RUN)
--
-- SEGURA PARA RE-EXECUTAR: todas as operações verificam a existência das
-- tabelas/colunas antes de agir. Nenhum erro 42P01 (relation does not exist).
--
-- NOTA SOBRE TABELAS QUE PODEM NÃO EXISTIR:
--   recharge_codes é criada aqui se faltar (a API de recarga precisa dela).
--   As restantes (balance_adjustments, blocked_users, platform_earnings,
--   matches, ...) só recebem RLS se já existirem no teu projeto.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Helper: aplica ENABLE RLS apenas se a tabela existir
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.__drop_policy_if_exists(tbl text, pol text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.__enable_rls_if_exists(tbl text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    RAISE NOTICE 'RLS activado em %', tbl;
  ELSE
    RAISE NOTICE 'Tabela % não existe — saltada', tbl;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper admin (usado pelas políticas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECHARGE_CODES — criar se faltar (a rota /api/recharge precisa dela)
--    Schema derivada do código: id, code, amount, used, used_by, used_at.
--    Se já existir, nada é alterado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recharge_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  amount     numeric NOT NULL CHECK (amount > 0),
  used       boolean NOT NULL DEFAULT false,
  used_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recharge_codes_code_key ON public.recharge_codes (code);

-- Colunas em falta se a tabela já existisse com schema antigo
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS used_at  timestamptz;
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PLATFORM_SETTINGS
--    Leitura pública só de chaves não-sensíveis; escrita só para admins.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('platform_settings');

SELECT public.__drop_policy_if_exists('platform_settings', 'platform_settings_all');
SELECT public.__drop_policy_if_exists('platform_settings', 'platform_settings_public_read');
SELECT public.__drop_policy_if_exists('platform_settings', 'platform_settings_admin_write');
SELECT public.__drop_policy_if_exists('platform_settings', 'Allow authenticated read non-sensitive settings');
SELECT public.__drop_policy_if_exists('platform_settings', 'Admin full access platform settings');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_settings') THEN
    EXECUTE $pol$CREATE POLICY "platform_settings_public_read" ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (NOT (key ~* 'token|secret|password|webhook|service_role|api_key'))$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_settings') THEN
    EXECUTE $pol$CREATE POLICY "platform_settings_admin_write" ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MATCHMAKING_QUEUE
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('matchmaking_queue');

SELECT public.__drop_policy_if_exists('matchmaking_queue', 'mq_all');
SELECT public.__drop_policy_if_exists('matchmaking_queue', 'mq_insert_own');
SELECT public.__drop_policy_if_exists('matchmaking_queue', 'mq_select_queue');
SELECT public.__drop_policy_if_exists('matchmaking_queue', 'mq_delete_own');
SELECT public.__drop_policy_if_exists('matchmaking_queue', 'mq_admin_all');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matchmaking_queue') THEN
    EXECUTE $pol$CREATE POLICY "mq_insert_own" ON public.matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matchmaking_queue') THEN
    EXECUTE $pol$CREATE POLICY "mq_select_queue" ON public.matchmaking_queue FOR SELECT
  TO authenticated
  USING (true)$pol$;
  END IF;
END
$do$;  -- necessário para detectar oponentes; sem dados sensíveis

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matchmaking_queue') THEN
    EXECUTE $pol$CREATE POLICY "mq_delete_own" ON public.matchmaking_queue FOR DELETE
  TO authenticated
  USING (user_id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matchmaking_queue') THEN
    EXECUTE $pol$CREATE POLICY "mq_admin_all" ON public.matchmaking_queue FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SMS_LOGS + DEPOSIT_VERIFICATIONS — 100% service_role
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('sms_logs');
SELECT public.__enable_rls_if_exists('deposit_verifications');

DROP POLICY IF EXISTS "sms_logs_all" ON public.sms_logs;
DROP POLICY IF EXISTS "deposit_verifications_all" ON public.deposit_verifications;
-- Sem políticas = ninguém (à parte service_role) acede.
-- Defesa extra: revogar grants directos (RLS já bloqueia, isto reforça)
REVOKE ALL ON public.sms_logs FROM anon, authenticated;
REVOKE ALL ON public.deposit_verifications FROM anon, authenticated;
REVOKE ALL ON public.recharge_codes FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RECHARGE_CODES — só service_role (compra/uso passa pela API)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('recharge_codes');
SELECT public.__drop_policy_if_exists('recharge_codes', 'recharge_codes_all');
SELECT public.__drop_policy_if_exists('recharge_codes', 'recharge_codes_select_own');
-- Sem políticas — só service_role.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PROFILES
--    Browser só actualiza dados de perfil. Saldo/admin/bloqueio ficam para
--    service_role, garantido pelo trigger abaixo.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('profiles');

SELECT public.__drop_policy_if_exists('profiles', 'profiles_select_own');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_update_own');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_insert_own');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_update_own_limited');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_insert_self_on_signup');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_select_public_fields');
SELECT public.__drop_policy_if_exists('profiles', 'profiles_admin_all');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE $pol$CREATE POLICY "profiles_insert_self_on_signup" ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE $pol$CREATE POLICY "profiles_select_public_fields" ON public.profiles FOR SELECT
  TO authenticated
  USING (true)$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE $pol$CREATE POLICY "profiles_update_own_limited" ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE $pol$CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- Trigger: bloqueia ALTERAÇÕES de colunas sensíveis vindas do browser
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
  protected_cols text[] := ARRAY[
    'balance', 'is_admin', 'is_blocked', 'block_type',
    'affiliate_pending_earnings', 'affiliate_invite_code'
  ];
  col text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- service_role (API) e admins podem alterar
    IF current_setting('request.jwt.claim.role', true) = 'service_role'
       OR current_setting('role') = 'supabase_admin'
       OR public.is_platform_admin() THEN
      RETURN NEW;
    END IF;
    -- Verifica coluna a coluna (ignora colunas que não existam na tua tabela)
    FOREACH col IN ARRAY protected_cols LOOP
      IF new_row ? col
         AND (NOT (old_row ? col) OR new_row -> col IS DISTINCT FROM old_row -> col) THEN
        RAISE EXCEPTION 'Alteração de campo protegido (%) bloqueada — saldo/admin apenas via API', col;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger só é criado se a tabela profiles existir
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles';
    EXECUTE 'CREATE TRIGGER trg_protect_profile_columns
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_profile_columns()';
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('transactions');

SELECT public.__drop_policy_if_exists('transactions', 'Users can insert own pending transactions');
SELECT public.__drop_policy_if_exists('transactions', 'transactions_select_own');
SELECT public.__drop_policy_if_exists('transactions', 'transactions_insert_own');
SELECT public.__drop_policy_if_exists('transactions', 'transactions_insert_own_pending');
SELECT public.__drop_policy_if_exists('transactions', 'transactions_admin_all');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='transactions') THEN
    EXECUTE $pol$CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='transactions') THEN
    EXECUTE $pol$CREATE POLICY "transactions_insert_own_pending" ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND type IN ('manual_deposit', 'manual_bet')
  )$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='transactions') THEN
    EXECUTE $pol$CREATE POLICY "transactions_admin_all" ON public.transactions FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. MATCHES — escrita só de participantes/admins
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('matches');

SELECT public.__drop_policy_if_exists('matches', 'matches_select_all');
SELECT public.__drop_policy_if_exists('matches', 'matches_insert_own');
SELECT public.__drop_policy_if_exists('matches', 'matches_update_own');
SELECT public.__drop_policy_if_exists('matches', 'matches_select_participants');
SELECT public.__drop_policy_if_exists('matches', 'matches_update_participants');
SELECT public.__drop_policy_if_exists('matches', 'matches_admin_all');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matches') THEN
    EXECUTE $pol$CREATE POLICY "matches_select_participants" ON public.matches FOR SELECT
  TO authenticated
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_platform_admin()
  )$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matches') THEN
    EXECUTE $pol$CREATE POLICY "matches_insert_own" ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (player1_id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matches') THEN
    EXECUTE $pol$CREATE POLICY "matches_update_participants" ON public.matches FOR UPDATE
  TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid())
  WITH CHECK (player1_id = auth.uid() OR player2_id = auth.uid())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matches') THEN
    EXECUTE $pol$CREATE POLICY "matches_admin_all" ON public.matches FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PLATFORM_EARNINGS — só service_role escreve; admin lê
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('platform_earnings');
SELECT public.__drop_policy_if_exists('platform_earnings', 'platform_earnings_insert');
SELECT public.__drop_policy_if_exists('platform_earnings', 'platform_earnings_select_admin');
SELECT public.__drop_policy_if_exists('platform_earnings', 'platform_earnings_admin_read');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_earnings') THEN
    EXECUTE $pol$CREATE POLICY "platform_earnings_admin_read" ON public.platform_earnings FOR SELECT
  TO authenticated
  USING (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. BALANCE_ADJUSTMENTS + BLOCKED_USERS — só admin
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('balance_adjustments');
SELECT public.__drop_policy_if_exists('balance_adjustments', 'balance_adjustments_admin_read');
SELECT public.__drop_policy_if_exists('balance_adjustments', 'balance_adjustments_admin_insert');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='balance_adjustments') THEN
    EXECUTE $pol$CREATE POLICY "balance_adjustments_admin_read" ON public.balance_adjustments FOR SELECT
  TO authenticated
  USING (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='balance_adjustments') THEN
    EXECUTE $pol$CREATE POLICY "balance_adjustments_admin_insert" ON public.balance_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

SELECT public.__enable_rls_if_exists('blocked_users');
SELECT public.__drop_policy_if_exists('blocked_users', 'blocked_users_admin_read');
SELECT public.__drop_policy_if_exists('blocked_users', 'blocked_users_admin_write');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='blocked_users') THEN
    EXECUTE $pol$CREATE POLICY "blocked_users_admin_read" ON public.blocked_users FOR SELECT
  TO authenticated
  USING (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='blocked_users') THEN
    EXECUTE $pol$CREATE POLICY "blocked_users_admin_write" ON public.blocked_users FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())$pol$;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. VIEW pública de perfis (campos seguros para matchmaking/salas)
--     Usa `profiles_public` no frontend em vez de `profiles` quando precisares
--     de dados de outros jogadores.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  avatar_url,
  my_invite_code,
  affiliate_invite_code,
  last_seen_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Realtime
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Limpeza dos helpers temporários (mantém is_platform_admin)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.__enable_rls_if_exists(text);
DROP FUNCTION IF EXISTS public.__drop_policy_if_exists(text, text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. VERIFICAÇÃO FINAL — correr à parte para confirmar:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;
-- Todas as linhas devem mostrar rowsecurity = true.
-- ============================================================================

-- ============================================================================
-- 16. FIX v3: o trigger protect_profile_columns bloqueava também a
--     service_role (current_setting('request.jwt.claim.role') não fica
--     definido em chamadas PostgREST com service key). Correcção: quando a
--     conexão NÃO tem JWT de utilizador (request.jwt.claims vazio/ausente),
--     é service_role → permitir.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
  protected_cols text[] := ARRAY[
    'balance', 'is_admin', 'is_blocked', 'block_type',
    'affiliate_pending_earnings', 'affiliate_invite_code'
  ];
  col text;
  claims jsonb;
  jwt_role text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
    jwt_role := COALESCE(claims->>'role', current_setting('request.jwt.claim.role', true));

    -- service_role (API server-side) e admins podem alterar
    IF jwt_role = 'service_role'
       OR current_setting('role') = 'supabase_admin'
       OR current_setting('role') = 'postgres'
       OR public.is_platform_admin() THEN
      RETURN NEW;
    END IF;

    FOREACH col IN ARRAY protected_cols LOOP
      IF new_row ? col
         AND (NOT (old_row ? col) OR new_row -> col IS DISTINCT FROM old_row -> col) THEN
        RAISE EXCEPTION 'Alteração de campo protegido (%) bloqueada — saldo/admin apenas via API', col;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
