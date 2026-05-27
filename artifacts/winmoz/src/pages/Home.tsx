import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Play, Star, ChevronRight, ArrowDownLeft, TrendingUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";

/* ─────────────────────────────────────────────
   SAQUES 24 HORAS
───────────────────────────────────────────── */
const SAQUES_POOL = [
  { id: "s1", name: "Isabel Martins", initials: "IM", bg: "from-violet-500 to-purple-700", amount: "3.500 MT", time: "agora mesmo" },
  { id: "s2", name: "Carlos Fonseca", initials: "CF", bg: "from-blue-500 to-indigo-700", amount: "12.000 MT", time: "há 1 min" },
  { id: "s3", name: "Ana Rodrigues", initials: "AR", bg: "from-emerald-500 to-teal-700", amount: "850 MT", time: "há 2 min" },
  { id: "s4", name: "Pedro Nhamposse", initials: "PN", bg: "from-orange-500 to-red-600", amount: "5.200 MT", time: "há 3 min" },
  { id: "s5", name: "Beatriz Silva", initials: "BS", bg: "from-pink-500 to-rose-700", amount: "1.750 MT", time: "há 4 min" },
  { id: "s6", name: "Miguel Chongo", initials: "MC", bg: "from-amber-500 to-yellow-600", amount: "22.000 MT", time: "há 5 min" },
  { id: "s7", name: "Lúcia Tembe", initials: "LT", bg: "from-cyan-500 to-blue-600", amount: "4.400 MT", time: "há 7 min" },
  { id: "s8", name: "Daniel Macuacua", initials: "DM", bg: "from-lime-500 to-green-700", amount: "9.800 MT", time: "há 8 min" },
];

