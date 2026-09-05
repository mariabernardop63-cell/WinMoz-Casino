---
name: Winmoz game fixes
description: Key decisions and patterns from major bug-fix session — payout, rematch, notifications, transactions
---

## Payout percentage
- Winner payout is `Math.floor(BET * 2 * 0.90)` (10% platform fee) in all 3 games: LudoGame, ChessGame, DamasGame
- Three places per file: the display label, the payout calculation, and the `winner_payout` field in the matches upsert
- ChessGame uses compact format without spaces (`BET*2*0.90`), sed needs `*2*` pattern to match

## Rematch transaction records
- On rematch accept/receive, both sides must: deduct balance AND insert a `transactions` row (type: "bet", amount: -BET)
- The `betDeductedRef.current` is reset to `false` in `resetGame()` — but the subscription handler doesn't re-fire (channel already subscribed), so rematch deduction is handled exclusively by the rematch broadcast handlers

## Notification banner persistence
- `shownIds` stored in `sessionStorage` under key `wm_notif_shown` to survive navigation but reset on new browser session
- Announcements no longer bypass the 10-minute age filter (was: `if (type === "announcement") return true` unconditionally)
- `useGetUserNotifications` now accepts `userCreatedAt` as second param and filters notifications with `.gte("created_at", userCreatedAt)`

## Transaction description parsing
- DB field `description` can be JSON (`{"mode":"deposit"}` or `{"mode":"bet"}`) for manual_deposit/manual_bet types
- `parseTxDescription()` in Perfil.tsx handles this; mapTxType/mapTxSign/mapTxIcon all handle `manual_deposit` and `manual_bet`

## Matchmaking cancel credit-back
- `Apostar.tsx` no longer calls `/api/deposit/credit` (endpoint doesn't exist at root api/)
- Instead uses Supabase directly: fetch current balance, add bet amount, update profile, insert deposit transaction with description "Reembolso — sem adversário encontrado"

## Resume modal DB check
- `handleResumeClick` in BottomNav.tsx now queries `matches` table for the `gameId` from localStorage
- If status is "finished" or "cancelled" (or row missing), clears `wm_active_game` from localStorage and shows the "no active game" picker

## Support chat
- Endpoint exists at `api/support/chat.ts` (root-level, Vercel serverless)
- Requires `GROQ_API_KEY` env var in Vercel; without it returns a graceful fallback message (no crash)
- **Why:** The endpoint already handles missing key gracefully — no code change needed, only Vercel env var

## Admin matches panel
- Default `statusFilter` is `"active"` (not `"all"`) to hide finished matches on load

## Ludo realtime invariants
- Realtime dice and piece-selection events must be accepted only when their player matches the current turn; remote base-exit animations must always release the movement lock.
- **Why:** Delayed broadcasts otherwise reuse an old die/result on the next turn, and a remote piece leaving home can leave the local board permanently non-selectable.
- **How to apply:** Keep turn/phase checks both before and after animation delays, clear both dice faces on hand-off, and release animation locks in every remote-move completion path.
- A timed-out Ludo turn must publish the turn hand-off even when no pawn can move, and must auto-select a pawn after an automatic roll with multiple legal choices.
- **Why:** A client-only timeout can otherwise reduce a life while leaving the other device on the old phase, or leave the timed-out player stuck in piece selection.
- **How to apply:** Treat timeout as a complete turn transaction: decrement life, roll if needed, choose/move, then broadcast the authoritative next turn/state.
- Ludo roll locks must last until the server response and phase transition, not a fixed short delay.
- **Why:** A slow roll request can outlive a fixed unlock timer and let rapid clicks create concurrent rolls or duplicate turn events.
- **How to apply:** Lock before the request, release on error/stale response or authoritative state transition, and reject duplicate remote roll broadcasts while the current roll is being resolved.
- Each Ludo roll phase also needs a monotonic client transaction/epoch, because a delayed render or realtime hand-off can otherwise make the same phase appear rollable twice.
- **Why:** A boolean busy ref can be cleared by a stale transition while an older async roll is still returning.
- **How to apply:** Mark the epoch synchronously before the server request, validate it after the response/animation, and clear it only when a new authoritative roll phase begins.
- Authoritative Ludo hand-offs need a shared monotonic state version carried through both clients.
- **Why:** Realtime delivery can reorder delayed movement snapshots; an old snapshot can otherwise restore the previous turn and reactivate the wrong die.
- **How to apply:** Increment the version on every outgoing hand-off, propagate the received version before the next hand-off, and ignore older snapshots both on receipt and after animation delays.
