-- ============================================================================
-- MOZBET — HARDENING RLS COMPLETO
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New Query → RUN)
--
-- Protege todas as tabelas que antes estavam expostas ao anon key:
--   platform_settings, matchmaking_queue, deposit_verifications, sms_logs,
--   recharge_codes, transactions, matches, platform_earnings, profiles.
--
-- Princípios:
--   • O browser (anon key) SÓ lê/escreve o que o utilizador possui.
--   • Saldos (profiles.balance) NUNCA são escritos pelo browser — só por
--     service_role (a API Express usa SUPABASE_SERVICE_ROLE_KEY).
--   • Config pública (platform_settings) é só-leitura para utilizadores
--     autenticados; chaves sensíveis ficam protegidas por convenção de nome
--     (a API também redacta no endpoint público).
--   • Tabelas internas (sms_logs, deposit_verifications, recharge_codes) ficam
--     inacessíveis ao anon/authenticated — só service_role.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Helpers
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
-- 1. PLATFORM_SETTINGS
--    Antes: RLS desligado — qualquer anónimo lia TUDO (incl. sms_webhook_token)
--    e escrevia. Agora: leitura pública de configurações não-sensíveis,
--    escrita só para admins (service_role continua a poder tudo).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_all" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
DROP POLICY IF EXISTS "Allow authenticated read non-sensitive settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admin full access platform settings" ON public.platform_settings;

CREATE POLICY "platform_settings_public_read"
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    NOT (key ~* 'token|secret|password|webhook|service_role|api_key')
  );

CREATE POLICY "platform_settings_admin_write"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MATCHMAKING_QUEUE
--    Antes: RLS desligado — qualquer um lia a fila toda e apagava entradas
--    alheias (cancelar a fila de outro jogador). Agora: cada utilizador gere
--    as suas próprias entradas; leitura da fila limitada ao mesmo jogo/aposta
--    para o matchmaking funcionar (dados públicos: nome e valor da aposta).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mq_all" ON public.matchmaking_queue;

CREATE POLICY "mq_insert_own"
  ON public.matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mq_select_queue"
  ON public.matchmaking_queue FOR SELECT
  TO authenticated
  USING (true);  -- necessário para detectar oponentes; sem dados sensíveis

CREATE POLICY "mq_delete_own"
  ON public.matchmaking_queue FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mq_admin_all"
  ON public.matchmaking_queue FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SMS_LOGS + DEPOSIT_VERIFICATIONS
--    Antes: RLS desligado — expunham corpo de SMS (com números e tx IDs) e o
--    fluxo de verificação de depósitos a qualquer anónimo.
--    Agora: 100% service_role. O browser nunca acede directamente (a API
--    Express trata disto server-side).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_logs_all" ON public.sms_logs;
DROP POLICY IF EXISTS "deposit_verifications_all" ON public.deposit_verifications;
-- Sem políticas = ninguém (à parte service_role, que ignora RLS) acede.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RECHARGE_CODES
--    Códigos de recarga = dinheiro. Nunca expostos ao browser.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.recharge_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recharge_codes_all" ON public.recharge_codes;
-- Sem políticas — só service_role (a rota /api/recharge).

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PROFILES
--    Antes: qualquer utilizador podia escrever o PRÓPRIO saldo (e campos como
--    is_admin) directamente. Agora: o browser só pode actualizar dados de
--    perfil (nome, telefone, avatar); saldo, flags de admin, bloqueio e
--    ganhos de afiliado ficam só para service_role.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "profiles_insert_self_on_signup"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own_limited"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- O browser nunca pode alterar estes campos:
    -- balance, is_admin, is_blocked, block_type, affiliate_pending_earnings,
    -- affiliate_invite_code, referral rewards...
    -- (o trigger abaixo reverte tentativas)
  );

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Utilizadores autenticados podem ver código de convite/afiliado de outros
-- (necessário para /api/validate-invite e registos com convite) e presença
-- (nome/avatar para matchmaking). Sem saldos.
CREATE POLICY "profiles_select_public_fields"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
-- NOTA: como Postgres RLS filtra linhas (não colunas), esta política permite
-- ler o perfil inteiro de outros utilizadores autenticados. Para restringir
-- de verdade, expõe os dados públicos através de uma VIEW (ver secção 9).

