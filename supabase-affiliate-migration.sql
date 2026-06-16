-- ═══════════════════════════════════════════════════════════════
-- MOZBET — SISTEMA DE AFILIADOS — MIGRAÇÃO SUPABASE
-- Executar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Adicionar colunas de afiliado à tabela profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_affiliate                 BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affiliate_pending_earnings   NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_milestone_500_claimed  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affiliate_milestone_2000_claimed BOOLEAN DEFAULT FALSE;

-- 2. Criar tabela de referidos (caso não exista)
CREATE TABLE IF NOT EXISTS referrals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- RLS em referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select" ON referrals;
CREATE POLICY "referrals_select" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert" ON referrals
  FOR INSERT WITH CHECK (true);

-- 3. Criar tabela de apostas creditadas ao afiliado (max 5 por referido)
CREATE TABLE IF NOT EXISTS affiliate_bets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  bet_count         INTEGER DEFAULT 1,
  credited_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, referred_user_id)
);

-- RLS em affiliate_bets
ALTER TABLE affiliate_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_bets_select" ON affiliate_bets;
CREATE POLICY "affiliate_bets_select" ON affiliate_bets
  FOR SELECT USING (auth.uid() = affiliate_id);

DROP POLICY IF EXISTS "affiliate_bets_admin" ON affiliate_bets;
CREATE POLICY "affiliate_bets_admin" ON affiliate_bets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 4. Trigger: creditar afiliado quando referido faz aposta
CREATE OR REPLACE FUNCTION credit_affiliate_on_bet()
RETURNS TRIGGER AS $$
DECLARE
  v_affiliate_id UUID;
  v_bet_count    INTEGER;
  v_is_affiliate BOOLEAN;
BEGIN
  -- Só actua em apostas
  IF NEW.type NOT IN ('bet', 'manual_bet') THEN
    RETURN NEW;
  END IF;

  -- Encontrar o referidor deste utilizador
  SELECT referrer_id INTO v_affiliate_id
  FROM referrals
  WHERE referred_id = NEW.user_id
  LIMIT 1;

  IF v_affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se o referidor é afiliado
  SELECT is_affiliate INTO v_is_affiliate
  FROM profiles
  WHERE id = v_affiliate_id;

  IF NOT COALESCE(v_is_affiliate, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Verificar quantas apostas já foram creditadas para este par
  SELECT COALESCE(bet_count, 0) INTO v_bet_count
  FROM affiliate_bets
  WHERE affiliate_id = v_affiliate_id AND referred_user_id = NEW.user_id;

  IF v_bet_count IS NULL THEN
    v_bet_count := 0;
  END IF;

  IF v_bet_count >= 5 THEN
    RETURN NEW;
  END IF;

  -- Creditar 5 MT ao afiliado
  UPDATE profiles
  SET affiliate_pending_earnings = COALESCE(affiliate_pending_earnings, 0) + 5
  WHERE id = v_affiliate_id;

  -- Registar/incrementar na tabela de apostas
  INSERT INTO affiliate_bets (affiliate_id, referred_user_id, bet_count)
  VALUES (v_affiliate_id, NEW.user_id, 1)
  ON CONFLICT (affiliate_id, referred_user_id)
  DO UPDATE SET bet_count = affiliate_bets.bet_count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente e criar novo
DROP TRIGGER IF EXISTS trg_credit_affiliate_on_bet ON transactions;
CREATE TRIGGER trg_credit_affiliate_on_bet
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION credit_affiliate_on_bet();

-- 5. Função RPC: transferir saldo pendente para saldo principal
CREATE OR REPLACE FUNCTION affiliate_transfer_to_balance(
  p_user_id UUID,
  p_amount   NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_current_pending NUMERIC;
BEGIN
  -- Verificar saldo pendente actual
  SELECT COALESCE(affiliate_pending_earnings, 0) INTO v_current_pending
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_pending < p_amount OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Saldo pendente insuficiente';
  END IF;

  -- Debitar do saldo pendente e creditar no saldo principal
  UPDATE profiles
  SET
    affiliate_pending_earnings = affiliate_pending_earnings - p_amount,
    balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id;

  -- Registar a transação no histórico
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'referral_bonus', p_amount, 'Transferência do programa de afiliados');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC: reclamar bónus de marco (500 ou 2000 referidos)
CREATE OR REPLACE FUNCTION affiliate_claim_milestone(
  p_user_id   UUID,
  p_milestone TEXT,    -- '500' ou '2000'
  p_amount    NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_referral_count  INTEGER;
  v_already_claimed BOOLEAN;
  v_col_name        TEXT;
BEGIN
  IF p_milestone = '500' THEN
    v_col_name := 'affiliate_milestone_500_claimed';
    -- Verificar referidos e se já reclamou
    SELECT COUNT(*) INTO v_referral_count FROM referrals WHERE referrer_id = p_user_id;
    SELECT affiliate_milestone_500_claimed INTO v_already_claimed FROM profiles WHERE id = p_user_id;
    IF v_referral_count < 500 THEN
      RAISE EXCEPTION 'Ainda não atingiste 500 referidos';
    END IF;
    IF COALESCE(v_already_claimed, FALSE) THEN
      RAISE EXCEPTION 'Marco 500 já reclamado';
    END IF;
    UPDATE profiles
    SET affiliate_pending_earnings        = COALESCE(affiliate_pending_earnings, 0) + p_amount,
        affiliate_milestone_500_claimed   = TRUE
    WHERE id = p_user_id;

  ELSIF p_milestone = '2000' THEN
    SELECT COUNT(*) INTO v_referral_count FROM referrals WHERE referrer_id = p_user_id;
    SELECT affiliate_milestone_2000_claimed INTO v_already_claimed FROM profiles WHERE id = p_user_id;
    IF v_referral_count < 2000 THEN
      RAISE EXCEPTION 'Ainda não atingiste 2000 referidos';
    END IF;
    IF COALESCE(v_already_claimed, FALSE) THEN
      RAISE EXCEPTION 'Marco 2000 já reclamado';
    END IF;
    UPDATE profiles
    SET affiliate_pending_earnings         = COALESCE(affiliate_pending_earnings, 0) + p_amount,
        affiliate_milestone_2000_claimed   = TRUE
    WHERE id = p_user_id;

  ELSE
    RAISE EXCEPTION 'Marco inválido: use 500 ou 2000';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_bets_affiliate ON affiliate_bets(affiliate_id);

-- ═══════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO
-- Após executar, para activar um afiliado:
--   UPDATE profiles SET is_affiliate = TRUE WHERE id = 'UUID_DO_USER';
-- ═══════════════════════════════════════════════════════════════
