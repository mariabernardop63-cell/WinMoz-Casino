---
name: Winmoz admin panel integration
description: How the admin panel is integrated into winmoz — nested router, CSS scoping, auth flow
---

The admin panel (from SHAZANANA repo) is integrated at `artifacts/winmoz/src/admin/`.

**Router:** AdminApp creates a nested `<WouterRouter base={BASE + "/admin"}>`. Sidebar links use paths relative to `/admin` (e.g. `/matches` resolves to `/admin/matches`). The route `/admin/profile` inside admin = `/profile` (not `/admin/profile` — that would double-prefix).

**Why:** Avoids adding new packages; all admin deps (recharts, tanstack-query, wouter, lucide) already exist in winmoz.

**CSS:** GZ design tokens and classes are defined in `index.css` scoped to `.admin-panel-root`. The AdminApp wraps content in `<div className="admin-panel-root">`.

**Auth flow:** Login.tsx checks if email === `nexialonemz@gmail.com` → redirects to `/admin`. ProfileMenu uses winmoz `useAuth()` for signOut, redirects to `/login`.

**Data:** Admin uses mock data only (api.ts + mock-api.ts in src/admin/lib/). No Supabase queries in admin.

**How to apply:** When adding new admin pages, put them in `src/admin/pages/`, import from `@/admin/lib/mock-api` or `@/admin/lib/api`, and add the route to `AdminApp.tsx` without the `/admin/` prefix.
