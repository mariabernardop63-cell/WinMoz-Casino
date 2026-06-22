-- ============================================================
-- Criar tabela matchmaking_queue para o painel admin
-- Executar no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  game_type    text NOT NULL,
  bet_amount   numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS matchmaking_queue_user_game_idx
  ON matchmaking_queue(user_id, game_type);

CREATE INDEX IF NOT EXISTS matchmaking_queue_created_idx
  ON matchmaking_queue(created_at DESC);

-- Desactivar RLS para o admin conseguir ler sem service role
ALTER TABLE matchmaking_queue DISABLE ROW LEVEL SECURITY;

-- Activar Realtime para actualizações em tempo real no painel admin
ALTER TABLE matchmaking_queue REPLICA IDENTITY FULL;

-- Limpar entradas antigas (mais de 10 minutos) — segurança extra
-- Podes criar um cron job no Supabase para executar isto periodicamente:
-- DELETE FROM matchmaking_queue WHERE created_at < now() - interval '10 minutes';
