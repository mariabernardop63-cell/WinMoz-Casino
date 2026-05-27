import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Play, Home as HomeIcon, Gamepad2, Wallet, User, Star, ChevronRight, ArrowDownLeft, TrendingUp } from "lucide-react";

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

// 50-square Ludo track (col, row) — clockwise from blue exit
const LUDO_TRACK: [number, number][] = [
  [1,8],[1,7],[1,6],
  [2,5],[3,5],[4,5],[5,5],
  [6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,5],[10,5],[11,5],[12,5],[13,5],
  [13,6],[13,7],[13,8],
  [13,9],[12,9],[11,9],[10,9],[9,9],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  [5,9],[4,9],[3,9],[2,9],[1,9],
];

const PIECE_COLORS = ["#EF4444","#22C55E","#EAB308","#818CF8"];
const PIECE_START = [0, 12, 25, 37]; // staggered start positions on track

function LudoBoard({ size = 140 }: { size?: number }) {
  const C = size / 15;
  const [step, setStep] = useState(0);
  const [diceVal, setDiceVal] = useState(5);
  const [diceSpin, setDiceSpin] = useState(false);

  // Advance pieces every 480ms
  useEffect(() => {
    const t = setInterval(() => setStep(s => s + 1), 480);
    return () => clearInterval(t);
  }, []);

  // Roll dice every ~1.6s (every ~3.3 steps)
  useEffect(() => {
    const t = setInterval(() => {
      setDiceSpin(true);
      setTimeout(() => {
        setDiceVal(Math.floor(Math.random() * 6) + 1);
        setDiceSpin(false);
      }, 200);
    }, 1600);
    return () => clearInterval(t);
  }, []);

  const piecePx = PIECE_COLORS.map((_, i) => {
    const idx = (PIECE_START[i] + step) % LUDO_TRACK.length;
    const [col, row] = LUDO_TRACK[idx];
    return { x: col * C + C / 2, y: row * C + C / 2 };
  });

  // Dice dots layout for faces 1-6
  const DICE_DOTS: [number, number][][] = [
    [[0.5,0.5]],
    [[0.25,0.25],[0.75,0.75]],
    [[0.25,0.25],[0.5,0.5],[0.75,0.75]],
    [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]],
    [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]],
    [[0.25,0.25],[0.75,0.25],[0.25,0.5],[0.75,0.5],[0.25,0.75],[0.75,0.75]],
  ];
  const dots = DICE_DOTS[diceVal - 1];
  const diceSize = C * 2.2;
  const diceX = size - diceSize - C * 0.3;
  const diceY = C * 0.3;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 6 }}>
      {/* Board background */}
      <rect width={size} height={size} fill="#F8F8F8"/>

      {/* Track cells — white cross */}
      {/* Vertical arm cols 6-8 */}
      {[6,7,8].map(c => (
        <rect key={`va${c}`} x={c*C} y={0} width={C} height={size} fill="#FFFFFF"/>
      ))}
      {/* Horizontal arm rows 6-8 */}
      {[6,7,8].map(r => (
        <rect key={`ha${r}`} x={0} y={r*C} width={size} height={C} fill="#FFFFFF"/>
      ))}

      {/* Home areas */}
      <rect x={0} y={0} width={6*C} height={6*C} fill="#EF4444"/>
      <rect x={9*C} y={0} width={6*C} height={6*C} fill="#22C55E"/>
      <rect x={9*C} y={9*C} width={6*C} height={6*C} fill="#EAB308"/>
      <rect x={0} y={9*C} width={6*C} height={6*C} fill="#3B82F6"/>

      {/* Inner safe zones (white inset rounded rect) */}
      {[
        { x: C*0.7, y: C*0.7 },
        { x: 9*C+C*0.7, y: C*0.7 },
        { x: 9*C+C*0.7, y: 9*C+C*0.7 },
        { x: C*0.7, y: 9*C+C*0.7 },
      ].map((pos, i) => (
        <rect key={`safe${i}`} x={pos.x} y={pos.y} width={C*4.6} height={C*4.6}
          fill="rgba(255,255,255,0.28)" rx={C*0.5}/>
      ))}

      {/* Home circles (4 per corner) */}
      {[
        { cx: 2*C, cy: 2*C, color: "#FECACA" },
        { cx: 4*C, cy: 2*C, color: "#FECACA" },
        { cx: 2*C, cy: 4*C, color: "#FECACA" },
        { cx: 4*C, cy: 4*C, color: "#FECACA" },
        { cx: 11*C, cy: 2*C, color: "#BBF7D0" },
        { cx: 13*C, cy: 2*C, color: "#BBF7D0" },
        { cx: 11*C, cy: 4*C, color: "#BBF7D0" },
        { cx: 13*C, cy: 4*C, color: "#BBF7D0" },
        { cx: 11*C, cy: 11*C, color: "#FEF08A" },
        { cx: 13*C, cy: 11*C, color: "#FEF08A" },
        { cx: 11*C, cy: 13*C, color: "#FEF08A" },
        { cx: 13*C, cy: 13*C, color: "#FEF08A" },
        { cx: 2*C, cy: 11*C, color: "#BFDBFE" },
        { cx: 4*C, cy: 11*C, color: "#BFDBFE" },
        { cx: 2*C, cy: 13*C, color: "#BFDBFE" },
        { cx: 4*C, cy: 13*C, color: "#BFDBFE" },
      ].map((dot, i) => (
        <circle key={`hc${i}`} cx={dot.cx} cy={dot.cy} r={C*0.72}
          fill={dot.color} stroke="rgba(0,0,0,0.12)" strokeWidth={0.5}/>
      ))}

      {/* Home stretch lanes (tinted track lanes toward center) */}
      {/* Red → row 7, cols 1-5 */}
      {[1,2,3,4,5].map(c => <rect key={`rs${c}`} x={c*C+1} y={7*C+1} width={C-2} height={C-2} fill="#FCA5A5" rx={1}/>)}
      {/* Green → col 7, rows 1-5 */}
      {[1,2,3,4,5].map(r => <rect key={`gs${r}`} x={7*C+1} y={r*C+1} width={C-2} height={C-2} fill="#86EFAC" rx={1}/>)}
      {/* Yellow → row 7, cols 9-13 */}
      {[9,10,11,12,13].map(c => <rect key={`ys${c}`} x={c*C+1} y={7*C+1} width={C-2} height={C-2} fill="#FDE68A" rx={1}/>)}
      {/* Blue → col 7, rows 9-13 */}
      {[9,10,11,12,13].map(r => <rect key={`bs${r}`} x={7*C+1} y={r*C+1} width={C-2} height={C-2} fill="#93C5FD" rx={1}/>)}

      {/* Track grid lines */}
      {Array.from({length:15},(_,i) => (
        <line key={`gl${i}`} x1={i*C} y1={0} x2={i*C} y2={size} stroke="#E2E2E2" strokeWidth={0.4}/>
      ))}
      {Array.from({length:15},(_,i) => (
        <line key={`gr${i}`} x1={0} y1={i*C} x2={size} y2={i*C} stroke="#E2E2E2" strokeWidth={0.4}/>
      ))}

      {/* Safe squares (star markers on specific track squares) */}
      {[[2,6],[2,8],[6,2],[8,2],[12,6],[12,8],[6,12],[8,12]].map(([c,r],i) => (
        <rect key={`star${i}`} x={c*C+C*0.2} y={r*C+C*0.2} width={C*0.6} height={C*0.6}
          fill="#6B7280" rx={1} transform={`rotate(45 ${c*C+C/2} ${r*C+C/2})`}/>
      ))}

      {/* Center finishing area — triangle star */}
      {[
        { points: `${7*C},${6*C} ${8*C},${7*C} ${7*C},${8*C} ${6*C},${7*C}`, fill: "#EF4444" },
        { points: `${7*C},${6*C} ${9*C},${6*C} ${8*C},${7*C}`, fill: "#22C55E" },
        { points: `${8*C},${7*C} ${9*C},${6*C} ${9*C},${9*C}`, fill: "#EAB308" },
        { points: `${7*C},${8*C} ${8*C},${7*C} ${9*C},${9*C} ${6*C},${9*C}`, fill: "#3B82F6" },
        { points: `${6*C},${6*C} ${7*C},${6*C} ${6*C},${7*C}`, fill: "#EF4444" },
        { points: `${6*C},${7*C} ${7*C},${8*C} ${6*C},${9*C}`, fill: "#3B82F6" },
      ].map((tri, i) => (
        <polygon key={`ct${i}`} points={tri.points} fill={tri.fill} opacity={0.85}/>
      ))}

      {/* Board outer border */}
      <rect x={0} y={0} width={size} height={size} fill="none" stroke="#9CA3AF" strokeWidth={1.5} rx={4}/>

      {/* Animated Pieces */}
      {piecePx.map((pos, i) => (
        <motion.g
          key={`piece${i}`}
          animate={{ x: pos.x, y: pos.y }}
          initial={{ x: pos.x, y: pos.y }}
          transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <circle r={C*0.38} fill="rgba(0,0,0,0.2)" cx={0.5} cy={C*0.18}/>
          <circle r={C*0.38} fill={PIECE_COLORS[i]} stroke="rgba(255,255,255,0.8)" strokeWidth={0.9}/>
          <circle r={C*0.18} fill="rgba(255,255,255,0.4)"/>
          <circle r={C*0.1} cx={-C*0.12} cy={-C*0.12} fill="rgba(255,255,255,0.6)"/>
        </motion.g>
      ))}

      {/* Animated Dice */}
      <motion.g
        animate={{ rotate: diceSpin ? 15 : 0, scale: diceSpin ? 0.85 : 1 }}
        style={{ transformOrigin: `${diceX + diceSize/2}px ${diceY + diceSize/2}px` }}
        transition={{ duration: 0.15 }}
      >
        <rect x={diceX} y={diceY} width={diceSize} height={diceSize} fill="white"
          stroke="#D1D5DB" strokeWidth={0.8} rx={C*0.3}
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))" }}/>
        {dots.map(([fx, fy], di) => (
          <circle key={`d${di}`}
            cx={diceX + fx * diceSize}
            cy={diceY + fy * diceSize}
            r={diceSize * 0.1}
            fill="#1F2937"
          />
        ))}
      </motion.g>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   BANNER CAROUSEL
