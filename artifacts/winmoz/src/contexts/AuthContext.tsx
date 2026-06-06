import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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
    if (error || !data) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        return fetchProfile(userId, attempt + 1);
      }
      return null;
    }
    return data as UserProfile;
  } catch {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      return fetchProfile(userId, attempt + 1);
    }
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
  extraData: { full_name?: string; phone?: string; invite_code_used?: string | null }
) {
  try {
    const res = await fetch(`${API_BASE}/complete-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
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
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveCachedProfile(p: UserProfile) {
  try { sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function clearCachedProfile() {
  try { sessionStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
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
  const signedInHandledRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveAndSet = (p: UserProfile) => {
    if (p.is_blocked) {
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

  const refreshProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const data = await fetchProfile(session.user.id);
      if (data) saveAndSet({ ...data, email: session.user.email ?? "" });
    } catch { /* silently fail */ }
  };

  const forceRefresh = refreshProfile;

  const signOut = async () => {
    activeUidRef.current = null;
    signedInHandledRef.current = false;
    stopHeartbeat();
    if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
    clearCachedProfile();
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
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

  useEffect(() => {
    let cancelled = false;

    const initFromSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session?.user) {
          clearCachedProfile();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const { id, email = "" } = session.user;

        if (cachedProfile?.id === id) {
          activeUidRef.current = id;
          signedInHandledRef.current = true;
          setLoading(false);
          setSessionReady(true);
          startHeartbeat(id);
          startRealtimeProfile(id, email);
          const fresh = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id && fresh) {
            saveAndSet({ ...fresh, email });
          }
          return;
        }

        activeUidRef.current = id;
        if (!cancelled) setUser({ id, email });

        const data = await fetchProfile(id);
        if (!cancelled && activeUidRef.current === id) {
          if (data) saveAndSet({ ...data, email });
          signedInHandledRef.current = true;
          setLoading(false);
          setSessionReady(true);
          startHeartbeat(id);
          startRealtimeProfile(id, email);
        }
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
              });
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
