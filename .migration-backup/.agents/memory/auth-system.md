---
name: Auth system
description: WinMoz auth is fully Supabase-based — client JWT auth, OTP flows, profiles table
---

## Current state (as of May 2026)
Auth has been fully migrated from custom Express session auth to Supabase auth.

### Frontend
- `artifacts/winmoz/src/lib/supabase.ts` — Supabase client using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `AuthContext.tsx` — reads session via `supabase.auth.onAuthStateChange` + fetches `profiles` table; exports `{ user, profile, loading, refreshProfile, forceRefresh, signOut }`
- `Login.tsx` — `supabase.auth.signInWithPassword`
- `Registar.tsx` — 3-step form → `supabase.auth.signUp` → redirects to `/otp?email=...&type=signup`; stores pending registration data in `sessionStorage['pendingReg']`
- `OTP.tsx` — `supabase.auth.verifyOtp({ email, token, type: 'signup'|'recovery' })`; on signup calls `/api/complete-registration` to save name/phone/invite_code; on recovery redirects to `/redefinir-senha`
- `EsqueceuSenha.tsx` — checks email exists via `/api/check-email`, then `supabase.auth.resetPasswordForEmail` → `/otp?type=recovery`
- `RedefinirSenha.tsx` — `supabase.auth.updateUser({ password })` (works because session is active after OTP verification)

### Backend
- `src/lib/supabaseAdmin.ts` — service-role admin client; must pass `ws` as realtime transport (Node.js 20 requirement)
- `src/routes/api.ts` — `POST /api/check-email`, `POST /api/complete-registration`, `POST /api/withdraw` (JWT-verified)
- `src/app.ts` — simplified; express-session removed (auth is JWT/Supabase, not cookie session)

### Database (Supabase)
- `profiles` — id FK auth.users, full_name, phone, avatar_url, invite_code_used, my_invite_code, balance (numeric), timestamps; auto-created by trigger on signup
- `transactions` — user_id, type, amount, description, status
- `withdrawal_requests` — user_id, amount, phone, status
- `referrals` — referrer_id, referred_id, bonus_paid
- Run `supabase/migration.sql` in Supabase SQL Editor to create all tables + RLS + trigger + storage bucket

**Why:** User explicitly wanted "apenas Supabase" — full migration away from Replit PostgreSQL + bcrypt session auth.

**How to apply:** Balance is numeric in Supabase — use `parseFloat(String(profile.balance))` for safety.
