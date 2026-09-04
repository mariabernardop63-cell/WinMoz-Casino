import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { forceSessionLogout, isSessionExpiredError, supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/apiBase";

export interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string;
  phone: string | null;
  avatar_url: string | null;
  invite_code_used: string | null;
  my_invite_code: string | null;
  balance: string | number;
  created_at?: string;
  updated_at?: string;
  is_blocked?: boolean;
  block_type?: string | null;
  is_affiliate?: boolean;
  affiliate_pending_earnings?: number;
  affiliate_milestone_500_claimed?: boolean;
  affiliate_milestone_2000_claimed?: boolean;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  sessionReady: boolean;
  isBlocked: boolean;
  refreshProfile: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PROFILE_CACHE_KEY = "wm_profile_cache";

async function fetchProfile(userId: string, attempt = 0): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error && isSessionExpiredError(error)) {
      forceSessionLogout("profile_fetch_failed");
      return null;
    }
    if (error || !data) {
      // PGRST116 = row not found → profile genuinely missing, don't retry
      if ((error as any)?.code === "PGRST116") return null;
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        return fetchProfile(userId, attempt + 1);
      }
      return null;
    }
    return data as UserProfile;
  } catch {
    if (attempt < 4) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      return fetchProfile(userId, attempt + 1);
    }
    return null;
  }
}

/** Refresh the session if the access token is expired/near-expiry, then fetch
    the profile. Returns null only when there is no usable session at all. */
async function refreshSessionAndFetchProfile(): Promise<{ userId: string; email: string; profile: UserProfile | null } | null> {
  try {
    let { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      // A missing session after the refresh attempt is an invalid account,
      // not a profile-loading state. Do not keep rendering cached data.
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      session = refreshed ?? session;
      if (!session?.user) {
        forceSessionLogout(isSessionExpiredError(sessionError ?? refreshError)
          ? "refresh_token_invalid"
          : "session_missing");
        return null;
      }
    }

    if (!session?.user) return null;

    const expiresAt = session.expires_at ?? 0;
    if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
      if (refreshed) {
        session = refreshed;
      } else {
        forceSessionLogout("refresh_token_invalid");
        return null;
      }
      // A session that is still valid can survive a transient refresh error.
    }

    const userId = session.user.id;
    const email = session.user.email ?? "";
    const profile = await fetchProfile(userId);
    return { userId, email, profile };
  } catch {
    return null;
  }
}

