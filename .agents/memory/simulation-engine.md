---
name: Simulation engine
description: Central lib for all synthetic/live-feeling data in WinMoz (player counts, withdrawals, match pools, active game persistence)
---

## Location
`artifacts/winmoz/src/lib/simulation.ts`

## Key exports
- `getMozHour()` — current hour in Mozambique time (UTC+2)
- `getLivePlayerCount(gameIndex, tick)` — time-slot-aware player count with slow sine-wave drift; call every 20 s
- `formatPlayerCount(n)` — formats as "1,2K" for ≥1000
- `getSyntheticUser(seed)` — `{ name, initials, bg }` from large Mozambican name pool
- `generateWithdrawalAmount(rng)` — tiered realistic amounts (30–3 000 MT)
- `getWithdrawalInterval()` — ms between feed updates, varies by hour (4–10 min daytime, 18–30 min night)
- `shouldBootWithdrawal()` — false between 22 h–05 h (no fake activity at night)
- `generateMatchPool(count, epoch)` — array of `SimMatch` objects with `endsAt` timestamps for rotation

## Active game persistence
Key: `wm_active_game` in localStorage.
Shape: `{ gameId, gameType, betAmount, opponentName, savedAt, ttlMs: 30*60_000 }`
Helpers: `saveActiveGame / clearActiveGame / getActiveGame`
BottomNav polls this key every 5 s and shows a green indicator + resume card when an active game exists.
Back button in each game page writes this key instead of sending a forfeit broadcast.
