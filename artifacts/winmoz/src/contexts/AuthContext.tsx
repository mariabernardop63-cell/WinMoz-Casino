import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

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
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
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

async function ensureProfileExists(
  userId: string,
  email: string,
  extraData: { full_name?: string; phone?: string; invite_code_used?: string | null }
) {
  try {
    const res = await fetch("/api/complete-registration", {
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
  // If we already have a cache hit, skip the loading spinner
  const [loading, setLoading] = useState(!cachedProfile);

  const activeUidRef = useRef<string | null>(cachedProfile?.id ?? null);
  const signedInHandledRef = useRef(false);

  const saveAndSet = (p: UserProfile) => {
    setProfile(p);
    saveCachedProfile(p);
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
    clearCachedProfile();
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let cancelled = false;

    // ── getSession() is the primary and most reliable source on page reload ──
    // It reads the stored token directly; doesn't depend on event timing.
    const initFromSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session?.user) {
          // No valid session — wipe any stale cache
          clearCachedProfile();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const { id, email = "" } = session.user;

        // If the cache already seeded this exact user, just do a silent background refresh
        if (cachedProfile?.id === id) {
          activeUidRef.current = id;
          signedInHandledRef.current = true;
          setLoading(false);
          // Refresh balance/profile silently in background
          const fresh = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id && fresh) {
            saveAndSet({ ...fresh, email });
          }
          return;
        }

        // Different user or no cache — load fresh
        activeUidRef.current = id;
        if (!cancelled) setUser({ id, email });

        const data = await fetchProfile(id);
        if (!cancelled && activeUidRef.current === id) {
          if (data) saveAndSet({ ...data, email });
          signedInHandledRef.current = true;
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    initFromSession();

    // Safety net — never leave the app stuck in loading state
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    // ── onAuthStateChange handles live sign-in, sign-out, and token refresh ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_IN" && session?.user) {
          const { id, email = "" } = session.user;
          // Avoid re-running if initFromSession already handled this user
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
          }

        } else if (event === "SIGNED_OUT") {
          activeUidRef.current = null;
          signedInHandledRef.current = false;
          clearCachedProfile();
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          const { id, email = "" } = session.user;
          if (!cancelled) setUser(prev => (prev?.id === id ? prev : { id, email }));
          // Silent profile refresh after token is renewed
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
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, forceRefresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
