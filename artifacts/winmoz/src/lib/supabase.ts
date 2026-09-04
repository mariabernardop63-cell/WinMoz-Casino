import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

const REFRESH_TOKEN_DEAD_RE =
  /refresh_token_not_found|Invalid Refresh Token|refresh.?token.*(expired|invalid|revoked|not found)/i;

/**
 * Logout automático quando a sessão está definitivamente morta:
 * limpa a sessão Supabase + cache de perfil e recarrega a app na rota de
 * login. Garante que o utilizador nunca fica preso num ecrã a meio.
 */
export function forceSessionLogout() {
  supabase.auth.signOut().catch(() => { /* best-effort */ });
  try { sessionStorage.removeItem("wm_profile_cache"); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("wm:session-invalid"));
}

/**
 * Returns a valid session, proactively refreshing when the access token is
 * expired or expires in <60 s. Behaviour on failure:
 *  - refresh token dead  → auto-logout + redirect, returns null
 *  - transient/network   → keeps the (possibly stale) session so the UI can
 *    keep showing cached data while retrying in the background
 */
export async function getSessionWithRefresh(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const expiresAt = session.expires_at ?? 0;
    const nowSecs = Math.floor(Date.now() / 1000);

    if (expiresAt - nowSecs > 60) return session;

    const { data: { session: refreshed }, error: refreshErr } =
      await supabase.auth.refreshSession();

    if (refreshed) return refreshed;

    const msg = String((refreshErr as any)?.message ?? refreshErr ?? "");
    if (REFRESH_TOKEN_DEAD_RE.test(msg)) {
      forceSessionLogout();
      return null;
    }

    // Transient failure — return the old session; callers keep cached data
    return session;
  } catch {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ?? null;
    } catch {
      return null;
    }
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
