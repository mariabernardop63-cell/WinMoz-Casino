-- ─────────────────────────────────────────────────────────────────────────────
-- LUDO: authoritative turn tracking on matches
-- Run once in Supabase SQL Editor before deploying api/games/ludo-dice.ts +
-- api/games/ludo-turn.ts. Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- Colour of the player who rolls next: 'blue' | 'green'.
-- Blue (player1) always starts. NULL = game not started yet.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS current_turn text;

-- Wall-clock timestamp of the last turn change (used for diagnostics and
-- future server-side stale-turn recovery).
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS turn_updated_at timestamptz;

-- Existing active matches keep NULL current_turn → first roll claim works
-- exactly like before (blue starts by default in the client too).

-- Fast lookups for the dice/turn endpoints (optional but cheap).
CREATE INDEX IF NOT EXISTS matches_current_turn_idx
  ON public.matches (id, current_turn)
  WHERE status = 'active';
