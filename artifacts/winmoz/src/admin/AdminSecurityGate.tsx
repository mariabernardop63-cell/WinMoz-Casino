import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Eye, EyeOff, AlertTriangle, Lock, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BAN_KEY = "_wmz_ban";
const SESSION_KEY = "_wmz_gate";
const DEVICE_KEY = "_wmz_did";
const MAX_ATTEMPTS = 5;
const BAN_DURATION_MS = 60 * 60 * 1000;

interface BanState {
  type: "temp" | "permanent";
  expires?: string;
  attempts: number;
  phase: number;
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    const raw = `${navigator.userAgent}_${screen.width}x${screen.height}_${Math.random()}`;
    id = btoa(encodeURIComponent(raw)).slice(0, 32);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getBanState(): BanState | null {
  try {
    const raw = localStorage.getItem(BAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BanState;
  } catch { return null; }
}

function setBanState(state: BanState | null) {
  if (!state) { localStorage.removeItem(BAN_KEY); }
  else { localStorage.setItem(BAN_KEY, JSON.stringify(state)); }
}

function isSessionAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function setSessionAuthenticated() {
  sessionStorage.setItem(SESSION_KEY, "1");
}

async function fetchSecurityPassword(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return "";
    const res = await fetch("/api/admin/security-password", {
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    if (!res.ok) return "";
    const data = await res.json() as { password?: string | null };
    return data?.password ?? "";
  } catch { return ""; }
}

async function verifyAdminServer(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    if (!res.ok) return false;
    const data = await res.json() as { isAdmin?: boolean };
    return data?.isAdmin === true;
  } catch { return false; }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export default function AdminSecurityGate({ children }: { children: React.ReactNode }) {
  const [passed, setPassed] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [ban, setBan] = useState<BanState | null>(getBanState());
  const [countdown, setCountdown] = useState<number>(0);
  const [attempts, setAttempts] = useState(0);
  const verifiedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (isSessionAuthenticated()) {
        const isAdmin = await verifyAdminServer();
        if (isAdmin) {
          verifiedRef.current = true;
          setPassed(true);
          setVerifying(false);
          return;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      setVerifying(false);
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const b = getBanState();
      if (b?.type === "temp" && b.expires) {
        const remaining = new Date(b.expires).getTime() - Date.now();
        if (remaining <= 0) {
          const nextPhase: BanState = { type: "temp", attempts: 0, phase: b.phase };
          setBanState(nextPhase);
          setBan(null);
          setAttempts(0);
        } else {
          setCountdown(remaining);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const b = getBanState();
    if (b?.type === "temp" && b.expires) {
      const remaining = new Date(b.expires).getTime() - Date.now();
      setCountdown(Math.max(0, remaining));
    }
  }, [ban]);

  const handleSubmit = useCallback(async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");

    const [correctPw, isAdmin] = await Promise.all([
      fetchSecurityPassword(),
      verifyAdminServer(),
    ]);

    if (!isAdmin) {
      setLoading(false);
      setError("Deves estar autenticado como administrador.");
      setPassword("");
      return;
    }

    const valid = correctPw
      ? password === correctPw
      : password.length >= 8;

    if (valid) {
      setBanState(null);
      setSessionAuthenticated();
      setPassed(true);
    } else {
      const currentBan = getBanState();
      const currentPhase = currentBan?.phase ?? 1;
      const currentAttempts = (currentBan?.attempts ?? 0) + 1;

      setAttempts(currentAttempts);
      setShake(true);
      setTimeout(() => setShake(false), 600);

      if (currentAttempts >= MAX_ATTEMPTS) {
        if (currentPhase >= 2) {
          const newBan: BanState = { type: "permanent", attempts: currentAttempts, phase: 2 };
          setBanState(newBan);
          setBan(newBan);
          setError("Dispositivo bloqueado permanentemente.");
        } else {
          const expires = new Date(Date.now() + BAN_DURATION_MS).toISOString();
          const newBan: BanState = { type: "temp", expires, attempts: currentAttempts, phase: 2 };
          setBanState(newBan);
          setBan(newBan);
          setCountdown(BAN_DURATION_MS);
          setError("Demasiadas tentativas. Acesso bloqueado por 1 hora.");
        }
      } else {
        const remaining = MAX_ATTEMPTS - currentAttempts;
        setBanState({ type: "temp", attempts: currentAttempts, phase: currentPhase });
        setError(`Senha incorrecta. ${remaining} tentativa${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}.`);
      }
    }

    setPassword("");
    setLoading(false);
  }, [password, loading]);

  if (verifying) {
    return (
      <div style={{ minHeight: "100dvh", width: "100%", background: "linear-gradient(135deg, #0d0618 0%, #1a0533 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(124,58,237,0.25)", borderTopColor: "#7C3AED", animation: "admin_spin 0.8s linear infinite" }} />
        <style>{`@keyframes admin_spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (passed) return <>{children}</>;

  if (ban?.type === "permanent") {
    return (
      <div style={{ minHeight: "100dvh", width: "100%", background: "linear-gradient(135deg, #0d0618 0%, #1a0533 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ maxWidth: 380, width: "100%", textAlign: "center", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 28, padding: "48px 32px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <AlertTriangle style={{ width: 32, height: 32, color: "#ef4444" }} />
          </div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>Acesso Permanentemente Bloqueado</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Este dispositivo foi bloqueado permanentemente por múltiplas tentativas de acesso não autorizado.
          </p>
          <div style={{ marginTop: 24, padding: "10px 16px", background: "rgba(239,68,68,0.08)", borderRadius: 12, fontSize: 11, color: "rgba(239,68,68,0.7)", fontFamily: "monospace" }}>
            DEVICE: {getDeviceId().slice(0, 16)}...
          </div>
        </motion.div>
      </div>
    );
  }

  if (ban?.type === "temp" && ban.expires && new Date(ban.expires).getTime() > Date.now()) {
    return (
      <div style={{ minHeight: "100dvh", width: "100%", background: "linear-gradient(135deg, #0d0618 0%, #1a0533 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ maxWidth: 380, width: "100%", textAlign: "center", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 28, padding: "48px 32px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <Clock style={{ width: 32, height: 32, color: "#f59e0b" }} />
          </div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>Acesso Temporariamente Bloqueado</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, margin: "0 0 24px" }}>Demasiadas tentativas falhadas.</p>
          <div style={{ padding: "16px 24px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 6, letterSpacing: "0.8px", textTransform: "uppercase" }}>Tempo Restante</div>
            <div style={{ color: "#f59e0b", fontSize: 28, fontWeight: 800, fontFamily: "monospace", letterSpacing: "2px" }}>{formatCountdown(countdown)}</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", width: "100%", background: "linear-gradient(135deg, #0d0618 0%, #1a0533 40%, #2d0f6b 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden" }}>
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.18, 0.1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "-15%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0 }}
        transition={shake ? { duration: 0.5 } : { duration: 0.5, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 10 }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <motion.div
            animate={{ boxShadow: ["0 0 20px rgba(124,58,237,0.3)", "0 0 40px rgba(124,58,237,0.5)", "0 0 20px rgba(124,58,237,0.3)"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 72, height: 72, borderRadius: 24, background: "linear-gradient(135deg, #7C3AED, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Shield style={{ width: 32, height: 32, color: "#fff" }} />
          </motion.div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>Acesso Restrito</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13.5, margin: 0 }}>Painel Administrativo · Winmoz</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 28, padding: "36px 28px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 100, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", marginBottom: 28, width: "fit-content" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px" }}>VERIFICAÇÃO DE 2 FACTORES ACTIVA</span>
          </div>

          <label style={{ display: "block", marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, letterSpacing: "0.5px" }}>PALAVRA-PASSE</label>

          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: `1.5px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ padding: "0 14px", color: "rgba(255,255,255,0.3)" }}><Lock style={{ width: 15, height: 15 }} /></div>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="Introduza a palavra-passe"
              autoFocus
              autoComplete="off"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "14px 0", fontFamily: "inherit" }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)" }}>
              {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 16 }}>
                <AlertTriangle style={{ width: 12, height: 12, color: "#ef4444", flexShrink: 0 }} />
                <span style={{ color: "#fca5a5", fontSize: 12 }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {attempts > 0 && attempts < MAX_ATTEMPTS && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[...Array(MAX_ATTEMPTS)].map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 100, background: i < attempts ? "#ef4444" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
              ))}
            </div>
          )}

          <motion.button onClick={handleSubmit} disabled={!password.trim() || loading}
            whileHover={{ scale: password.trim() ? 1.01 : 1 }} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: password.trim() ? "pointer" : "default", background: password.trim() ? "linear-gradient(135deg, #7C3AED, #4f46e5)" : "rgba(255,255,255,0.05)", color: password.trim() ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", boxShadow: password.trim() ? "0 8px 24px rgba(124,58,237,0.4)" : "none" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "admin_spin 0.8s linear infinite" }} />
                A verificar...
              </div>
            ) : "Entrar no Painel"}
          </motion.button>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 11, marginTop: 20 }}>
          🔒 Sessão verificada no servidor · {MAX_ATTEMPTS} tentativas máximas
        </p>
      </motion.div>
      <style>{`@keyframes admin_spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
