-- ═══════════════════════════════════════════════════════════════
-- MOZBET — FIX SISTEMA DE AFILIADOS E CONVIDAR AMIGOS
-- Executar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Adicionar coluna affiliate_invite_code à tabela profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS affiliate_invite_code TEXT UNIQUE;

-- 2. Criar tabela invite_credits (rastrear bónus de convite já pagos)
CREATE TABLE IF NOT EXISTS invite_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  credited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- RLS em invite_credits
ALTER TABLE invite_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invite_credits_select" ON invite_credits;
CREATE POLICY "invite_credits_select" ON invite_credits
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "invite_credits_insert" ON invite_credits;
CREATE POLICY "invite_credits_insert" ON invite_credits
  FOR INSERT WITH CHECK (true);

-- 3. Função unificada: creditar afiliado OU convidar amigos
CREATE OR REPLACE FUNCTION credit_referral_on_bet()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id      UUID;
  v_is_affiliate     BOOLEAN;
  v_bet_count        INTEGER;
  v_already_credited BOOLEAN;
BEGIN
  -- ── Determinar quando actuar ──────────────────────────────────
  -- INSERT: só processar type='bet' com status='approved' (ex: Roleta)
  IF TG_OP = 'INSERT' THEN
    IF NEW.type NOT IN ('bet') OR COALESCE(NEW.status, '') != 'approved' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- UPDATE: só processar manual_bet a transitar para 'approved'
  IF TG_OP = 'UPDATE' THEN
    IF NEW.type NOT IN ('manual_bet', 'bet') THEN RETURN NEW; END IF;
    IF COALESCE(NEW.status, '') != 'approved' THEN RETURN NEW; END IF;
    IF COALESCE(OLD.status, '') = 'approved' THEN RETURN NEW; END IF;
  END IF;

  -- Não creditar bónus de referido a si próprio
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  -- ── Encontrar o referidor ──────────────────────────────────────
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = NEW.user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  -- Não creditar se o referidor é o próprio utilizador
  IF v_referrer_id = NEW.user_id THEN RETURN NEW; END IF;

  -- ── Verificar se é afiliado oficial ───────────────────────────
  SELECT COALESCE(is_affiliate, FALSE) INTO v_is_affiliate
  FROM profiles
  WHERE id = v_referrer_id;

  -- ── Ramo A: Afiliado Oficial — 5 MT por aposta (máx 5 por referido) ──
  IF v_is_affiliate THEN
    SELECT COALESCE(bet_count, 0) INTO v_bet_count
    FROM affiliate_bets
    WHERE affiliate_id = v_referrer_id AND referred_user_id = NEW.user_id;

    IF COALESCE(v_bet_count, 0) >= 5 THEN RETURN NEW; END IF;

    UPDATE profiles
    SET affiliate_pending_earnings = COALESCE(affiliate_pending_earnings, 0) + 5
    WHERE id = v_referrer_id;

    INSERT INTO affiliate_bets (affiliate_id, referred_user_id, bet_count)
    VALUES (v_referrer_id, NEW.user_id, 1)
    ON CONFLICT (affiliate_id, referred_user_id)
    DO UPDATE SET bet_count = affiliate_bets.bet_count + 1;

  -- ── Ramo B: Convidar Amigos — 2,50 MT única vez ───────────────
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM invite_credits WHERE referred_id = NEW.user_id
    ) INTO v_already_credited;

    IF COALESCE(v_already_credited, FALSE) THEN RETURN NEW; END IF;

    -- Creditar directamente no saldo principal
    UPDATE profiles
    SET balance = COALESCE(balance, 0) + 2.5
    WHERE id = v_referrer_id;

    -- Registar para não creditar de novo
    INSERT INTO invite_credits (referrer_id, referred_id)
    VALUES (v_referrer_id, NEW.user_id)
    ON CONFLICT (referred_id) DO NOTHING;

    -- Registar a transacção no histórico do referidor
    INSERT INTO transactions (user_id, type, amount, description, status, created_at)
    VALUES (
      v_referrer_id,
      'referral_bonus',
      2.5,
      'Bónus de convite — amigo fez primeira aposta',
      'approved',
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Remover trigger antigo e criar dois novos (INSERT + UPDATE)
DROP TRIGGER IF EXISTS trg_credit_affiliate_on_bet ON transactions;
DROP TRIGGER IF EXISTS trg_credit_referral_insert ON transactions;
DROP TRIGGER IF EXISTS trg_credit_referral_update ON transactions;

CREATE TRIGGER trg_credit_referral_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION credit_referral_on_bet();

CREATE TRIGGER trg_credit_referral_update
  AFTER UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION credit_referral_on_bet();

-- 5. Função para gerar código de afiliado único
CREATE OR REPLACE FUNCTION generate_affiliate_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_existing TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_len  INTEGER := 7;
  i      INTEGER;
  attempts INTEGER := 0;
BEGIN
  -- Verificar se já tem código
  SELECT affiliate_invite_code INTO v_existing FROM profiles WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Gerar código único
  LOOP
    v_code := 'AF';
    FOR i IN 1..v_len LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::integer + 1, 1);
    END LOOP;
    -- Verificar unicidade
    IF NOT EXISTS(SELECT 1 FROM profiles WHERE affiliate_invite_code = v_code) THEN
      EXIT;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN RAISE EXCEPTION 'Não foi possível gerar código único'; END IF;
  END LOOP;

  UPDATE profiles SET affiliate_invite_code = v_code WHERE id = p_user_id;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Gerar códigos para afiliados que já existem
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE is_affiliate = TRUE AND affiliate_invite_code IS NULL LOOP
    PERFORM generate_affiliate_code(r.id);
  END LOOP;
END;
$$;

-- 7. Índices adicionais
CREATE INDEX IF NOT EXISTS idx_invite_credits_referrer ON invite_credits(referrer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code ON profiles(affiliate_invite_code);

-- ═══════════════════════════════════════════════════════════════
-- RESUMO DO QUE ESTA MIGRAÇÃO FAZ:
-- • Adiciona affiliate_invite_code (código separado para afiliados oficiais)
-- • Cria tabela invite_credits (rastreia bónus de convite já pagos)
-- • Corrige trigger: agora actua quando aposta é APROVADA (não pending)
-- • Afiliados oficiais: 5 MT por aposta (max 5 por referido) → saldo pendente
-- • Convidar Amigos: 2,50 MT única vez → directo no saldo principal
-- • Gera códigos de afiliado para afiliados já existentes
-- ═══════════════════════════════════════════════════════════════
