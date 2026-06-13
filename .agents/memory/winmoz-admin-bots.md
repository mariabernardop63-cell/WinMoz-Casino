---
name: Winmoz admin bots data source
description: Why the admin bots page had zero data and how it was fixed
---

## The problem

`fetchBotData` in `bots.tsx` was querying the `matches` table. This failed silently because:
1. The `supabase_migration.sql` does NOT create a `matches` table (only `sms_logs` + `deposit_verifications`)
2. Even if it exists, it has RLS and `adminSupabase` falls back to anon key when no service role key is set
3. Errors were silently swallowed: `botRes.data ?? []` → always `[]`
4. Bot transaction descriptions (`Aposta (Damas) vs Manuel Sitoe`) were identical to PvP — no way to distinguish

## The fix

**Marker in description**: DamasGame.tsx and ChessGame.tsx now write `[bot]` in bot bet descriptions:
- `Aposta (Damas) [bot] vs ${opponentName}`
- `Aposta (Xadrez) [bot] vs ${opponentName}`

**fetchBotData rewritten** to use the `transactions` table:
- Queries `type=bet, status=approved, description ILIKE '%[bot]%'`
- Matches each bot bet to a win transaction (same user_id, within 4h, not reused)
- No win found within 4h + bet > 2h old → bot won
- No win found + bet < 2h old → still active
- Win found → user won

**Why:**
The `transactions` table is proven to work (all other admin pages use it). The `matches` table is unreliable (may not exist, RLS issues).

**Caveat:**
Pre-fix bot games (recorded without `[bot]` marker) will NOT appear. Only new games after this fix will be counted.
