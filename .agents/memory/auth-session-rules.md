---
name: Winmoz authentication session rules
description: Durable rules for Supabase session recovery and login navigation
---

Supabase auth callbacks must return before making profile or other Supabase
queries. Schedule that work after the callback; awaiting it can contend with
the auth lock and make login or token refresh appear to fail.

**Why:** Auth state changes and refreshes share Supabase's internal
serialization. A callback that waits on another Supabase request can leave the
new session temporarily unavailable and trigger an incorrect navigation.

**How to apply:** Keep `onAuthStateChange` synchronous. Treat profile loading
as follow-up work, and only clear local auth after a refresh-token failure is
confirmed. A single transient API 401 must be retried or surfaced without
logging the user out.