-- ═══════════════════════════════════════════════════════════════
-- MOZBET — FIX DEFINITIVO: SISTEMA DE CONVITES + AFILIADOS
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CORRIGIR CONSTRAINT DE TRANSAÇÕES ────────────────────────
-- O constraint original não incluía referral_bonus nem affiliate_bonus,
-- o que fazia o INSERT de recompensas falhar silenciosamente.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit',
    'withdrawal',
    'recharge',
    'bet',
    'win',
    'manual_deposit',
    'manual_bet',
    'referral_bonus',
    'affiliate_bonus'
  ));

-- ── 2. GARANTIR ESTRUTURA DA TABELA invite_credits ──────────────
-- Necessária para controlar duplicados e mostrar estatísticas no ecrã.

CREATE TABLE IF NOT EXISTS public.invite_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id),
  UNIQUE(referred_id)
);

ALTER TABLE public.invite_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invite_credits_select_own" ON public.invite_credits;
CREATE POLICY "invite_credits_select_own" ON public.invite_credits
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- ── 3. TRIGGER: AUTO-CRIAR REFERRAL QUANDO invite_code_used É DEFINIDO ──
-- Esta é a correcção mais importante.
-- Sem isto, o sistema de convites nunca funciona — o frontend pode falhar,
-- a API pode ter timeout, mas o trigger na BD é sempre executado.

CREATE OR REPLACE FUNCTION fn_auto_link_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_code        TEXT;
  v_referrer_id UUID;
BEGIN
  -- Ignorar se invite_code_used é nulo
  IF NEW.invite_code_used IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só actuar se o valor realmente mudou
  IF TG_OP = 'UPDATE' AND OLD.invite_code_used IS NOT DISTINCT FROM NEW.invite_code_used THEN
    RETURN NEW;
  END IF;

  v_code := UPPER(TRIM(NEW.invite_code_used));

  -- Se já existe referral para este utilizador, não duplicar
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Procurar referidor pelo código de convite normal
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE my_invite_code = v_code
    AND id != NEW.id
  LIMIT 1;

  -- Se não encontrou, procurar pelo código de afiliado
  IF v_referrer_id IS NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE affiliate_invite_code = v_code
      AND id != NEW.id
    LIMIT 1;
  END IF;

  -- Criar o link de referral
  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (v_referrer_id, NEW.id)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_link_referral ON public.profiles;
CREATE TRIGGER trg_auto_link_referral
  AFTER INSERT OR UPDATE OF invite_code_used ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_link_referral();

-- ── 4. CORRIGIR process_bet_reward (RPC chamada pelo Apostar.tsx) ──
-- Versão completa que trata convite normal (2.5 MT) e afiliado (5 MT × 5).

CREATE OR REPLACE FUNCTION process_bet_reward()
RETURNS JSON AS $$
DECLARE
  v_user_id      UUID;
  v_referrer_id  UUID;
  v_is_affiliate BOOLEAN;
  v_bet_count    INTEGER;
  v_already_done INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Encontrar quem referiu este utilizador
  SELECT referrer_id INTO v_referrer_id
  FROM public.referrals
  WHERE referred_id = v_user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'no_referral');
  END IF;

  -- Ver se o referidor é afiliado
  SELECT is_affiliate INTO v_is_affiliate
  FROM public.profiles
  WHERE id = v_referrer_id;

  -- ── FLUXO AFILIADO (5 MT × máx 5 apostas) ──────────────────────
  IF COALESCE(v_is_affiliate, FALSE) THEN
    SELECT COALESCE(bet_count, 0) INTO v_bet_count
    FROM public.affiliate_bets
    WHERE affiliate_id = v_referrer_id AND referred_user_id = v_user_id;

    IF COALESCE(v_bet_count, 0) >= 5 THEN
      RETURN json_build_object('success', false, 'reason', 'max_bets_reached');
    END IF;

    -- Creditar 5 MT ao afiliado (saldo pendente)
    UPDATE public.profiles
    SET affiliate_pending_earnings = COALESCE(affiliate_pending_earnings, 0) + 5
    WHERE id = v_referrer_id;

    -- Registar aposta creditada
    INSERT INTO public.affiliate_bets (affiliate_id, referred_user_id, bet_count)
    VALUES (v_referrer_id, v_user_id, 1)
    ON CONFLICT (affiliate_id, referred_user_id)
    DO UPDATE SET
      bet_count   = public.affiliate_bets.bet_count + 1,
      credited_at = NOW();

    -- Transação visível no extrato do afiliado
    INSERT INTO public.transactions (user_id, type, amount, description, status)
    VALUES (
      v_referrer_id,
      'affiliate_bonus',
      5,
      format('Bónus de afiliado (aposta #%s/5 do referido)', COALESCE(v_bet_count, 0) + 1),
      'approved'
    );

    RETURN json_build_object('success', true, 'type', 'affiliate', 'amount', 5);
  END IF;

  -- ── FLUXO CONVITE NORMAL (2.5 MT — 1 única vez) ─────────────────
  SELECT COUNT(*) INTO v_already_done
  FROM public.invite_credits
  WHERE referrer_id = v_referrer_id AND referred_id = v_user_id;

  IF COALESCE(v_already_done, 0) > 0 THEN
    RETURN json_build_object('success', false, 'reason', 'already_rewarded');
  END IF;

  -- Creditar 2.5 MT directamente no saldo do referidor
  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) + 2.5
  WHERE id = v_referrer_id;

  -- Registar em invite_credits para evitar duplicados e mostrar no ecrã
  INSERT INTO public.invite_credits (referrer_id, referred_id)
  VALUES (v_referrer_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Transação visível no extrato
  INSERT INTO public.transactions (user_id, type, amount, description, status)
  VALUES (
    v_referrer_id,
    'referral_bonus',
    2.5,
    'Bónus de convite: amigo fez a primeira aposta',
    'approved'
  );

  RETURN json_build_object('success', true, 'type', 'referral', 'amount', 2.5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. GARANTIR POLÍTICA RLS PARA PROFILES ──────────────────────
-- Utilizadores autenticados devem poder actualizar o próprio perfil
-- (necessário para guardar invite_code_used directamente do frontend).

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 6. VERIFICAÇÃO FINAL ─────────────────────────────────────────
-- Após correr este SQL, verifica:
--   SELECT COUNT(*) FROM referrals;          -- deve crescer com novos registos
--   SELECT COUNT(*) FROM invite_credits;     -- cresce quando alguém aposta
--   SELECT * FROM transactions WHERE type IN ('referral_bonus','affiliate_bonus');

-- ═══════════════════════════════════════════════════════════════
-- FIM — Correr no Supabase SQL Editor e confirmar "Success"
-- ═══════════════════════════════════════════════════════════════
