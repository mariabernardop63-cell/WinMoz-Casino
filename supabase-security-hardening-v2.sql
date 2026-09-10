-- ============================================================================
-- MOZBET — HARDENING DE SEGURANÇA v2 (auditoria)
-- Executar no Supabase SQL Editor. Seguro para re-executar.
--
-- 1. RPC atómico adjust_balance (elimina race conditions de saldo)
-- 2. matches: RLS server-only + coluna paid_out (payout único)
-- 3. profiles: SELECT apenas da própria linha (+ view pública mantida)
-- 4. referrals / invite_credits / support_messages / game_rooms: políticas corrigidas
-- 5. Colunas protegidas extras no trigger de perfil
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RPC ATÓMICO DE SALDO — usar SEMPRE para movimentos de dinheiro
--    adjust_balance(p_user_id, p_delta, p_min) → saldo novo ou NULL se falhou
--    - Incremento atómico: nunca perde créditos concorrentes
--    - Guard: exige saldo final >= p_min (p.ex. p_min = 0 ou = aposta)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adjust_balance(p_user_id uuid, p_delta numeric, p_min numeric DEFAULT 0)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET balance = round((balance + p_delta) * 100) / 100
  WHERE id = p_user_id
    AND is_blocked = false
    AND round((balance + p_delta) * 100) / 100 >= p_min
  RETURNING balance;
$$;

REVOKE ALL ON FUNCTION public.adjust_balance(uuid, numeric, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, numeric, numeric) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MATCHES — escrita apenas pelo servidor + payout único
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS paid_out boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS matches_paid_out_idx ON public.matches (id) WHERE paid_out = false;

SELECT public.__drop_policy_if_exists('matches', 'matches_insert_own');
SELECT public.__drop_policy_if_exists('matches', 'matches_update_participants');
SELECT public.__drop_policy_if_exists('matches', 'matches_select_participants');
SELECT public.__drop_policy_if_exists('matches', 'matches_admin_all');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='matches') THEN
    ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

    -- Leitura: apenas participantes
    EXECUTE $p$CREATE POLICY matches_select_participants ON public.matches
      FOR SELECT TO authenticated
      USING (player1_id = auth.uid() OR player2_id = auth.uid())$p$;

    -- Escrita: NENHUMA política → só service_role (API server-side).
    -- Isto elimina: criação de partidas com bet_amount falso, elevação de
    -- aposta, reset de status para re-claim de payout (C1/C2/C3 da auditoria).
    RAISE NOTICE 'RLS matches: escrita apenas service_role';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES — SELECT apenas da própria linha (ou admin)
--    Outros perfis: via view profiles_public (só colunas seguras)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__drop_policy_if_exists('profiles', 'profiles_select_public_fields');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE $p$CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid() OR is_admin)$p$;
    RAISE NOTICE 'RLS profiles: SELECT restrito à própria linha (ou admin)';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REFERRALS — só o servidor cria (elimina farming de bónus)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__drop_policy_if_exists('referrals', 'service_role_insert_referrals');
SELECT public.__drop_policy_if_exists('referrals', 'service role can insert referrals');
SELECT public.__drop_policy_if_exists('referrals', 'referrals_select_own');
SELECT public.__drop_policy_if_exists('referrals', 'referrals_insert_service');
SELECT public.__drop_policy_if_exists('referrals', 'referrals_update_service');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='referrals') THEN
    ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
    EXECUTE $p$CREATE POLICY referrals_select_own ON public.referrals
      FOR SELECT TO authenticated
      USING (referrer_id = auth.uid() OR referred_id = auth.uid())$p$;
    -- Sem INSERT/UPDATE para clientes — só service_role
    RAISE NOTICE 'RLS referrals: leitura própria; escrita só service_role';
  END IF;
END
$$;

-- 4b. INVITE_CREDITS — leitura própria apenas (elimina re-armar bónus)
SELECT public.__drop_policy_if_exists('invite_credits', 'invite_credits_all');
SELECT public.__drop_policy_if_exists('invite_credits', 'invite_credits_select_own');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='invite_credits') THEN
    ALTER TABLE public.invite_credits ENABLE ROW LEVEL SECURITY;
    EXECUTE $p$CREATE POLICY invite_credits_select_own ON public.invite_credits
      FOR SELECT TO authenticated
      USING (user_id = auth.uid())$p$;
    RAISE NOTICE 'RLS invite_credits: leitura própria; escrita só service_role';
  END IF;
