import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import {
  forceSessionLogout, isSessionExpiredError, isHardAuthError,
  ensureFreshSession, terminateSession, clearLocalAuthStorage,
  inLoginGrace, cancelLoginGrace, supabase,
} from "@/lib/supabase";
import { API_BASE } from "@/lib/apiBase";

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
  is_blocked?: boolean;
  block_type?: string | null;
  is_affiliate?: boolean;
  affiliate_pending_earnings?: number;
  affiliate_milestone_500_claimed?: boolean;
  affiliate_milestone_2000_claimed?: boolean;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  sessionReady: boolean;
  isBlocked: boolean;
  refreshProfile: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PROFILE_CACHE_KEY = "wm_profile_cache";

/* ── Persistência do perfil (nome, telefone, saldo) ─────────────────────
   O perfil é guardado em localStorage (sobrevive ao fecho do browser) e
   só é removido quando existe a CERTEZA de que a sessão terminou. Um
   perfil em cache é sempre rotulado com o instante em que foi valido. */

function loadCachedProfile(): (UserProfile & { email?: string }) | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
      ?? sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as (UserProfile & { email?: string }) | null;
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) return null;
    /* Stubs legacy (bug antigo): perfil sem NENHUM dado identificativo
       (nome, telefone, código de convite, avatar). Era o "conta expirada
       com tudo null" que ficava cravado no dispositivo — não é fiável. */
    if (!parsed.full_name && !parsed.phone && !parsed.my_invite_code && !parsed.avatar_url) {
      try {
        localStorage.removeItem(PROFILE_CACHE_KEY);
        sessionStorage.removeItem(PROFILE_CACHE_KEY);
      } catch { /* ignore */ }
      return null;
    }
    try { localStorage.setItem(PROFILE_CACHE_KEY, raw); } catch { /* ignore */ }
    return parsed;
  } catch { return null; }
}

function saveCachedProfile(p: UserProfile) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* ignore */ }
}

/* ── Fetch do perfil com retries + refresh de token a meio ─────────────── */

async function fetchProfile(userId: string, attempt = 0): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && isSessionExpiredError(error)) {
      // Token provavelmente expirou a meio do pedido: refresca e tenta de novo.
      if (attempt < 4) {
        await ensureFreshSession({ forceRefresh: true, marginSeconds: 0 });
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
        return fetchProfile(userId, attempt + 1);
      }
      // Só encerra a sessão quando o refresh já não consegue produzir token.
      forceSessionLogout("profile_fetch_failed");
      return null;
    }
    if (error || !data) {
      // PGRST116 = row not found → profile genuinely missing, don't retry
      if ((error as any)?.code === "PGRST116") return null;
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        return fetchProfile(userId, attempt + 1);
      }
      return null;
    }
    return data as UserProfile;
  } catch {
    if (attempt < 4) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      return fetchProfile(userId, attempt + 1);
    }
    return null;
  }
}

/** Garante sessão válida (refresca se necessário) e devolve o perfil.
    null só quando não há sessão utilizável e a refresh token está morta. */
async function refreshSessionAndFetchProfile(): Promise<{ userId: string; email: string; profile: UserProfile | null; metadata: Record<string, unknown> } | null> {
  try {
    const session = await ensureFreshSession({ marginSeconds: 60 });
    if (!session?.user) return null;

    const userId = session.user.id;
    const email = session.user.email ?? "";
    const metadata = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const profile = await fetchProfile(userId);
    return { userId, email, profile, metadata };
  } catch {
    return null;
  }
}

