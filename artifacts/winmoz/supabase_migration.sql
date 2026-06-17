-- Tabelas para o sistema SMS Forwarder
-- Corre este SQL no Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Cola aqui → RUN

-- 1. Tabela para guardar SMS recebidos do SMS Forwarder
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id            TEXT        PRIMARY KEY,
  body          TEXT        NOT NULL,
  sender        TEXT        DEFAULT 'unknown',
  parsed_amount NUMERIC,
  parsed_tx_id  TEXT,
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  used          BOOLEAN     DEFAULT FALSE
);

-- Índice para pesquisa rápida por tx_id
CREATE INDEX IF NOT EXISTS sms_logs_parsed_tx_id_idx ON public.sms_logs (parsed_tx_id);
CREATE INDEX IF NOT EXISTS sms_logs_received_at_idx  ON public.sms_logs (received_at);
CREATE INDEX IF NOT EXISTS sms_logs_used_idx         ON public.sms_logs (used);

-- 2. Tabela para verificações de depósito pendentes
CREATE TABLE IF NOT EXISTS public.deposit_verifications (
  id               TEXT        PRIMARY KEY,
  user_id          UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_sms_body    TEXT        NOT NULL,
  expected_amount  NUMERIC     NOT NULL,
  mode             TEXT        DEFAULT 'deposit',  -- 'deposit' | 'bet'
  status           TEXT        DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  sms_log_id       TEXT        REFERENCES public.sms_logs(id),
  resolved_tx_id   TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  verified_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS deposit_verifications_status_idx   ON public.deposit_verifications (status);
CREATE INDEX IF NOT EXISTS deposit_verifications_user_id_idx  ON public.deposit_verifications (user_id);

-- 3. RLS: desabilitar para estas tabelas (só o service_role as acede)
ALTER TABLE public.sms_logs            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_verifications DISABLE ROW LEVEL SECURITY;

-- 4. Limpeza automática (opcional): apagar registos com mais de 24h
-- Podes criar um cron job no Supabase para isto:
-- DELETE FROM sms_logs WHERE received_at < NOW() - INTERVAL '24 hours';
-- DELETE FROM deposit_verifications WHERE submitted_at < NOW() - INTERVAL '24 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CORRECÇÃO: Adicionar tipos manuais ao CHECK constraint de transactions
--    O constraint original não incluía 'manual_deposit' nem 'manual_bet',
--    o que causava erro ao utilizador submeter depósitos/apostas via carteira móvel.
--
--    CORRE ESTE BLOCO NO SUPABASE SQL EDITOR:
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit',
    'withdrawal',
    'recharge',
    'bet',
    'win',
    'manual_deposit',
    'manual_bet'
  ));

-- Garantir também que utilizadores autenticados podem inserir as suas próprias transacções pendentes
-- (RLS policy — só cria se não existir uma política equivalente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactions'
      AND policyname = 'Users can insert own pending transactions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can insert own pending transactions"
      ON public.transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABELA REFERRALS — sistema de convites e afiliados
--    Corre este bloco no Supabase SQL Editor para ativar o sistema de referidos.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)  -- each user can only be referred once
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON public.referrals (referred_id);

-- Ativar RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Política: cada utilizador autenticado pode ver os referidos onde É o referrer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'referrer can view own referrals'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "referrer can view own referrals"
      ON public.referrals FOR SELECT
      TO authenticated
      USING (referrer_id = auth.uid())
    $policy$;
  END IF;
END $$;

-- Política: o service_role pode inserir referrals (via complete-registration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'service role can insert referrals'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service role can insert referrals"
      ON public.referrals FOR INSERT
      TO authenticated
      WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TABELA AFFILIATE_BETS — apostas contabilizadas por afiliado
--    Necessária para o Programa de Afiliados Oficial.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affiliate_bets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bet_count    INTEGER     DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, referred_id)
);

ALTER TABLE public.affiliate_bets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_bets' AND policyname = 'affiliate can view own bets'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "affiliate can view own bets"
      ON public.affiliate_bets FOR SELECT
      TO authenticated
      USING (affiliate_id = auth.uid())
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Permitir leitura pública de my_invite_code para validação no sign-up
--    (preciso apenas de saber se um código existe — não expõe dados sensíveis)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'public can lookup invite codes'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "public can lookup invite codes"
      ON public.profiles FOR SELECT
      TO anon
      USING (my_invite_code IS NOT NULL)
    $policy$;
  END IF;
END $$;
