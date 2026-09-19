import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Star, Zap, AlertCircle, Lock, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSessionWithRefresh } from "@/lib/supabase";
import { useLocation } from "wouter";

const SECTORS = [
  { label: "100",   sub: "MT",    color: "#18181b", prize: 100,  type: "mt"      },
  { label: "200",   sub: "MT",    color: "#27272a", prize: 200,  type: "mt"      },
  { label: "50",    sub: "MT",    color: "#18181b", prize: 50,   type: "mt"      },
  { label: "25",    sub: "MT",    color: "#27272a", prize: 25,   type: "mt"      },
  { label: "10",    sub: "MT",    color: "#18181b", prize: 10,   type: "mt"      },
  { label: "5",     sub: "MT",    color: "#27272a", prize: 5,    type: "mt"      },
  { label: "1",     sub: "MT",    color: "#18181b", prize: 1,    type: "mt"      },
  { label: "5.000", sub: "MT",    color: "#09090b", prize: 5000, type: "jackpot" },
  { label: "Boa",   sub: "Sorte", color: "#3f3f46", prize: 0,    type: "luck"    },
];
const N = SECTORS.length;
const SLICE = 360 / N;
const FREE_SPINS_PER_WEEK = 3;

// ─── Audio (Web Audio API — no delay) ─────────────────────────────────────
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      sharedAudioCtx = new AC();
    }
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch { return null; }
}

function playTick(ctx: AudioContext, vol = 0.12) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle"; osc.frequency.value = 1100;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.025);
  } catch { /* ignore */ }
}

function playWin(ctx: AudioContext) {
  try {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t); osc.stop(t + 0.24);
    });
  } catch { /* ignore */ }
}

function playLose(ctx: AudioContext) {
  try {
    [400, 350].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.27);
    });
  } catch { /* ignore */ }
}

// ─── Wheel SVG ─────────────────────────────────────────────────────────────
function WheelSVG() {
  const CX = 150, CY = 150, R = 138, INNER = 52;
  function sectorPath(i: number) {
    const s0 = (i * SLICE - 90) * (Math.PI / 180);
    const e0 = ((i + 1) * SLICE - 90) * (Math.PI / 180);
    const x1 = CX + R * Math.cos(s0), y1 = CY + R * Math.sin(s0);
    const x2 = CX + R * Math.cos(e0), y2 = CY + R * Math.sin(e0);
    const xi1 = CX + INNER * Math.cos(s0), yi1 = CY + INNER * Math.sin(s0);
    const xi2 = CX + INNER * Math.cos(e0), yi2 = CY + INNER * Math.sin(e0);
    return `M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${INNER} ${INNER} 0 0 0 ${xi1} ${yi1} Z`;
  }
  function textPos(i: number) {
    const mid = ((i + 0.5) * SLICE - 90) * (Math.PI / 180);
    const rMid = (R + INNER) / 2 + 6;
    return { x: CX + rMid * Math.cos(mid), y: CY + rMid * Math.sin(mid), angle: (i + 0.5) * SLICE - 90 };
  }
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#e4e4e7" strokeWidth={3} opacity={0.6} />
      <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#d4d4d8" strokeWidth={1.5} opacity={0.3} />
      {SECTORS.map((s, i) => (
        <g key={i}>
          <path d={sectorPath(i)} fill={s.color} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        </g>
      ))}
      {SECTORS.map((_, i) => {
        const a = (i * SLICE - 90) * (Math.PI / 180);
        return <line key={i}
          x1={CX + INNER * Math.cos(a)} y1={CY + INNER * Math.sin(a)}
          x2={CX + R * Math.cos(a)} y2={CY + R * Math.sin(a)}
          stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />;
      })}
      {SECTORS.map((s, i) => {
        const { x, y, angle } = textPos(i);
        const isJackpot = s.type === "jackpot";
        return (
          <g key={i} transform={`rotate(${angle + 90} ${x} ${y})`}>
            <text x={x} y={y - (s.sub ? 5 : 1)} textAnchor="middle"
              fontSize={s.label.length > 4 ? 9 : s.label.length > 3 ? 10 : 12}
              fontWeight="800" fill={isJackpot ? "#fbbf24" : "#fafafa"}
              style={{ fontFamily: "'Syne',sans-serif" }}>
              {s.label}
            </text>
            {s.sub && (
              <text x={x} y={y + 8} textAnchor="middle" fontSize={7} fontWeight="600"
                fill={isJackpot ? "#fbbf24" : "rgba(255,255,255,0.5)"} style={{ fontFamily: "sans-serif" }}>
                {s.sub}
              </text>
            )}
          </g>
        );
      })}
      {Array.from({ length: N * 2 }).map((_, i) => {
        const a = (i * (360 / (N * 2))) * (Math.PI / 180);
        return <circle key={i} cx={CX + (R + 3) * Math.cos(a)} cy={CY + (R + 3) * Math.sin(a)}
          r={2} fill="#a1a1aa" opacity={0.6} />;
      })}
      <circle cx={CX} cy={CY} r={INNER - 4} fill="url(#hubGrad)" />
      <circle cx={CX} cy={CY} r={INNER - 4} fill="none" stroke="#d4d4d8" strokeWidth={2} />
      <circle cx={CX} cy={CY} r={INNER - 14} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize={10} fontWeight="900"
        fill="#18181b" style={{ fontFamily: "'Syne',sans-serif" }}>SPIN</text>
    </svg>
  );
}