async function updateLastSeen(userId: string) {
  try {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch { /* silently fail */ }
}

async function ensureProfileExists(
  userId: string,
  email: string,
  extraData: { full_name?: string; phone?: string; invite_code_used?: string | null },
  accessToken?: string | null
) {
  try {
    const res = await fetch(`${API_BASE}/complete-registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        email,
        full_name: extraData.full_name ?? null,
        phone: extraData.phone ?? null,
        invite_code_used: extraData.invite_code_used ?? null,
      }),
    });
    if (!res.ok) throw new Error("API error");
  } catch {
    if (!extraData.full_name && !extraData.phone) return;
    try {
      const { data: existing } = await supabase
        .from("profiles").select("id").eq("id", userId).single();
      if (existing) {
        const updates: Record<string, any> = {};
        if (extraData.full_name) updates.full_name = extraData.full_name;
        if (extraData.phone) updates.phone = extraData.phone.replace(/\D/g, "");
        if (extraData.invite_code_used !== undefined) updates.invite_code_used = extraData.invite_code_used;
        if (Object.keys(updates).length > 0)
          await supabase.from("profiles").update(updates).eq("id", userId);
      }
    } catch { /* ignore */ }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedProfile = loadCachedProfile();

  const [user, setUser] = useState<{ id: string; email: string } | null>(
    cachedProfile ? { id: cachedProfile.id, email: cachedProfile.email ?? "" } : null
  );
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile ?? null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [sessionReady, setSessionReady] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const activeUidRef = useRef<string | null>(cachedProfile?.id ?? null);
  const signedInHandledRef = useRef(false);
  const invalidatingRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // true quando esta tab chegou a ter um utilizador autenticado — só nesse
  // caso o fim de sessão deve encaminhar para /login.
  const hadAuthenticatedStateRef = useRef(Boolean(cachedProfile));

  const saveAndSet = (p: UserProfile, { persist = true } = {}) => {
    if (p.is_blocked) {
      signedInHandledRef.current = false;
      hadAuthenticatedStateRef.current = false;
      activeUidRef.current = null;
      clearCachedProfile();
      setUser(null);
      setProfile(null);
      setLoading(false);
      setIsBlocked(true);
      void terminateSession();
      return;
    }
    hadAuthenticatedStateRef.current = true;
    setIsBlocked(false);
    setProfile(p);
    // Perfis vindos de metadados (enquanto a linha real não chega) mostram-se
    // em memória mas NUNCA são guardados — só o perfil real da DB é
    // persistido. Evita que o "Utilizador / sem saldo" fique cravado no
    // dispositivo como aconteceu antes.
    if (persist) saveCachedProfile(p);
  };

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const startRealtimeProfile = (userId: string, email: string) => {
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    realtimeChannelRef.current = supabase
      .channel(`profile-realtime-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as UserProfile;
          if (updated) saveAndSet({ ...updated, email });
        }
      )
      .subscribe();
  };

  const stopRealtimeProfile = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  };

  const startHeartbeat = (userId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    updateLastSeen(userId);
    heartbeatRef.current = setInterval(() => {
      updateLastSeen(userId);
    }, 30_000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  /* ── Fim de sessão REAL (refresh token provadamente morto) ───────────
     Limpa todo o estado e encaminha para /login. Sem chamadas de rede:
     um signOut pendente nunca pode apagar uma sessão nova iniciada
     entretanto, e o utilizador nunca fica preso na conta morta. */
  const invalidateSession = () => {
    if (invalidatingRef.current) return;
    invalidatingRef.current = true;
    const wasAuthenticated = hadAuthenticatedStateRef.current;
    hadAuthenticatedStateRef.current = false;
    signedInHandledRef.current = false;
    activeUidRef.current = null;
    stopHeartbeat();
    stopRealtimeProfile();
    clearCachedProfile();
    setUser(null);
    setProfile(null);
    setIsBlocked(false);
    setLoading(false);
    setSessionReady(true);
    // Cancela a graça/watchdog: nada deve repor uma sessão que estamos a
    // encerrar por decisão própria (refresh token provadamente morto).
    cancelLoginGrace();
    clearLocalAuthStorage();
    invalidatingRef.current = false;
    if (wasAuthenticated && window.location.pathname !== "/login") {
      const target = "/login?expired=1";
      window.history.replaceState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const refreshProfile = async () => {
    try {
      const result = await refreshSessionAndFetchProfile();
      if (!result) return;
      const { userId, email, profile: data } = result;
      if (!data) return;
      if (activeUidRef.current === null || activeUidRef.current === userId) {
        activeUidRef.current = userId;
        hadAuthenticatedStateRef.current = true;
        setUser(prev => (prev?.id === userId ? prev : { id: userId, email }));
        saveAndSet({ ...data, email });
      }
    } catch { /* silently fail */ }
  };

  const forceRefresh = refreshProfile;

  /* ── Sair da conta: SEMPRE funciona, mesmo com sessão morta ──────────
     Não depende de rede: limpa o estado local primeiro, tenta avisar o
     servidor com um limite temporal, e devolve o controlo ao utilizador. */
  const signOut = async () => {
    // Cancela a graça/watchdog do login antes de mais nada.
    cancelLoginGrace();
    signedInHandledRef.current = false;
    hadAuthenticatedStateRef.current = false;
    activeUidRef.current = null;
    stopHeartbeat();
    stopRealtimeProfile();
    clearCachedProfile();
    // Limpa já as credenciais locais — o UI responde de imediato.
    setUser(null);
    setProfile(null);
    setIsBlocked(false);
    setLoading(false);
    await terminateSession("global");
  };

  // Keep balance fresh: re-fetch on window focus and every 60 s
  useEffect(() => {
    const handler = () => { refreshProfile(); };
    window.addEventListener("focus", handler);
    const iv = setInterval(handler, 60_000);
    return () => { window.removeEventListener("focus", handler); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fim de sessão real (refresh token morto, conta bloqueada, logout noutro
     dispositivo). Um 401 avulso NÃO chega aqui — só isHardAuthError. */
  useEffect(() => {
    const onSessionInvalid = () => invalidateSession();
    window.addEventListener("wm:session-invalid", onSessionInvalid);
    return () => window.removeEventListener("wm:session-invalid", onSessionInvalid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self-heal: if a user is logged in but the profile is missing (e.g. a
  // failed fetch after an expired token), retry automatically with backoff
  // instead of showing "Utilizador" with no data.
  const profileRetryRef = useRef(0);
  useEffect(() => {
    if (!user || profile || isBlocked) return;
    if (profileRetryRef.current >= 5) return;
    const delay = 1500 * Math.pow(2, profileRetryRef.current);
    const t = setTimeout(() => {
      profileRetryRef.current += 1;
      refreshProfile();
    }, delay);
    return () => clearTimeout(t);
  }, [user, profile, isBlocked]);
  // Reset the retry counter whenever the profile recovers
  useEffect(() => {
    if (profile) profileRetryRef.current = 0;
  }, [profile]);

  /* ── Sessão de longa duração: refresh proactivo ────────────────────────
     A cada 5 minutos garante que o access token está fresco. Nas abas
     ocultas o setInterval é retardado pelo browser, por isso também
     refresca sempre que a aba volta a ficar visível — o token nunca
     "envelhece" em segundo plano. */
  useEffect(() => {
    const keepAlive = () => {
      if (!activeUidRef.current) return;
      ensureFreshSession({ marginSeconds: 120 }).catch(() => {});
    };
    const iv = setInterval(keepAlive, 5 * 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") keepAlive(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initFromSession = async () => {
      try {
        // Primeiro, só leitura: existe sessão guardada no browser?
        const { data: { session: stored } } = await supabase.auth.getSession();

        if (!stored) {
          // Sem sessão em storage: visitante anónimo legítimo OU uma
          //falha ao ler o storage. Só encerra a conta se houve conta
          // activa nesta tab; caso contrário é apenas um visitante.
          if (!cancelled && hadAuthenticatedStateRef.current) invalidateSession();
          if (!cancelled) { setLoading(false); setSessionReady(true); }
          return;
        }

        // ensureFreshSession refresca o token se necessário; só sinaliza
        // fim de sessão quando o refresh token está provadamente morto.
        const session = await ensureFreshSession({ marginSeconds: 30 });

        if (!session?.user) {
          // Falha transitória de rede com token ainda válido? mantenho a conta.
          const fallback = await supabase.auth.getSession();
          if (!fallback.data.session && !cancelled) invalidateSession();
          if (!cancelled) { setLoading(false); setSessionReady(true); }
          return;
        }

        const { userId: id, email, profile: data, metadata } =
          await refreshSessionAndFetchProfile() ?? {};
        if (cancelled) return;

        if (!id) {
          // Falha transitória (perfil/rede) com token ainda válido → mantém a
          // conta degradada; o self-heal recupera. Só encerra se já não há
          // sessão utilizável em storage.
          const check = await supabase.auth.getSession();
          if (!check.data.session) invalidateSession();
          if (!cancelled) { setLoading(false); setSessionReady(true); }
          return;
        }

        if (profile && profile.id !== id) {
          clearCachedProfile();
          setProfile(null);
        }

        // User is confirmed alive — keep session state
        activeUidRef.current = id;
        hadAuthenticatedStateRef.current = true;
        setUser({ id, email: email ?? "" });

        if (data) {
          saveAndSet({ ...data, email: email ?? "" });
        } else if (profile?.id === id) {
          // If data is temporarily unavailable, keep the cached profile
          // visible — the focus/interval refresh will retry.
          saveAndSet({ ...profile, email });
        } else {
          // Auth metadata still gives the user a stable identity while the
          // profile row is being recovered. O retry automático preenche o
          // resto assim que a rede/DB responder. Não persiste (ver saveAndSet).
          saveAndSet({
            id,
            full_name: typeof metadata?.full_name === "string" ? metadata.full_name as string : null,
            email,
            phone: typeof metadata?.phone === "string" ? metadata.phone as string : null,
            avatar_url: typeof metadata?.avatar_url === "string" ? metadata.avatar_url as string : null,
            invite_code_used: null,
            my_invite_code: null,
            balance: 0,
          }, { persist: false });
        }
        signedInHandledRef.current = true;
        setLoading(false);
        setSessionReady(true);
        startHeartbeat(id);
        startRealtimeProfile(id, email ?? "");
      } catch {
        if (!cancelled) { setLoading(false); setSessionReady(true); }
      }
    };

    initFromSession();

    const safetyTimer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setSessionReady(true); }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_IN" && session?.user) {
          const { id, email = "" } = session.user;
          if (signedInHandledRef.current && activeUidRef.current === id) {
            /* Já tratámos este login — mas se o perfil ainda não chegou
               (watchdog repôs a sessão após um refresh antigo ter a apagado),
               deixar correr para re-tentar fetchProfile. */
            if (profile) return;
          }

          activeUidRef.current = id;
          hadAuthenticatedStateRef.current = true;
          if (!cancelled) setUser({ id, email });

          const pendingRaw = sessionStorage.getItem("pendingReg");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              sessionStorage.removeItem("pendingReg");
              await ensureProfileExists(id, email, {
                full_name: pending.full_name,
                phone: pending.phone,
                invite_code_used: pending.invite_code_used,
              }, session?.access_token);
            } catch { /* não crítico */ }
          }

          const data = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id) {
            if (data) {
              saveAndSet({ ...data, email });
            } else {
              /* Falha transitória a buscar a linha do perfil: mostra já a
                 identidade a partir dos metadados (sem persistir) e deixa o
                 self-heal preencher nome/telefone/saldo assim que a DB
                 responder — a conta nunca fica "tudo null". */
              const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
              saveAndSet({
                id,
                full_name: typeof meta.full_name === "string" ? meta.full_name as string : null,
                email,
                phone: typeof meta.phone === "string" ? meta.phone as string : null,
                avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url as string : null,
                invite_code_used: null,
                my_invite_code: null,
                balance: 0,
              }, { persist: false });
            }
            signedInHandledRef.current = true;
            setLoading(false);
            startHeartbeat(id);
            startRealtimeProfile(id, email);
          }

        } else if (event === "SIGNED_OUT") {
          /* Ignorar SIGNED_OUT durante a graça de login: é tipicamente um
             refresh antigo (da sessão anterior) a falhar e a apagar a
             sessão NOVA do storage. Limpar o estado aqui deixava o
             utilizador "entrado" com uma conta nula. O watchdog do
             finalizeLogin repõe a sessão e o SIGNED_IN volta a chegar. */
          if (inLoginGrace()) return;
          activeUidRef.current = null;
          signedInHandledRef.current = false;
          hadAuthenticatedStateRef.current = false;
          stopHeartbeat();
          stopRealtimeProfile();
          clearCachedProfile();
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }

        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          const { id, email = "" } = session.user;
          if (!cancelled) setUser(prev => (prev?.id === id ? prev : { id, email }));
          const data = await fetchProfile(id);
          if (!cancelled && activeUidRef.current === id && data) {
            saveAndSet({ ...data, email });
          }

        } else if (event === "USER_UPDATED" && session?.user) {
          const { id, email = "" } = session.user;
          const data = await fetchProfile(id);
          if (!cancelled && data) saveAndSet({ ...data, email });
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      stopHeartbeat();
      stopRealtimeProfile();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, sessionReady, isBlocked, refreshProfile, forceRefresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export { isHardAuthError };
