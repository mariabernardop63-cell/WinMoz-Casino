import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft, Gift, Star, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ─── Sectors ────────────────────────────────────────────────────────────────────
const SECTORS = [
  { label: "100",   sub: "MT",  color: "#7C3AED", darkColor: "#5B21B6", prize: 100,  type: "mt"   },
  { label: "x2",    sub: "",    color: "#EA580C", darkColor: "#C2410C", prize: 2,    type: "mult" },
  { label: "50",    sub: "MT",  color: "#6D28D9", darkColor: "#4C1D95", prize: 50,   type: "mt"   },
  { label: "x3",    sub: "",    color: "#D97706", darkColor: "#B45309", prize: 3,    type: "mult" },
  { label: "5.000", sub: "MT",  color: "#7C3AED", darkColor: "#5B21B6", prize: 5000, type: "jackpot"},
  { label: "x1.5",  sub: "",    color: "#2563EB", darkColor: "#1D4ED8", prize: 1.5,  type: "mult" },
  { label: "200",   sub: "MT",  color: "#6D28D9", darkColor: "#4C1D95", prize: 200,  type: "mt"   },
  { label: "Free",  sub: "Spin",color: "#059669", darkColor: "#047857", prize: 0,    type: "free" },
  { label: "25",    sub: "MT",  color: "#7C3AED", darkColor: "#5B21B6", prize: 25,   type: "mt"   },
  { label: "x5",    sub: "",    color: "#DC2626", darkColor: "#B91C1C", prize: 5,    type: "mult" },
  { label: "500",   sub: "MT",  color: "#6D28D9", darkColor: "#4C1D95", prize: 500,  type: "mt"   },
  { label: "10",    sub: "MT",  color: "#EA580C", darkColor: "#C2410C", prize: 10,   type: "mt"   },
];

const N = SECTORS.length;
const SLICE = 360 / N;

// ─── Web Audio Tick Sound ────────────────────────────────────────────────────────
function playTick(ctx: AudioContext, vol = 0.15, freq = 900) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch { /* ignore */ }
}