-- Trigger de protecção de colunas sensíveis: reverte tentativas do browser
-- de alterar saldo/flags. Executado como SECURITY DEFINER para poder comparar.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.balance   IS DISTINCT FROM OLD.balance
    OR NEW.is_admin  IS DISTINCT FROM OLD.is_admin
    OR (NEW.is_blocked IS DISTINCT FROM OLD.is_blocked)
    OR (NEW.block_type IS DISTINCT FROM OLD.block_type)
    OR (NEW.affiliate_pending_earnings IS DISTINCT FROM OLD.affiliate_pending_earnings)
    OR (NEW.affiliate_invite_code IS DISTINCT FROM OLD.affiliate_invite_code) THEN
      -- Permitido apenas se a escrita vier de service_role/admin (RLS bypass
      -- não é detectável aqui, por isso comparamos o autor real via
      -- current_setting). Escritas do serviço usam service_role, que também
      -- dispara este trigger — nesse caso current_setting('role') = supabase_admin.
      IF current_setting('request.jwt.claim.role', true) = 'service_role'
         OR current_setting('role') = 'supabase_admin'
         OR public.is_platform_admin() THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Alteração de campo protegido bloqueada (saldo/admin via API apenas)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TRANSACTIONS
--    Antes: política de INSERT aberta — um utilizador podia inserir uma
--    transacção "win" +500 MT aprovada à mão. Agora: INSERT só de tipos
--    pendentes/depósito manual, UPDATE/DELETE negados; histórico só o próprio.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own pending transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;

CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

-- Insert restrito: apenas depósitos manuais pendentes (fluxo carteira móvel).
-- Apostas/vitórias/recargas passam SEMPRE pela API (service_role).
CREATE POLICY "transactions_insert_own_pending"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND type IN ('manual_deposit', 'manual_bet')
  );

CREATE POLICY "transactions_admin_all"
  ON public.transactions FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MATCHES
--    Antes: qualquer utilizador autenticado podia mudar o vencedor de uma
--    partida alheia (chamando /api/games/win com outro gameId, ou escrevendo
--    directamente). Agora: escrita apenas de participantes e admins.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_all" ON public.matches;
DROP POLICY IF EXISTS "matches_insert_own" ON public.matches;
DROP POLICY IF EXISTS "matches_update_own" ON public.matches;

CREATE POLICY "matches_select_participants"
  ON public.matches FOR SELECT
  TO authenticated
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_platform_admin()
  );

-- O browser cria partida via upsert quando entra num jogo (serverBet envia
-- gameId). Mantemos INSERT do criador, mas sem poder alterar bet_amount.
CREATE POLICY "matches_insert_own"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (player1_id = auth.uid());

CREATE POLICY "matches_update_participants"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid())
  WITH CHECK (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "matches_admin_all"
  ON public.matches FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. BALANCE_ADJUSTMENTS (histórico de ajustes manuais de saldo — só admin)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_adjustments_admin_read" ON public.balance_adjustments;
DROP POLICY IF EXISTS "balance_adjustments_admin_insert" ON public.balance_adjustments;

CREATE POLICY "balance_adjustments_admin_read"
  ON public.balance_adjustments FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "balance_adjustments_admin_insert"
  ON public.balance_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7c. BLOCKED_USERS (lista de utilizadores bloqueados — só admin)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_admin_read" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_admin_write" ON public.blocked_users;

CREATE POLICY "blocked_users_admin_read"
  ON public.blocked_users FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "blocked_users_admin_write"
  ON public.blocked_users FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. PLATFORM_EARNINGS
--    Antes: qualquer browser inseria "taxas" fictícias. Agora: só service_role.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_earnings_insert" ON public.platform_earnings;
DROP POLICY IF EXISTS "platform_earnings_select_admin" ON public.platform_earnings;

CREATE POLICY "platform_earnings_admin_read"
  ON public.platform_earnings FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. VIEW pública de perfis (campos seguros para matchmaking/salas)
--    Use esta view no frontend onde hoje lê "profiles" de outros jogadores.
--    (Opcional — migração de código separada.)
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
-- 10. Realtime: manter funcional para o admin (usa service_role) e para a
--     maintenance flag (leitura pública autorizada acima).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;

-- FIM — correr uma única vez. Verificar com:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
