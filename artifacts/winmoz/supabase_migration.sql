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
