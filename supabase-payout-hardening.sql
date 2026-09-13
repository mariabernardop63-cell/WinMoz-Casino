-- ─────────────────────────────────────────────────────────────────────────────
-- PAYOUT HARDENING — coluna `paid_out` em matches
-- Executar uma vez no Supabase SQL Editor. Idempotente (seguro re-executar).
--
-- Sem esta coluna, o antigo código de /api/games/win e /api/games/forfeit
-- devolvia "column matches.paid_out does not exist" e o vencedor não recebia
-- o prémio (aparecia a modal de vitória mas o saldo não era creditado).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS paid_out boolean NOT NULL DEFAULT false;

-- Índice para o claim atómico do payout (só partidas por pagar).
CREATE INDEX IF NOT EXISTS matches_paid_out_idx
  ON public.matches (id)
  WHERE paid_out = false;

-- Marca partidas já terminadas como pagas, para o guard `paid_out = false`
-- não voltar a permitir um segundo payout de jogos históricos.
UPDATE public.matches
  SET paid_out = true
  WHERE status = 'finished'
    AND paid_out = false;
