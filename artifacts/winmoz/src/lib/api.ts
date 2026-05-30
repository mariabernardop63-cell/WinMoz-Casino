const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
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
  email: string;
  phone: string | null;
  avatar_url: string | null;
  invite_code_used: string | null;
  my_invite_code: string | null;
  balance: string | number;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  user: { id: string; email: string };
  profile: UserProfile;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    return req<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async register(data: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    invite_code_used?: string;
  }): Promise<AuthResult> {
    return req<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<void> {
    await req("/auth/logout", { method: "POST" });
  },

  async me(): Promise<AuthResult | null> {
    try {
      return await req<AuthResult>("/auth/me");
    } catch {
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
