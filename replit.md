# mozbet

App de jogos e apostas online com painel de administração integrado.

## Run & Operatee

- `pnpm --filter @workspace/winmoz run dev` — run the frontend (port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS
- Auth + DB: Supabase (external — do NOT migrate to Replit DB)
- Routing: Wouter v3

## Where things live

- `artifacts/winmoz/src/` — main app source
- `artifacts/winmoz/src/pages/` — app pages (Login, Home, Explorar, jogos, carteira, etc.)
- `artifacts/winmoz/src/admin/` — painel de admin integrado
- `artifacts/winmoz/src/admin/pages/` — telas do admin
- `artifacts/winmoz/src/admin/layout/` — layout do admin (sidebar, topbar)
- `artifacts/winmoz/src/admin/lib/` — api.ts e mock-api.ts do admin
- `artifacts/winmoz/src/contexts/AuthContext.tsx` — auth via Supabase

## Architecture decisions

- Admin panel is integrated as a nested WouterRouter at `/admin/*` — avoids adding new packages
- Admin uses mock data (api.ts + mock-api.ts) — no new backend dependencies
- Admin CSS classes (gz-*) are scoped inside `.admin-panel-root` to avoid conflicts with main app styles
- Supabase stays as the auth/db provider — not migrated to Replit
- Admin access: login with nexialonemz@gmail.com → auto-redirected to /admin

## Product

- Jogos: Dama, Ludo, Xadrez, Roleta, Bilhar (em breve)
- Carteira: depósito, levantamento, extratos
- Social: convites, grupo chat, QR scanner
- Admin: dashboard, partidas, jogadores, apostas, ranking, denúncias, saques, anti-fraude, logs

## User preferences

- Manter o Supabase como base de dados — NÃO migrar para o ambiente Replit
- Não adicionar dependências desnecessárias que causam problemas no Vercel

## Gotchas

- Admin panel uses its own nested Router (WouterRouter base="/admin") — sidebar links are relative to /admin
- The admin CSS token variables (--gz-*) need .admin-panel-root wrapper to take effect
- Admin profile route inside the admin panel is `/profile` (not `/admin/profile`) because the base is already `/admin`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
