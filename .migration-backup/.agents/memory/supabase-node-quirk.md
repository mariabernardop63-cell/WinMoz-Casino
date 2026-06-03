---
name: Supabase Node.js quirk
description: Node.js 20 requires ws package for Supabase realtime transport; express-session not needed with Supabase JWT auth
---

## Node.js 20 + Supabase Realtime
Node.js versions below 22 don't have native WebSocket support. Supabase's realtime client crashes at createClient() time unless you provide the ws package as the transport.

**Fix in supabaseAdmin.ts:**
```typescript
import ws from "ws"
export const supabaseAdmin = createClient(url, key, {
  realtime: { transport: ws as any }
})
```

Also install: `pnpm add ws @types/ws` in the api-server.

**Why:** Error thrown at module initialization: "Node.js 20 detected without native WebSocket support". Even if you don't use realtime subscriptions, the RealtimeClient is always initialized by createClient().

## express-session not needed with Supabase
When using Supabase JWT auth, there's no need for express-session or connect-pg-simple in the backend. JWT tokens are verified via `supabaseAdmin.auth.getUser(token)`. Removing session middleware simplifies the backend and removes the need for SESSION_SECRET env var.