function playWin(ctx: AudioContext) {
  try {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch { /* ignore */ }
}

// ─── Wheel SVG ──────────────────────────────────────────────────────────────────
function WheelSVG({ rotation }: { rotation: number }) {
  const CX = 150, CY = 150, R = 138, INNER = 52;

  function sectorPath(i: number) {
    const startAngle = (i * SLICE - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * SLICE - 90) * (Math.PI / 180);
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const xi1 = CX + INNER * Math.cos(startAngle);
    const yi1 = CY + INNER * Math.sin(startAngle);
    const xi2 = CX + INNER * Math.cos(endAngle);
    const yi2 = CY + INNER * Math.sin(endAngle);
    return `M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${INNER} ${INNER} 0 0 0 ${xi1} ${yi1} Z`;
  }

  function textPos(i: number) {
    const midAngle = ((i + 0.5) * SLICE - 90) * (Math.PI / 180);
    const rMid = (R + INNER) / 2 + 6;
    return { x: CX + rMid * Math.cos(midAngle), y: CY + rMid * Math.sin(midAngle), angle: (i + 0.5) * SLICE - 90 };
  }

  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5C842" />
          <stop offset="60%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#8B6914" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g transform={`rotate(${rotation} ${CX} ${CY})`}>
        {/* Outer decorative ring */}
        <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#F5C842" strokeWidth={3} opacity={0.7} />
        <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#D4A017" strokeWidth={1.5} opacity={0.4} />

        {/* Sectors */}
        {SECTORS.map((s, i) => (
          <g key={i}>
            <path d={sectorPath(i)} fill={s.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
            {/* Lighter inner edge */}
            <path d={sectorPath(i)} fill={s.darkColor} stroke="none" opacity={0.4}
              style={{ transform: "scale(0.96)", transformOrigin: `${CX}px ${CY}px` }} />
          </g>
        ))}

        {/* Divider lines */}
        {SECTORS.map((_, i) => {
          const a = (i * SLICE - 90) * (Math.PI / 180);
          return (
            <line key={i}
              x1={CX + INNER * Math.cos(a)} y1={CY + INNER * Math.sin(a)}
              x2={CX + R * Math.cos(a)} y2={CY + R * Math.sin(a)}
              stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
          );
        })}

        {/* Labels */}
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

        {/* Dot decorations on ring */}
        {Array.from({ length: N * 2 }).map((_, i) => {
          const a = (i * (360 / (N * 2))) * (Math.PI / 180);
          return (
            <circle key={i} cx={CX + (R + 3) * Math.cos(a)} cy={CY + (R + 3) * Math.sin(a)}
              r={2} fill="#FFD700" opacity={0.8} />
          );
        })}
      </g>

      {/* Hub (fixed center, doesn't rotate) */}
      <circle cx={CX} cy={CY} r={INNER - 4} fill="url(#hubGrad)" />
      <circle cx={CX} cy={CY} r={INNER - 4} fill="none" stroke="#F5C842" strokeWidth={2} />
      <circle cx={CX} cy={CY} r={INNER - 14} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize={10} fontWeight="900"
        fill="#2D1810" style={{ fontFamily: "'Syne',sans-serif" }}>SPIN</text>
    </svg>
  );
}

// ─── Pointer / Arrow ────────────────────────────────────────────────────────────
function Pointer() {
  return (
    <div style={{
      position: "absolute", top: -2, left: "50%",
      transform: "translateX(-50%)",
      zIndex: 10,
      filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
    }}>
      <svg width={28} height={34} viewBox="0 0 28 34">
        <polygon points="14,34 0,0 28,0" fill="#FF4500" />
        <polygon points="14,34 0,0 28,0" fill="none" stroke="#FFD700" strokeWidth={2} />
        <circle cx={14} cy={8} r={4} fill="#FFD700" />
      </svg>
    </div>
  );
}

// ─── Prize Result Card ───────────────────────────────────────────────────────────
function PrizeCard({ sector, onClose }: { sector: typeof SECTORS[0]; onClose: () => void }) {
  const isJackpot = sector.type === "jackpot";
  const isMult = sector.type === "mult";
  const isFree = sector.type === "free";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
      <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
        style={{ width: "85%", maxWidth: 320, borderRadius: 24, overflow: "hidden",
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 60px ${sector.color}44` }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(145deg,${sector.color},${sector.darkColor})`,
          padding: "28px 24px 24px", textAlign: "center" }}>
          {isJackpot && (
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, repeat: 3 }}
              style={{ fontSize: 52, marginBottom: 8 }}>🎰</motion.div>
          )}
          {isMult && <div style={{ fontSize: 52, marginBottom: 8 }}>⚡</div>}
          {isFree && <div style={{ fontSize: 52, marginBottom: 8 }}>🎁</div>}
          {!isJackpot && !isMult && !isFree && <div style={{ fontSize: 52, marginBottom: 8 }}>💰</div>}

          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
            {isJackpot ? "JACKPOT!" : isMult ? "MULTIPLICADOR" : isFree ? "GIRO GRÁTIS" : "GANHO"}
          </p>
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900,
            fontSize: isJackpot ? 36 : 32, color: "#FFD700", lineHeight: 1 }}>
            {isFree ? "FREE SPIN" : isMult ? `x${sector.prize}` : `${sector.label} MT`}
          </p>
        </div>

        {/* Body */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "20px 24px" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 16 }}>
            {isFree ? "Um giro extra foi adicionado à tua conta!"
              : isMult ? `O teu próximo ganho será multiplicado por ${sector.prize}x!`
              : `${sector.label} MT foram adicionados ao teu saldo!`}
          </p>
          <button onClick={onClose} style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: `linear-gradient(135deg,${sector.color},${sector.darkColor})`,
            color: "#fff", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14,
            cursor: "pointer",
          }}>
            {isFree ? "Usar Giro Grátis!" : "Fantástico! 🎉"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Roulette Component ─────────────────────────────────────────────────────
export default function Roleta() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<typeof SECTORS[0] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(3);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const rotationRef = useRef(0);

  const balance = parseFloat(String(profile?.balance ?? "0"));

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function stopTicking() {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }

  const startSpin = useCallback(() => {
    if (spinning || spinsLeft <= 0) return;

    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    setSpinsLeft(s => s - 1);
    setSpinning(true);
    setResult(null);
    setShowResult(false);

    // Pick random result sector
    const targetIdx = Math.floor(Math.random() * N);
    // Total rotation: multiple full turns + offset to land on target
    // Target sector center offset from top (pointer at top)
    const targetDeg = 360 - (targetIdx * SLICE + SLICE / 2);
    const totalSpins = 5 + Math.floor(Math.random() * 4); // 5-8 full rotations
    const totalRotation = rotationRef.current + totalSpins * 360 + targetDeg;

    // Schedule ticking sounds that slow down
    const spinDuration = 4500 + Math.random() * 1500; // 4.5-6 seconds
    const ticksTotal = N * (totalSpins + 1);
    let tickCount = 0;

    function scheduleTick() {
      if (tickCount >= ticksTotal) { stopTicking(); return; }
      const progress = tickCount / ticksTotal;
      // Interval starts fast (~50ms) and slows to ~400ms
      const interval = 50 + progress * progress * 350;
      const volume = Math.max(0.04, 0.18 - progress * 0.14);
      const freq = 800 + (1 - progress) * 400;
      playTick(ctx, volume, freq);
      tickCount++;
      (tickIntervalRef.current as any) = setTimeout(scheduleTick, interval) as any;
    }
    scheduleTick();

    // Animate rotation
    setRotation(totalRotation);
    rotationRef.current = totalRotation;

    // After spin completes
    setTimeout(() => {
      stopTicking();
      setSpinning(false);
      setResult(SECTORS[targetIdx]);
      setShowResult(true);
      playWin(ctx);
    }, spinDuration);
  }, [spinning, spinsLeft]);

  useEffect(() => () => stopTicking(), []);

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", justifyContent: "center",
      background: "linear-gradient(180deg,#0D0620 0%,#1A0A35 50%,#0D0620 100%)" }}>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column",
        minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "48px 20px 16px", flexShrink: 0 }}>
          <button onClick={() => setLocation("/")} style={{
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
          {/* Balance */}
          <div style={{ padding: "6px 12px", background: "rgba(255,215,0,0.12)",
            border: "1px solid rgba(255,215,0,0.25)", borderRadius: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FFD700",
              fontFamily: "'Syne',sans-serif" }}>
              {balance.toLocaleString("pt-MZ")} MT
            </span>
          </div>
        </div>

        {/* Spins left badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
            borderRadius: 99 }}>
            <Zap style={{ width: 13, height: 13, color: "#A78BFA" }} />
            <span style={{ fontSize: 11, color: "#A78BFA", fontWeight: 700 }}>
              {spinsLeft} giro{spinsLeft !== 1 ? "s" : ""} disponível{spinsLeft !== 1 ? "is" : ""}
            </span>
          </div>
        </div>

        {/* Wheel container */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 24px" }}>
          <div style={{ width: "100%", maxWidth: 340, position: "relative" }}>
            {/* Glow ring */}
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%",
              background: "radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%)",
              pointerEvents: "none" }} />

            {/* Outer decorative ring */}
            <div style={{ position: "relative", width: "100%", paddingTop: "100%",
              borderRadius: "50%",
              boxShadow: spinning
                ? "0 0 40px rgba(124,58,237,0.6),0 0 80px rgba(124,58,237,0.3)"
                : "0 0 20px rgba(0,0,0,0.5)",
              transition: "box-shadow 0.5s" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                {/* Pointer at top */}
                <Pointer />
                {/* Wheel */}
                <div style={{
                  width: "100%", height: "100%",
                  transition: spinning ? `transform ${4.5 + 0.75}s cubic-bezier(0.17,0.67,0.12,1.0)` : "none",
                  transform: `rotate(${rotation}deg)`,
                }}>
                  <WheelSVG rotation={0} />
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

        {/* Spin button */}
        <div style={{ padding: "8px 20px 36px", flexShrink: 0 }}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={startSpin}
            disabled={spinning || spinsLeft <= 0}
            style={{
              width: "100%", height: 60, borderRadius: 99, border: "none",
              background: spinning || spinsLeft <= 0
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg,#7C3AED,#5B21B6)",
              color: spinning || spinsLeft <= 0 ? "rgba(255,255,255,0.3)" : "#fff",
              fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
              cursor: spinning || spinsLeft <= 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: spinning || spinsLeft <= 0 ? "none" : "0 4px 24px rgba(124,58,237,0.5)",
              transition: "all 0.3s",
            }}>
            {spinning ? (
              <>
                <div style={{ width: 20, height: 20, borderRadius: "50%",
                  border: "2.5px solid rgba(255,255,255,0.2)", borderTopColor: "#fff" }}
                  className="animate-spin" />
                A girar…
              </>
            ) : spinsLeft <= 0 ? (
              "Sem giros disponíveis"
            ) : (
              <>
                <Star style={{ width: 18, height: 18 }} />
                Girar Agora x{spinsLeft}
              </>
            )}
          </motion.button>

          {spinsLeft <= 0 && (
            <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => setSpinsLeft(3)}
              style={{ width: "100%", marginTop: 10, height: 44, borderRadius: 99, border: "none",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
                fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Obter mais giros
            </motion.button>
          )}
        </div>
      </div>

      {/* Prize result overlay */}
      <AnimatePresence>
        {showResult && result && (
          <PrizeCard sector={result} onClose={() => setShowResult(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
