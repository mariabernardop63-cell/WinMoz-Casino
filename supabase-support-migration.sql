-- ═══════════════════════════════════════════════════════════════════════════
-- POKER WINNER — Migração: Suporte Chat + Platform Settings
-- Executa este ficheiro no Supabase SQL Editor
-- É seguro executar múltiplas vezes (usa IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela support_messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  user_name   text,
  sender      text        NOT NULL CHECK (sender IN ('user', 'admin', 'ai')),
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS support_messages_user_id_idx    ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS support_messages_created_at_idx ON support_messages(created_at DESC);

-- ── 2. Tabela platform_settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Valores por omissão
INSERT INTO platform_settings (key, value) VALUES
  ('maintenance_mode',           'false'),
  ('support_ai_mode',            'true'),
  ('game_damas_enabled',         'true'),
  ('game_ludo_enabled',          'true'),
  ('game_xadrez_enabled',        'true'),
  ('game_roleta_enabled',        'true'),
  ('deposits_enabled',           'true'),
  ('withdrawals_enabled',        'true'),
  ('bets_enabled',               'true'),
  ('new_registrations_enabled',  'true'),
  ('platform_name',              'POKER WINNER'),
  ('withdrawal_fee',             '5'),
  ('platform_cut_pct',           '10')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Row Level Security ────────────────────────────────────────────────────
ALTER TABLE support_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "support_messages_select" ON support_messages;
DROP POLICY IF EXISTS "support_messages_insert" ON support_messages;
DROP POLICY IF EXISTS "support_messages_update" ON support_messages;
DROP POLICY IF EXISTS "platform_settings_select" ON platform_settings;
DROP POLICY IF EXISTS "platform_settings_all"    ON platform_settings;

-- support_messages: utilizador vê as suas próprias; admins vêem todas
CREATE POLICY "support_messages_select" ON support_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Qualquer utilizador autenticado pode inserir mensagens de suporte
CREATE POLICY "support_messages_insert" ON support_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- platform_settings: qualquer autenticado pode ler
CREATE POLICY "platform_settings_select" ON platform_settings
  FOR SELECT TO authenticated
  USING (true);

-- Só admins podem modificar platform_settings
CREATE POLICY "platform_settings_all" ON platform_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 4. Realtime ──────────────────────────────────────────────────────────────
-- Adiciona as tabelas à publicação realtime (ignora se já existir)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE platform_settings;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
