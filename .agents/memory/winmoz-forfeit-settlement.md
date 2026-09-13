---
name: Winmoz forfeit settlement
description: Rule for making game forfeits settle money reliably
---

When a player forfeits a real-money multiplayer match, the authenticated quitter must trigger a server-side settlement that derives the opponent from the match row and credits that opponent. The realtime event remains a UI notification, not the source of truth.

**Why:** A browser broadcast can be delayed, dropped, or arrive after the winner modal is shown; relying on the winner client alone can leave a legitimate payout uncredited.

**How to apply:** Keep forfeiture idempotent at the match level, calculate payout from the stored bet, and refresh the winner profile even when the match was already settled by the quitter.