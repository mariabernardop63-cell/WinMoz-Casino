import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";

const DEMO_EMAIL = "12345678@gmail.com";
const DEMO_STORAGE_KEY = "winmoz_demo_mode";

const DEMO_PROFILE: Profile = {
  id: "demo-user-id",
  full_name: "Demo User",
  phone: null,
  avatar_url: null,
  invite_code_used: null,
  my_invite_code: "DEMO01",
  balance: 5000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_USER = {
  id: "demo-user-id",
  email: DEMO_EMAIL,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_metadata: { full_name: "Demo User" },
} as unknown as User;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfileFromDB(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data as Profile;
  } catch {
    return null;
  }
}

function buildProfileFromMetadata(user: User): Profile {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    full_name: meta.full_name ?? null,
    phone: meta.phone ?? null,
    avatar_url: meta.avatar_url ?? null,
    invite_code_used: meta.invite_code_used ?? null,
    my_invite_code: null,
    balance: 0,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (u: User) => {
    const dbProfile = await fetchProfileFromDB(u.id);
    setProfile(dbProfile ?? buildProfileFromMetadata(u));
  };

  const refreshProfile = async () => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") return;
    if (user) await loadProfile(user);
  };

  const signOut = async () => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setUser(null);
      setProfile(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          loadProfile(u);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export { DEMO_EMAIL, DEMO_STORAGE_KEY };
