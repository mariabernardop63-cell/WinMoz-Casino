# WinMoz

A gaming and betting platform targeting the Mozambican market, supporting games like Ludo, Chess, Draughts, and Billiards with betting, financial transactions, and social features.

## Run & Operate

- `PORT=5000 pnpm --filter @workspace/winmoz run dev` — run the frontend (port 5000)
- `PORT=3000 pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, Framer Motion, shadcn/ui, Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- Frontend app: `artifacts/winmoz/src/`
- API server: `artifacts/api-server/src/`
- DB schema: `lib/db/src/schema/index.ts`
- API spec: `lib/api-spec/openapi.yaml`
- Generated API client: `lib/api-client-react/`
- Generated Zod schemas: `lib/api-zod/`

## Architecture decisions

- Monorepo with pnpm workspaces — shared libraries in `lib/`, apps in `artifacts/`
- API-first: OpenAPI spec drives code generation for both frontend hooks and Zod validation
- Frontend and backend run as separate services; frontend proxies API requests to the backend
- Database uses Drizzle ORM with direct PostgreSQL connection (no ORM magic)

## User preferences

- Portuguese language UI (Mozambican market)
- Currency displayed as MT (Mozambican Metical)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec
- Always run `pnpm --filter @workspace/db run push` after changing the DB schema
- Use port 5000 for frontend (Replit webview requirement), port 3000 for API