───────────────────────────────────────────── */
const SLIDES = [
  {
    id: "damas",
    duration: 8000,
    bg: "linear-gradient(135deg, #1A0A00 0%, #3D1A00 40%, #5C2A00 100%)",
    accent: "#D4820A",
    badge: "Anúncio Patrocinado",
    title: "Domina o\nTabuleiro?",
    subtitle: "Jogue Damas Online e multiplica o teu saldo.",
    cta: "Jogar Agora",
  },
  {
    id: "ludo",
    duration: 10000,
    bg: "linear-gradient(135deg, #0A0A1A 0%, #12122E 40%, #1A1A3D 100%)",
    accent: "#A78BFA",
    badge: "Anúncio Patrocinado",
    title: "Gosta de Ludo\napostado?",
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (next: number) => {
    setDir(next > slideIdx ? 1 : -1);
    setSlideIdx(next);
  };

  useEffect(() => {
    const slide = SLIDES[slideIdx];
    timerRef.current = setTimeout(() => {
      goTo((slideIdx + 1) % SLIDES.length);
    }, slide.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slideIdx]);

  const slide = SLIDES[slideIdx];

  return (
    <section className="px-4 pt-5 pb-3">
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: slide.bg, minHeight: 190, transition: "background 0.8s ease" }}
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
            variants={slideIn}
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
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest mb-3 uppercase border"
                style={{ borderColor: `${slide.accent}40`, background: `${slide.accent}15`, color: slide.accent }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: slide.accent }}/>
                {slide.badge}
              </div>

              {/* Title */}
              <h1 className="font-syne font-extrabold text-[1.55rem] leading-tight text-white mb-2 drop-shadow-md whitespace-pre-line">
                {slide.title}
              </h1>

              {/* Subtitle */}
              <p className="text-[11px] leading-relaxed mb-4 max-w-[155px]" style={{ color: `${slide.accent}CC` }}>
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
                <motion.div
                  initial={{ opacity: 0, rotate: 4, scale: 0.88 }}
                  animate={{ opacity: 1, rotate: 4, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(167,139,250,0.25)",
                  }}
                >
                  <LudoBoard size={136} />
                </motion.div>
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
    image: null,
    imageFit: "cover" as const,
    imagePos: "center",
    ludoCard: true,
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
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
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
    image: "/ludo-board.png",
    imagePos: "center 60%",
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

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex gap-3 overflow-x-auto pt-1 pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {games.map((game) => (
              <motion.div
                key={game.id}
                variants={fadeUp}
                className="min-w-[148px] flex-shrink-0 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col"
              >
                <div className="h-28 w-full relative overflow-hidden bg-slate-200">
                  {"ludoCard" in game && game.ludoCard ? (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "#18181B" }}>
                      <LudoBoard size={110} />
                    </div>
                  ) : game.image ? (
                    <>
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: game.imagePos }}
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
        <nav className="fixed bottom-0 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex flex-col items-center gap-1 text-blue-700">
              <HomeIcon className="w-5 h-5"/>
              <span className="text-[9px] font-semibold font-syne tracking-wide">Home</span>
            </Link>
            <Link href="/explorar" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
              <Gamepad2 className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Explorar</span>
            </Link>
            <Link href="/carteira" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
              <Wallet className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Carteira</span>
            </Link>
            <Link href="/perfil" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
              <User className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Perfil</span>
            </Link>
          </div>
        </nav>

      </div>
    </div>
  );
}
