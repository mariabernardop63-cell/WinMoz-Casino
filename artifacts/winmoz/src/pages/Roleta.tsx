import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Star, Zap, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

// ─── Sectors ─────────────────────────────────────────────────────────────────
// IMPORTANT: indices must match server-side logic:
// 5 = "5 MT", 6 = "1 MT", 8 = "Boa Sorte"
const SECTORS = [
  { label: "100",   sub: "MT",    color: "#7C3AED", darkColor: "#5B21B6", prize: 100,  type: "mt"      },
  { label: "200",   sub: "MT",    color: "#DC2626", darkColor: "#B91C1C", prize: 200,  type: "mt"      },
  { label: "50",    sub: "MT",    color: "#6D28D9", darkColor: "#4C1D95", prize: 50,   type: "mt"      },
  { label: "25",    sub: "MT",    color: "#EA580C", darkColor: "#C2410C", prize: 25,   type: "mt"      },
  { label: "10",    sub: "MT",    color: "#7C3AED", darkColor: "#5B21B6", prize: 10,   type: "mt"      },
  { label: "5",     sub: "MT",    color: "#2563EB", darkColor: "#1D4ED8", prize: 5,    type: "mt"      },
  { label: "1",     sub: "MT",    color: "#6D28D9", darkColor: "#4C1D95", prize: 1,    type: "mt"      },
  { label: "5.000", sub: "MT",    color: "#059669", darkColor: "#047857", prize: 5000, type: "jackpot" },
  { label: "Boa",   sub: "Sorte", color: "#6B7280", darkColor: "#4B5563", prize: 0,    type: "luck"    },
];
const N = SECTORS.length;
const SLICE = 360 / N;

// ─── Audio ───────────────────────────────────────────────────────────────────
function playTick(ctx: AudioContext, vol = 0.15, freq = 900) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04);
  } catch { /* ignore */ }
}
function playWin(ctx: AudioContext) {
  try {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    });
  } catch { /* ignore */ }
}

