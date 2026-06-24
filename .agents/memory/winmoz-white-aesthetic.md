---
name: Winmoz White Aesthetic
description: White minimal style rules applied to Apostar and game outer containers
---

## Rule
All main user-facing screens use white/minimal aesthetic:
- Background: `#fff`
- Primary text: `#0a0a0a` / `#111`
- Secondary text: `#6b7280` / `#9ca3af`
- Borders: `1px solid #e5e7eb`
- Cards: `background: #fff; border: 1px solid #e5e7eb`
- CTA buttons: `background: #000; color: #fff; border: none`
- Inputs/buttons: `borderRadius: 0` (square, no rounding)
- Subtle backgrounds: `#f8fafc`

## Applied to
- `Apostar.tsx` — main bet screen, sala-menu, sala-aguardar, sala-entrar, timeout
- `LudoGame.tsx` — outer container, header, turn indicator pill
- `ChessGame.tsx` — outer container, header, turn indicator pill
- `DamasGame.tsx` — outer container, header, turn indicator text
- `SegmentedToggle` component (inside Apostar.tsx)
- `MobileWalletPhoneField` component (inside Apostar.tsx)

## Exceptions
- SMSBettingScreen — intentionally kept dark (user preference)
- Game boards themselves — untouched (Ludo colored squares, Damas gold/black, Chess black/white)
- Admin panel — uses its own dark gz-theme with --gz-* CSS variables

**Why:** Login screen is white/minimal; all main bet + game outer UI should match it for visual consistency.