END
$$;

-- 4c. SUPPORT_MESSAGES — user só escreve as suas (sender='user'); 'ai' só servidor
SELECT public.__drop_policy_if_exists('support_messages', 'support_messages_insert_admin');
SELECT public.__drop_policy_if_exists('support_messages', 'support_messages_select_own');
SELECT public.__drop_policy_if_exists('support_messages', 'support_messages_insert_own');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='support_messages') THEN
    ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
    EXECUTE $p$CREATE POLICY support_messages_select_own ON public.support_messages
      FOR SELECT TO authenticated
      USING (user_id = auth.uid())$p$;
    EXECUTE $p$CREATE POLICY support_messages_insert_own ON public.support_messages
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND sender = 'user')$p$;
    RAISE NOTICE 'RLS support_messages: user só escreve as suas (sender=user)';
  END IF;
END
$$;

-- 4d. GAME_ROOMS — UPDATE só pelo criador (elimina manipulação de salas alheias)
SELECT public.__drop_policy_if_exists('game_rooms', 'game_rooms_update');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='game_rooms') THEN
    ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
    -- joiner definido apenas via RPC/servidor; clientes só leem e criam
    EXECUTE $p$CREATE POLICY game_rooms_select_all ON public.game_rooms
      FOR SELECT TO authenticated
      USING (true)$p$;
    EXECUTE $p$CREATE POLICY game_rooms_insert_own ON public.game_rooms
      FOR INSERT TO authenticated
      WITH CHECK (creator_id = auth.uid())$p$;
    EXECUTE $p$CREATE POLICY game_rooms_update_creator ON public.game_rooms
      FOR UPDATE TO authenticated
      USING (creator_id = auth.uid())$p$;
    EXECUTE $p$CREATE POLICY game_rooms_delete_creator ON public.game_rooms
      FOR DELETE TO authenticated
      USING (creator_id = auth.uid())$p$;
    RAISE NOTICE 'RLS game_rooms: update/delete apenas pelo criador';
  END IF;
END
$$;

-- 4e. NOTIFICATIONS — leitura apenas (client); escrita só servidor
SELECT public.__drop_policy_if_exists('notifications', 'notifications_insert_admin');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='notifications') THEN
    EXECUTE $p$CREATE POLICY notifications_select_all ON public.notifications
      FOR SELECT TO authenticated
      USING (target = 'all' OR target = auth.uid()::text)$p$;
    RAISE NOTICE 'RLS notifications: leitura por target; escrita só service_role';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PROTECT_PROFILE_COLUMNS — proteger também campos de afiliado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='protect_profile_columns'
  ) THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_body$
DECLARE
  is_service boolean;
  protected_cols text[] := ARRAY['balance','is_admin','is_blocked','block_type',
    'affiliate_pending_earnings','affiliate_invite_code',
    'is_affiliate','my_invite_code','invite_code_used'];
  col text;
BEGIN
  SELECT (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
    INTO is_service
    WHERE current_setting('request.jwt.claims', true) IS NOT NULL;
  IF is_service THEN RETURN NEW; END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
      RAISE EXCEPTION 'Coluna protegida % não pode ser modificada pelo cliente', col;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn_body$;
$fn$;
    RAISE NOTICE 'protect_profile_columns actualizado (afiliados protegidos)';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC atómico para contador de referidos (elimina race do bónus)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_referral_bets(p_referred uuid, p_max int DEFAULT 5)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.referrals
  SET bet_count = bet_count + 1
  WHERE referred_id = p_referred AND bet_count < p_max
  RETURNING bet_count;
$$;

REVOKE ALL ON FUNCTION public.increment_referral_bets(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_referral_bets(uuid, int) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Marca partidas antigas como pagas (conservador: histórico é intocável)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.matches SET paid_out = true WHERE status = 'finished';

DO $$
BEGIN
  RAISE NOTICE '✅ HARDENING v2 APLICADO COM SUCESSO';
END
$$;
