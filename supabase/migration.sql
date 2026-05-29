-- ============================================================
-- WinMoz - Migração Supabase
-- Corre este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabela de perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid          REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name     text,
  phone         text,
  avatar_url    text,
  invite_code_used text,
  my_invite_code   text UNIQUE,
  balance       decimal(12,2) DEFAULT 0,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "upd_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "ins_own_profile" ON public.profiles;

CREATE POLICY "sel_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "upd_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "ins_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Função para criar perfil automaticamente ao registar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, my_invite_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    upper(substring(md5(random()::text || NEW.id::text), 1, 6))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Storage bucket para avatares
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_own_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_own_delete" ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.role() = 'authenticated'
  );

CREATE POLICY "avatars_own_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_own_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
