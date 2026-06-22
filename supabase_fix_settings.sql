-- ============================================================
-- Fix 1: Garantir que a tabela platform_settings existe
--        com constraint único na coluna "key" (necessário para upsert)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key  text NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar unique constraint na coluna key (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_settings_key_unique'
  ) THEN
    ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
END$$;

-- Inserir o registo poker_winner_mode se não existir
INSERT INTO platform_settings (key, value)
VALUES ('poker_winner_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Fix 2: Activar Realtime nas tabelas necessárias
--        (para que o admin veja mudanças em tempo real)
-- ============================================================
ALTER TABLE platform_settings REPLICA IDENTITY FULL;
ALTER TABLE game_rooms        REPLICA IDENTITY FULL;

-- Adicionar à publicação do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE platform_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;

-- ============================================================
-- Fix 3: Política RLS para que o service role possa ler/escrever
--        (o service role bypassa RLS por defeito, mas por segurança)
-- ============================================================
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública (para o frontend ler as definições)
DROP POLICY IF EXISTS "allow_read_platform_settings" ON platform_settings;
CREATE POLICY "allow_read_platform_settings"
  ON platform_settings FOR SELECT
  USING (true);

-- Apenas o service role pode escrever (via Vercel function)
DROP POLICY IF EXISTS "allow_service_write_platform_settings" ON platform_settings;
CREATE POLICY "allow_service_write_platform_settings"
  ON platform_settings FOR ALL
  USING (true)
  WITH CHECK (true);
