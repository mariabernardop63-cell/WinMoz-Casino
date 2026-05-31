const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("winmoz_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("winmoz_token", token);
  else localStorage.removeItem("winmoz_token");
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json as T;
}

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

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
  profile: UserProfile;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    const result = await req<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    return result;
  },

  async register(data: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    invite_code_used?: string;
  }): Promise<AuthResult> {
    const result = await req<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setToken(result.token);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await req("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
    }
  },

  async me(): Promise<AuthResult | null> {
    if (!getToken()) return null;
    try {
      return await req<AuthResult>("/auth/me");
    } catch {
      setToken(null);
      return null;
    }
  },

  async updateProfile(data: {
    full_name?: string;
    phone?: string;
    avatar_url?: string | null;
  }): Promise<{ profile: UserProfile }> {
    return req<{ profile: UserProfile }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async forgotPassword(email: string): Promise<void> {
    await req("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(password: string): Promise<void> {
    await req("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
};
