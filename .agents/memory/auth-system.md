---
name: Auth System
description: How authentication works in WinMoz — session-based, PostgreSQL, key gotchas
---

# Auth System

## Architecture
- **NOT Supabase** — a previous agent replaced Supabase auth with a custom Express + express-session system
- Sessions stored in PostgreSQL `session` table (connect-pg-simple)
- Passwords hashed with bcryptjs (cost 12)
- Cookie: `winmoz.sid`, Secure, SameSite=None (required for Replit HTTPS proxy)

## Critical: Vite proxy must inject X-Forwarded-Proto
`artifacts/winmoz/vite.config.ts` proxy configure callback sets `x-forwarded-proto: https` on every `/api` request. Without this, express-session sees HTTP and refuses to set the Secure cookie → 401 on login.

## Balance is a string from Drizzle
`profile.balance` is `numeric` in PostgreSQL → Drizzle returns it as a **string** (e.g. `"0.00"`), not a number. Any UI function that calls `.toFixed()` on it must first convert: `parseFloat(String(val)) || 0`.

**Why:** Drizzle ORM maps PostgreSQL `numeric`/`decimal` to JS string to avoid floating-point precision loss.

**How to apply:** Whenever reading `profile.balance` for display or arithmetic, wrap with `Number(profile.balance)` or `parseFloat(String(profile.balance))`.

## Real user accounts
- Users are stored in the `profiles` table in the Replit PostgreSQL DB
- The original Supabase project (ref: oekucnfyckmzhirkqglq) is no longer used for auth
- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in secrets but unused by auth flow

## Backend runs on port 3000
- `Start Backend` workflow: `PORT=3000 pnpm --filter @workspace/api-server run dev` (uses tsx, instant start)
- Vite dev server port 5000 proxies `/api` → `localhost:3000`
- The artifact workflow (`artifacts/api-server: API Server`) also runs the same process on port 3000 — not a conflict since it's the same command
