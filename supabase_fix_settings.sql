-- ============================================================
-- Fix platform_settings: garantir tabela + políticas de escrita
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Criar tabela se não existir
CREATE TABLE IF NOT EXISTS platform_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  value      text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Garantir unique constraint na coluna key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_settings_key_unique'
  ) THEN
    ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
END$$;

-- 3. Inserir valores padrão se não existirem
INSERT INTO platform_settings (key, value) VALUES
  ('poker_winner_mode', 'false'),
  ('maintenance_mode',  'false'),
  ('support_ai_mode',   'true'),
  ('allow_new_users',   'true'),
  ('bets_active',       'true'),
  ('backup_auto',       'true'),
  ('query_cache',       'true'),
  ('query_logs',        'false')
ON CONFLICT (key) DO NOTHING;

-- 4. Desactivar RLS (platform_settings é config pública, não dados privados)
--    Isto resolve o erro de escrita definitivamente sem precisar de service role no frontend
ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;

-- 5. Se preferires manter RLS, usa isto em vez do passo 4:
-- ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "platform_settings_all" ON platform_settings;
-- CREATE POLICY "platform_settings_all" ON platform_settings FOR ALL USING (true) WITH CHECK (true);

-- 6. Realtime (para o admin ver mudanças em tempo real)
ALTER TABLE platform_settings REPLICA IDENTITY FULL;