async function updateLastSeen(userId: string) {
  try {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch { /* silently fail */ }
}

async function ensureProfileExists(
  userId: string,
  email: string,
  extraData: { full_name?: string; phone?: string; invite_code_used?: string | null },
  accessToken?: string | null
) {
  try {
    const res = await fetch(`${API_BASE}/complete-registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        email,
        full_name: extraData.full_name ?? null,
        phone: extraData.phone ?? null,
        invite_code_used: extraData.invite_code_used ?? null,
      }),
    });
    if (!res.ok) throw new Error("API error");
  } catch {
    if (!extraData.full_name && !extraData.phone) return;
    try {
      const { data: existing } = await supabase
        .from("profiles").select("id").eq("id", userId).single();
      if (existing) {
        const updates: Record<string, any> = {};
        if (extraData.full_name) updates.full_name = extraData.full_name;
        if (extraData.phone) updates.phone = extraData.phone.replace(/\D/g, "");
        if (extraData.invite_code_used !== undefined) updates.invite_code_used = extraData.invite_code_used;
        if (Object.keys(updates).length > 0)
          await supabase.from("profiles").update(updates).eq("id", userId);
      }
    } catch { /* ignore */ }
  }
}

function loadCachedProfile(): (UserProfile & { email?: string }) | null {
  try {
    // Migrate the old tab-only cache once. Closing a tab must not erase the
    // account details shown while the profile request is being rehydrated.
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
      ?? sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    try { localStorage.setItem(PROFILE_CACHE_KEY, raw); } catch { /* ignore */ }
    return parsed;
  } catch { return null; }
}

function saveCachedProfile(p: UserProfile) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedProfile = loadCachedProfile();

  const [user, setUser] = useState<{ id: string; email: string } | null>(
    cachedProfile ? { id: cachedProfile.id, email: cachedProfile.email ?? "" } : null
  );
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile ?? null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [sessionReady, setSessionReady] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const activeUidRef = useRef<string | null>(cachedProfile?.id ?? null);
  const hadAuthenticatedStateRef = useRef(Boolean(cachedProfile));
  const signedInHandledRef = useRef(false);
  const explicitSignOutRef = useRef(false);
  const invalidatingRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveAndSet = (p: UserProfile) => {
    if (p.is_blocked) {
      hadAuthenticatedStateRef.current = false;
      clearCachedProfile();
      setUser(null);
      setProfile(null);
      setLoading(false);
      setIsBlocked(true);
      activeUidRef.current = null;
      signedInHandledRef.current = false;
      supabase.auth.signOut().catch(() => {});
      return;
    }
    hadAuthenticatedStateRef.current = true;
    setIsBlocked(false);
    setProfile(p);
    saveCachedProfile(p);
  };

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const startRealtimeProfile = (userId: string, email: string) => {
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    realtimeChannelRef.current = supabase
      .channel(`profile-realtime-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as UserProfile;
          if (updated) saveAndSet({ ...updated, email });
        }
      )
      .subscribe();
  };

  const startHeartbeat = (userId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    updateLastSeen(userId);
    heartbeatRef.current = setInterval(() => {
      updateLastSeen(userId);
    }, 30_000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const invalidateSession = () => {
    if (invalidatingRef.current) return;
    const shouldRedirect = hadAuthenticatedStateRef.current;
    invalidatingRef.current = true;
    hadAuthenticatedStateRef.current = false;
    activeUidRef.current = null;
    signedInHandledRef.current = false;
    stopHeartbeat();
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    clearCachedProfile();
    setUser(null);
    setProfile(null);
    setIsBlocked(false);
    setLoading(false);
    setSessionReady(true);
    if (shouldRedirect && window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    void supabase.auth.signOut().catch(() => {}).finally(() => {
      invalidatingRef.current = false;
    });
  };

  const refreshProfile = async () => {
    try {
      const result = await refreshSessionAndFetchProfile();
      if (!result) return;
      const { userId, email, profile: data } = result;
      if (!data) return;
      if (activeUidRef.current === null || activeUidRef.current === userId) {
        activeUidRef.current = userId;
        setUser(prev => (prev?.id === userId ? prev : { id: userId, email }));
        saveAndSet({ ...data, email });
      }
    } catch { /* silently fail */ }
  };

  const forceRefresh = refreshProfile;

  const signOut = async () => {
    explicitSignOutRef.current = true;
    activeUidRef.current = null;
    signedInHandledRef.current = false;
    stopHeartbeat();
    if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
    clearCachedProfile();
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    explicitSignOutRef.current = false;
    setUser(null);
    setProfile(null);
    setIsBlocked(false);
  };

  // Keep balance fresh: re-fetch on window focus and every 60 s
  useEffect(() => {
    const handler = () => { refreshProfile(); };
    window.addEventListener("focus", handler);
    const iv = setInterval(handler, 60_000);
    return () => { window.removeEventListener("focus", handler); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A request that proves the token invalid must clear all user-scoped state.
     Network/profile retries are handled separately and do not reach here. */
  useEffect(() => {
    const onSessionInvalid = () => invalidateSession();
    window.addEventListener("wm:session-invalid", onSessionInvalid);
    return () => window.removeEventListener("wm:session-invalid", onSessionInvalid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self-heal: if a user is logged in but the profile is missing (e.g. a
  // failed fetch after an expired token), retry automatically with backoff
  // instead of showing "Utilizador" with no data.
  const profileRetryRef = useRef(0);
  useEffect(() => {
    if (!user || profile || isBlocked) return;
    if (profileRetryRef.current >= 5) return;
    const delay = 1500 * Math.pow(2, profileRetryRef.current);
    const t = setTimeout(() => {
      profileRetryRef.current += 1;
      refreshProfile();
    }, delay);
    return () => clearTimeout(t);
  }, [user, profile, isBlocked]);
  // Reset the retry counter whenever the profile recovers
  useEffect(() => {
    if (profile) profileRetryRef.current = 0;
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    const initFromSession = async () => {
      try {
        // First fast check: is there a session in storage?
        let { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // Maybe the access token expired while the tab was closed —
          // attempt one silent refresh before deciding the user is logged out
          const { data: { session: refreshed } } = await supabase.auth.refreshSession();
          session = refreshed ?? null;

          if (!session?.user && !cancelled) {
            invalidateSession();
            setLoading(false);
            setSessionReady(true);
            return;
          }
        }

        const result = await refreshSessionAndFetchProfile();
        if (cancelled) return;
        if (!result) {
          invalidateSession();
          setLoading(false);
          setSessionReady(true);
          return;
        }

        const { userId: id, email, profile: data } = result;
        if (profile && profile.id !== id) {
          clearCachedProfile();
          setProfile(null);
        }

        // User is confirmed alive — keep session state
        activeUidRef.current = id;
        hadAuthenticatedStateRef.current = true;
        setUser({ id, email });

        if (data) {
          saveAndSet({ ...data, email });
        } else if (profile?.id === id) {
          // If data is temporarily unavailable, keep the cached profile
          // visible — the focus/interval refresh will retry.
          saveAndSet({ ...profile, email });
        } else {
          // Auth metadata still gives the user a stable identity while the
          // profile row is being recovered.
          const metadata = result ? session?.user.user_metadata ?? {} : {};
          saveAndSet({
            id,
            full_name: typeof metadata.full_name === "string" ? metadata.full_name : null,
            email,
            phone: typeof metadata.phone === "string" ? metadata.phone : null,
            avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
            invite_code_used: null,
            my_invite_code: null,
            balance: 0,
          });
        }
        signedInHandledRef.current = true;
        setLoading(false);
        setSessionReady(true);
        startHeartbeat(id);
        startRealtimeProfile(id, email);
      } catch {
        if (!cancelled) { setLoading(false); setSessionReady(true); }
      }
    };

    initFromSession();

    const safetyTimer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setSessionReady(true); }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_IN" && session?.user) {
          const { id, email = "" } = session.user;
          if (signedInHandledRef.current && activeUidRef.current === id) return;

          activeUidRef.current = id;
          hadAuthenticatedStateRef.current = true;
          if (!cancelled) setUser({ id, email });

          const pendingRaw = sessionStorage.getItem("pendingReg");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              sessionStorage.removeItem("pendingReg");
              await ensureProfileExists(id, email, {
                full_name: pending.full_name,
                phone: pending.phone,
                invite_code_used: pending.invite_code_used,
              }, session?.access_token);
            } catch { /* não crítico */ }
          }

          const data = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id) {
            if (data) saveAndSet({ ...data, email });
            signedInHandledRef.current = true;
            setLoading(false);
            startHeartbeat(id);
            startRealtimeProfile(id, email);
          }

        } else if (event === "SIGNED_OUT") {
          activeUidRef.current = null;
          signedInHandledRef.current = false;
          stopHeartbeat();
          if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
          clearCachedProfile();
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          const { id, email = "" } = session.user;
          if (!cancelled) setUser(prev => (prev?.id === id ? prev : { id, email }));
          const data = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id && data) {
            saveAndSet({ ...data, email });
          }

        } else if (event === "USER_UPDATED" && session?.user) {
          const { id, email = "" } = session.user;
          const data = await fetchProfile(id);
          if (!cancelled && data) saveAndSet({ ...data, email });
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      stopHeartbeat();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, sessionReady, isBlocked, refreshProfile, forceRefresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
