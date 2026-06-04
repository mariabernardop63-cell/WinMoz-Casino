---
name: Supabase preference
description: User explicitly does not want Supabase migrated to Replit DB
---

The user explicitly requested that Supabase remains as the auth and database provider for the winmoz project. Never suggest or perform a migration to Replit's built-in PostgreSQL.

**Why:** The user had issues in the past where migrating deps caused Vercel build problems (pinned/skipped packages, wrong versions).

**How to apply:** Always use the existing `@/lib/supabase` client. Do not run `pnpm --filter @workspace/db run push` or reference the Drizzle ORM setup for winmoz features.
