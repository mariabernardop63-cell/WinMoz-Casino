-- ============================================================
-- WinMoz — Supabase Migration
-- Run this in the Supabase SQL Editor for your project
-- ============================================================

-- 1. PROFILES TABLE (auto-created by trigger on new user)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  phone         text,
  avatar_url    text,
  invite_code_used  text,
  my_invite_code    text unique,
  balance       numeric(18,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Service role full access"     on public.profiles for all using (true);

-- Trigger to auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, my_invite_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    upper(substring(md5(random()::text) for 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. TRANSACTIONS TABLE
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('deposit','withdrawal','bet','win','recharge','referral_bonus')),
  amount      numeric(18,2) not null,
  description text,
  status      text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users see own transactions"   on public.transactions for select using (auth.uid() = user_id);
create policy "Service role full access"     on public.transactions for all using (true);

-- 3. WITHDRAWAL REQUESTS TABLE
create table if not exists public.withdrawal_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(18,2) not null,
  phone       text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.withdrawal_requests enable row level security;

create policy "Users see own withdrawals"   on public.withdrawal_requests for select using (auth.uid() = user_id);
create policy "Users can insert withdrawals" on public.withdrawal_requests for insert with check (auth.uid() = user_id);
create policy "Service role full access"     on public.withdrawal_requests for all using (true);

-- 4. REFERRALS TABLE
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  referred_id  uuid not null references public.profiles(id) on delete cascade,
  bonus_paid   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(referred_id)
);

alter table public.referrals enable row level security;

create policy "Users see own referrals"  on public.referrals for select using (auth.uid() = referrer_id);
create policy "Service role full access" on public.referrals for all using (true);

-- 5. STORAGE BUCKET for avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public avatar read"    on storage.objects for select using (bucket_id = 'avatars');
create policy "Auth users can upload" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);
create policy "Users update own"      on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own"      on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