// ─── Wheel SVG ───────────────────────────────────────────────────────────────
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
          <stop offset="0%" stopColor="#F5C842" />
          <stop offset="60%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#8B6914" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#F5C842" strokeWidth={3} opacity={0.7} />
      <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#D4A017" strokeWidth={1.5} opacity={0.4} />
      {SECTORS.map((s, i) => (
        <g key={i}>
          <path d={sectorPath(i)} fill={s.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
          <path d={sectorPath(i)} fill={s.darkColor} stroke="none" opacity={0.4}
            style={{ transform: "scale(0.96)", transformOrigin: `${CX}px ${CY}px` }} />
        </g>
      ))}
      {SECTORS.map((_, i) => {
        const a = (i * SLICE - 90) * (Math.PI / 180);
        return <line key={i}
          x1={CX + INNER * Math.cos(a)} y1={CY + INNER * Math.sin(a)}
          x2={CX + R * Math.cos(a)} y2={CY + R * Math.sin(a)}
          stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />;
      })}
      {SECTORS.map((s, i) => {
        const { x, y, angle } = textPos(i);
        return (
          <g key={i} transform={`rotate(${angle + 90} ${x} ${y})`}>
            <text x={x} y={y - (s.sub ? 5 : 1)} textAnchor="middle"
              fontSize={s.label.length > 4 ? 9 : s.label.length > 3 ? 10 : 12}
              fontWeight="800" fill="white"
              style={{ fontFamily: "'Syne',sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {s.label}
            </text>
            {s.sub && (
              <text x={x} y={y + 8} textAnchor="middle" fontSize={7} fontWeight="600"
                fill="rgba(255,255,255,0.75)" style={{ fontFamily: "sans-serif" }}>
                {s.sub}
              </text>
            )}
          </g>
        );
      })}
      {Array.from({ length: N * 2 }).map((_, i) => {
        const a = (i * (360 / (N * 2))) * (Math.PI / 180);
        return <circle key={i} cx={CX + (R + 3) * Math.cos(a)} cy={CY + (R + 3) * Math.sin(a)}
          r={2} fill="#FFD700" opacity={0.8} />;
      })}
      <circle cx={CX} cy={CY} r={INNER - 4} fill="url(#hubGrad)" />
      <circle cx={CX} cy={CY} r={INNER - 4} fill="none" stroke="#F5C842" strokeWidth={2} />
      <circle cx={CX} cy={CY} r={INNER - 14} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize={10} fontWeight="900"
        fill="#2D1810" style={{ fontFamily: "'Syne',sans-serif" }}>SPIN</text>
    </svg>
  );
}

// ─── Pointer ─────────────────────────────────────────────────────────────────
function Pointer() {
  return (
    <div style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>
      <svg width={28} height={34} viewBox="0 0 28 34">
        <polygon points="14,34 0,0 28,0" fill="#FF4500" />
        <polygon points="14,34 0,0 28,0" fill="none" stroke="#FFD700" strokeWidth={2} />
        <circle cx={14} cy={8} r={4} fill="#FFD700" />
      </svg>
    </div>
  );
}

// ─── Prize Card ───────────────────────────────────────────────────────────────
function PrizeCard({ sector, isFreeSpin, onClose }: {
  sector: typeof SECTORS[0]; isFreeSpin: boolean; onClose: () => void
}) {
  const isJackpot = sector.type === "jackpot";
  const isLuck = sector.type === "luck";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex",
        alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 430, borderRadius: "20px 20px 0 0",
          overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none",
          boxShadow: `0 -12px 40px rgba(0,0,0,0.5), 0 0 40px ${sector.color}25` }}>
        <div style={{ background: `linear-gradient(120deg,${sector.color} 0%,${sector.darkColor} 100%)`,
          padding: "18px 22px 16px", display: "flex", alignItems: "center", gap: 14,
          position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "-20%", width: "50%", height: "100%",
            background: "linear-gradient(105deg,transparent,rgba(255,255,255,0.1),transparent)",
            transform: "skewX(-15deg)", pointerEvents: "none" }} />
          <motion.div
            animate={isJackpot ? { rotate: [0, 10, -10, 5, -5, 0], scale: [1, 1.1, 1] }
              : isLuck ? { opacity: [1, 0.55, 1] } : { y: [0, -2, 0] }}
            transition={{ duration: isJackpot ? 0.6 : 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: "rgba(0,0,0,0.22)", border: "1.5px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isLuck && (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
                <path d="M12 7v5.5l3.5 2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {!isJackpot && !isLuck && (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.5" fill="rgba(255,215,0,0.18)" stroke="#FFD700" strokeWidth="1.5"/>
                <path d="M12 7.5v9M8.5 12h7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            {isJackpot && (
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
                  fill="rgba(255,215,0,0.4)" stroke="#FFD700" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            )}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 3,
              textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>
              {isJackpot ? "JACKPOT" : isLuck ? "SEM PRÉMIO" : "GANHO"}
            </p>
            <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, lineHeight: 1,
              fontSize: isJackpot ? 26 : isLuck ? 20 : 24, color: "#fff", letterSpacing: -0.3 }}>
              {isLuck ? "Boa Sorte!" : `${sector.label} ${sector.sub}`}
            </p>
            {isFreeSpin && isLuck && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                Giro grátis usado — aposta para ganhar!
              </p>
            )}
          </div>
        </div>
        <div style={{ background: "rgba(8,10,18,0.97)", padding: "14px 18px 22px",
          display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>
            {isLuck
              ? isFreeSpin
                ? "O teu giro grátis acabou. Paga 5 MT para continuar a jogar!"
                : "Desta vez não. Tenta de novo!"
              : isJackpot
              ? "Parabéns! Prémio máximo creditado na tua conta."
              : `+${sector.label} MT adicionados ao teu saldo.`}
          </p>
          <button onClick={onClose} style={{
            height: 44, paddingLeft: 20, paddingRight: 20, borderRadius: 12, border: "none",
            flexShrink: 0, cursor: "pointer",
            background: isLuck ? "rgba(255,255,255,0.08)"
              : `linear-gradient(135deg,${sector.color},${sector.darkColor})`,
            color: "#fff", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
            boxShadow: isLuck ? "none" : `0 4px 14px ${sector.color}50`,
          }}>
            {isLuck ? "Fechar" : "Continuar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Spinner icon ─────────────────────────────────────────────────────────────
function SpinnerIcon() {
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%",
      border: "2.5px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
      animation: "spin 0.75s linear infinite" }} />
  );
}

// ─── Main Roulette Component ──────────────────────────────────────────────────
const PAID_SPIN_COST = 5;

