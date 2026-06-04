---
name: Winmoz admin panel integration
description: How the admin panel is integrated into winmoz — nested router, CSS scoping, auth flow
---

The admin panel (from SHAZANANA repo) is integrated at `artifacts/winmoz/src/admin/`.

**Router:** AdminApp creates a nested `<WouterRouter base={BASE + "/admin"}>`. Sidebar links use paths relative to `/admin` (e.g. `/matches` resolves to `/admin/matches`). The route `/admin/profile` inside admin = `/profile` (not `/admin/profile` — that would double-prefix).

**Why:** Avoids adding new packages; all admin deps (recharts, tanstack-query, wouter, lucide) already exist in winmoz.

**CSS:** GZ design tokens and classes are defined in `index.css` scoped to `.admin-panel-root`. The AdminApp wraps content in `<div className="admin-panel-root">`.

**Auth flow:** Login.tsx checks if email === `nexialonemz@gmail.com` → redirects to `/admin`. Layout.tsx "Terminar sessão" button calls `useAuth().signOut()` then `window.location.href = "/"`.

**Data:** Admin uses mock data only (api.ts + mock-api.ts in src/admin/lib/). No Supabase queries in admin.

**Currency:** MT (Metical) throughout admin — never R$ or $.

**Icon colours:** Black (#111) in stat/money cards — not purple/rose.

**Sidebar routes (current):** `/` dashboard · `/matches` · `/players` · `/transactions` (Transação) · `/messages` (Mensagem) · `/reports` (Denúncias) · `/withdrawals` (Saques) · `/notifications` · `/online-users` · `/balance` · `/block-users` (Bloquear Usuários) · `/security` (Segurança) · `/relatorios` (alias for reports) · `/settings` (bottom icon).

**Dark mode:** `.dark .admin-panel-root` CSS block in `src/index.css` handles full dark mode adaptation for cards, topbar, glass, rows, etc.

**Background:** Layout outer div has NO background set — `.admin-panel-root` CSS owns it (`hsl(248 50% 97%)` light / `hsl(248 30% 8%)` dark).

**Games (all 4):** Dama, Ludo, Xadrez, Roleta da Sorte — always show all 4 in charts and breakdown stats.

**How to apply:** When adding new admin pages, put them in `src/admin/pages/`, import from `@/admin/lib/mock-api` or `@/admin/lib/api`, and add the route to `AdminApp.tsx` without the `/admin/` prefix.
