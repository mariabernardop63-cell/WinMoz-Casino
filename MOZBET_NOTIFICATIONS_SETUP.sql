-- ═══════════════════════════════════════════════════════════════════════════
-- MOZBET — Migração: Notificações + Leituras
-- Executa este ficheiro no Supabase SQL Editor (Dashboard → SQL Editor)
-- É seguro executar múltiplas vezes (usa IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela notifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text        NOT NULL,
  subtitle            text,
  type                text        NOT NULL DEFAULT 'notification',
  target              text        NOT NULL DEFAULT 'all',
  target_user_ids     uuid[],
  image_url           text,
  action_button_label text,
  action_button_url   text,
  sent_by             uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_target_idx     ON notifications(target);

-- ── 2. Tabela notification_reads ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id uuid        REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  read_at         timestamptz DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads(user_id);

-- ── 3. Row Level Security ────────────────────────────────────────────────────
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "notifications_select"       ON notifications;
DROP POLICY IF EXISTS "notifications_insert"       ON notifications;
DROP POLICY IF EXISTS "notifications_admin_all"    ON notifications;
DROP POLICY IF EXISTS "notif_reads_select"         ON notification_reads;
DROP POLICY IF EXISTS "notif_reads_insert"         ON notification_reads;
DROP POLICY IF EXISTS "notif_reads_upsert"         ON notification_reads;

-- Todos os utilizadores autenticados podem ler notificações
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (true);

-- Só admins podem inserir notificações (via anon key + JWT)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins podem actualizar/apagar
CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Utilizadores vêem as suas próprias leituras
CREATE POLICY "notif_reads_select" ON notification_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Utilizadores podem inserir as suas próprias leituras
CREATE POLICY "notif_reads_insert" ON notification_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Utilizadores podem actualizar as suas próprias leituras
CREATE POLICY "notif_reads_upsert" ON notification_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ── 4. Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification_reads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 5. Garantir que support_messages também tem Realtime activo ──────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