function SaquesSection() {
  const [visible, setVisible] = useState(SAQUES_POOL.slice(0, 4));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = SAQUES_POOL[Math.floor(Math.random() * SAQUES_POOL.length)];
      const fresh = { ...next, id: next.id + Date.now(), time: "agora mesmo" };
      setVisible(prev => [fresh, ...prev.slice(0, 3)]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="px-4 py-4 mb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h2 className="font-syne font-bold text-base text-slate-900">Saques 24 Horas</h2>
          <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
            AO VIVO
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((saque) => (
            <motion.div
              key={saque.id}
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${saque.bg} flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0 shadow-md`}>
                {saque.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-syne font-bold text-slate-900 text-sm truncate">{saque.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{saque.time}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="font-syne font-extrabold text-emerald-600 text-sm">+{saque.amount}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Saque</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   LOGO
───────────────────────────────────────────── */
function WinMozLogo() {
  return (
    <div className="flex items-center">
      <svg viewBox="0 0 230 46" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D"/>
        <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18"/>
        <text x="24" y="40" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="40" letterSpacing="-1.5" fill="#0D0D0D">Poker</text>
        <circle cx="218" cy="11" r="7" stroke="#0D0D0D" strokeWidth="1.8" fill="none"/>
        <text x="214.5" y="15.5" fontFamily="'Syne', sans-serif" fontWeight="700" fontSize="9" fill="#0D0D0D">R</text>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   INTERNATIONAL DRAUGHTS ANIMATED BOARD (10×10)
───────────────────────────────────────────── */

type Piece = { id: string; row: number; col: number; color: "white" | "black" };

// Initial positions — International Draughts (10×10)
// Dark squares: (row + col) % 2 === 1
// Black: rows 0–3 (top), White: rows 6–9 (bottom)
function initPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let r = 0; r <= 3; r++) {
    for (let c = 0; c < 10; c++) {
      if ((r + c) % 2 === 1) pieces.push({ id: `b${r}${c}`, row: r, col: c, color: "black" });
    }
  }
  for (let r = 6; r <= 9; r++) {
    for (let c = 0; c < 10; c++) {
      if ((r + c) % 2 === 1) pieces.push({ id: `w${r}${c}`, row: r, col: c, color: "white" });
    }
  }
  return pieces;
}

// Legal opening move sequence (International Draughts rules)
// White moves UP (decreasing row), Black moves DOWN (increasing row)
const MOVE_SEQ: [string, number, number][] = [
  // [pieceId, targetRow, targetCol]
  ["w76", 5, 7],   // white (6,7) → (5,7) — not dark: adjust
  ["w63", 5, 4],   // white (6,3) → (5,4)
  ["b32", 4, 3],   // black (3,2) → (4,3)
  ["w74", 6, 3],   // white (7,4) → (6,3)
  ["b34", 4, 5],   // black (3,4) → (4,5)
  ["w65", 5, 6],   // white (6,5) → (5,6)
  ["b30", 4, 1],   // black (3,0) → (4,1)
  ["w78", 6, 7],   // white (7,8) → (6,7)
];

// Fix: only dark squares — recalculate valid moves
const VALID_MOVES: [string, number, number][] = [
  ["w63", 5, 2],   // white (6,3) → (5,2) ✓ dark
  ["b32", 4, 3],   // black (3,2) → (4,3) ✓ dark
  ["w65", 5, 4],   // white (6,5) → (5,4) ✓ dark
  ["b34", 4, 5],   // black (3,4) → (4,5) ✓ dark
  ["w67", 5, 6],   // white (6,7) → (5,6) ✓ dark? (5+6=11 odd ✓)
  ["b36", 4, 7],   // black (3,6) → (4,7) ✓ dark? (4+7=11 odd ✓)
];

function DamasBoard({ size = 140 }: { size?: number }) {
  const cell = size / 10;
  const [pieces, setPieces] = useState<Piece[]>(initPieces);
  const [moveIdx, setMoveIdx] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    animRef.current = setTimeout(() => {
      const [id, tr, tc] = VALID_MOVES[moveIdx % VALID_MOVES.length];
      setPieces(prev =>
        prev.map(p => p.id === id ? { ...p, row: tr, col: tc } : p)
      );
      setMoveIdx(i => i + 1);
    }, moveIdx === 0 ? 1200 : 1800);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [moveIdx]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: 6, overflow: "hidden", display: "block" }}
    >
      {/* Board squares */}
      {Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => {
          const dark = (r + c) % 2 === 1;
          return (
            <rect
              key={`sq${r}${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill={dark ? "#8B5E3C" : "#F5DEB3"}
            />
          );
        })
      )}

      {/* Board grain texture lines on dark squares */}
      {Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => {
          if ((r + c) % 2 !== 1) return null;
          return (
            <rect
              key={`gr${r}${c}`}
              x={c * cell + 1}
              y={r * cell + 1}
              width={cell - 2}
              height={cell - 2}
              fill="rgba(0,0,0,0.06)"
              rx={1}
            />
          );
        })
      )}

      {/* Pieces — use motion.g with x/y transform */}
      {pieces.map(p => {
        const px = p.col * cell + cell / 2;
        const py = p.row * cell + cell / 2;
        const r = cell * 0.36;
        const isWhite = p.color === "white";
        return (
          <motion.g
            key={p.id}
            animate={{ x: px, y: py }}
            initial={{ x: px, y: py }}
            transition={{ duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Shadow */}
            <ellipse cx={1} cy={r * 0.55} rx={r} ry={r * 0.35} fill="rgba(0,0,0,0.28)" />
            {/* Piece body */}
            <circle
              r={r}
              fill={isWhite ? "#F0EDE6" : "#2C2C2C"}
              stroke={isWhite ? "#C9BFA8" : "#111111"}
              strokeWidth={0.9}
            />
            {/* Inner ring 1 */}
            <circle
              r={r * 0.72}
              fill="none"
              stroke={isWhite ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.1)"}
              strokeWidth={0.8}
            />
            {/* Inner ring 2 */}
            <circle
              r={r * 0.46}
              fill="none"
              stroke={isWhite ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.07)"}
              strokeWidth={0.7}
            />
            {/* Highlight */}
            <circle
              cx={-r * 0.26}
              cy={-r * 0.26}
              r={r * 0.2}
              fill={isWhite ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.14)"}
            />
          </motion.g>
        );
      })}

      {/* Board border */}
      <rect x={0} y={0} width={size} height={size} fill="none" stroke="#6B3F1C" strokeWidth={2.5} rx={4}/>
      {/* Inner border */}
      <rect x={2} y={2} width={size - 4} height={size - 4} fill="none" stroke="#A0714A" strokeWidth={1} rx={3}/>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED LUDO BOARD
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   LUDO CARD ART — Variant 3 style (crown + LUDO letters)
───────────────────────────────────────────── */
function LudoBoardBase({ S, C }: { S: number; C: number }) {
  return (
    <>
      <rect width={S} height={S} fill="white" rx={2}/>
      {[6,7,8].map(c => <rect key={`v${c}`} x={c*C} y={0} width={C} height={S} fill="#F2F2F2"/>)}
      {[6,7,8].map(r => <rect key={`h${r}`} x={0} y={r*C} width={S} height={C} fill="#F2F2F2"/>)}
      <rect x={0} y={0} width={6*C} height={6*C} fill="#E63030" rx={2}/>
      <rect x={9*C} y={0} width={6*C} height={6*C} fill="#1FAB1F" rx={2}/>
      <rect x={9*C} y={9*C} width={6*C} height={6*C} fill="#F0C000" rx={2}/>
      <rect x={0} y={9*C} width={6*C} height={6*C} fill="#1E55E0" rx={2}/>
      {([[C*0.55,C*0.55],[C*9.55,C*0.55],[C*9.55,C*9.55],[C*0.55,C*9.55]] as [number,number][]).map(([x,y],i) => (
        <rect key={`sz${i}`} x={x} y={y} width={C*4.9} height={C*4.9} fill="white" rx={C*0.45}/>
      ))}
      {[1,2,3,4,5].map(c => <rect key={`rs${c}`} x={c*C+0.4} y={7*C+0.4} width={C-0.8} height={C-0.8} fill="#FF9999" rx={0.8}/>)}
      {[1,2,3,4,5].map(r => <rect key={`gs${r}`} x={7*C+0.4} y={r*C+0.4} width={C-0.8} height={C-0.8} fill="#88DD88" rx={0.8}/>)}
      {[9,10,11,12,13].map(c => <rect key={`ys${c}`} x={c*C+0.4} y={7*C+0.4} width={C-0.8} height={C-0.8} fill="#FFE066" rx={0.8}/>)}
      {[9,10,11,12,13].map(r => <rect key={`bs${r}`} x={7*C+0.4} y={r*C+0.4} width={C-0.8} height={C-0.8} fill="#88AAFF" rx={0.8}/>)}
      {([[2,6],[2,8],[6,2],[8,2],[12,6],[12,8],[6,12],[8,12]] as [number,number][]).map(([c,r],i) => (
        <text key={`st${i}`} x={c*C+C/2} y={r*C+C/2+C*0.2} textAnchor="middle" fontSize={C*0.6} fill="#BBBBBB">★</text>
      ))}
      <polygon points={`${7*C},${6*C} ${9*C},${6*C} ${7.5*C},${7.5*C}`} fill="#E63030"/>
      <polygon points={`${9*C},${6*C} ${9*C},${9*C} ${7.5*C},${7.5*C}`} fill="#F0C000"/>
      <polygon points={`${9*C},${9*C} ${6*C},${9*C} ${7.5*C},${7.5*C}`} fill="#1FAB1F"/>
      <polygon points={`${6*C},${9*C} ${6*C},${6*C} ${7.5*C},${7.5*C}`} fill="#1E55E0"/>
      <rect x={0} y={0} width={S} height={S} fill="none" stroke="#CCCCCC" strokeWidth={1} rx={2}/>
    </>
  );
}

function LudoPawns({ C, color, offX, offY }: { C: number; color: string; offX: number; offY: number }) {
  const r = C * 0.34;
  const positions: [number,number][] = [
    [offX + C*1.5, offY + C*1.5],
    [offX + C*3.7, offY + C*1.5],
    [offX + C*1.5, offY + C*3.7],
    [offX + C*3.7, offY + C*3.7],
  ];
  return (
    <>
      {positions.map(([cx, cy], i) => (
        <g key={i}>
          <ellipse cx={cx+0.5} cy={cy+r*1.8+1} rx={r*1.1} ry={r*0.45} fill="rgba(0,0,0,0.22)"/>
          <ellipse cx={cx} cy={cy+r*0.9} rx={r*0.88} ry={r*1.3} fill={color}/>
          <circle cx={cx} cy={cy-r*0.2} r={r} fill={color}/>
          <circle cx={cx-r*0.3} cy={cy-r*0.5} r={r*0.36} fill="rgba(255,255,255,0.5)"/>
        </g>
      ))}
    </>
  );
}

function LudoCardArt() {
  const S = 148;
  const C = S / 15;
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: "#0E0E18" }}>
      {/* Board background (slightly faded) */}
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${S} ${S}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, opacity: 0.75 }}
      >
        <LudoBoardBase S={S} C={C}/>
        <LudoPawns C={C} color="#CC1111" offX={0} offY={0}/>
        <LudoPawns C={C} color="#1A8E1A" offX={9*C} offY={0}/>
        <LudoPawns C={C} color="#C89900" offX={9*C} offY={9*C}/>
        <LudoPawns C={C} color="#1444BB" offX={0} offY={9*C}/>
      </svg>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(14,14,24,0.15) 0%, rgba(14,14,24,0.55) 100%)" }}/>

      {/* Gold Crown */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
          <defs>
            <linearGradient id="cg1" x1="22" y1="0" x2="22" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE566"/>
              <stop offset="55%" stopColor="#F59E0B"/>
              <stop offset="100%" stopColor="#B45309"/>
            </linearGradient>
            <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="white" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M4 28 L40 28 L40 33 L4 33 Z" rx="1" fill="url(#cg1)"/>
          <path d="M4 28 L8 10 L17 20 L22 4 L27 20 L36 10 L40 28 Z" fill="url(#cg1)"/>
          <path d="M4 28 L8 10 L17 20 L22 4 L27 20 L36 10 L40 28 Z" fill="url(#cg2)"/>
          <circle cx="22" cy="22" r="3.5" fill="#EF4444" stroke="#FFE566" strokeWidth="0.8"/>
          <circle cx="11" cy="24" r="2.2" fill="#3B82F6" stroke="#FFE566" strokeWidth="0.8"/>
          <circle cx="33" cy="24" r="2.2" fill="#22C55E" stroke="#FFE566" strokeWidth="0.8"/>
          <line x1="9" y1="12" x2="12" y2="24" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="22" y1="6" x2="22" y2="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="35" y1="12" x2="32" y2="24" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>

      {/* LUDO letters */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
        {([["L","#E63030","#FF7777"],["U","#1FAB1F","#55DD55"],["D","#1E55E0","#5588FF"],["O","#CC9900","#FFD700"]] as [string,string,string][]).map(([l,bg,bd]) => (
          <div key={l} style={{
            width: 26, height: 26, borderRadius: "50%",
            background: bg, border: `2px solid ${bd}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 13, color: "white",
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LUDO BANNER IMAGE — foto do tabuleiro com animação suave
───────────────────────────────────────────── */

function LudoBannerImage({ size = 136 }: { size?: number }) {
  return (
    <motion.div
      style={{ width: size, height: size, display: "block" }}
      animate={{
        y: [0, -7, 0],
        rotate: [4, 5.5, 4],
        scale: [1, 1.025, 1],
      }}
      transition={{
        duration: 3.2,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.5, 1],
      }}
    >
      <img
        src="/ludo-board-nobg.png"
        alt="Ludo Board"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.65)) drop-shadow(0 2px 6px rgba(167,139,250,0.35))",
        }}
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   SKELETON COMPONENTS — Airbnb-style shimmer
───────────────────────────────────────────── */

function BannerSkeleton() {
  return (
    <section className="px-4 pt-5 pb-3">
      <div
        className="relative w-full rounded-3xl overflow-hidden"
        style={{ minHeight: 190, background: "#16142a" }}
      >
        <div className="absolute inset-0 skeleton-shimmer-dark" />
        <div
          className="relative z-10 flex items-center justify-between px-5 py-6 gap-3"
          style={{ minHeight: 190 }}
        >
          {/* Left text area */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="h-5 w-36 rounded-full skeleton-shimmer-dark" style={{ borderRadius: 99 }} />
            <div className="flex flex-col gap-2">
              <div className="h-7 w-40 rounded-lg skeleton-shimmer-dark" />
              <div className="h-7 w-28 rounded-lg skeleton-shimmer-dark" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 w-36 rounded skeleton-shimmer-dark" />
              <div className="h-2.5 w-24 rounded skeleton-shimmer-dark" />
            </div>
            <div className="h-9 w-28 rounded-xl skeleton-shimmer-dark mt-1" />
          </div>
          {/* Right board area */}
          <div className="w-[136px] h-[136px] rounded-xl flex-shrink-0 skeleton-shimmer-dark" />
        </div>
        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          <div className="w-5 h-1.5 rounded-full skeleton-shimmer-dark" />
          <div className="w-1.5 h-1.5 rounded-full skeleton-shimmer-dark" />
        </div>
      </div>
    </section>
  );
}

function GameCardSkeleton() {
  return (
    <div className="min-w-[148px] flex-shrink-0 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md flex flex-col">
      <div className="h-28 w-full skeleton-shimmer" />
      <div className="p-3 flex flex-col gap-2.5">
        <div className="h-3.5 w-20 rounded skeleton-shimmer" />
        <div className="h-2.5 w-16 rounded skeleton-shimmer" />
        <div className="h-2.5 w-24 rounded skeleton-shimmer" />
        <div className="h-8 w-full rounded-lg skeleton-shimmer mt-0.5" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   BANNER CAROUSEL
───────────────────────────────────────────── */
const SLIDES = [
  {
    id: "damas",
    duration: 8000,
    bg: "linear-gradient(135deg, rgba(8,4,0,0.72) 0%, rgba(22,9,0,0.66) 40%, rgba(38,15,0,0.60) 100%)",
    bgImage: "/wood-texture.jpg" as string | null,
    accent: "#F59E0B",
    badge: "Anúncio Patrocinado",
    badgeBg: "rgba(0,0,0,0.50)",
    badgeBorder: "rgba(255,255,255,0.22)",
    badgeDot: "#F59E0B",
    badgeText: "#FFFFFF",
    subtitleColor: "rgba(255,255,255,0.82)",
    title: "Domina o\nTabuleiro?",
    subtitle: "Jogue Damas Online e multiplica o teu saldo.",
    cta: "Jogar Agora",
  },
  {
    id: "ludo",
    duration: 10000,
    bg: "linear-gradient(135deg, rgba(6,4,16,0.72) 0%, rgba(10,8,28,0.68) 40%, rgba(14,12,40,0.64) 100%)",
    bgImage: "/ludo-bg.png" as string | null,
    accent: "#A78BFA",
    badge: "Anúncio Patrocinado",
    badgeBg: "rgba(0,0,0,0.50)",
    badgeBorder: "rgba(255,255,255,0.22)",
    badgeDot: "#A78BFA",
    badgeText: "#FFFFFF",
    subtitleColor: "rgba(255,255,255,0.82)",
    title: "Jogue Ludo apostado.",
    subtitle: "Desafia rivais online e multiplica o teu saldo.",
    cta: "Jogar Agora",
  },
];

const slideIn = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 40, scale: 0.97 }),
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, scale: 0.97, transition: { duration: 0.5, ease: [0.55, 0, 1, 0.45] } }),
};

function HeroBanner() {
  const [slideIdx, setSlideIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const srcs = SLIDES.map(s => s.bgImage).filter(Boolean) as string[];
    let loaded = 0;
    const fallback = setTimeout(() => setReady(true), 900);
    srcs.forEach(src => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= 1) { clearTimeout(fallback); setReady(true); }
      };
      img.src = src;
    });
    if (srcs.length === 0) { clearTimeout(fallback); setReady(true); }
    return () => clearTimeout(fallback);
  }, []);

  const goTo = (next: number) => {
    setDir(next > slideIdx ? 1 : -1);
    setSlideIdx(next);
  };

  useEffect(() => {
    if (!ready) return;
    const slide = SLIDES[slideIdx];
    timerRef.current = setTimeout(() => {
      goTo((slideIdx + 1) % SLIDES.length);
    }, slide.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slideIdx, ready]);

  if (!ready) return <BannerSkeleton />;

  const slide = SLIDES[slideIdx];

  return (
    <section className="px-4 pt-5 pb-3">
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-2xl"
        style={{
          backgroundImage: slide.bgImage
            ? `${slide.bg}, url(${slide.bgImage})`
            : slide.bg,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: 190,
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 80% 50%, ${slide.accent}22 0%, transparent 65%)`,
            transition: "background 0.8s ease",
          }}
        />

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            variants={slideIn as any}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-10 flex items-center justify-between px-5 py-6 gap-3"
            style={{ minHeight: 190 }}
          >
            {/* LEFT: text */}
            <div className="flex-1 min-w-0">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest mb-3 uppercase border backdrop-blur-sm"
                style={{ borderColor: slide.badgeBorder, background: slide.badgeBg, color: slide.badgeText }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: slide.badgeDot }}/>
                {slide.badge}
              </div>

              {/* Title */}
              <h1
                className="font-syne font-extrabold leading-tight text-white mb-2 drop-shadow-md whitespace-pre-line"
                style={{ fontSize: slide.id === "ludo" ? "1.32rem" : "1.55rem" }}
              >
                {slide.title}
              </h1>

              {/* Subtitle */}
              <p className="text-[11px] leading-relaxed mb-4 max-w-[155px]" style={{ color: slide.subtitleColor }}>
                {slide.subtitle}
              </p>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                className="font-syne font-bold text-sm px-5 py-2 rounded-xl shadow-lg transition-all duration-200"
                style={{ background: slide.accent, color: "#000" }}
              >
                {slide.cta} →
              </motion.button>
            </div>

            {/* RIGHT: board */}
            <div className="flex-shrink-0 flex items-center justify-center">
              {slide.id === "damas" ? (
                <motion.div
                  initial={{ opacity: 0, rotate: -4, scale: 0.88 }}
                  animate={{ opacity: 1, rotate: -4, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  style={{
                    borderRadius: 10,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)",
                    border: "2px solid rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <DamasBoard size={136} />
                </motion.div>
              ) : (
                <LudoBannerImage size={136} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slide dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className="transition-all duration-400"
              style={{
                width: i === slideIdx ? 20 : 6,
                height: 6,
                borderRadius: 4,
                background: i === slideIdx ? slide.accent : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   GAME CARDS DATA
───────────────────────────────────────────── */
const games = [
  {
    id: "damas",
    name: "DAMAS",
    sub: "Jogo de Tabuleiro",
    bet: "50–5.000 MT",
    rating: "4.8",
    players: "2.4K jogando",
    image: "/damas-board.png",
    imageFit: "cover" as const,
    imagePos: "center 20%",
  },
  {
    id: "ludo",
    name: "LUDO",
    sub: "Jogo de Dados",
    bet: "20–2.000 MT",
    rating: "4.9",
    players: "4.1K jogando",
    image: "/ludo-card.jpg",
    imageFit: "contain" as const,
    imagePos: "center",
    cardBg: "#1A1A3D",
  },
  {
    id: "xadrez",
    name: "XADREZ",
    sub: "Estratégia Real",
    bet: "100–10.000 MT",
    rating: "4.7",
    players: "1.2K jogando",
    image: null,
    imageFit: "cover" as const,
    imagePos: "center",
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
};

/* ─────────────────────────────────────────────
   TOP GAMES
───────────────────────────────────────────── */
const topGames = [
  {
    id: "dc",
    name: "Damas Clássico",
    players: "4.1K apostadores ativos",
    rank: 1,
    image: "/damas-board.png",
    imagePos: "center 15%",
    from: "#1D4ED8",
    to: "#1E3A8A",
  },
  {
    id: "lt",
    name: "Ludo Turbo",
    players: "3.8K apostadores ativos",
    rank: 2,
    image: "/ludo-card.jpg",
    imagePos: "center",
    from: "#059669",
    to: "#064E3B",
  },
  {
    id: "xr",
    name: "Xadrez Rápido",
    players: "2.5K apostadores ativos",
    rank: 3,
    image: null,
    imagePos: "center",
    from: "#7C3AED",
    to: "#3B0764",
  },
  {
    id: "dp",
    name: "Damas Pro",
    players: "1.9K apostadores ativos",
    rank: 4,
    image: "/damas-board.png",
    imagePos: "center 25%",
    from: "#EA580C",
    to: "#7C2D12",
  },
];

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export default function Home() {
  const [gamesReady, setGamesReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGamesReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 w-full flex justify-center selection:bg-blue-100">
      <div className="w-full max-w-[430px] flex flex-col relative pb-24 bg-[#F8F9FA]">

        {/* TOP NAV */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3.5 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
          <WinMozLogo />
          <Link href="/login">
            <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-blue-200 hover:shadow-lg font-syne tracking-wide">
              Registar-se
            </button>
          </Link>
        </header>

        {/* HERO BANNER */}
        <HeroBanner />

        {/* JOGOS EM DESTAQUE */}
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-bold text-base text-slate-900">Jogos em Destaque</h2>
            <Link href="/jogos" className="text-blue-700 text-xs font-semibold hover:underline inline-flex items-center">
              Ver Todos <ChevronRight className="w-3 h-3 ml-0.5"/>
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pt-1 pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!gamesReady ? (
              <>
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
              </>
            ) : null}
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate={gamesReady ? "show" : "hidden"}
            className="flex gap-3 overflow-x-auto pt-1 pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ display: gamesReady ? undefined : "none" }}
          >
            {games.map((game) => (
              <motion.div
                key={game.id}
                variants={fadeUp}
                className="min-w-[148px] flex-shrink-0 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col"
              >
                <div
                  className="h-28 w-full relative overflow-hidden"
                  style={{ background: (game as any).cardBg || "#E2E8F0" }}
                >
                  {game.image ? (
                    <>
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full"
                        style={{ objectFit: game.imageFit || "cover", objectPosition: game.imagePos }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"/>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 flex items-center justify-center">
                      <svg viewBox="0 0 40 44" width="38" className="drop-shadow-xl" fill="none">
                        <rect x="10" y="34" width="20" height="4" rx="2" fill="white" fillOpacity="0.85"/>
                        <rect x="14" y="28" width="12" height="7" rx="1.5" fill="white" fillOpacity="0.85"/>
                        <rect x="16" y="20" width="8" height="10" rx="1.5" fill="white" fillOpacity="0.85"/>
                        <rect x="17" y="12" width="6" height="10" rx="1.5" fill="white" fillOpacity="0.9"/>
                        <circle cx="20" cy="8" r="4" fill="white" fillOpacity="0.9"/>
                        <rect x="17" y="4" width="6" height="6" rx="1" fill="white" fillOpacity="0.8"/>
                        <rect x="15" y="2" width="10" height="3" rx="1.5" fill="white"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400"/>
                    <span className="text-[10px] font-bold text-white">{game.rating}</span>
                  </div>
                </div>

                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-syne font-bold text-slate-900 text-sm tracking-wide">{game.name}</h3>
                  <p className="text-[10px] font-semibold text-blue-700 mt-0.5 uppercase tracking-wider">{game.bet}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 mb-3">{game.players}</p>
                  <div className="mt-auto">
                    <button className="w-full h-8 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors">
                      Jogar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* DIVIDER */}
        <div className="mx-4 border-t border-slate-200 my-1"/>

        {/* POPULARES AGORA */}
        <section className="px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-bold text-base text-slate-900">Populares Agora</h2>
            <Link href="/top" className="text-blue-700 text-xs font-semibold hover:underline inline-flex items-center">
              Ver Todos <ChevronRight className="w-3 h-3 ml-0.5"/>
            </Link>
          </div>

          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {topGames.map((game) => (
              <motion.div
                key={game.id}
                variants={fadeUp}
                className="flex items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 group shadow-sm"
              >
                {/* Thumbnail */}
                <div
                  className="w-11 h-11 rounded-xl flex-shrink-0 relative overflow-hidden shadow-md"
                  style={!game.image ? { background: `linear-gradient(135deg, ${game.from}, ${game.to})` } : {}}
                >
                  {game.image ? (
                    <>
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: game.imagePos }}
                      />
                      <div className="absolute inset-0 bg-black/15"/>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white font-syne font-bold text-sm">{game.id.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-syne font-bold text-slate-900 text-sm truncate">{game.name}</h4>
                    {game.rank === 1 && (
                      <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center flex-shrink-0">
                        <Star className="w-2 h-2 mr-0.5 fill-amber-500 text-amber-500"/> #1
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{game.players}</p>
                </div>

                <button className="w-8 h-8 rounded-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center transition-colors shadow-md flex-shrink-0">
                  <Play className="w-3.5 h-3.5 ml-0.5"/>
                </button>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* SAQUES 24 HORAS */}
        <SaquesSection />

        {/* BOTTOM NAV */}
        <BottomNav />

      </div>
    </div>
  );
}
