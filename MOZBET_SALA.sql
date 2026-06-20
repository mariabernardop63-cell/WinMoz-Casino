-- ═══════════════════════════════════════════════════════════════
-- MOZBET — SISTEMA DE SALA PRIVADA
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CRIAR TABELA game_rooms ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  creator_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_type   TEXT        NOT NULL,
  bet_amount  NUMERIC     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting', 'matched', 'cancelled')),
  joiner_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- ── 2. ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Qualquer utilizador autenticado pode ler salas em espera
DROP POLICY IF EXISTS "game_rooms_select" ON public.game_rooms;
CREATE POLICY "game_rooms_select" ON public.game_rooms
  FOR SELECT
  USING (
    auth.uid() = creator_id
    OR auth.uid() = joiner_id
    OR status = 'waiting'
  );

-- Criador pode inserir a sua própria sala
DROP POLICY IF EXISTS "game_rooms_insert" ON public.game_rooms;
CREATE POLICY "game_rooms_insert" ON public.game_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Criador ou jogador podem actualizar (para matched / joiner_id)
DROP POLICY IF EXISTS "game_rooms_update" ON public.game_rooms;
CREATE POLICY "game_rooms_update" ON public.game_rooms
  FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = joiner_id OR status = 'waiting');

-- Apenas o criador pode apagar (cancelar) a sala
DROP POLICY IF EXISTS "game_rooms_delete" ON public.game_rooms;
CREATE POLICY "game_rooms_delete" ON public.game_rooms
  FOR DELETE
  USING (auth.uid() = creator_id);

-- ── 3. LIMPEZA AUTOMÁTICA: expirar salas antigas ─────────────────
-- Opcional: correr periodicamente para limpar salas expiradas
-- DELETE FROM public.game_rooms WHERE expires_at < NOW();

-- ── 4. VERIFICAÇÃO FINAL ─────────────────────────────────────────
-- SELECT * FROM public.game_rooms LIMIT 10;
-- ═══════════════════════════════════════════════════════════════
-- FIM — Correr no Supabase SQL Editor e confirmar "Success"
-- ═══════════════════════════════════════════════════════════════
