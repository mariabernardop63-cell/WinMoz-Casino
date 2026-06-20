---
name: Winmoz affiliate reward system
description: Bugs found and fixed in the affiliate commission pipeline (referrals table, column names, transaction types)
---

# Affiliate commission pipeline — bugs fixed

## Root causes (all three must be fixed together)

### Bug 1 — Missing `complete-registration.ts` API
`AuthContext.tsx` and `OTP.tsx` both call `POST /api/complete-registration` after signup.
This API was **absent** from `artifacts/winmoz/api/`.
Without it, `invite_code_used` was saved to `profiles` but **no record was ever inserted into the `referrals` table**.
With no `referrals` row, neither the API nor the DB trigger can find the referrer → zero commissions.

**Fix:** Created `artifacts/winmoz/api/complete-registration.ts` — upserts profile + inserts into `referrals` by looking up the invite code in both `my_invite_code` and `affiliate_invite_code` columns.

### Bug 2 — Column name mismatch in `record-bet-reward.ts`
The `affiliate_bets` table (defined in `supabase-affiliate-migration.sql`) uses column `referred_user_id`.
The API used `referred_id` in all queries and inserts → queries returned null, inserts silently failed.

**Fix:** Changed every `referred_id` → `referred_user_id` in `record-bet-reward.ts`.

### Bug 3 — Missing transaction types in CHECK constraint
`record-bet-reward.ts` inserts transactions of type `affiliate_bonus` and `referral_bonus`.
The `transactions_type_check` constraint did not include these types → DB rejected insertions.

**Fix:** `supabase-affiliate-fix.sql` drops and recreates the constraint with all types.

## SQL to run in Supabase
File: `artifacts/winmoz/supabase-affiliate-fix.sql`
- Updates transactions CHECK constraint (adds `referral_bonus`, `affiliate_bonus`)
- Renames `referred_id` → `referred_user_id` if still wrong in DB
- Creates `check_invite_code` SECURITY DEFINER RPC (used in Registar.tsx)
- Adds `affiliate_invite_code` column to profiles if missing
- Adds RLS insert policy for referrals table

**Why:** All three bugs must be resolved simultaneously; fixing only one or two still breaks the flow end-to-end.

**How to apply:** Run `supabase-affiliate-fix.sql` in Supabase SQL Editor, then deploy to Vercel.