// ─── Pointer ───────────────────────────────────────────────────────────────
function Pointer() {
  return (
    <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}>
      <svg width={24} height={30} viewBox="0 0 24 30">
        <polygon points="12,30 0,0 24,0" fill="#fafafa" />
        <polygon points="12,30 0,0 24,0" fill="none" stroke="#a1a1aa" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

// ─── Prize Modal ───────────────────────────────────────────────────────────
function PrizeModal({ sector, spinsLeft, spinNumber, onClose }: {
  sector: typeof SECTORS[0]; spinsLeft: number; spinNumber?: number; onClose: () => void
}) {
  const isJackpot = sector.type === "jackpot";
  const isLuck = sector.type === "luck";
  const isWin = !isLuck;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)", padding: 24 }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 340, borderRadius: 28,
          overflow: "hidden", background: "#fff",
          boxShadow: "0 40px 100px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.2)" }}>

        {/* Top section */}
        <div style={{ padding: "36px 28px 28px", textAlign: "center",
          background: isWin ? "#09090b" : "#f8f8f8", position: "relative" }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 16, width: 32, height: 32,
            borderRadius: 999, background: isWin ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer" }}>
            <X style={{ width: 16, height: 16, color: isWin ? "rgba(255,255,255,0.5)" : "#a1a1aa" }} />
          </button>

          {isWin && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
              style={{ width: 72, height: 72, borderRadius: 22, margin: "0 auto 18px",
                background: isJackpot
                  ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                  : "linear-gradient(135deg, #22c55e, #16a34a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isJackpot
                  ? "0 8px 32px rgba(251,191,36,0.4)"
                  : "0 8px 32px rgba(34,197,94,0.35)" }}>
              {isJackpot ? (
                <Star style={{ width: 36, height: 36, color: "#fff" }} fill="#fff" />
              ) : (
                <Check style={{ width: 36, height: 36, color: "#fff" }} strokeWidth={3} />
              )}
            </motion.div>
          )}

          {!isWin && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
              style={{ width: 72, height: 72, borderRadius: 22, margin: "0 auto 18px",
                background: "#e4e4e7",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 32 }}>🍀</span>
            </motion.div>
          )}

          <motion.p
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3,
              textTransform: "uppercase", color: isWin ? "rgba(255,255,255,0.35)" : "#a1a1aa",
              marginBottom: 8 }}>
            {isJackpot ? "JACKPOT" : isLuck ? "SEM PRÉMIO" : "PRÉMIO GANHO"}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 20 }}
            style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, lineHeight: 1.1,
              fontSize: isJackpot ? 40 : isLuck ? 24 : 34,
              color: isWin ? "#fff" : "#18181b", letterSpacing: -0.5 }}>
            {isLuck ? "Boa Sorte!" : `${sector.label} MT`}
          </motion.p>
        </div>

        {/* Bottom section */}
        <div style={{ padding: "20px 28px 28px", textAlign: "center" }}>
          <p style={{ fontSize: 13.5, color: "#71717a", lineHeight: 1.65, marginBottom: 20 }}>
            {isLuck
              ? "Desta vez não saiu prémio. Tenta de novo!"
              : isJackpot
              ? "Parabéns! Prémio máximo creditado na tua conta."
              : `+${sector.label} MT adicionados ao teu saldo.`}
          </p>

          {spinNumber && (
            <p style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 10, fontWeight: 600 }}>
              Giro {spinNumber}/3
            </p>
          )}

          {spinsLeft > 0 && (
            <p style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 16, fontWeight: 600 }}>
              {spinsLeft} giro{spinsLeft > 1 ? "s" : ""} gratuito{spinsLeft > 1 ? "s" : ""} restante{spinsLeft > 1 ? "s" : ""} esta semana
            </p>
          )}

          <button onClick={onClose} style={{
            width: "100%", height: 52, borderRadius: 16, border: "none", cursor: "pointer",
            background: isWin ? "#09090b" : "#18181b",
            color: "#fff",
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            transition: "transform 0.15s",
          }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
          onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
            {isLuck ? "Fechar" : "Continuar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────
function SpinnerIcon() {
  return (
    <div style={{ width: 18, height: 18, borderRadius: "50%",
      border: "2.5px solid rgba(255,255,255,0.2)", borderTopColor: "#fff",
      animation: "spin 0.7s linear infinite" }} />
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Roleta() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<typeof SECTORS[0] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [statusChecked, setStatusChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBalance, setLocalBalance] = useState<number | null>(null);
  const [spinNumberResult, setSpinNumberResult] = useState<number | undefined>(undefined);

  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationRef = useRef(0);
  const suppressBalanceSyncRef = useRef(false);

  const profileBalance = parseFloat(String(profile?.balance ?? "0"));
  const balance = localBalance ?? profileBalance;

  useEffect(() => {
    if (!suppressBalanceSyncRef.current) setLocalBalance(profileBalance);
  }, [profile?.balance]);

  useEffect(() => {
    if (!profile?.id) return;
    void checkFreeSpinStatus();
  }, [profile?.id]);

  async function checkFreeSpinStatus() {
    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) return;
      const res = await fetch("/api/roleta/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSpinsLeft(data.spinsLeft ?? 0);
      }
    } catch {
      setSpinsLeft(0);
    } finally {
      setStatusChecked(true);
    }
  }

  function stopTicking() {
    if (tickTimerRef.current) { clearTimeout(tickTimerRef.current); tickTimerRef.current = null; }
  }

  const animateToSector = useCallback((targetIdx: number, isWin: boolean, prize: number, onComplete: () => void) => {
    const ctx = getAudioCtx();

    const currentAngleMod = ((rotationRef.current % 360) + 360) % 360;
    const rawTarget = ((360 - (targetIdx * SLICE + SLICE / 2)) % 360 + 360) % 360;
    const targetDeg = ((rawTarget - currentAngleMod) % 360 + 360) % 360;
    const totalSpins = 5 + Math.floor(Math.random() * 4);
    const totalRotation = rotationRef.current + totalSpins * 360 + targetDeg;
    const duration = 4000 + Math.random() * 1000;

    setSpinDuration(duration);
    setRotation(totalRotation);
    rotationRef.current = totalRotation;

    /* Update balance immediately when spinning starts (if prize > 0) */
    if (prize > 0) {
      suppressBalanceSyncRef.current = true;
      setLocalBalance(prev => (prev ?? 0) + prize);
    }

    if (ctx) {
      const totalTicks = Math.floor(duration / 60);
      let tickCount = 0;
      function scheduleNextTick() {
        if (tickCount >= totalTicks) return;
        const progress = tickCount / totalTicks;
        const interval = 40 + progress * progress * 300;
        playTick(ctx!, Math.max(0.03, 0.14 - progress * 0.11));
        tickCount++;
        tickTimerRef.current = setTimeout(scheduleNextTick, interval);
      }
      scheduleNextTick();
    }

    setTimeout(() => {
      stopTicking();
      if (ctx) {
        if (isWin) playWin(ctx); else playLose(ctx);
      }
      onComplete();
    }, duration);
  }, []);

  useEffect(() => () => stopTicking(), []);

  const startSpin = async () => {
    if (loading || animating) return;
    if (!profile?.id) { setError("Precisas de estar autenticado para jogar."); return; }
    if (spinsLeft <= 0) { setError("Sem giros gratuitos esta semana."); return; }

    const ctx = getAudioCtx();
    if (ctx?.state === "suspended") ctx.resume();

    setError(null);
    setShowResult(false);
    setResult(null);
    setSpinNumberResult(undefined);
    setLoading(true);

    try {
      const session = await getSessionWithRefresh();
      if (!session?.access_token) { setLoading(false); return; }

      const res = await fetch("/api/roleta/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ isFree: true }),
      });

      let data: { sectorIndex?: number; prize?: number; newBalance?: number; spinsLeft?: number; spinNumber?: number; error?: string };
      try { data = await res.json(); } catch {
        setError("Resposta inválida do servidor."); setLoading(false); return;
      }

      if (!res.ok) { setError(data.error ?? "Erro ao processar."); setLoading(false); return; }

      const sectorIndex = data.sectorIndex ?? 8;
      const prize = data.prize ?? 0;
      const newBalance = data.newBalance ?? 0;
      const isWin = prize > 0;
      const remainingSpins = data.spinsLeft ?? Math.max(0, spinsLeft - 1);

      setLoading(false);
      setSpinsLeft(remainingSpins);
      setAnimating(true);

      animateToSector(sectorIndex, isWin, prize, () => {
        setAnimating(false);
        /* Sync with server balance */
        suppressBalanceSyncRef.current = false;
        setLocalBalance(newBalance);
        setResult(SECTORS[sectorIndex]);
        setShowResult(true);
        setSpinNumberResult(data.spinNumber);
      });

    } catch {
      setError("Erro de rede. Verifica a tua ligação.");
      setLoading(false);
    }
  };

  const isBusy = loading || animating;

  if (!profile && statusChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fafafa", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <Lock style={{ width: 44, height: 44, color: "#a1a1aa", margin: "0 auto 16px" }} />
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: "#18181b", marginBottom: 8 }}>
            Precisa de conta
          </p>
          <p style={{ color: "#71717a", fontSize: 13, marginBottom: 20 }}>
            Faz login para jogar na Roleta da Sorte.
          </p>
          <button onClick={() => setLocation("/login")} style={{
            background: "#09090b", color: "#fff", border: "none", borderRadius: 14,
            padding: "13px 32px", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14,
            cursor: "pointer" }}>Fazer Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", justifyContent: "center",
      background: "#fafafa" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "48px 20px 16px", flexShrink: 0 }}>
          <button onClick={() => window.history.back()} style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#fff", border: "1px solid #e4e4e7",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#18181b" }} />
          </button>
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 16,
            color: "#18181b", letterSpacing: 4 }}>
            ROLETA
          </p>
          <div style={{ padding: "7px 14px", background: "#09090b", borderRadius: 20,
            display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff",
              fontFamily: "'Syne',sans-serif" }}>
              {Number(balance).toLocaleString("pt-MZ", { minimumFractionDigits: 2 })} MT
            </span>
          </div>
        </div>

        {/* Spins left badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          {statusChecked && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
              background: spinsLeft > 0 ? "#f0fdf4" : "#f4f4f5",
              border: `1px solid ${spinsLeft > 0 ? "#bbf7d0" : "#e4e4e7"}`, borderRadius: 99 }}>
              <Zap style={{ width: 13, height: 13, color: spinsLeft > 0 ? "#16a34a" : "#a1a1aa" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: spinsLeft > 0 ? "#15803d" : "#71717a" }}>
                {spinsLeft > 0
                  ? `${spinsLeft} giro${spinsLeft > 1 ? "s" : ""} gratuit${spinsLeft > 1 ? "os" : "o"} restante${spinsLeft > 1 ? "s" : ""}`
                  : "Giros esgotados esta semana"}
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: "0 20px 8px", padding: "10px 14px", borderRadius: 12,
                background: "#fef2f2", border: "1px solid #fecaca",
                display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle style={{ width: 15, height: 15, color: "#dc2626", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.4 }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wheel */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 24px" }}>
          <div style={{ width: "100%", maxWidth: 320, position: "relative" }}>
            <div style={{ position: "absolute", inset: -16, borderRadius: "50%",
              background: "radial-gradient(circle,rgba(0,0,0,0.04) 0%,transparent 70%)",
              pointerEvents: "none" }} />
            <div style={{ position: "relative", width: "100%", paddingTop: "100%",
              borderRadius: "50%",
              boxShadow: animating
                ? "0 0 40px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.1)"
                : "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
              border: "3px solid #e4e4e7",
              transition: "box-shadow 0.5s" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <Pointer />
                <div style={{
                  width: "100%", height: "100%",
                  transition: animating
                    ? `transform ${(spinDuration / 1000).toFixed(2)}s cubic-bezier(0.17,0.67,0.12,1.0)`
                    : "none",
                  transform: `rotate(${rotation}deg)`,
                }}>
                  <WheelSVG />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spin Button */}
        <div style={{ padding: "12px 20px 40px", flexShrink: 0 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startSpin}
            disabled={isBusy || spinsLeft <= 0}
            style={{
              width: "100%", height: 60, borderRadius: 18, border: "none",
              background: (isBusy || spinsLeft <= 0) ? "#e4e4e7" : "#09090b",
              color: (isBusy || spinsLeft <= 0) ? "#a1a1aa" : "#fff",
              fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
              cursor: (isBusy || spinsLeft <= 0) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: (isBusy || spinsLeft <= 0) ? "none" : "0 8px 28px rgba(0,0,0,0.18)",
              transition: "all 0.2s",
            }}>
            {loading ? <><SpinnerIcon /> A processar…</>
              : animating ? <><SpinnerIcon /> A girar…</>
              : spinsLeft <= 0 ? "Sem giros esta semana"
              : <><Zap style={{ width: 18, height: 18 }} /> Girar Grátis ({spinsLeft} restante{spinsLeft > 1 ? "s" : ""})</>}
          </motion.button>
        </div>
      </div>

      {/* Result overlay */}
      <AnimatePresence>
        {showResult && result && (
          <PrizeModal
            sector={result}
            spinsLeft={spinsLeft}
            spinNumber={spinNumberResult}
            onClose={() => {
              setShowResult(false);
              void refreshProfile();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
