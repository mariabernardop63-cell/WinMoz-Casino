import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, type UserProfile } from "@/lib/api";

export const DEMO_EMAIL = "12345678@gmail.com";
export const DEMO_STORAGE_KEY = "winmoz_demo_mode";

const DEMO_PROFILE: UserProfile = {
  id: "demo-user-id",
  full_name: "Demo User",
  email: DEMO_EMAIL,
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
};

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") return;
    const result = await authApi.me();
    if (result) {
      setUser(result.user);
      setProfile(result.profile);
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  const forceRefresh = async () => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }
    const result = await authApi.me();
    if (result) {
      setUser(result.user);
      setProfile(result.profile);
    } else {
      setUser(null);
      setProfile(null);
    }
    setLoading(false);
  };

  const signOut = async () => {
    if (localStorage.getItem(DEMO_STORAGE_KEY) === "true") {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setUser(null);
      setProfile(null);
      return;
    }
    await authApi.logout();
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

    authApi.me().then((result) => {
      if (result) {
        setUser(result.user);
        setProfile(result.profile);
      }
      setLoading(false);
    });
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
