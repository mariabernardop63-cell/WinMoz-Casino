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

function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function fetchProfileFromSupabase(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.from("profiles").select("*").eq("id", userId).single(),
      10000,
      "fetchProfile"
    );
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

async function ensureProfileExists(
  userId: string,
  email: string,
  extraData?: { full_name?: string; phone?: string; invite_code_used?: string | null }
) {
  try {
    await withTimeout(
      fetch("/api/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          email,
          full_name: extraData?.full_name ?? null,
          phone: extraData?.phone ?? null,
          invite_code_used: extraData?.invite_code_used ?? null,
        }),
      }),
      10000,
      "ensureProfile"
    );
  } catch {
    /* não crítico */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const loadProfile = async (userId: string, email: string) => {
    // Prevent concurrent loadProfile calls
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await fetchProfileFromSupabase(userId);
      setProfile(data ? { ...data, email } : null);
      setUser({ id: userId, email });
    } catch {
      setProfile(null);
      setUser({ id: userId, email });
    } finally {
      loadingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    try {
      const result = await withTimeout(supabase.auth.getSession(), 8000, "getSession");
      const session = result.data.session;
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email ?? "");
      }
    } catch {
      /* silently fail — user stays logged in */
    }
  };

  const forceRefresh = refreshProfile;

  const signOut = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 8000, "signOut");
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "").finally(() => {
          if (!cancelled) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
          const userId = session.user.id;
          const email = session.user.email ?? "";

          const pendingRaw = sessionStorage.getItem("pendingReg");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              await ensureProfileExists(userId, email, {
                full_name: pending.full_name,
                phone: pending.phone,
                invite_code_used: pending.invite_code_used,
              });
              sessionStorage.removeItem("pendingReg");
            } catch { /* não crítico */ }
          } else {
            await ensureProfileExists(userId, email);
          }

          await loadProfile(userId, email);
          if (!cancelled) setLoading(false);

        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          if (!cancelled) setLoading(false);

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? "" });
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
