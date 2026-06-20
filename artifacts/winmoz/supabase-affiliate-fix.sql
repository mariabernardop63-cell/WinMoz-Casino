-- ═══════════════════════════════════════════════════════════════════
-- MOZBET — CORREÇÃO DO SISTEMA DE AFILIADOS
-- Executar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar os tipos 'affiliate_bonus' e 'referral_bonus' ao CHECK
--    constraint da tabela transactions (eram tipos desconhecidos, por isso
--    as inserções de comissões falhavam silenciosamente).
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

-- 2. Garantir que a tabela affiliate_bets tem a coluna correcta
--    (a migração original usava referred_user_id; isto confirma).
--    Não faz nada se a coluna já existir com o nome certo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_bets'
      AND column_name = 'referred_user_id'
  ) THEN
    -- Se a coluna se chamar referred_id, renomear para referred_user_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'affiliate_bets'
        AND column_name = 'referred_id'
    ) THEN
      ALTER TABLE public.affiliate_bets
        RENAME COLUMN referred_id TO referred_user_id;
    END IF;
  END IF;
END $$;

-- 3. RPC check_invite_code — usada na página de registo para validar
--    o código de convite com a anon key (SECURITY DEFINER bypassa o RLS).
CREATE OR REPLACE FUNCTION public.check_invite_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_found BOOLEAN;
BEGIN
  v_code  := UPPER(TRIM(p_code));
  v_found := FALSE;

  -- Verifica my_invite_code
  SELECT TRUE INTO v_found
  FROM profiles
  WHERE my_invite_code = v_code
  LIMIT 1;

  IF v_found THEN
    RETURN TRUE;
  END IF;

  -- Verifica affiliate_invite_code
  SELECT TRUE INTO v_found
  FROM profiles
  WHERE affiliate_invite_code = v_code
  LIMIT 1;

  RETURN COALESCE(v_found, FALSE);
END;
$$;

-- 4. Garantir que a coluna affiliate_invite_code existe em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_invite_code TEXT UNIQUE;

-- 5. Política de RLS para permitir que o service_role insira referrals
--    (a API complete-registration usa o service_role key)
DROP POLICY IF EXISTS "service_role_insert_referrals" ON public.referrals;
CREATE POLICY "service_role_insert_referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- FIM DA CORREÇÃO
-- Após executar este script, faz deploy no Vercel e testa:
--   1. Regista um user com o código de convite do afiliado
--   2. Esse user faz uma aposta
--   3. O afiliado deve ver 5 MT nos ganhos pendentes
-- ═══════════════════════════════════════════════════════════════════
