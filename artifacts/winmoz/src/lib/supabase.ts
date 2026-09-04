import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Keep the Supabase session across tabs and browser restarts. The
    // default is localStorage, but making it explicit prevents a future
    // client configuration change from turning this into a tab-only session.
    storage: window.localStorage,
  },
});

const SESSION_AUTH_ERROR_RE =
  /refresh_token_not_found|invalid refresh token|refresh.?token.*(expired|invalid|revoked|not found)|jwt expired|token is expired|invalid jwt|unauthori[sz]ed|not authenticated|session invalid/i;

/**
 * Notifica a app que a sessão já não é válida. O AuthContext limpa o perfil
 * cacheado e encaminha o utilizador para login; uma falha de autenticação não
 * pode deixar a interface a mostrar um perfil sem saldo funcional.
 */
export function forceSessionLogout(reason = "invalid_session") {
  window.dispatchEvent(new CustomEvent("wm:session-invalid", {
    detail: { reason },
  }));
}

/**
 * Returns a valid session, proactively refreshing when the access token is
 * expired or expires in <60 s. Behaviour on failure:
 *  - expired/invalid refresh → invalidates the local account state
 *  - network failure before expiry → keeps the still-valid session
 */
export async function getSessionWithRefresh(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      if (isSessionExpiredError(error)) forceSessionLogout("session_read_failed");
      return null;
    }
    if (!session) {
      forceSessionLogout("session_missing");
      return null;
    }

    const expiresAt = session.expires_at ?? 0;
    const nowSecs = Math.floor(Date.now() / 1000);

    if (expiresAt - nowSecs > 60) return session;

    const { data: { session: refreshed }, error: refreshErr } =
      await supabase.auth.refreshSession();

    if (refreshed) return refreshed;

    const msg = String((refreshErr as any)?.message ?? refreshErr ?? "");
    if (SESSION_AUTH_ERROR_RE.test(msg) || expiresAt <= nowSecs) {
      forceSessionLogout("refresh_failed");
      return null;
    }

    // Transient failure — return the old session; callers keep cached data
    return session;
  } catch (error) {
    if (isSessionExpiredError(error)) forceSessionLogout("session_exception");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) forceSessionLogout("session_missing");
      return session ?? null;
    } catch {
      forceSessionLogout("session_unavailable");
      return null;
    }
  }
}

/** Returns true if the error is a Supabase JWT / session expiry error. */
export function isSessionExpiredError(err: unknown): boolean {
  if (!err) return false;
  const value = err as { message?: unknown; code?: unknown; status?: unknown };
  const msg = String(value.message ?? err);
  const code = String(value.code ?? "");
  const status = Number(value.status ?? 0);
  return SESSION_AUTH_ERROR_RE.test(`${code} ${msg}`) || status === 401;
}
