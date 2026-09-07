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
 * Erros que PROVAM que o refresh token já não consegue recuperar a sessão
 * (revogado, rodado por outra sessão, sessão terminada no servidor). Só
 * estes encerram a conta local — tudo o resto é transitório.
 */
const HARD_REFRESH_ERROR_RE =
  /refresh[_ ]?token[_ ]?(not[_ ]?found|is invalid|has been (revoked|used|invalidated)|already used|reuse)|invalid[_ ]?refresh[_ ]?token|invalid[_ ]?grant|session[_ ]?not[_ ]?found|token[_ ]?(revoked|terminated)|bad[_ ]?refresh[_ ]?token/i;

/** Falhas transitórias: rede, timeouts, 5xx, rate limit. Nunca encerram sessão. */
const TRANSIENT_ERROR_RE =
  /fetch|network|offline|timeout|timed? ?out|abort|failed to fetch|load failed|rate.?limit|too many requests|server error|internal error|bad gateway|service unavailable|gateway timeout|econn|enotfound|socket|temporarily/i;

/**
 * Returns true if the error is a Supabase JWT / session expiry error.
 * NB: isto NÃO prova que a sessão morreu — prova que o access token actual
 * não foi aceite. O remedio é refrescar e repetir, não terminar a sessão.
 */
export function isSessionExpiredError(err: unknown): boolean {
  if (!err) return false;
  const value = err as { message?: unknown; code?: unknown; status?: unknown };
  const msg = String(value.message ?? err);
  const code = String(value.code ?? "");
  const status = Number(value.status ?? 0);
  return SESSION_AUTH_ERROR_RE.test(`${code} ${msg}`) || status === 401;
}

/**
 * True only when the refresh token itself is unrecoverable. Anything
 * ambiguous (network, 5xx, timeouts) is treated as transient on purpose:
 * a moment offline must never log the user out.
 */
export function isHardAuthError(err: unknown): boolean {
  if (!err) return false;
  const value = err as { message?: unknown; code?: unknown; status?: unknown };
  const msg = String(value.message ?? err);
  const code = String(value.code ?? "");
  const status = Number(value.status ?? 0);
  const text = `${code} ${msg}`;
  if (TRANSIENT_ERROR_RE.test(text)) return false;
  if (HARD_REFRESH_ERROR_RE.test(text)) return true;
  return status === 400 || status === 401 || status === 403;
}

/**
 * Notifica a app que a sessão terminou a sério (refresh token morto, conta
 * bloqueada, logout). O AuthContext limpa o estado e encaminha para /login
 * com uma mensagem amigável — o utilizador nunca fica preso numa conta morta.
 */
export function forceSessionLogout(reason = "invalid_session") {
  // Durante a janela de login, um refresh antigo (da sessão anterior) pode
  // falhar ao mesmo tempo que o utilizador entra. Ignorar: quase de certeza
  // é a sessão velha a morrer — nunca a nova.
  if (inLoginGrace()) return;
  window.dispatchEvent(new CustomEvent("wm:session-invalid", {
    detail: { reason },
  }));
}

/* ── Janela de graça de login ──────────────────────────────────────────────
   Entre o submit do login e a estabilização da nova sessão, um refresh em
   curso da SESSÃO VELHA pode falhar e o auth-js faz `_removeSession()` —
   que apaga do storage a sessão NOVA e dispara SIGNED_OUT. Durante a
   graça: ignoramos esses fins de sessão e um watchdog repara o storage. */
let loginGraceUntil = 0;
const LOGIN_GRACE_MS = 25_000;

export function beginLoginGrace() {
  loginGraceUntil = Date.now() + LOGIN_GRACE_MS;
}

export function cancelLoginGrace() {
  loginGraceUntil = 0;
  stopLoginWatchdog();
}

export function inLoginGrace(): boolean {
  return Date.now() < loginGraceUntil;
}

interface EnsureSessionOptions {
  /** Force a token refresh even if the current one still looks valid. */
  forceRefresh?: boolean;
  /** Refresh when the token expires within this many seconds (default 90). */
  marginSeconds?: number;
}

let ensureInFlight: Promise<Session | null> | null = null;

/**
 * Devolve uma sessão com access token válido, refrescando quando necessário.
 * Comportamento:
 *  - refresh falha com erro de refresh token morto  → encerra a sessão local
 *  - refresh falha por rede/5xx/transitório          → devolve o token ainda
 *    válido, ou null sem encerrar nada (recuperação acontece no próximo tick)
 * Chamadas concorrentes partilham o mesmo refresh (single-flight).
 */
export async function ensureFreshSession(opts: EnsureSessionOptions = {}): Promise<Session | null> {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = runEnsureFreshSession(opts).finally(() => { ensureInFlight = null; });
  return ensureInFlight;
}

