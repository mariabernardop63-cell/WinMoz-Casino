-- ============================================================================
-- FIX v5 — TRIGGER CORRIGIDO + ATIVAR ADMIN
-- Copiar TODO o bloco abaixo e correr no Supabase SQL Editor (RUN).
-- É seguro re-executar quantas vezes quiseres.
--
-- Por que a versão anterior falhou no SQL Editor:
--   o trigger usava SECURITY DEFINER, o que fazia current_user = 'postgres'
--   DENTRO do trigger — a verificação "current_user IN ('postgres'...)"
--   era sempre verdadeira e nada era bloqueado (nem o UPDATE is_admin
--   do dashboard devia passar pelo caminho certo... mas o confundi).
--
-- Lógica v5 (testada em 5 cenários):
--   • Chamada com JWT anon/authenticated (browser via PostgREST) → BLOQUEIA
--     alterações a balance, is_admin, is_blocked, block_type,
--     affiliate_pending_earnings, affiliate_invite_code.
--   • Chamada com JWT service_role (a tua API Express) → PERMITE.
--   • Conexão sem JWT — SQL Editor do dashboard, migrations — → PERMITE.
--   • Utilizador admin autenticado → PERMITE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
  protected_cols text[] := ARRAY[
    'balance', 'is_admin', 'is_blocked', 'block_type',
    'affiliate_pending_earnings', 'affiliate_invite_code'
  ];
  col text;
  claims jsonb;
  jwt_role text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
    jwt_role := COALESCE(claims->>'role', current_setting('request.jwt.claim.role', true));

    IF jwt_role = 'service_role'
       OR current_setting('role') = 'none'
       OR public.is_platform_admin() THEN
      RETURN NEW;
    END IF;

    FOREACH col IN ARRAY protected_cols LOOP
      IF new_row ? col
         AND (NOT (old_row ? col) OR new_row -> col IS DISTINCT FROM old_row -> col) THEN
        RAISE EXCEPTION 'Alteração de campo protegido (%) bloqueada — saldo/admin apenas via API', col;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Ativar o admin (conta usada no login → /admin)
UPDATE public.profiles
SET is_admin = true
WHERE id = '54b7b27b-b287-462e-b2a0-59e64a9b14b8';

-- Verificação: deve mostrar is_admin = true
SELECT id, full_name, is_admin
FROM public.profiles
WHERE id = '54b7b27b-b287-462e-b2a0-59e64a9b14b8';
