---
name: WinMoz Replit Port
description: Notes on porting the WinMoz poker/games app from Vercel/v0 to Replit with Supabase kept as-is.
---

# WinMoz Replit Port

## Key decisions
- Supabase remains the DB/auth provider (NOT migrated to Replit DB). Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (both VITE_ prefixed for Vite frontend).
- supabase.ts uses placeholder fallbacks so app starts even without env vars set (avoid crash-on-load).
- API_BASE in apiBase.ts defaults to "/api" when VITE_API_URL is empty — correctly hits api-server at /api via Replit proxy.
- `@assets` alias in vite.config.ts points to `../../attached_assets` (workspace root).
- migration-backup workflows fail (no node_modules) — expected, ignore them.

## vite.config.ts — PORT/BASE_PATH are OPTIONAL (defaults to 3000 / "/")
- Required for Vercel builds — do not add back the throw for missing PORT/BASE_PATH.
- **Why:** Vercel doesn't inject PORT or BASE_PATH; making them optional lets build pass in both Replit (has PORT) and Vercel (no PORT).

## TypeScript Supabase patterns
- `PostgrestBuilder` is PromiseLike but not Promise — no `.catch()` method.
- Fix pattern 1 (withTimeout): `const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> => Promise.race([Promise.resolve(p), ...])`
- Fix pattern 2 (.catch): wrap chain in `Promise.resolve(supabase.from(...).select(...))` before `.then().catch()`.
- For typed destructuring from withTimeout: cast to `unknown as Promise<{ data: X | null; error: any }>`.
- **Why:** TypeScript types PostgrestBuilder as PromiseLike<unknown> in some contexts, causing `data: unknown` destructuring errors.

## OTP verification timeout
- `supabase.auth.verifyOtp()` can hang indefinitely on slow connections.
- Fix: wrap in `Promise.race([supabase.auth.verifyOtp(...), new Promise<never>((_, rej) => setTimeout(() => rej(), 15000))])`.
- Catch block: show "Tempo esgotado" error, reset code fields.
- **Why:** Users reported correct OTP just kept processing (Supabase auth calls don't self-timeout).

## Applied UI fixes
1. GrupoChat: name shown above EVERY other-user message (not just first in sequence).
2. OTP + Registar + Home: ONLINE text in WinMozLogo matches WINNER exactly (fontSize 11, fontWeight 300, letterSpacing 3) — NO opacity override.
3. Home.tsx: bilhar excluded from player count in "Jogos em Destaque" (id="bilhar") and "Populares Agora" (id="bi").
4. Explorar.tsx: bilhar excluded from "a jogar" count in GameCard.
5. BottomNav.tsx: removed localStorage.removeItem("wm_active_game") from resume click.
6. DamasGame.tsx PlayerCard: 5 red life dots rendered per player (dark when lost, glowing red when alive).
7. ChessGame.tsx: PieceSVG component replaces Unicode symbols — 3D SVG pieces (cream/charcoal) for all 6 types; board stays golden (#D4A017) / dark (#1A1008).

## Chess piece IDs
bilhar game IDs: id="bilhar" in games/Explorar arrays; id="bi" in topGames array in Home.tsx.
