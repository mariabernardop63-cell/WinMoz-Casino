import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Returns a valid session, proactively refreshing if the access token
 * expires in <60 s. Signs out and returns null if the refresh token
 * is expired or any auth error occurs — the caller should then redirect
 * the user to /login with a friendly message.
 */
export async function getSessionWithRefresh() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const expiresAt = session.expires_at ?? 0;
    const nowSecs = Math.floor(Date.now() / 1000);

    if (expiresAt - nowSecs > 60) return session;

    const { data: { session: refreshed }, error: refreshErr } =
      await supabase.auth.refreshSession();

    if (refreshErr || !refreshed) {
      await supabase.auth.signOut();
      return null;
    }
    return refreshed;
  } catch {
    await supabase.auth.signOut().catch(() => {});
    return null;
  }
}

/** Returns true if the error is a Supabase JWT / session expiry error. */
export function isSessionExpiredError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as any)?.message ?? err);
  return (
    msg.includes("JWT expired") ||
    msg.includes("token is expired") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("Invalid Refresh Token")
  );
}
