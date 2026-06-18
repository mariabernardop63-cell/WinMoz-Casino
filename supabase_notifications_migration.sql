-- ============================================================
--  MOZBET — Notifications Migration
--  Executar no Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- 1. Tabela de notificações (enviadas pelo admin)
CREATE TABLE IF NOT EXISTS notifications (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title                text        NOT NULL,
  subtitle             text,
  type                 text        DEFAULT 'notification',    -- 'notification' | 'announcement'
  target               text        DEFAULT 'all',             -- 'all' | 'online' | 'specific'
  target_user_ids      uuid[],
  image_url            text,
  action_button_label  text,
  action_button_url    text,
  sent_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

-- 2. Tabela de leituras (marcar notificação como lida por utilizador)
CREATE TABLE IF NOT EXISTS notification_reads (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id  uuid        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at          timestamptz DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads (user_id);

-- 4. Activar RLS
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads  ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de notifications
-- Todos os utilizadores autenticados podem ler notificações
CREATE POLICY "notifications_select_auth"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

-- Apenas service role pode inserir/alterar (via API serverless)
CREATE POLICY "notifications_insert_service"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "notifications_update_service"
  ON notifications FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "notifications_delete_service"
  ON notifications FOR DELETE
  TO service_role
  USING (true);

-- 6. Políticas de notification_reads
-- Utilizadores lêem apenas as suas próprias leituras
CREATE POLICY "notif_reads_select_own"
  ON notification_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Utilizadores inserem as suas próprias leituras (marcar como lido)
CREATE POLICY "notif_reads_insert_own"
  ON notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role tem acesso total
CREATE POLICY "notif_reads_all_service"
  ON notification_reads FOR ALL
  TO service_role
  USING (true);
