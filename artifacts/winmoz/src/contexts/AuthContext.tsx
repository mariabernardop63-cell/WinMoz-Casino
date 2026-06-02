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
    // Fallback: try direct Supabase upsert if API call fails
    try {
      const upsertData: Record<string, any> = { id: userId };
      if (extraData?.full_name) upsertData.full_name = extraData.full_name;
      if (extraData?.phone) upsertData.phone = extraData.phone.replace(/\D/g, "");
      if (extraData?.invite_code_used !== undefined) upsertData.invite_code_used = extraData.invite_code_used;

      // Check if profile exists first
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (existing) {
        // Update only non-null fields
        const updates: Record<string, any> = {};
        if (extraData?.full_name) updates.full_name = extraData.full_name;
        if (extraData?.phone) updates.phone = extraData.phone.replace(/\D/g, "");
        if (extraData?.invite_code_used !== undefined) updates.invite_code_used = extraData.invite_code_used;
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
  // loadingRef prevents concurrent loadProfile calls — returns false if skipped so caller knows
  const loadingRef = useRef(false);

  // loadProfile: returns true if it actually ran (vs. was skipped by guard)
  const loadProfile = async (userId: string, email: string): Promise<boolean> => {
    if (loadingRef.current) return false;
    loadingRef.current = true;
    try {
      const data = await fetchProfileFromSupabase(userId);
      setProfile(data ? { ...data, email } : null);
      setUser({ id: userId, email });
      return true;
    } catch {
      setProfile(null);
      setUser({ id: userId, email });
      return true;
    } finally {
      loadingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    try {
      const result = await withTimeout(supabase.auth.getSession(), 8000, "getSession");
      const session = result.data.session;
      if (session?.user) {
        // Force reload even if guard would block — reset it first
        loadingRef.current = false;
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

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        const ran = await loadProfile(session.user.id, session.user.email ?? "");
        // Only set loading=false if loadProfile actually ran (wasn't blocked by guard)
        // If it was blocked, the onAuthStateChange handler is the one that will set it
        if (!cancelled && ran) setLoading(false);
      } else {
        if (!cancelled) setLoading(false);
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

          // Read and consume pendingReg (set by Registar.tsx before sign-up)
          const pendingRaw = sessionStorage.getItem("pendingReg");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              sessionStorage.removeItem("pendingReg");
              await ensureProfileExists(userId, email, {
                full_name: pending.full_name,
                phone: pending.phone,
                invite_code_used: pending.invite_code_used,
              });
            } catch { /* não crítico */ }
          } else {
            await ensureProfileExists(userId, email);
          }

          const ran = await loadProfile(userId, email);
          if (!cancelled && ran) setLoading(false);

        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          if (!cancelled) setLoading(false);

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Just keep user in sync — no need to reload full profile
          setUser({ id: session.user.id, email: session.user.email ?? "" });
        } else if (event === "INITIAL_SESSION" && session?.user) {
          // Some Supabase versions fire INITIAL_SESSION instead of SIGNED_IN on restore
          const userId = session.user.id;
          const email = session.user.email ?? "";
          const ran = await loadProfile(userId, email);
          if (!cancelled && ran) setLoading(false);
        } else if (event === "INITIAL_SESSION" && !session) {
          if (!cancelled) setLoading(false);
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
