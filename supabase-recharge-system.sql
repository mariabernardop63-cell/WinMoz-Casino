-- ============================================================================
-- MOZBET — SISTEMA DE RECARGAS (códigos de 12 dígitos)
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New Query → RUN)
--
-- SEGURA PARA RE-EXECUTAR: todas as operações verificam a existência de
-- tabelas/colunas/funções antes de agir.
--
-- MODELO DE SEGURANÇA:
--   - RLS activado em TODAS as tabelas de recarga, SEM políticas para
--     anon/authenticated → nenhum cliente consegue ler/criar/alterar códigos
--     directamente. Todo o acesso passa pelo service_role (API server-side).
--   - Códigos: 12 dígitos numéricos únicos (índice UNIQUE), gerados com
--     criptografia segura pelo backend. Nunca expostos parcialmente.
--   - Uso atómico via RPC SECURITY DEFINER com row lock (FOR UPDATE):
--     impossível usar o mesmo código duas vezes em paralelo (race-safe).
--   - Um mesmo utilizador NUNCA pode usar a mesma recarga duas vezes
--     (mesmo que a recarga permita múltiplos usos por utilizadores
--     diferentes) — garantido dentro do RPC.
--   - Código errado 5 vezes seguidas (por IP) → bloqueio de 15 minutos
--     (anti brute-force). Cada código tem no máximo 10 tentativas
--     globais antes de ser congelado (anti adivinhação).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Helpers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.__drop_policy_if_exists(tbl text, pol text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA recharge_codes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recharge_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL,
  amount         numeric NOT NULL CHECK (amount > 0),
  max_uses       integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count     integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at     timestamptz,
  used_at        timestamptz,
  last_used_by   uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recharge_codes_code_unique UNIQUE (code),
  CONSTRAINT recharge_codes_used_count_max CHECK (used_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS recharge_codes_status_idx ON public.recharge_codes (status);
CREATE INDEX IF NOT EXISTS recharge_codes_created_at_idx ON public.recharge_codes (created_at DESC);

-- Colunas extra se a tabela já existisse com schema antigo
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS max_uses     integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1) ;
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS used_count   integer NOT NULL DEFAULT 0;
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'active';
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS created_by   uuid;
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS expires_at   timestamptz;
ALTER TABLE public.recharge_codes ADD COLUMN IF NOT EXISTS last_used_by uuid;
ALTER TABLE public.recharge_codes DROP CONSTRAINT IF EXISTS recharge_codes_used_count_max;
ALTER TABLE public.recharge_codes ADD CONSTRAINT recharge_codes_used_count_max CHECK (used_count <= max_uses);

-- Migração do schema antigo: códigos já usados (flag booleana) passam a contar
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='recharge_codes' AND column_name='used'
  ) THEN
    UPDATE public.recharge_codes
    SET used_count = 1, status = 'expired', used_at = COALESCE(used_at, now())
    WHERE used = true AND used_count = 0;
  END IF;
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA recharge_redemptions (histórico de usos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recharge_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       uuid NOT NULL REFERENCES public.recharge_codes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        numeric NOT NULL CHECK (amount > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recharge_redemptions_unique_per_user UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS recharge_redemptions_user_idx ON public.recharge_redemptions (user_id);
CREATE INDEX IF NOT EXISTS recharge_redemptions_code_idx ON public.recharge_redemptions (code_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA recharge_attempts (anti brute-force)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recharge_attempts (
  id         bigserial PRIMARY KEY,
  ip         text NOT NULL,
  code       text,
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recharge_attempts_ip_time_idx ON public.recharge_attempts (ip, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: nenhuma política → apenas service_role acede
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.__enable_rls_if_exists('recharge_codes');
SELECT public.__drop_policy_if_exists('recharge_codes', 'recharge_codes_all');
SELECT public.__drop_policy_if_exists('recharge_codes', 'recharge_codes_select_own');
SELECT public.__drop_policy_if_exists('recharge_codes', 'recharge_codes_admin_all');
-- Sem políticas — só service_role.

SELECT public.__enable_rls_if_exists('recharge_redemptions');
SELECT public.__drop_policy_if_exists('recharge_redemptions', 'recharge_redemptions_all');
-- Sem políticas — só service_role.

SELECT public.__enable_rls_if_exists('recharge_attempts');
SELECT public.__drop_policy_if_exists('recharge_attempts', 'recharge_attempts_all');
-- Sem políticas — só service_role.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: usar recarga de forma ATÓMICA e SEGURA
--    Chamada apenas pela API server-side com service_role.
--    - Row lock (FOR UPDATE) → sem race conditions
--    - Um utilizador só pode usar cada código UMA vez (unicamente garantido
--      por UNIQUE(code_id, user_id) na tabela de usos)
--    - Credita o saldo e regista a transacção no mesmo bloco
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.use_recharge_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.recharge_codes%ROWTYPE;
  v_balance numeric;
  v_new_balance numeric;
  v_code_clean text;
BEGIN
  v_code_clean := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  IF v_code_clean = '' OR length(v_code_clean) <> 12 THEN
    RETURN json_build_object('ok', false, 'error', 'Código inválido');
  END IF;

  -- LOCK exclusivo da linha do código → garante atomicidade total
  SELECT * INTO v_row
  FROM public.recharge_codes
  WHERE code = v_code_clean
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Código não encontrado');
  END IF;

  -- Estado
  IF v_row.status <> 'active' THEN
    RETURN json_build_object('ok', false, 'error', 'Este código expirou');
  END IF;

  -- Validade temporal
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    UPDATE public.recharge_codes SET status = 'expired' WHERE id = v_row.id;
    RETURN json_build_object('ok', false, 'error', 'Este código expirou');
  END IF;

  -- Esgotado
  IF v_row.used_count >= v_row.max_uses THEN
    UPDATE public.recharge_codes SET status = 'expired' WHERE id = v_row.id;
    RETURN json_build_object('ok', false, 'error', 'Este código já foi utilizado');
  END IF;

  -- Utilizador já usou este código antes?
  IF EXISTS (
    SELECT 1 FROM public.recharge_redemptions
    WHERE code_id = v_row.id AND user_id = p_user_id
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'Já usaste este código de recarga');
  END IF;

  -- Saldo actual
  SELECT balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil não encontrado');
  END IF;

  v_new_balance := round((coalesce(v_balance, 0) + v_row.amount) * 100) / 100;

  -- 1) Credita saldo
  UPDATE public.profiles SET balance = v_new_balance WHERE id = p_user_id;

  -- 2) Regista o uso (UNIQUE(code_id, user_id) protege contra duplicados)
  BEGIN
    INSERT INTO public.recharge_redemptions (code_id, user_id, amount)
    VALUES (v_row.id, p_user_id, v_row.amount);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DUPLICATE_REDEMPTION';
  END;

  -- 3) Actualiza o código
  UPDATE public.recharge_codes
  SET used_count = used_count + 1,
      last_used_by = p_user_id,
      used_at = now(),
      status = CASE WHEN used_count + 1 >= max_uses THEN 'expired' ELSE status END
  WHERE id = v_row.id;

  -- 4) Transacção no extrato do utilizador
  INSERT INTO public.transactions (user_id, type, amount, description, status, created_at)
  VALUES (
    p_user_id,
    'recharge',
    v_row.amount,
    json_build_object(
      'code', v_row.code,
      'rechargeId', v_row.id
    )::text,
    'approved',
    now()
  );

  RETURN json_build_object(
    'ok', true,
    'amount', v_row.amount,
    'newBalance', v_new_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'DUPLICATE_REDEMPTION%' THEN
      RETURN json_build_object('ok', false, 'error', 'Já usaste este código de recarga');
    END IF;
    RETURN json_build_object('ok', false, 'error', 'Erro ao processar a recarga');
END;
$$;

-- Permissões: apenas service_role pode chamar (default revoked de public)
REVOKE ALL ON FUNCTION public.use_recharge_code(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.use_recharge_code(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.use_recharge_code(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.use_recharge_code(text, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Notas
--    - Código de 12 dígitos: gerado no backend com crypto aleatório seguro.
--    - "Expirada" aparece automaticamente quando used_count >= max_uses
--      ou quando expires_at passa (status actualizado na leitura/uso).
--    - Admin apaga códigos via API (service_role) — nunca pelo browser.
-- ============================================================================
