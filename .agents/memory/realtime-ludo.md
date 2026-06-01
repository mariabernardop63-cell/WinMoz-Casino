---
name: Realtime Ludo architecture
description: How the realtime 2-player Ludo game and matchmaking work — Supabase channels, URL params, no AI.
---

## Matchmaking (Apostar.tsx → MatchmakingScreen)
- Uses Supabase Presence channel: `matchmaking_{gameType}_{betAmount}`
- Each user tracks `{ userId, displayName }` with their userId as the presence key
- On sync event with 2+ users: sorted IDs determine color (`sorted[0]` = blue, `sorted[1]` = green)
- gameId = `${sorted[0]}_${sorted[1]}` — deterministic for both players
- Navigates to: `/ludo-jogo?gameId=...&color=...&bet=...&opp=...`

**Why:** Deterministic gameId computed independently by both clients ensures they join the same game channel without a server handshake.

**How to apply:** For other game types, extend `gameType` param in the channel name.

## Game sync (LudoGame.tsx)
- Reads URL params: `gameId`, `color` (myColor), `bet`, `opp` (opponent display name)
- `gameId === "local"` → demo mode (no channel, timer auto-plays for myColor)
- Supabase Broadcast channel: `ludo_game_{gameId}` with `self: false`
- Two event types:
  - `dice_rolled { player, value }` — broadcast when my turn dice clicked, apply opponent's when received
  - `piece_selected { pieceId, diceVal, player }` — broadcast when my piece clicked, apply opponent's when received
- `applyRoll(pl, val)` — pure local state update (no broadcast), called by both self and when receiving opponent event
- `doRoll()` — generates random value, broadcasts, calls `applyRoll(myColor, val)`
- `handleSelectPiece(pid)` — guards `turn !== myColor`, broadcasts, calls `doSelectPiece`
- Timer only counts down for `turn === myColor`; no AI useEffect for opponent

## PlayerPanel redesign
- White card (`#FFFFFF`) with colored border when active
- `isMe` prop (not `isHuman`) — shows "Tu" badge vs "Rival"
- Dice `active={isActive && isMe}` — opponent dice visible but not clickable
- Timer arc only shown for `isMe && isActive`

## Balance flow & DB architecture
- Backend uses TWO separate DBs: Supabase (cloud, auth only) and local Replit Postgres (data, Drizzle)
- All data ops (profiles, transactions, withdrawal_requests, referrals) use Drizzle → local Postgres
- Supabase admin client is ONLY used for JWT verification: `supabaseAdmin.auth.getUser(token)`
- Service role key not provisioned → falls back to anon key for JWT verification (works for getUser)
- AuthContext.fetchProfile → calls `/api/profile` (backend) with Bearer token instead of `supabase.from("profiles")`
- On 404 (profile not in local DB), AuthContext auto-calls `/api/complete-registration` to sync then retries
- Recarga.tsx → POST `/api/recharge` with Bearer token + amount → updates local DB → calls `refreshProfile()`
- Apostar.tsx handleStart uses `profile?.balance` from AuthContext (not localStorage)