async function runEnsureFreshSession({ forceRefresh, marginSeconds = 90 }: EnsureSessionOptions): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const nowSecs = Math.floor(Date.now() / 1000);
    const expiresAt = session?.expires_at ?? 0;

    if (session && !forceRefresh && expiresAt - nowSecs >= marginSeconds) return session;
    if (!session?.refresh_token) return session ?? null;

    const attemptedToken = session.refresh_token;
    const { data: { session: refreshed }, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshed) return refreshed;

    // Enquanto o refresh antigo estava em curso, o storage pode ter sido
    // substituído (novo login, outra aba). Se a sessão actual já não é a que
    // tentámos refrescar, é mais nova — usá-la e ignorar a falha antiga.
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user && current.refresh_token !== attemptedToken) return current;

    if (isHardAuthError(refreshErr)) {
      forceSessionLogout("refresh_token_invalid");
      return null;
    }

    // Falha transitória: o token antigo, se ainda não expirou, continua útil.
    if (session && expiresAt > nowSecs) return session;
    return null;
  } catch {
    // Excepção desconhecida é tratada como transitória — um "talvez" nunca
    // pode destruir a sessão de alguém.
    return null;
  }
}

/**
 * Compatibilidade com os chamadores existentes (Apostar, Roleta, Depositar…).
 * Só dispara o encerramento quando NÃO existe sessão nenhuma em storage —
 * uma falha de rede devolve null e mantém a sessão intacta.
 */
export async function getSessionWithRefresh(): Promise<Session | null> {
  const session = await ensureFreshSession({ marginSeconds: 60 });
  if (!session) {
    try {
      const { data: { session: stored } } = await supabase.auth.getSession();
      if (!stored) forceSessionLogout("session_missing");
    } catch { /* ignore */ }
  }
  return session;
}

/**
 * A ser chamado após um 401 de uma API/DB: tenta produzir um token novo.
 * Devolve true quando um token fresco está disponível e o pedido pode ser
 * repetido; false quando o refresh também falhou.
 */
export async function recoverAfter401(): Promise<boolean> {
  const session = await ensureFreshSession({ forceRefresh: true, marginSeconds: 0 });
  return Boolean(session?.access_token);
}

/* ── Watchdog pós-login ────────────────────────────────────────────────────
   Enquanto a graça durar, verifica periodicamente se a sessão do login
   continua intacta no storage. Um refresh antigo pendente do auth-js pode
   falhar TARDE e apagar a sessão nova (_removeSession). Quando isso
   acontece, este watchdog repõe a sessão em ≤600 ms e o auth-js volta a
   disparar SIGNED_IN — o perfil é recarregado sem intervenção. */

let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let watchdogSession: Session | null = null;

function stopLoginWatchdog() {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
  watchdogSession = null;
}

async function repairLoginSession(): Promise<boolean> {
  if (!watchdogSession) return false;
  try {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.refresh_token === watchdogSession.refresh_token) return true;
    // Storage perdido/substituído → repor a sessão do login.
    await supabase.auth.setSession({
      access_token: watchdogSession.access_token,
      refresh_token: watchdogSession.refresh_token,
    });
    return true;
  } catch { return false; }
}

/**
 * Chamado pelo Login após `signInWithPassword` devolver uma sessão:
 *  1. verificação imediata — se um refresh antigo já apagou o storage,
 *     repõe a sessão de imediato (antes da navegação para /admin, p.ex.);
 *  2. watchdog até ao fim da graça — repara eliminações tardias.
 */
export async function finalizeLogin(session: Session): Promise<void> {
  if (!session?.refresh_token) return;
  beginLoginGrace();
  watchdogSession = session;

  // Reparo imediato (rápido quando está tudo intacto).
  try {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current || current.refresh_token !== session.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  } catch { /* ignore */ }

  if (!watchdogTimer) {
    watchdogTimer = setInterval(async () => {
      if (!inLoginGrace()) { stopLoginWatchdog(); return; }
      await repairLoginSession();
    }, 600);
  }
}

/** Chaves de sessão do supabase-js: sb-<ref>-auth-token[-user|-code-verifier]. */
const AUTH_STORAGE_KEY_RE = /^sb-.*-auth-token/;

/** Limpa as credenciais locais do Supabase sem chamadas de rede. */
export function clearLocalAuthStorage() {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) keys.push(storage.key(i) ?? "");
      keys.filter(k => AUTH_STORAGE_KEY_RE.test(k)).forEach(k => storage.removeItem(k));
    }
  } catch { /* ignore */ }
}

/**
 * Termina a sessão com um limite temporal duro: o utilizador nunca fica
 * refém de um signOut em rede lenta. Se a chamada ao servidor não responder
 * em 5 s, as credenciais locais são limpas na mesma.
 */
export async function terminateSession(scope: "global" | "local" = "global"): Promise<void> {
  // Um logout cancela a graça e o watchdog — a sessão nova deixou de existir.
  cancelLoginGrace();
  try {
    await Promise.race([
      supabase.auth.signOut({ scope }),
      new Promise<void>(resolve => setTimeout(resolve, 5000)),
    ]);
  } catch { /* ignore */ }
  clearLocalAuthStorage();
}
