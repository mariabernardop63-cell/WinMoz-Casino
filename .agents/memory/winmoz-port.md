---
name: WinMoz Replit Port
description: Notes on porting the WinMoz poker/games app from Vercel/v0 to Replit with Supabase kept as-is.
---

# WinMoz Replit Port

## Key decisions
- Supabase remains the DB/auth provider (NOT migrated to Replit DB). Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (both VITE_ prefixed for Vite frontend).
- supabase.ts uses placeholder fallbacks so app starts even without env vars set (avoid crash-on-load).
- API_BASE in apiBase.ts defaults to "/api" when VITE_API_URL is empty — this correctly hits the api-server at /api in Replit.
- `@assets` alias in vite.config.ts points to `../../attached_assets` (workspace root). Missing asset `Gemini_Generated_Image_grc2w7grc2w7grc2_1780220609974.png` was copied from .migration-backup/attached_assets.
- migration-backup workflows fail (no node_modules) — expected, ignore them.

## Applied UI fixes
1. GrupoChat: name shown above EVERY other-user message (not just first in sequence).
2. OTP + Registar + Home: "ONLINE" text in WinMozLogo bumped to fontSize 16, fontWeight 600, opacity 0.75.
3. Home.tsx: bilhar excluded from player count in "Jogos em Destaque" (id="bilhar") and "Populares Agora" (id="bi").
4. Explorar.tsx: bilhar excluded from "a jogar" count in GameCard.
5. BottomNav.tsx: removed localStorage.removeItem("wm_active_game") from resume click — game stays resumable.
6. OTP.tsx: fetch to /complete-registration now has 5s AbortController timeout to prevent hang.

## Why ONLINE text matters
User explicitly requested larger ONLINE text in logo across all screens.

**Why:** Preserves brand identity — ONLINE is part of the "WINNER ONLINE" branding.
