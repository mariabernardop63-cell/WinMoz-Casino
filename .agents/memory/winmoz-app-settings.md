---
name: Winmoz AppSettingsContext
description: Global settings context for dark mode, language, currency, payment methods, betting limits
---

## Location
`artifacts/winmoz/src/contexts/AppSettingsContext.tsx`

## Storage key
`wm_app_settings_v2` (localStorage)

## Features
- `darkMode` / `setDarkMode`
- `language` (Português | English | Français | Español) / `setLanguage`
- `currency` (MZN | USD | EUR | ZAR | BRL) / `setCurrency`
- `exchangeRates` — live from `open.er-api.com` (base MZN), refreshed every 10 min
- `convertAmount(mtAmount)` — returns `{ amount, formatted }` in current currency
- `paymentMethods` — array of max 3 `{id, phone, label, isDefault}`, saved to localStorage
- `bettingLimits` — `{enabled, dailyLimit, todaySpent, lastReset}` with daily midnight reset enforcement
- `t(pt, en, fr, es)` — simple inline translation helper

## Provider placement
Wrapped in `App.tsx` inside `<BrandProvider>`, outside the router.

## Admin integration
Admin `settings.tsx` stores `app_version`, `terms_of_service_content`, `privacy_policy_content` in `platform_settings` Supabase table. Definicoes reads `app_version` from that table. TermosServico reads `terms_of_service_content` with Markdown fallback.

**Why:** Needed a persistent cross-session context for user preferences (currency, payment methods, limits) without requiring DB columns per user.
