---
name: Supabase Auth Setup
description: How Supabase auth is wired into WinMoz — credentials, migration, and key decisions
---

# Supabase Auth Setup

**Project ref:** oekucnfyckmzhirkqglq  
**URL stored as:** `VITE_SUPABASE_URL` env var (shared)  
**Anon key stored as:** `VITE_SUPABASE_ANON_KEY` env var (shared) — public by design  
**Service role key:** NOT stored in env — only used ad-hoc in code_execution for ops; never committed or exposed to frontend

## Database migration

Supabase has NO programmatic SQL endpoint accessible via REST without a management API token. Both `exec_sql` RPC and `/pg/v1/query` returned 404. The only way to run DDL is:
- **Supabase Dashboard → SQL Editor** (manual, user must do this)
- File: `supabase/migration.sql` — contains profiles table, RLS policies, auto-create trigger, avatars storage bucket

**Why:** Supabase's REST API only exposes PostgREST (row-level CRUD) and custom RPC functions. DDL requires direct Postgres access or the Management API (needs a separate access token, not the service_role key).

## Auth flow

- **Sign up:** `supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })` → sends 6-digit OTP to email (requires "Email OTP" enabled in Supabase Auth settings, which the user confirmed)
- **Verify OTP:** `supabase.auth.verifyOtp({ email, token, type: 'signup' })`
- **Login:** `supabase.auth.signInWithPassword({ email, password })`
- **Sign out:** `supabase.auth.signOut()` via `AuthContext.signOut()`

## Profile data

- Stored in `public.profiles` table (Supabase DB)
- Auto-created via trigger `on_auth_user_created` when user signs up
- Fallback: if table doesn't exist yet, reads from `user.user_metadata` (set during signUp)
- Avatar stored in Supabase Storage bucket `avatars` (public), path: `{user_id}/avatar.{ext}`

## Key files

- `artifacts/winmoz/src/lib/supabase.ts` — client singleton
- `artifacts/winmoz/src/contexts/AuthContext.tsx` — session, user, profile, loading, signOut, refreshProfile
- `artifacts/winmoz/src/components/ProtectedRoute.tsx` — redirects to /login if !user
- `supabase/migration.sql` — MUST be run in Supabase SQL editor before auth works fully

## How to apply
Always run `supabase/migration.sql` in the Supabase dashboard after a fresh project setup or when setting up production. Without it, the profiles table won't exist and avatars won't upload — the app handles this gracefully via user_metadata fallback.
