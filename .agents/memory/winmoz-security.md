---
name: Winmoz security hardening
description: All client-side balance manipulations migrated to server-side API endpoints; what remains for user to do.
---

## Rule
All balance mutations (bet deduction, win credit, refund) must go through server-side Vercel API endpoints — never directly via Supabase client from the browser.

## What was done
- Removed `VITE_SUPABASE_SERVICE_ROLE` from frontend build env (supabase-api.ts now uses anon client).
- Removed hardcoded `MASTER_PW="12345678y"` from AdminSecurityGate; admin password verified server-side at `/api/admin/auth/verify`.
- Removed `"12345678y"` fallback in settings.tsx.
- All game win credits: `/api/games/win` (idempotent via gameId in description).
- All game bet deductions (initial + rematch): `/api/games/bet` (idempotent via gameId).
- Lobby matchmaking bet/refund: `/api/games/bet` + `/api/games/refund`.
- Files hardened: LudoGame.tsx, DamasGame.tsx, ChessGame.tsx, Explorar.tsx, settings.tsx, AdminSecurityGate.tsx.
- New API files: api/games/win.ts, api/games/bet.ts, api/games/refund.ts, api/games/ludo/dice.ts, api/admin/auth/verify.ts, api/admin/auth/check.ts.
- Security headers in vercel.json (X-Frame-Options, HSTS, CSP-lite).

## What user must still do
- Apply `supabase_security_migration.sql` in Supabase SQL Editor — this enables RLS policies that block direct balance updates from the browser, completing the server-side enforcement.
- Set `ADMIN_JWT_SECRET` env var on Vercel (falls back to SUPABASE_SERVICE_ROLE_KEY if absent).
- Set `ADMIN_PANEL_PASSWORD` env var on Vercel (falls back to DB platform_settings.admin_security_password).

## Why
Real-money platform; client-side balance updates allow any user to inspect/modify their balance via browser devtools or crafted fetch calls.

## How to apply
Any new game feature that touches balance must use these endpoints (or new ones following the same pattern: JWT validation → service-role Supabase client → atomic read-modify-write).
