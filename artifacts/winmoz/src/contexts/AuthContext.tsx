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

async function fetchProfileFromSupabase(userId: string): Promise<UserProfile | null> {
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
    const response = await fetch("/api/complete-registration", {
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
    if (!response.ok) throw new Error("API error");
  } catch {
    // Fallback: only update if we actually have data to write
    if (!extraData.full_name && !extraData.phone) return;
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (existing) {
        const updates: Record<string, any> = {};
        if (extraData.full_name) updates.full_name = extraData.full_name;
        if (extraData.phone) updates.phone = extraData.phone.replace(/\D/g, "");
        if (extraData.invite_code_used !== undefined) updates.invite_code_used = extraData.invite_code_used;
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", userId);
        }
      }
    } catch {
      /* silently ignore */
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the latest active userId to discard stale fetch results
  const currentUserIdRef = useRef<string | null>(null);

  const applyProfile = (userId: string, email: string, data: UserProfile | null) => {
    // Only apply if this is still the current user
    if (currentUserIdRef.current !== userId) return;
    if (data) {
      setProfile({ ...data, email });
    }
    // If fetch failed (data is null), do NOT clear profile — keep existing data
    // This prevents data disappearing due to transient network errors or RLS timing
  };

  const refreshProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const data = await fetchProfileFromSupabase(session.user.id);
        if (data) {
          setProfile({ ...data, email: session.user.email ?? "" });
        }
      }
    } catch {
      /* silently fail — user stays logged in with existing data */
    }
  };

  const forceRefresh = refreshProfile;

  const signOut = async () => {
    currentUserIdRef.current = null;
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let cancelled = false;

    // Safety net: always resolve loading after 12 seconds max
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 12000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === "INITIAL_SESSION") {
          // Page load — restore session if it exists
          if (session?.user) {
            const { id, email = "" } = session.user;
            currentUserIdRef.current = id;
            setUser({ id, email });
            const data = await fetchProfileFromSupabase(id);
            if (!cancelled) {
              applyProfile(id, email, data);
              setLoading(false);
            }
          } else {
            if (!cancelled) setLoading(false);
          }

        } else if (event === "SIGNED_IN" && session?.user) {
          const { id, email = "" } = session.user;
          currentUserIdRef.current = id;
          setUser({ id, email });

          // Only call ensureProfileExists for brand-new registrations
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

          if (!cancelled) {
            const data = await fetchProfileFromSupabase(id);
            if (!cancelled) {
              applyProfile(id, email, data);
              setLoading(false);
            }
          }

        } else if (event === "SIGNED_OUT") {
          currentUserIdRef.current = null;
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Token refreshed silently — update user and reload profile
          const { id, email = "" } = session.user;
          setUser({ id, email });
          const data = await fetchProfileFromSupabase(id);
          if (!cancelled && data) {
            setProfile({ ...data, email });
          }

        } else if (event === "USER_UPDATED" && session?.user) {
          const { id, email = "" } = session.user;
          const data = await fetchProfileFromSupabase(id);
          if (!cancelled && data) {
            setProfile({ ...data, email });
          }
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
