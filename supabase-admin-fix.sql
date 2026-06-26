-- ═══════════════════════════════════════════════════════════════════════════
-- MOZBET — Admin Panel Fix: reports + is_admin + support_messages RLS
-- Executa no Supabase Dashboard → SQL Editor → New Query → RUN
-- É seguro executar múltiplas vezes (usa IF NOT EXISTS / OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Adicionar coluna is_admin à tabela profiles ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ── 2. Marcar o utilizador admin ─────────────────────────────────────────────
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'nexialonemz@gmail.com'
);

-- ── 3. Criar tabela reports (denúncias) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name    text,
  user_email   text,
  category     text,
  priority     text        NOT NULL DEFAULT 'Média',
  description  text        NOT NULL,
  status       text        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'resolved', 'dismissed')),
  admin_notes  text,
  updated_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx     ON public.reports(status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_id_idx    ON public.reports(user_id);

-- ── 4. RLS para reports ──────────────────────────────────────────────────────
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own"   ON public.reports;
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
DROP POLICY IF EXISTS "reports_insert"       ON public.reports;
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;

-- Utilizadores vêem as suas próprias denúncias
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins vêem e gerem todas as denúncias
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Qualquer autenticado pode inserir uma denúncia
CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── 5. Corrigir RLS de support_messages (admin pode actualizar/inserir) ──────
-- (a tabela e RLS básica já existem — apenas adiciona políticas em falta)

DROP POLICY IF EXISTS "support_messages_update_admin" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_admin" ON public.support_messages;

-- Admin pode inserir mensagens (respostas de suporte)
CREATE POLICY "support_messages_insert_admin" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender IN ('user', 'ai')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin pode actualizar mensagens (ex: marcar como lido)
CREATE POLICY "support_messages_update_admin" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── 6. Realtime para reports ─────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 7. Verificação ───────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.reports)         AS total_reports,
  (SELECT count(*) FROM public.support_messages) AS total_support_msgs,
  (SELECT count(*) FROM public.profiles WHERE is_admin = true) AS admin_count;
