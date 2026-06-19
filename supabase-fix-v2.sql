-- ═══════════════════════════════════════════════════════════════
-- MOZBET — FIX v2 — Executar no Supabase SQL Editor
-- Corrige: coluna affiliate_bets, tipo referral_bonus, trigger completo
-- ═══════════════════════════════════════════════════════════════

-- 1. Normalizar coluna affiliate_bets: garantir que se chama referred_user_id
--    (algumas instalações usam referred_id, outras referred_user_id)
DO $$
BEGIN
  -- Se existir "referred_id" mas não "referred_user_id" → renomear
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliate_bets' AND column_name = 'referred_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliate_bets' AND column_name = 'referred_user_id'
  ) THEN
    ALTER TABLE public.affiliate_bets RENAME COLUMN referred_id TO referred_user_id;
  END IF;
END;
$$;

-- 2. Garantir que a coluna referred_user_id existe (caso a tabela não existisse antes)
ALTER TABLE public.affiliate_bets
  ADD COLUMN IF NOT EXISTS referred_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Recrear constraint UNIQUE com o nome correcto (se necessário)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_bets_affiliate_id_referred_user_id_key'
  ) THEN
    ALTER TABLE public.affiliate_bets
      ADD CONSTRAINT affiliate_bets_affiliate_id_referred_user_id_key
      UNIQUE (affiliate_id, referred_user_id);
  END IF;
END;
$$;

-- 4. Adicionar referral_bonus ao constraint de tipos de transacções
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
    'free_spin'
  ));

-- 5. Garantir que a coluna affiliate_invite_code existe
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_invite_code TEXT UNIQUE;

-- 6. Criar tabela invite_credits se não existir
CREATE TABLE IF NOT EXISTS public.invite_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

ALTER TABLE public.invite_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invite_credits_select" ON public.invite_credits;
CREATE POLICY "invite_credits_select" ON public.invite_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "invite_credits_all" ON public.invite_credits;
CREATE POLICY "invite_credits_all" ON public.invite_credits
  FOR ALL TO authenticated
  WITH CHECK (true);

-- 7. Função de geração de código de afiliado
CREATE OR REPLACE FUNCTION public.generate_affiliate_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code     TEXT;
  v_existing TEXT;
  v_chars    TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  attempts   INTEGER := 0;
BEGIN
  SELECT affiliate_invite_code INTO v_existing FROM public.profiles WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  LOOP
    v_code := 'AF';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::integer + 1, 1);
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE affiliate_invite_code = v_code) THEN EXIT; END IF;
    attempts := attempts + 1;
    IF attempts > 30 THEN RAISE EXCEPTION 'Não foi possível gerar código único'; END IF;
  END LOOP;

  UPDATE public.profiles SET affiliate_invite_code = v_code WHERE id = p_user_id;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger unificado: creditar afiliados E convidar amigos
CREATE OR REPLACE FUNCTION public.credit_referral_on_bet()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id      UUID;
  v_is_affiliate     BOOLEAN;
  v_bet_count        INTEGER;
  v_already_credited BOOLEAN;
BEGIN
  -- INSERT: só processar 'bet' com status 'approved' (ex: Roleta)
  IF TG_OP = 'INSERT' THEN
    IF NEW.type NOT IN ('bet') OR COALESCE(NEW.status, '') != 'approved' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- UPDATE: só processar 'manual_bet' a transitar para 'approved'
  IF TG_OP = 'UPDATE' THEN
    IF NEW.type NOT IN ('manual_bet', 'bet') THEN RETURN NEW; END IF;
    IF COALESCE(NEW.status, '') != 'approved' THEN RETURN NEW; END IF;
    IF COALESCE(OLD.status, '') = 'approved' THEN RETURN NEW; END IF;
  END IF;

  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  -- Encontrar referidor
  SELECT referrer_id INTO v_referrer_id
  FROM public.referrals
  WHERE referred_id = NEW.user_id
  LIMIT 1;

  IF v_referrer_id IS NULL OR v_referrer_id = NEW.user_id THEN RETURN NEW; END IF;

  -- Verificar se é afiliado oficial
  SELECT COALESCE(is_affiliate, FALSE) INTO v_is_affiliate
  FROM public.profiles WHERE id = v_referrer_id;

  -- Ramo A: Afiliado Oficial — 5 MT por aposta (máx 5 por referido)
  IF v_is_affiliate THEN
    SELECT COALESCE(bet_count, 0) INTO v_bet_count
    FROM public.affiliate_bets
    WHERE affiliate_id = v_referrer_id AND referred_user_id = NEW.user_id;

    IF COALESCE(v_bet_count, 0) >= 5 THEN RETURN NEW; END IF;

    UPDATE public.profiles
    SET affiliate_pending_earnings = COALESCE(affiliate_pending_earnings, 0) + 5
    WHERE id = v_referrer_id;

    INSERT INTO public.affiliate_bets (affiliate_id, referred_user_id, bet_count)
    VALUES (v_referrer_id, NEW.user_id, 1)
    ON CONFLICT (affiliate_id, referred_user_id)
    DO UPDATE SET bet_count = public.affiliate_bets.bet_count + 1;

  -- Ramo B: Convidar Amigos — 2,50 MT única vez (1ª aposta do amigo)
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.invite_credits WHERE referred_id = NEW.user_id
    ) INTO v_already_credited;

    IF COALESCE(v_already_credited, FALSE) THEN RETURN NEW; END IF;

    UPDATE public.profiles
    SET balance = COALESCE(balance, 0) + 2.5
    WHERE id = v_referrer_id;

    INSERT INTO public.invite_credits (referrer_id, referred_id)
    VALUES (v_referrer_id, NEW.user_id)
    ON CONFLICT (referred_id) DO NOTHING;

    INSERT INTO public.transactions (user_id, type, amount, description, status, created_at)
    VALUES (v_referrer_id, 'referral_bonus', 2.5,
            'Bónus de convite — amigo fez primeira aposta', 'approved', NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Remover triggers antigos e criar os correctos
DROP TRIGGER IF EXISTS trg_credit_affiliate_on_bet     ON public.transactions;
DROP TRIGGER IF EXISTS trg_credit_referral_insert      ON public.transactions;
DROP TRIGGER IF EXISTS trg_credit_referral_update      ON public.transactions;

CREATE TRIGGER trg_credit_referral_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.credit_referral_on_bet();

CREATE TRIGGER trg_credit_referral_update
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.credit_referral_on_bet();

-- 10. Gerar códigos de afiliado para quem ainda não tem
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE is_affiliate = TRUE AND affiliate_invite_code IS NULL LOOP
    PERFORM public.generate_affiliate_code(r.id);
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: mostra o que existe agora
-- ═══════════════════════════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM public.referrals)        AS total_referrals,
  (SELECT COUNT(*) FROM public.affiliate_bets)   AS affiliate_bet_records,
  (SELECT COUNT(*) FROM public.invite_credits)   AS invite_credits,
  (SELECT COUNT(*) FROM public.profiles WHERE is_affiliate = TRUE) AS affiliates,
  (SELECT COUNT(*) FROM public.profiles WHERE affiliate_invite_code IS NOT NULL) AS with_affiliate_code;
