---
name: Rematch bug pattern
description: Why handleReplay/handleRematchAccept gets stuck at "checking" and how to fix it
---

## The rule
Every `async` handler that calls Supabase must be wrapped in `try-catch` **and** race against an 8 s timeout via `Promise.race`. Without this, a network hiccup or expired token causes the promise to hang forever, leaving the rematch overlay frozen at "A verificar saldo…".

**Why:** The `setRematchPhase("checking")` fires before the await. If the await never settles, no subsequent setState call runs, so the phase is permanently "checking".

**How to apply:**
```ts
async function handleReplay() {
  setRematchPhase("checking");
  try {
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
    const data = await Promise.race([supabase.from(...).single().then(r => r.data), timeout]);
    if (!data || ...) { setRematchPhase("no_balance"); return; }
    setRematchPhase("waiting");
    channelRef.current?.send(...);
  } catch {
    setRematchPhase("no_balance"); // always land in a safe visible state
  }
}
```
Same pattern applies to `handleRematchAccept` in all 3 game pages (DamasGame, ChessGame, LudoGame).