export default function Roleta() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(5000);
  const [loading, setLoading] = useState(false);     // API call in progress
  const [animating, setAnimating] = useState(false); // wheel animation in progress
  const [result, setResult] = useState<typeof SECTORS[0] | null>(null);
  const [wasFreeSpin, setWasFreeSpin] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [freeSpinAvailable, setFreeSpinAvailable] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBalance, setLocalBalance] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationRef = useRef(0);

  const profileBalance = parseFloat(String(profile?.balance ?? "0"));
  const balance = localBalance ?? profileBalance;

  useEffect(() => { setLocalBalance(profileBalance); }, [profile?.balance]);

  // Check free spin status from server on mount (uses server Mozambique time)
  useEffect(() => {
    if (!profile?.id) return;
    void checkFreeSpinStatus();
  }, [profile?.id]);

  async function checkFreeSpinStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/roleta/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFreeSpinAvailable(Boolean(data.freeSpinAvailable));
      }
    } catch {
      setFreeSpinAvailable(false);
    } finally {
      setStatusChecked(true);
    }
  }

  function getAudioCtx(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        audioCtxRef.current = new AC();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }

  function stopTicking() {
    if (tickTimerRef.current) { clearTimeout(tickTimerRef.current); tickTimerRef.current = null; }
  }

  // Animate wheel to a specific sector index, then call onComplete
  const animateToSector = useCallback((targetIdx: number, onComplete: () => void) => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") { void ctx.resume(); }

    const currentAngleMod = ((rotationRef.current % 360) + 360) % 360;
    const rawTarget = ((360 - (targetIdx * SLICE + SLICE / 2)) % 360 + 360) % 360;
    const targetDeg = ((rawTarget - currentAngleMod) % 360 + 360) % 360;
    const totalSpins = 5 + Math.floor(Math.random() * 4);
    const totalRotation = rotationRef.current + totalSpins * 360 + targetDeg;
    const duration = 4500 + Math.random() * 1200;

    setSpinDuration(duration);
    setRotation(totalRotation);
    rotationRef.current = totalRotation;

    // Ticking audio (only if AudioContext is available)
    if (ctx) {
      const ticksTotal = N * (totalSpins + 1);
      let tickCount = 0;
      function scheduleTick() {
        if (tickCount >= ticksTotal) { stopTicking(); return; }
        const progress = tickCount / ticksTotal;
        const interval = 50 + progress * progress * 350;
        playTick(ctx!, Math.max(0.04, 0.18 - progress * 0.14), 800 + (1 - progress) * 400);
        tickCount++;
        tickTimerRef.current = setTimeout(scheduleTick, interval);
      }
      scheduleTick();
    }

    setTimeout(() => {
      stopTicking();
      if (ctx) playWin(ctx);
      onComplete();
    }, duration);
  }, []);

  useEffect(() => () => stopTicking(), []);

  const startSpin = async (isFree: boolean) => {
    if (loading || animating) return;
    if (!profile?.id) { setError("Precisas de estar autenticado para jogar."); return; }

    setError(null);
    setShowResult(false);
    setResult(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faz login novamente.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/roleta/spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ isFree }),
      });

      let data: { sectorIndex?: number; prize?: number; newBalance?: number; error?: string };
      try {
        data = await res.json();
      } catch {
        setError("Resposta inválida do servidor. Tenta novamente.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Erro ao processar. Tenta novamente.");
        setLoading(false);
        return;
      }

      const sectorIndex = data.sectorIndex ?? 8;
      const newBalance = data.newBalance ?? 0;

      if (isFree) setFreeSpinAvailable(false);

      setLoading(false);
      setAnimating(true);

      try {
        animateToSector(sectorIndex, () => {
          setAnimating(false);
          setLocalBalance(newBalance);
          setWasFreeSpin(isFree);
          setResult(SECTORS[sectorIndex]);
          setShowResult(true);
          void refreshProfile();
        });
      } catch {
        // Animação falhou mas o spin foi processado — mostra resultado na mesma
        setAnimating(false);
        setLocalBalance(newBalance);
        setWasFreeSpin(isFree);
        setResult(SECTORS[sectorIndex]);
        setShowResult(true);
        void refreshProfile();
      }

    } catch {
      setError("Erro de rede. Verifica a tua ligação e tenta novamente.");
      setLoading(false);
    }
  };

  const isBusy = loading || animating;

  // Not logged in
  if (!profile && statusChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(180deg,#0D0620 0%,#1A0A35 50%,#0D0620 100%)", padding: 24 }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <Lock style={{ width: 48, height: 48, color: "#A78BFA", margin: "0 auto 16px" }} />
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            Precisa de conta
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
            Faz login para jogar na Roleta da Sorte.
          </p>
          <button onClick={() => setLocation("/login")} style={{
            background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff",
            border: "none", borderRadius: 12, padding: "12px 28px",
            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>Fazer Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", justifyContent: "center",
      background: "linear-gradient(180deg,#0D0620 0%,#1A0A35 50%,#0D0620 100%)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "48px 20px 16px", flexShrink: 0 }}>
          <button onClick={() => window.history.back()} style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 18,
            color: "#fff", letterSpacing: 4, textShadow: "0 0 24px rgba(124,58,237,0.8)" }}>
            ROLETA
          </p>
          <div style={{ padding: "6px 12px", background: "rgba(255,215,0,0.12)",
            border: "1px solid rgba(255,215,0,0.25)", borderRadius: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FFD700",
              fontFamily: "'Syne',sans-serif" }}>
              {balance.toLocaleString("pt-MZ")} MT
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          {statusChecked && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: freeSpinAvailable ? "rgba(124,58,237,0.15)" : "rgba(255,215,0,0.10)",
              border: `1px solid ${freeSpinAvailable ? "rgba(124,58,237,0.35)" : "rgba(255,215,0,0.25)"}`,
              borderRadius: 99 }}>
              <Zap style={{ width: 13, height: 13,
                color: freeSpinAvailable ? "#A78BFA" : "#FFD700" }} />
              <span style={{ fontSize: 11, fontWeight: 700,
                color: freeSpinAvailable ? "#A78BFA" : "#FFD700" }}>
                {freeSpinAvailable
                  ? "1 giro grátis disponível hoje!"
                  : `Apostar · 5 MT por giro`}
              </span>
            </div>
          )}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: "0 20px 8px", padding: "10px 14px", borderRadius: 12,
                background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)",
                display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#f87171", lineHeight: 1.4 }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wheel */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 24px" }}>
          <div style={{ width: "100%", maxWidth: 340, position: "relative" }}>
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%",
              background: "radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%)",
              pointerEvents: "none" }} />
            <div style={{ position: "relative", width: "100%", paddingTop: "100%",
              borderRadius: "50%",
              boxShadow: animating
                ? "0 0 40px rgba(124,58,237,0.6),0 0 80px rgba(124,58,237,0.3)"
                : "0 0 20px rgba(0,0,0,0.5)",
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

        {/* Prize legend */}
        <div style={{ padding: "12px 20px", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {SECTORS.filter((_, i) => i < 6).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "5px 8px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                  {s.label}{s.sub ? ` ${s.sub}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Spin buttons */}
        <div style={{ padding: "8px 20px 36px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Free spin button — only if available */}
          {statusChecked && freeSpinAvailable && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => startSpin(true)}
              disabled={isBusy}
              style={{
                width: "100%", height: 56, borderRadius: 99, border: "none",
                background: isBusy ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#7C3AED,#5B21B6)",
                color: isBusy ? "rgba(255,255,255,0.3)" : "#fff",
                fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15,
                cursor: isBusy ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: isBusy ? "none" : "0 4px 24px rgba(124,58,237,0.45)",
                transition: "all 0.3s",
              }}>
              {loading ? <><SpinnerIcon /> A processar…</> : animating ? <><SpinnerIcon /> A girar…</> : (
                <><Zap style={{ width: 16, height: 16 }} /> Giro Grátis (1 por dia)</>
              )}
            </motion.button>
          )}

          {/* Paid spin button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => startSpin(false)}
            disabled={isBusy || balance < PAID_SPIN_COST}
            style={{
              width: "100%", height: 60, borderRadius: 99, border: "none",
              background: (isBusy || balance < PAID_SPIN_COST)
                ? "rgba(255,255,255,0.06)"
                : "linear-gradient(135deg,#B8860B,#D4A35A)",
              color: (isBusy || balance < PAID_SPIN_COST) ? "rgba(255,255,255,0.3)" : "#fff",
              fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
              cursor: (isBusy || balance < PAID_SPIN_COST) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: (isBusy || balance < PAID_SPIN_COST) ? "none" : "0 4px 24px rgba(212,163,90,0.45)",
              transition: "all 0.3s",
            }}>
            {loading ? <><SpinnerIcon /> A processar…</>
              : animating ? <><SpinnerIcon /> A girar…</>
              : balance < PAID_SPIN_COST ? "Saldo insuficiente (mínimo 5 MT)"
              : <><Star style={{ width: 18, height: 18 }} /> Girar por {PAID_SPIN_COST} MT</>}
          </motion.button>

          {/* Info line */}
          {statusChecked && !freeSpinAvailable && (
            <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)",
              marginTop: 2, lineHeight: 1.5 }}>
              Giro grátis diário já utilizado. Volta amanhã para mais um!
            </p>
          )}
        </div>
      </div>

      {/* Prize overlay */}
      <AnimatePresence>
        {showResult && result && (
          <PrizeCard
            sector={result}
            isFreeSpin={wasFreeSpin}
            onClose={() => setShowResult(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
