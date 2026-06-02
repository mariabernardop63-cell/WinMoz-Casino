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

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Tracks the active user id — used to discard stale async results
  const activeUidRef = useRef<string | null>(null);
  // Prevents SIGNED_IN from re-running a full load if INITIAL_SESSION already did it
  const initialSessionDoneRef = useRef(false);

  const refreshProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const data = await fetchProfile(session.user.id);
      if (data) setProfile({ ...data, email: session.user.email ?? "" });
    } catch { /* silently fail */ }
  };

  const forceRefresh = refreshProfile;

  const signOut = async () => {
    activeUidRef.current = null;
    initialSessionDoneRef.current = false;
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let cancelled = false;

    // Safety net: resolve loading after 6 seconds max
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    const unlock = () => {
      if (!cancelled) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        // ── INITIAL_SESSION: page load / session restore ──────────────────────
        if (event === "INITIAL_SESSION") {
          if (session?.user) {
            const { id, email = "" } = session.user;
            activeUidRef.current = id;
            setUser({ id, email });
            // Wait for profile before unlocking so pages never flash "UTILIZADOR"
            const data = await fetchProfile(id);
            if (cancelled || activeUidRef.current !== id) return;
            if (data) setProfile({ ...data, email });
            initialSessionDoneRef.current = true;
          }
          unlock();

        // ── SIGNED_IN: actual user login (or OTP confirmation) ────────────────
        } else if (event === "SIGNED_IN" && session?.user) {
          const { id, email = "" } = session.user;

          // If INITIAL_SESSION already loaded this user, skip to avoid double-fetch
          if (initialSessionDoneRef.current && activeUidRef.current === id) return;

          activeUidRef.current = id;
          setUser({ id, email });

          // Handle new registration data
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
          if (cancelled || activeUidRef.current !== id) return;
          if (data) setProfile({ ...data, email });
          initialSessionDoneRef.current = true;
          unlock();

        // ── SIGNED_OUT ────────────────────────────────────────────────────────
        } else if (event === "SIGNED_OUT") {
          activeUidRef.current = null;
          initialSessionDoneRef.current = false;
          setUser(null);
          setProfile(null);
          unlock();

        // ── TOKEN_REFRESHED: silent background refresh ────────────────────────
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          const { id, email = "" } = session.user;
          // Only update user object if id actually changed (avoid pointless re-renders)
          setUser(prev => (prev?.id === id ? prev : { id, email }));
          const data = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id && data)
            setProfile({ ...data, email });

        // ── USER_UPDATED ──────────────────────────────────────────────────────
        } else if (event === "USER_UPDATED" && session?.user) {
          const { id, email = "" } = session.user;
          const data = await fetchProfile(id);
          if (!cancelled && data) setProfile({ ...data, email });
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
