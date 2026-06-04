---
name: Winmoz Supabase overhaul
description: All admin pages replaced with real Supabase data; game win logic uses applyGameWin (10% cut); SQL migration required
---

# Winmoz — Full Supabase Overhaul

## What was built
- **SQL migration**: `artifacts/winmoz/supabase-migration.sql` — must be run in Supabase SQL Editor before anything works. Creates: matches, withdrawals, reports, notifications, notification_reads, support_messages, blocked_users, platform_settings, platform_earnings tables with RLS policies and realtime enabled.
- **Core libs** in `src/lib/`:
  - `supabase-admin.ts` — all admin CRUD functions
  - `game-utils.ts` — `applyGameWin` (10% platform cut, 90% to winner), `recordMatchStart`, `recordOnlinePresence`
  - `platform-settings.ts` — hook to read platform settings (maintenance mode, game toggles, fees)
- **All admin pages** in `src/admin/pages/` — replaced mock data with real Supabase queries and realtime subscriptions
- **Game pages** (DamasGame, LudoGame, ChessGame) — win handler changed from manual 83% payout to `applyGameWin` (90%)
- **User Notificacoes.tsx** — reads from `notifications` + `notification_reads` tables; realtime subscription
- **App.tsx** — `PresenceTracker` component calls `recordOnlinePresence` every 60s for online status

## Business logic
- Platform cut: **10%** (winner gets 90% of total pot = 2×bet)
- Withdrawal fee: **5MT flat**, deducted immediately on withdrawal request
- Admin access: login with nexialonemz@gmail.com → auto-redirect to /admin

## Why
- Full migration from mock data to real Supabase-backed admin panel
- Platform earnings tracked in `platform_earnings` table
- Online users: last_seen_at updated periodically; online = seen within 5 minutes

## How to apply
- User must run `supabase-migration.sql` in Supabase SQL Editor once
- `applyGameWin` must be used in any new game pages — never direct balance updates with old 83% formula
- `recordOnlinePresence(userId)` is called from App.tsx PresenceTracker — no need to call it in individual pages
