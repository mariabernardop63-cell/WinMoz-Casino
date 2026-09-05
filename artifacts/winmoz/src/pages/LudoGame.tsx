import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { evaluateBotDifficulty, getBotDifficultySync } from "@/lib/botBrain";
import { serverBet, serverWin, rollLudoDice } from "@/lib/gameApi";
import AdBanner from "@/components/AdBanner";
import bgImg from "@assets/Gemini_Generated_Image_grc2w7grc2w7grc2_1780220609974.png";
import rollSoundUrl from "@assets/som_para_quando_o_user_girar_no_dado__1781479690378.mp3";
import captureSoundUrl from "@assets/som_para_quando_o_peao_é_matado_1781479683373.mp3";

// ─── Sound helpers ────────────────────────────────────────────────────────────
// Web Audio API with pre-decoded buffers — zero-latency playback on any device
let _audioCtx: AudioContext | null = null;
let _rollBuffer: AudioBuffer | null = null;
let _captureBuffer: AudioBuffer | null = null;
let _audioLoading = false;
let _audioReady = false;

function _getCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _audioCtx;
}

async function _loadAudioBuffers() {
  if (_audioReady || _audioLoading) return;
  _audioLoading = true;
  try {
    const ctx = _getCtx();
    const [ab1, ab2] = await Promise.all([
      fetch(rollSoundUrl).then(r => r.arrayBuffer()),
      fetch(captureSoundUrl).then(r => r.arrayBuffer()),
    ]);
    [_rollBuffer, _captureBuffer] = await Promise.all([
      ctx.decodeAudioData(ab1),
      ctx.decodeAudioData(ab2),
    ]);
    _audioReady = true;
  } catch { /* silent fail — game works without sound */ }
  _audioLoading = false;
}

function _playBuffer(buf: AudioBuffer | null, volume = 0.65) {
  if (!buf) return;
  try {
    const ctx = _getCtx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch {}
}

/* ── Anti-duplicação global: cada som toca no máximo 1x por intervalo.
   Chamas concorrentes (broadcast echo + state sync + capture loop)
   são absorvidas em vez de empilhar. */
const _lastPlayAt: Record<string, number> = {};
function _throttledPlay(kind: string, buf: AudioBuffer | null, minGapMs: number, volume?: number) {
  const now = Date.now();
  if (now - (_lastPlayAt[kind] ?? 0) < minGapMs) return;
  _lastPlayAt[kind] = now;
  _playBuffer(buf, volume);
}

function playRollSound()    { _throttledPlay("roll",   _rollBuffer,    400); }
function playCaptureSound() { _throttledPlay("capture", _captureBuffer, 700); }
function playVictoryChime() {
  /* 1x apenas — chames concorrentes (handleMoveComplete + state sync) não repetem */
  const now = Date.now();
  if (now - (_lastPlayAt["chime"] ?? 0) < 1500) return;
  _lastPlayAt["chime"] = now;
  try {
    const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
    // Ascending C-E-G-C arpeggio — classic "goal reached" fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.38, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t); osc.stop(t + 0.6);
    });
  } catch {}
}

function playWinFanfare() {
  const now = Date.now();
  if (now - (_lastPlayAt["fanfare"] ?? 0) < 2000) return;
  _lastPlayAt["fanfare"] = now;
  try {
    const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
    const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.55);
    });
  } catch {}
}

function playMoveSound() {
  const now = Date.now();
  if (now - (_lastPlayAt["move"] ?? 0) < 250) return;
  _lastPlayAt["move"] = now;
  try {
    const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 520;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t); osc.stop(t + 0.12);
  } catch {}
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type Player  = "blue" | "green";
type PieceId = "B0"|"B1"|"B2"|"B3"|"G0"|"G1"|"G2"|"G3";
type Phase   = "roll"|"select"|"moving"|"done";
interface GamePiece { id: PieceId; player: Player; pos: number; }

// ─── CSPRNG helper — cryptographically secure random float [0,1) ───────────────
function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

// ─── Smart Dice Algorithm ───────────────────────────────────────────────────────
// Implements 5 fairness/drama rules for betting game integrity
// Uses CSPRNG (crypto.getRandomValues) — not predictable via Math.random() hacks
function generateWeightedDice(
  playerPieces: GamePiece[],
  opponentPieces: GamePiece[],
  player: Player,
  stuckTurns: number,       // consecutive turns with all pieces in base & no 6 rolled
  consecutiveSixes: number, // sixes rolled in the current turn
  gameId: string,
): number {
  // ── Rule 4: Block third consecutive 6 in the same turn ──────────────────────
  if (consecutiveSixes >= 2) {
    // Force a secure random 1-5, never 6
    return Math.floor(secureRandom() * 5) + 1;
  }

  // ── Rule 1: Anti-frustration — force 6 on 10th stuck turn ───────────────────
  const allInBase = playerPieces.every(p => p.pos === -1);
  if (allInBase && stuckTurns >= 9) {
    return 6;
  }

  // Use CSPRNG + gameId as entropy salt (Rule 5)
  const entropy = secureRandom();

  // ── Rules 2 & 3 only apply to pieces actively on the track ──────────────────
  const myActive  = playerPieces.filter(p => p.pos > 0 && p.pos <= 50);
  const oppActive = opponentPieces.filter(p => p.pos > 0 && p.pos <= 50);

  const playerStart   = player === "blue" ? 0 : 26;
  const opponentStart = player === "blue" ? 26 : 0;

  for (const mine of myActive) {
    const myAbs = (playerStart + mine.pos) % 52;
    for (const opp of oppActive) {
      const oppAbs = (opponentStart + opp.pos) % 52;
      const dist = (oppAbs - myAbs + 52) % 52; // steps I need to reach opp

      // ── Rule 2: Combat Drama — 50% chance of exact kill if 1-6 away ─────────
      if (dist >= 1 && dist <= 6) {
        const salt = (entropy + (gameId.charCodeAt(0) % 128) / 128) % 1;
        if (salt < 0.5) {
          return dist; // exact kill number
        } else {
          const nonKill = [1, 2, 3, 4, 5, 6].filter(n => n !== dist);
          return nonKill[Math.floor(secureRandom() * nonKill.length)];
        }
      }

      // ── Rule 3: Chase — 20% chance of high number if 7-15 behind ────────────
      if (dist >= 7 && dist <= 15) {
        if (secureRandom() < 0.20) {
          const highs = [4, 5, 6];
          return highs[Math.floor(secureRandom() * highs.length)];
        }
      }
    }
  }

  // ── Normal fair roll ─────────────────────────────────────────────────────────
  return Math.floor(secureRandom() * 6) + 1;
}

// ─── Board geometry ─────────────────────────────────────────────────────────────
const TRACK: [number,number][] = [
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
];
// Home stretches — entered AFTER the arrow cell (pos 50)
// 5 cells only: [8,7] (blue) and [6,7] (green) sit inside the center 3×3 triangle
// region and must NOT be resting squares — center is pos 56 = [7,7]
const BLUE_STRETCH:  [number,number][] = [[13,7],[12,7],[11,7],[10,7],[9,7]];
const GREEN_STRETCH: [number,number][] = [[1,7],[2,7],[3,7],[4,7],[5,7]];

const PLAYER_START: Record<Player,number> = { blue:0, green:26 };
const HOME_SLOTS: Record<Player,[number,number][]> = {
  blue:  [[10,1],[10,3],[12,1],[12,3]],
  green: [[2,10],[2,12],[4,10],[4,12]],
};
// SVG px positions of home slot centers (for overlay pawn rendering)
const HOME_SVG_PX: Record<Player,[number,number][]> = {
  blue:  [[80,440],[160,440],[80,520],[160,520]],
  green: [[440,80],[520,80],[440,160],[520,160]],
};

// ─── Safe squares — ONLY starting squares (colored entry) + star squares ────────
// TRACK indices for safe squares:
//   0=[13,6] blue start, 8=[8,2] star, 13=[6,1] red start, 21=[2,6] star,
//   26=[1,8] green start, 34=[6,12] star, 39=[8,13] yellow start, 47=[12,8] star
const STAR_DISPLAY: [number,number][] = [[8,2],[2,6],[6,12],[12,8]];
const SAFE_IDX = [0,8,13,21,26,34,39,47];
const SAFE_COORDS = new Set<string>(
  SAFE_IDX.map(i=>`${TRACK[i][0]},${TRACK[i][1]}`)
);

// ─── Sizing — GPS pin pawn size ────────────────────────────────────────────────
// PIECE_BOX = click/hit area, PAWN_SIZE controls visual size
// Cell is SZ/15 = 40px. Pawn height = size×1.93. Size=13 → h≈25px — fits cleanly centered
const PIECE_BOX  = 24;  // px — click/hit area (smaller than cell so it never overlaps)
const PAWN_SIZE  = 15;  // px — single-piece size (height ≈ 29px, clearly visible on mobile)

// ─── getPieceCoord: stretch entered after pos 50 (arrow cell) ──────────────────
function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1)  return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 50)   return TRACK[(PLAYER_START[p.player] + p.pos) % 52];
  if (p.pos <= 55)   return (p.player==="blue" ? BLUE_STRETCH : GREEN_STRETCH)[p.pos - 51];
  return [7,7]; // pos 56+ = finished (center triangle)
}

// ─── Colors ─────────────────────────────────────────────────────────────────────
const Q = {
  red:    { main:"#E53935", bg:"#C62828" },
  green:  { main:"#20B56B", bg:"#168957" },
  blue:   { main:"#2F80ED", bg:"#1D5FC5" },
  yellow: { main:"#F2B705", bg:"#C68A00" },
};
const STRETCH_COL = { red:"#FFD6D4", green:"#C8F3DA", blue:"#D6E9FF", yellow:"#FFF0B8" };

type PawnColor = "red"|"green"|"blue"|"yellow";
const PAWN_PAL: Record<PawnColor,{s:string;m:string;d:string}> = {
  red:    { s:"#FF9898", m:"#EF4444", d:"#9B1C1C" },
  green:  { s:"#86EFAC", m:"#22C55E", d:"#166534" },
  blue:   { s:"#93C5FD", m:"#3B82F6", d:"#1E3A8A" },
  yellow: { s:"#FDE68A", m:"#EAB308", d:"#713F12" },
};

// ─── Classic Ludo Pawn (extracted from tournament SVG design) ──────────────────
function PinPawn({ color, size=PAWN_SIZE, glow=false }: {
  color:PawnColor; size?:number; glow?:boolean;
}) {
  const uid = `ludo_${color}`;

  // Color palettes derived from the SVG's gradient definitions
  const pal: Record<PawnColor,{
    headLight:string; headMid:string; headDark:string;
    bodyTop:string; bodyBot:string;
    belt:string; outline:string; shadow:string;
  }> = {
    blue: {
      headLight:"#A8CCE7", headMid:"#4E93CB", headDark:"#0245A3",
      bodyTop:"#124092",   bodyBot:"#0761AE",
      belt:"#103066",      outline:"#0D3580",  shadow:"rgba(2,45,130,0.55)",
    },
    green: {
      headLight:"#72D48A", headMid:"#27A84A", headDark:"#0C6A26",
      bodyTop:"#0C6A27",   bodyBot:"#209242",
      belt:"#004E1A",      outline:"#0A5C22",  shadow:"rgba(8,90,30,0.55)",
    },
    red: {
      headLight:"#F4A0A0", headMid:"#E03030", headDark:"#8B0000",
      bodyTop:"#8B1A1A",   bodyBot:"#C22020",
      belt:"#6B0000",      outline:"#7A1010",  shadow:"rgba(120,0,0,0.55)",
    },
    yellow: {
      headLight:"#FFE57A", headMid:"#D4A800", headDark:"#8A6A00",
      bodyTop:"#8A6A00",   bodyBot:"#C8A000",
      belt:"#6A5000",      outline:"#7A6000",  shadow:"rgba(100,75,0,0.55)",
    },
  };

  const c = pal[color] ?? pal.blue;
  // Pawn aspect: width=27 height=52 (matches the SVG extraction)
  const w = size;
  const h = Math.round(size * 1.93);

  return (
    <div style={{
      display:"flex", flexShrink:0, width:w, height:h,
      filter: glow
        ? `drop-shadow(0 0 ${Math.round(w*0.35)}px ${c.bodyBot}DD) drop-shadow(0 3px 6px rgba(0,0,0,0.80))`
        : `drop-shadow(0 3px 6px rgba(0,0,0,0.70)) drop-shadow(0 1px 2px rgba(0,0,0,0.45))`,
    }}>
      <svg viewBox="0 0 27 52" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Head — 3D radial gradient (top-left highlight → dark bottom) */}
          <radialGradient id={`${uid}_head`}
            gradientTransform={`matrix(13 -12.3 13.1 15.7 -0.7 4)`}
            gradientUnits="userSpaceOnUse">
            <stop offset="1%"   stopColor={c.headLight} stopOpacity="0.9"/>
            <stop offset="6%"   stopColor={c.headMid}/>
            <stop offset="23%"  stopColor={c.headDark}/>
          </radialGradient>
          {/* Body — vertical linear gradient */}
          <linearGradient id={`${uid}_body`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="43%"  stopColor={c.bodyTop}/>
            <stop offset="100%" stopColor={c.bodyBot}/>
          </linearGradient>
          {/* Belt highlight — horizontal */}
          <linearGradient id={`${uid}_belt`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop stopColor={c.belt}/>
            <stop offset="40%" stopColor="white" stopOpacity="0.46"/>
            <stop offset="74%" stopColor="white" stopOpacity="0.04"/>
          </linearGradient>
          {/* Body shine — vertical white streak */}
          <linearGradient id={`${uid}_shine`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop stopColor="white"/>
            <stop offset="15%" stopColor="white"/>
            <stop offset="68%" stopColor="#C8B5B5"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* ── Drop shadow under base ── */}
        <ellipse cx="13.5" cy="50.5" rx="8" ry="1.8" fill="rgba(0,0,0,0.38)"/>

        {/* ── HEAD: rounded egg-shape (classic ludo pawn head) ── */}
        <path
          d={`M22.6 4.95
              C25.13 9.08 24.59 14.93 21.26 18.45
              C19.62 20.18 17.92 19.38 14.34 19.38
              C10.37 19.38 8.45 20.45 6.59 17.87
              C4.07 14.37 3.5 9.47 5.54 5.67
              C7.36 2.27 10.62 0 14.34 0
              C17.79 0 20.78 1.95 22.6 4.95 Z`}
          fill={`url(#${uid}_head)`}
        />
        {/* Head outline */}
        <path
          d={`M14.34 0.5
              C17.59 0.5 20.43 2.33 22.18 5.21
              C24.59 9.15 24.06 14.75 20.9 18.1
              C20.54 18.49 20.18 18.72 19.81 18.86
              C19.44 19.0 19.03 19.06 18.52 19.06
              C18.0 19.07 17.43 19.03 16.73 18.98
              C16.04 18.93 15.25 18.88 14.34 18.88
              C13.33 18.88 12.44 18.95 11.68 19.01
              C10.9 19.07 10.26 19.12 9.7 19.09
              C9.14 19.07 8.68 18.97 8.26 18.75
              C7.84 18.54 7.43 18.18 7.0 17.58
              C4.58 14.22 4.04 9.52 5.98 5.91
              C7.73 2.64 10.83 0.5 14.34 0.5 Z`}
          fill="none"
          stroke={c.outline}
          strokeWidth="0.5"
        />

        {/* ── BODY / TORSO (tapered trapezoid) ── */}
        <path
          d={`M7.57 18L14.44 18.84L20.58 18.17L27 40.83
              V40.91 C27 45.0 24.25 48.6 20.23 49.3
              C17.77 49.72 15.08 50.06 12.98 49.99
              C11.09 49.93 8.88 49.64 6.83 49.28
              C2.78 48.58 0 44.96 0 40.85
              V40.33 L7.57 18 Z`}
          fill={`url(#${uid}_body)`}
        />
        {/* Body outline */}
        <path
          d={`M14.38 18.83L14.44 18.84L14.5 18.83
              L20.21 18.21L26.5 40.91
              C26.5 44.77 23.9 48.15 20.14 48.8
              C17.69 49.23 15.05 49.56 12.99 49.49
              C11.14 49.43 8.96 49.14 6.91 48.79
              C3.13 48.13 0.5 44.74 0.5 40.85
              V40.42 L7.92 18.55 L14.38 18.83 Z`}
          fill="none"
          stroke={c.outline}
          strokeWidth="0.5"
        />

        {/* ── BELT / WAIST highlight ── */}
        <path
          d={`M4.14 38 C4.14 38 8.95 39.71 12.18 39.88
              C15.55 40.06 20.7 38.78 20.7 38.78
              L20.63 40.28
              C20.63 40.28 15.48 41.56 12.11 41.38
              C8.88 41.2 4.07 39.5 4.07 39.5 L4.14 38 Z`}
          fill={`url(#${uid}_belt)`}
        />

        {/* ── BODY SHINE (vertical light streak) ── */}
        <path
          d={`M10.14 20H16L20 39.37L12.14 40L4 39.37L10.14 20 Z`}
          fill="white"
          fillOpacity="0.18"
        />

        {/* ── BODY right-side shine ── */}
        <path
          d={`M14.93 19.34L16.98 19.29L21.15 45.19L15.27 45.48L14.93 19.34 Z`}
          fill={`url(#${uid}_shine)`}
          fillOpacity="0.20"
        />

        {/* ── Head specular highlight (top-left glint) ── */}
        <ellipse cx="10" cy="5.5" rx="3.5" ry="2.2"
          fill="rgba(255,255,255,0.55)"
          transform="rotate(-20 10 5.5)"
        />
        {/* Tiny secondary glint */}
        <circle cx="8.8" cy="4.0" r="1.2" fill="rgba(255,255,255,0.38)"/>
      </svg>
    </div>
  );
}

// ─── Selection highlight — dramatic bounce + glow when player must choose ───────
function SelectionRing({ color }: { color: PawnColor }) {
  const p = PAWN_PAL[color];
  const glowColor = p.m;
  return (
    <>
      {/* Outer pulsing halo */}
      <motion.div
        animate={{ scale:[1, 1.25, 1], opacity:[0, 0.55, 0] }}
        transition={{ duration:0.9, repeat:Infinity, ease:"easeOut" }}
        style={{
          position:"absolute",
          inset:-5,
          borderRadius:"50%",
          background:`radial-gradient(circle, ${glowColor}44 0%, transparent 70%)`,
          pointerEvents:"none",
          zIndex:0,
        }}
      />
      {/* Spinning dashed ring */}
      <motion.div
        animate={{ rotate:360 }}
        transition={{ duration:1.6, repeat:Infinity, ease:"linear" }}
        style={{
          position:"absolute",
          inset:-3,
          borderRadius:"50%",
          border:`2px dashed ${glowColor}`,
          boxShadow:`0 0 7px ${glowColor}88, 0 0 14px ${glowColor}33`,
          pointerEvents:"none",
          zIndex:0,
        }}
      />
      {/* Inner solid ring */}
      <motion.div
        animate={{ scale:[1, 1.07, 1], opacity:[0.8, 1, 0.8] }}
        transition={{ duration:0.7, repeat:Infinity, ease:"easeInOut" }}
        style={{
          position:"absolute",
          inset:-1,
          borderRadius:"50%",
          border:`2px solid ${glowColor}`,
          boxShadow:`0 0 6px ${glowColor}BB`,
          pointerEvents:"none",
          zIndex:0,
        }}
      />
    </>
  );
}

// ─── Star polygon ───────────────────────────────────────────────────────────────
function StarShape({ cx,cy,r,fill,stroke="#FFD700",strokeW=0,opacity=1 }:{
  cx:number;cy:number;r:number;fill:string;stroke?:string;strokeW?:number;opacity?:number;
}) {
  const pts = Array.from({length:10},(_,i)=>{
    const a=(i*36-90)*Math.PI/180; const rad=i%2===0?r:r*0.42;
    return `${cx+Math.cos(a)*rad},${cy+Math.sin(a)*rad}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} opacity={opacity}/>;
}

// ─── Board SVG (static board graphics) ─────────────────────────────────────────
const CS = 40;
const SZ = 15*CS; // 600px

function cellColor(r:number,c:number):string {
  if(c===7&&r>=1&&r<=6)  return STRETCH_COL.green;
  if(c===7&&r>=8&&r<=13) return STRETCH_COL.blue;
  if(r===7&&c>=1&&c<=6)  return STRETCH_COL.red;
  if(r===7&&c>=8&&c<=13) return STRETCH_COL.yellow;
  if(r===13&&c===6) return Q.blue.main;
  if(r===1 &&c===8) return Q.green.main;
  if(r===6 &&c===1) return Q.red.main;
  if(r===8 &&c===13) return Q.yellow.main;
  return "#FBFCFE";
}

const HOME_DECO: { color:PawnColor; slots:[number,number][] }[] = [
  { color:"red",    slots:[[80,80],[160,80],[80,160],[160,160]] },
  { color:"yellow", slots:[[440,440],[520,440],[440,520],[520,520]] },
  { color:"blue",   slots:[[80,440],[160,440],[80,520],[160,520]] },
  { color:"green",  slots:[[440,80],[520,80],[440,160],[520,160]] },
];
const ARROWS=[{r:7,c:0,s:"→"},{r:7,c:14,s:"←"},{r:0,c:7,s:"↓"},{r:14,c:7,s:"↑"}];

function BoardSVG({ pieces }:{ pieces:GamePiece[] }) {
  const inHome:Record<"blue"|"green",Set<number>> = {
    blue:  new Set(pieces.filter(p=>p.player==="blue"  &&p.pos===-1).map(p=>+p.id[1])),
    green: new Set(pieces.filter(p=>p.player==="green" &&p.pos===-1).map(p=>+p.id[1])),
  };
  const pathCells:[number,number][] = [];
  for(let r=0;r<15;r++) for(let c=0;c<15;c++)
    if(!((r<=5&&c<=5)||(r<=5&&c>=9)||(r>=9&&c<=5)||(r>=9&&c>=9))) pathCells.push([r,c]);

  return (
    <svg viewBox={`0 0 ${SZ} ${SZ}`} width="100%" height="100%"
      style={{display:"block",position:"absolute",inset:0}}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="ludoBoardBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F8FAFC"/>
          <stop offset="100%" stopColor="#E8EEF5"/>
        </linearGradient>
        <linearGradient id="ludoRedHome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F04440"/>
          <stop offset="100%" stopColor="#C62828"/>
        </linearGradient>
        <linearGradient id="ludoGreenHome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#31C77A"/>
          <stop offset="100%" stopColor="#168957"/>
        </linearGradient>
        <linearGradient id="ludoBlueHome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4194F2"/>
          <stop offset="100%" stopColor="#1D5FC5"/>
        </linearGradient>
        <linearGradient id="ludoYellowHome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD04A"/>
          <stop offset="100%" stopColor="#C68A00"/>
        </linearGradient>
      </defs>
      {/* Board background */}
      <rect x={0} y={0} width={SZ} height={SZ} fill="url(#ludoBoardBase)" rx={10}/>
      {/* Quadrant fills */}
      <rect x={0}   y={0}   width={240} height={240} fill="url(#ludoRedHome)"/>
      <rect x={360} y={0}   width={240} height={240} fill="url(#ludoGreenHome)"/>
      <rect x={0}   y={360} width={240} height={240} fill="url(#ludoBlueHome)"/>
      <rect x={360} y={360} width={240} height={240} fill="url(#ludoYellowHome)"/>
      {/* Path cells */}
      {pathCells.map(([r,c])=>{
        if(r>=6&&r<=8&&c>=6&&c<=8) return null;
        return <rect key={`${r},${c}`} x={c*CS} y={r*CS} width={CS} height={CS}
          fill={cellColor(r,c)} stroke="#D6DEE8" strokeWidth="0.8"/>;
      })}
      {/* Center triangles */}
      <rect x={240} y={240} width={120} height={120} fill="#FFFFFF"/>
      <polygon points="240,240 360,240 300,300" fill={Q.green.main}/>
      <polygon points="360,240 360,360 300,300" fill={Q.yellow.main}/>
      <polygon points="360,360 240,360 300,300" fill={Q.blue.main}/>
      <polygon points="240,360 240,240 300,300" fill={Q.red.main}/>
      {/* Center border */}
      <rect x={240} y={240} width={120} height={120} fill="none" stroke="#B8C4D1" strokeWidth="1"/>
      {/* Home trays: translucent glass-like panels keep the four slots aligned. */}
      <rect x={30} y={30}   width={180} height={180} rx={20} fill="#FFFFFF" opacity={0.17} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2}/>
      <rect x={390} y={30}  width={180} height={180} rx={20} fill="#FFFFFF" opacity={0.17} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2}/>
      <rect x={30} y={390}  width={180} height={180} rx={20} fill="#FFFFFF" opacity={0.17} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2}/>
      <rect x={390} y={390} width={180} height={180} rx={20} fill="#FFFFFF" opacity={0.17} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2}/>
      {/* Home slot circles + resting pawns (pin rendered by HTML overlay) */}
      {HOME_DECO.map(({ color, slots })=>
        slots.map(([px,py],i)=>{
          const p=PAWN_PAL[color];
          const isActive=(color==="blue"&&inHome.blue.has(i))||(color==="green"&&inHome.green.has(i));
          return (
            <g key={`${color}_${i}`}>
              <circle cx={px} cy={py} r={27} fill={isActive ? p.s : "#FFFFFF"} opacity={isActive ? 0.72 : 0.9}/>
              <circle cx={px} cy={py} r={27} fill="none" stroke={isActive ? p.m : "#FFFFFF"} strokeWidth={isActive ? 3.2 : 2.4} opacity={isActive ? 0.98 : 0.82}/>
              <circle cx={px-7} cy={py-8} r={5} fill="#FFFFFF" opacity={isActive ? 0.2 : 0.45}/>
            </g>
          );
        })
      )}
      {/* Stars — original positions restored */}
      {STAR_DISPLAY.map(([sr,sc])=>(
        <g key={`star_${sr},${sc}`}>
          <StarShape cx={(sc+0.5)*CS} cy={(sr+0.5)*CS} r={CS*0.28}
            fill="#FFF4BF" stroke="#D89D00" strokeW={1.5} opacity={0.98}/>
        </g>
      ))}
      {/* Directional arrows */}
      {ARROWS.map(({r,c,s})=>(
        <text key={s} x={(c+0.5)*CS} y={(r+0.5)*CS+6}
          textAnchor="middle" fill="#64748B" fontSize={16} fontWeight="bold"
          opacity={0.65} fontFamily="Arial,sans-serif">{s}</text>
      ))}
      {/* Board border */}
      <rect x={1.5} y={1.5} width={SZ-3} height={SZ-3} fill="none" stroke="#94A3B8" strokeWidth={3} rx={10}/>
    </svg>
  );
}

// ─── Board overlay (interactive pawn layer) ────────────────────────────────────
function Board({ pieces, movable, onSelectPiece, rotateForPlayer }:{
  pieces:GamePiece[]; movable:PieceId[]; onSelectPiece:(id:PieceId)=>void;
  rotateForPlayer?: boolean;
}) {
  // Show selection effect only when player has a real choice (2+ movable pieces)
  const mustChoose = movable.length >= 2;

  // Build cell map for stacking offsets (exclude home base and finished)
  const cellMap = new Map<string,GamePiece[]>();
  pieces.forEach(p=>{
    if(p.pos===-1||p.pos>=56) return;
    const [r,c]=getPieceCoord(p);
    const k=`${r},${c}`;
    cellMap.set(k,[...(cellMap.get(k)||[]),p]);
  });

  // Finished pieces rendered in center triangles
  const blueFinished  = pieces.filter(p=>p.pos>=56&&p.player==="blue");
  const greenFinished = pieces.filter(p=>p.pos>=56&&p.player==="green");

  function renderFinished(arr:GamePiece[], cxSvg:number, cySvg:number) {
    if(!arr.length) return null;
    const count = arr.length;
    const sz = Math.max(10, 20 - (count-1)*3);
    const spacing = sz + 2;
    const totalW = spacing*(count-1);
    return arr.map((p,idx)=>{
      const color:PawnColor = p.player==="blue"?"blue":"green";
      const xOff = -totalW/2 + idx*spacing;
      return (
        <div key={p.id} style={{
          position:"absolute",
          left:`${cxSvg/SZ*100}%`,
          top:`${cySvg/SZ*100}%`,
          transform:`translate(calc(-50% + ${xOff}px),-50%)`,
          zIndex:15, pointerEvents:"none",
        }}>
          <PinPawn color={color} size={sz}/>
        </div>
      );
    });
  }

  return (
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1",
      borderRadius:16, overflow:"visible",
      background:"#DCE5EF",
      border:"1px solid #CBD5E1",
      boxShadow:"0 18px 38px rgba(15,23,42,0.18), 0 4px 10px rgba(15,23,42,0.10)",
      transform: rotateForPlayer ? "rotate(180deg)" : undefined,
    }}>
      <BoardSVG pieces={pieces}/>

      {pieces.map(p=>{
        const selectable = movable.includes(p.id);
        // Only show the highlight effect when there's a real choice to make
        const showEffect = selectable && mustChoose;
        const color: PawnColor = p.player==="blue" ? "blue" : "green";

        // Finished pieces rendered separately below
        if(p.pos>=56) return null;

        // Home pieces: render at SVG slot coordinates
        if(p.pos===-1){
          const slotIdx = +p.id[1];
          const [svgX,svgY] = HOME_SVG_PX[p.player][slotIdx];
          return (
            <motion.div key={p.id}
              onPointerDown={selectable?()=>onSelectPiece(p.id):undefined}
              animate={showEffect ? { y:[0,-5,0] } : { y:0 }}
              transition={showEffect ? { duration:0.65, repeat:Infinity, ease:"easeInOut" } : {}}
              style={{
                position:"absolute",
                width:PIECE_BOX, height:PIECE_BOX,
                left:`${svgX/SZ*100}%`,
                top:`${svgY/SZ*100}%`,
                translateX:"-50%",
                translateY:"-50%",
                zIndex:selectable?20:5,
                cursor:selectable?"pointer":"default",
                 touchAction:"manipulation",
                 userSelect:"none",
              }}>
              {showEffect && <SelectionRing color={color}/>}
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                zIndex:2,
              }}>
                <PinPawn color={color} size={PAWN_SIZE} glow={showEffect}/>
              </div>
            </motion.div>
          );
        }

        // Track / stretch pieces: centered exactly on cell
        const [r,c]=getPieceCoord(p);
        const here=cellMap.get(`${r},${c}`) || [];
        const idx=here.findIndex(x=>x.id===p.id);
        const count = here.length;

        // Compact stacking layout — keeps all pieces within the cell boundary
        // Offsets and sizes are tuned for PAWN_SIZE=16 (cell ≈ 27px)
        let pawnSize = PAWN_SIZE;
        let offX = 0, offY = 0;
        if (count === 2) {
          pawnSize = 12;
          const off2: [number,number][] = [[-6,0],[6,0]];
          [offX,offY] = off2[idx] ?? [0,0];
        } else if (count === 3) {
          pawnSize = 10;
          const off3: [number,number][] = [[0,-6],[-6,4],[6,4]];
          [offX,offY] = off3[idx] ?? [0,0];
        } else if (count >= 4) {
          pawnSize = 9;
          const off4: [number,number][] = [[-5,-4],[5,-4],[-5,4],[5,4]];
          [offX,offY] = off4[idx] ?? [0,0];
        }

        return (
          <motion.div key={p.id}
            onPointerDown={selectable?()=>onSelectPiece(p.id):undefined}
            animate={showEffect ? { y:[0,-4,0] } : { y:0 }}
            transition={showEffect ? { duration:0.65, repeat:Infinity, ease:"easeInOut" } : {}}
            style={{
              position:"absolute",
              width:PIECE_BOX, height:PIECE_BOX,
              left:`${(c+0.5)/15*100}%`,
              top:`${(r+0.5)/15*100}%`,
              translateX:`calc(-50% + ${offX}px)`,
              translateY:`calc(-50% + ${offY}px)`,
              zIndex:selectable?20:10,
              cursor:selectable?"pointer":"default",
               touchAction:"manipulation",
               userSelect:"none",
            }}>
            {showEffect && <SelectionRing color={color}/>}
            <div style={{
              position:"absolute", inset:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:2,
            }}>
              <PinPawn color={color} size={pawnSize} glow={showEffect}/>
            </div>
          </motion.div>
        );
      })}

      {/* Finished pieces inside center triangles */}
      {renderFinished(blueFinished,  300, 330)}
      {renderFinished(greenFinished, 300, 270)}
    </div>
  );
}

// ─── 3D Dice ───────────────────────────────────────────────────────────────────
const DOT_POS:Record<number,[number,number][]> = {
  1:[[50,50]],
  2:[[27,27],[73,73]],
  3:[[27,27],[50,50],[73,73]],
  4:[[27,27],[73,27],[27,73],[73,73]],
  5:[[27,27],[73,27],[50,50],[27,73],[73,73]],
  6:[[27,22],[73,22],[27,50],[73,50],[27,78],[73,78]],
};
function DiceFace({ value, sz }:{ value:number; sz:number }) {
  return (
    <svg viewBox="0 0 100 100" width={sz} height={sz} style={{display:"block"}}>
      {(DOT_POS[value]||[]).map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={10}
          fill="radial-gradient(circle,#333,#000)" style={{fill:"#1a1a1a"}}/>
      ))}
    </svg>
  );
}
function Dice3D({ value, rolling, onClick, active, sz=48 }:{
  value:number|null; rolling:boolean; onClick:()=>void; active:boolean; sz?:number;
}) {
  const h=sz/2;
  const [rollKey,setRollKey]=useState(0);
  const [disp,setDisp]=useState(1);
  const faceRot:Record<number,{rx:number;ry:number}>={
    1:{rx:0,ry:0},2:{rx:-90,ry:0},3:{rx:0,ry:-90},4:{rx:0,ry:90},5:{rx:90,ry:0},6:{rx:0,ry:180},
  };
  useEffect(()=>{
    if(!rolling){
      // A cleared die must not keep showing the previous player's result.
      if(value===null){ setDisp(1); return; }
      setDisp(value);
      return;
    }
    setRollKey(k=>k+1);
    let n=0;
    const iv=setInterval(()=>{ setDisp(Math.floor(Math.random()*6)+1); if(++n>14) clearInterval(iv); },45);
    return()=>clearInterval(iv);
  },[rolling,value]);
  const tr=faceRot[disp]||{rx:0,ry:0};
  const faces:[number,string,string][]=[
    [1,`translateZ(${h}px)`,"#FAFAF8"],
    [6,`rotateY(180deg) translateZ(${h}px)`,"#F0EEE8"],
    [2,`rotateX(90deg) translateZ(${h}px)`,"#F5F4F0"],
    [5,`rotateX(-90deg) translateZ(${h}px)`,"#E8E6E0"],
    [3,`rotateY(90deg) translateZ(${h}px)`,"#F2F0EB"],
    [4,`rotateY(-90deg) translateZ(${h}px)`,"#ECEAE4"],
  ];
  const rad=sz*0.17;
  return (
    <div onClick={active&&!rolling?onClick:undefined}
      style={{
        perspective:"400px", width:sz, height:sz,
        cursor:active&&!rolling?"pointer":"default",
        filter:active
          ?"drop-shadow(0 6px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 5px rgba(0,0,0,0.4))"
          :"drop-shadow(0 3px 8px rgba(0,0,0,0.4))",
        opacity:active?1:0.45, transition:"opacity 0.3s",
      }}>
      <motion.div key={rollKey}
        animate={rolling
          ?{rotateX:[0,-180,-360,tr.rx+360],rotateY:[0,180,360,tr.ry+360]}
          :{rotateX:tr.rx,rotateY:tr.ry}}
        transition={rolling?{duration:0.75,ease:"easeOut"}:{duration:0.14}}
        style={{width:sz,height:sz,transformStyle:"preserve-3d",position:"relative"}}>
        {faces.map(([v,t,bg])=>(
          <div key={v} style={{
            position:"absolute", inset:0,
            background:`radial-gradient(ellipse at 30% 25%,#FFFFFF,${bg} 60%,#D8D5CC)`,
            borderRadius:rad,
            border:"1px solid rgba(140,135,120,0.3)",
            display:"flex", alignItems:"center", justifyContent:"center",
            backfaceVisibility:"hidden", transform:t,
            boxShadow:"inset 2px 2px 5px rgba(255,255,255,0.9), inset -2px -2px 5px rgba(0,0,0,0.15)",
          }}>
            <DiceFace value={v} sz={sz*0.75}/>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Timer arc ─────────────────────────────────────────────────────────────────
function TimerArc({ timeLeft, total=30, size=30 }:{timeLeft:number;total?:number;size?:number}) {
  const r=(size-5)/2;
  const circ=2*Math.PI*r;
  const fill=timeLeft/total;
  const col=timeLeft>12?"#4ade80":timeLeft>6?"#fbbf24":"#ef4444";
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={3}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ*(1-fill)} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.85s linear, stroke 0.3s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:9,fontWeight:800,color:col,lineHeight:1}}>{timeLeft}</span>
      </div>
    </div>
  );
}

// ─── Trophy SVG ────────────────────────────────────────────────────────────────
function TrophySVG({ size=72 }:{size?:number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="tg" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor="#FFE566"/>
          <stop offset="50%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#B8860B"/>
        </linearGradient>
      </defs>
      <path d="M28 12 L72 12 L68 52 Q65 64 50 68 Q35 64 32 52 Z" fill="url(#tg)"/>
      <path d="M28 16 Q14 16 14 32 Q14 44 28 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <path d="M72 16 Q86 16 86 32 Q86 44 72 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <rect x="44" y="68" width="12" height="12" fill="url(#tg)" rx="2"/>
      <rect x="30" y="80" width="40" height="7" fill="url(#tg)" rx="3.5"/>
      <ellipse cx="38" cy="30" rx="7" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-18 38 30)"/>
    </svg>
  );
}


// ─── Professional Player Panel — white card ─────────────────────────────────────
function PlayerPanel({ player, name, balance, isActive, diceValue, rolling, onRoll,
  finished, lives, timeLeft, isMe, canRoll }:{
  player:Player; name:string; balance:string; isActive:boolean; diceValue:number|null;
  rolling:boolean; onRoll:()=>void; finished:number; lives:number; timeLeft:number; isMe:boolean;
  canRoll?: boolean;
}) {
  const color:PawnColor = player==="blue" ? "blue" : "green";
  const accentColor     = player==="blue" ? "#3B82F6" : "#22C55E";
  const accentDark      = player==="blue" ? "#1D4ED8" : "#15803D";

  return (
    <div style={{
      display:"flex", alignItems:"center",
      background: isActive
        ? `linear-gradient(105deg, #FFFFFF 0%, ${accentColor}0D 100%)`
        : "#FFFFFF",
      borderRadius:14,
      border:`1.5px solid ${isActive ? accentColor : "#E2E8F0"}`,
      overflow:"hidden",
      boxShadow: isActive
        ? `0 4px 20px ${accentColor}28, 0 1px 4px rgba(0,0,0,0.06)`
        : "0 1px 6px rgba(0,0,0,0.07)",
      transition:"border-color 0.3s, box-shadow 0.3s",
      height:62,
    }}>

      {/* Left accent bar */}
      <div style={{
         width:5, alignSelf:"stretch", flexShrink:0,
        background: isActive
          ? `linear-gradient(180deg,${accentColor},${accentDark})`
          : "#E2E8F0",
        transition:"background 0.3s",
      }}/>

      {/* Pawn avatar */}
      <div style={{
         width:40, height:40, borderRadius:12, flexShrink:0,
        margin:"0 10px",
        background:`${accentColor}12`,
        border:`2px solid ${isActive ? accentColor+"50" : "#E2E8F0"}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"border-color 0.3s",
      }}>
        <PinPawn color={color} size={22}/>
      </div>

      {/* Name + stats */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:3 }}>
        {/* Row 1: name + badge */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif",
            fontWeight:700, fontSize:13,
            color: isActive ? "#0F172A" : "#94A3B8",
            lineHeight:1,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            maxWidth:120,
            transition:"color 0.3s",
          }}>{name}</span>
          <span style={{
            fontSize:9, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase",
            color: isMe ? "#FFFFFF" : "#64748B",
            background: isMe ? accentColor : "#E2E8F0",
             borderRadius:999, padding:"3px 7px", flexShrink:0,
             border:`1px solid ${isMe ? accentColor+"55" : "#E2E8F0"}`,
          }}>{isMe?"Tu":"Rival"}</span>
        </div>
        {/* Row 2: balance + lives dots */}
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{
            fontFamily:"system-ui,-apple-system,sans-serif",
            fontWeight:600, fontSize:11,
            color: isActive ? accentColor : "#CBD5E1",
            transition:"color 0.3s",
          }}>{balance}</span>
          <div style={{ width:1, height:10, background:"#E2E8F0", flexShrink:0 }}/>
          {/* Life dots: green = alive, red = lost */}
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            {Array.from({length:5}).map((_,i)=>(
              <motion.div key={i}
                animate={{ scale: i===lives-1&&lives>0 ? [1,1.35,1] : 1 }}
                transition={{ duration:0.22 }}
                style={{
                  width:6, height:6, borderRadius:"50%",
                   background: i < lives ? accentColor : "#E2E8F0",
                   boxShadow: i < lives ? `0 0 4px ${accentColor}66` : "none",
                  transition:"background 0.3s, box-shadow 0.3s",
                  flexShrink:0,
                }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Right: timer + dice */}
      <div style={{
        display:"flex", alignItems:"center", gap:6,
        padding:"0 10px 0 4px", flexShrink:0,
      }}>
        <TimerArc timeLeft={timeLeft} size={24}/>
        <div style={{
           background: isActive ? `${accentColor}12` : "#F8FAFC",
           borderRadius:12, padding:"4px",
          border:`1.5px solid ${isActive ? accentColor+"60" : "#E2E8F0"}`,
          transition:"border-color 0.3s, background 0.3s",
        }}>
          <Dice3D
            value={diceValue} rolling={rolling}
            onClick={onRoll}
            active={isActive && isMe && canRoll !== false}
            sz={34}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Rematch Overlay ───────────────────────────────────────────────────────────
type RematchPhase = "idle"|"checking"|"no_balance"|"waiting"|"received"|"declined"|"opp_no_balance";

function RematchOverlay({ phase, requesterName, onAccept, onDecline, onClose }:{
  phase: Exclude<RematchPhase,"idle">;
  requesterName: string;
  onAccept: ()=>void;
  onDecline: ()=>void;
  onClose: ()=>void;
}) {
  const loading = phase==="checking"||phase==="waiting";
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.93)",
        backdropFilter:"blur(18px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.7,opacity:0,y:30}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        style={{width:"88%",maxWidth:290,borderRadius:24,overflow:"hidden",
          background:"linear-gradient(145deg,#0D1A2A,#0A1420)",
          border:"1px solid rgba(255,255,255,0.1)",
          boxShadow:"0 32px 80px rgba(0,0,0,0.75)"}}>
        <div style={{padding:"28px 22px 24px",textAlign:"center"}}>
          {loading&&(
            <>
              <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}
                style={{width:40,height:40,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.1)",
                  borderTopColor:"#D4A35A",margin:"0 auto 16px"}}/>
              <p style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>
                {phase==="checking"?"A verificar saldo…":"A aguardar resposta…"}
              </p>
              {phase==="waiting"&&<p style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:6}}>
                Pedido de revanche enviado.
              </p>}
            </>
          )}
          {phase==="no_balance"&&(
            <>
              <div style={{width:52,height:52,borderRadius:16,background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.25)",display:"flex",alignItems:"center",
                justifyContent:"center",margin:"0 auto 14px"}}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.8"/>
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{fontSize:16,fontWeight:800,color:"#EF4444",marginBottom:6}}>Saldo Insuficiente</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:20}}>
                Não tens saldo suficiente para a revanche.
              </p>
              <button onClick={onClose} style={{width:"100%",padding:"13px",borderRadius:14,
                background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                color:"rgba(255,255,255,0.65)",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                Fechar
              </button>
            </>
          )}
          {phase==="received"&&(
            <>
              <div style={{width:52,height:52,borderRadius:16,background:"rgba(255,215,0,0.1)",
                border:"1px solid rgba(255,215,0,0.22)",display:"flex",alignItems:"center",
                justifyContent:"center",margin:"0 auto 14px"}}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{fontSize:16,fontWeight:800,color:"#FFD700",marginBottom:6}}>Revanche!</p>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginBottom:20}}>
                <strong style={{color:"rgba(255,255,255,0.85)"}}>{requesterName}</strong> quer jogar novamente.
              </p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={onAccept} style={{flex:1,padding:"13px",borderRadius:14,
                  background:"linear-gradient(135deg,#22C55E,#16A34A)",border:"none",
                  color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  Aceitar
                </button>
                <button onClick={onDecline} style={{flex:1,padding:"13px",borderRadius:14,
                  background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.28)",
                  color:"#EF4444",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  Recusar
                </button>
              </div>
            </>
          )}
          {(phase==="declined"||phase==="opp_no_balance")&&(
            <>
              <div style={{width:52,height:52,borderRadius:16,background:"rgba(239,68,68,0.1)",
                border:"1px solid rgba(239,68,68,0.2)",display:"flex",alignItems:"center",
                justifyContent:"center",margin:"0 auto 14px"}}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.8"/>
                  <path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,0.8)",marginBottom:6}}>
                {phase==="declined"?"Revanche Recusada":"Sem Saldo"}
              </p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>
                {phase==="declined"
                  ?`${requesterName} recusou a revanche.`
                  :`${requesterName} não tem saldo suficiente.`}
              </p>
              <button onClick={onClose} style={{width:"100%",padding:"13px",borderRadius:14,
                background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                color:"rgba(255,255,255,0.65)",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                Fechar
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Win Screen — premium, fitness-app inspired, shows MT won ─────────────────
function WinScreen({ winner, winnerName, loserName, betAmount, isWinner, onReplay, onQuit }:{
  winner:Player; winnerName:string; loserName:string; betAmount:number; isWinner:boolean;
  onReplay:()=>void; onQuit:()=>void;
}) {
  if(!isWinner) return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.82)",
        backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.55,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22,delay:0.08}}
        style={{background:"#fff",maxWidth:310,width:"88%",overflow:"hidden",
          boxShadow:"0 24px 64px rgba(0,0,0,0.4)",border:"1px solid #e5e7eb"}}>
        <div style={{background:"#fef2f2",padding:"28px 24px 22px",textAlign:"center",borderBottom:"1px solid #fecaca"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <div style={{width:64,height:64,background:"#fef2f2",border:"1px solid #fecaca",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                <path d="M8 8 L24 24 M24 8 L8 24" stroke="#DC2626" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
            color:"#9ca3af",marginBottom:6}}>DERROTA</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,
            color:"#6b7280",lineHeight:1.3,marginBottom:4}}>Perdeste para</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#0a0a0a",lineHeight:1.1}}>
            {winnerName}
          </p>
        </div>
        <div style={{background:"#fff",padding:"20px 24px 22px"}}>
          {betAmount>0&&(
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",
              padding:"12px 16px",display:"flex",alignItems:"center",
              justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",
                  color:"#9ca3af",marginBottom:4}}>PERDIDO</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:20,color:"#DC2626",lineHeight:1}}>
                  -{betAmount.toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div style={{width:40,height:40,background:"#fef2f2",border:"1px solid #fecaca",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <path d="M3 17 L9 11 L13 15 L21 7" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 7 L21 7 L21 11" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} style={{flex:1,background:"#0a0a0a",color:"#fff",
              padding:"14px 0",border:"none",
              fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <RotateCcw style={{width:14,height:14}}/>Revanche
            </button>
            <button onClick={onQuit} style={{flex:1,background:"#f8fafc",
              border:"1px solid #e5e7eb",color:"#374151",
              padding:"14px 0",fontFamily:"'Syne',sans-serif",fontWeight:700,
              fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <LogOut style={{width:14,height:14}}/>Sair
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{
        position:"fixed", inset:0, zIndex:100,
        background:"rgba(0,0,0,0.82)",
        backdropFilter:"blur(16px)",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>

      <motion.div
        initial={{scale:0.55,opacity:0,y:40}}
        animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22,delay:0.08}}
        style={{
          background:"#fff", maxWidth:310, width:"88%",
          overflow:"hidden",
          boxShadow:"0 24px 64px rgba(0,0,0,0.4)",
          border:"1px solid #e5e7eb",
        }}>

        <div style={{
          background:"#f8fafc", padding:"28px 24px 22px",
          textAlign:"center", borderBottom:"1px solid #e5e7eb",
        }}>
          <motion.div
            animate={{ y:[0,-4,0] }}
            transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}
            style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <TrophySVG size={72}/>
          </motion.div>
          <p style={{
            fontSize:10, fontWeight:800, letterSpacing:3, textTransform:"uppercase",
            color:"#9ca3af", marginBottom:6,
          }}>VENCEDOR</p>
          <p style={{
            fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:24,
            color:"#0a0a0a", lineHeight:1.1, letterSpacing:0.3,
          }}>{winnerName}</p>
        </div>

        <div style={{
          background:"#fff",
          padding:"20px 24px 22px",
        }}>

          {betAmount > 0 && (
            <div style={{
              background:"#f0fdf4",
              border:"1px solid #bbf7d0",
              padding:"14px 16px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:16,
            }}>
              <div>
                <p style={{
                  fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase",
                  color:"#9ca3af", marginBottom:4,
                }}>GANHOS (90%)</p>
                <p style={{
                  fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22,
                  color:"#16a34a", lineHeight:1,
                }}>
                  +{Math.floor(betAmount * 2 * 0.90).toLocaleString("pt-MZ")} <span style={{fontSize:13}}>MT</span>
                </p>
              </div>
              <div style={{
                width:44, height:44,
                background:"#f0fdf4", border:"1px solid #bbf7d0",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}

          <p style={{
            fontSize:12, color:"#9ca3af", textAlign:"center",
            marginBottom:18,
          }}>
            <span style={{color:"#374151", fontWeight:600}}>{loserName}</span> foi eliminado
          </p>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onReplay} style={{
              flex:1,
              background:"#0a0a0a",
              color:"#fff", padding:"14px 0", border:"none",
              fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}>
              <RotateCcw style={{width:14,height:14}}/>
              Jogar Novamente
            </button>
            <button onClick={onQuit} style={{
              flex:1,
              background:"#f8fafc",
              border:"1px solid #e5e7eb",
              color:"#374151", padding:"14px 0",
              fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}>
              <LogOut style={{width:14,height:14}}/>
              Sair
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


// ─── Main Game Component ────────────────────────────────────────────────────────
export default function LudoGame() {
  const [,setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  // ── URL params ─────────────────────────────────────────────────────────────────
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const gameId      = searchParams.get("gameId") ?? "local";
  const myColor     = (searchParams.get("color") ?? "blue") as Player;
  const BET_AMOUNT  = parseInt(searchParams.get("bet") ?? "0");
  const oppFromUrl  = searchParams.get("opp") ?? "";
  const opponentColor: Player = myColor === "blue" ? "green" : "blue";
  const isBot  = searchParams.get("bot") === "1";
  const botBal = searchParams.get("botbalance") ?? "";

  const myNameUrl   = searchParams.get("myname") ?? "";
  const playerName  = myNameUrl ? decodeURIComponent(myNameUrl) : (profile?.full_name ?? "Jogador");
  const playerBal   = profile?.balance
    ? `${Number(profile.balance).toLocaleString("pt-MZ")} MT`
    : "0 MT";
  const opponentName = oppFromUrl ? decodeURIComponent(oppFromUrl) : "Adversário";

  // Saved state for reconnection support
  const _savedLudo=(()=>{
    if(gameId==="local") return null;
    try{
      const s=sessionStorage.getItem(`wm_ludo_${gameId}`);
      return s?JSON.parse(s) as{pieces:GamePiece[];turn:Player;phase:Phase;diceBlue:number|null;diceGreen:number|null;lives:{blue:number;green:number}}:null;
    }catch{return null;}
  })();

  const [opponentBal, setOpponentBal] = useState(isBot && botBal ? `${botBal} MT` : "—");
  const [opponentTimeLeft, setOpponentTimeLeft] = useState(30);
  const oppTimerRecvAtRef  = useRef<number>(0);
  const oppTimerRecvValRef = useRef<number>(30);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
  const [rematchRequester, setRematchRequester] = useState("");

  // ── State ──────────────────────────────────────────────────────────────────────
  const initialPieces=():GamePiece[]=>([
    {id:"B0",player:"blue",pos:-1},{id:"B1",player:"blue",pos:-1},
    {id:"B2",player:"blue",pos:-1},{id:"B3",player:"blue",pos:-1},
    {id:"G0",player:"green",pos:-1},{id:"G1",player:"green",pos:-1},
    {id:"G2",player:"green",pos:-1},{id:"G3",player:"green",pos:-1},
  ]);

  const [pieces,setPieces]         = useState<GamePiece[]>(_savedLudo?.pieces ?? initialPieces());
  const [turn,setTurn]             = useState<Player>(_savedLudo?.turn ?? "blue");
  const [phase,setPhase]           = useState<Phase>(_savedLudo?.phase ?? "roll");
  const [diceBlue,setDiceBlue]     = useState<number|null>(_savedLudo?.diceBlue ?? null);
  const [diceGreen,setDiceGreen]   = useState<number|null>(_savedLudo?.diceGreen ?? null);
  const [rollingBlue,setRollingB]  = useState(false);
  const [rollingGreen,setRollingG] = useState(false);
  const [movable,setMovable]       = useState<PieceId[]>([]);
  const [winner,setWinner]         = useState<Player|null>(null);
  const [lives,setLives]           = useState(_savedLudo?.lives ?? {blue:5,green:5});
  const livesRef                   = useRef<{blue:number;green:number}>(_savedLudo?.lives ?? {blue:5,green:5});
  const [timeLeft,setTimeLeft]     = useState(30);

  // ── Dice algorithm state ────────────────────────────────────────────────────
  // stuckTurns: how many consecutive turns each player had ALL pieces in base
  // and did NOT roll a 6 (triggers Rule 1 anti-frustration)
  const [stuckTurns,setStuckTurns] = useState<Record<Player,number>>({blue:0,green:0});
  // consecutiveSixes: tracked directly via ref (no state to avoid async timing bug)
  const stuckTurnsRef       = useRef<Record<Player,number>>({blue:0,green:0});
  const consecutiveSixesRef = useRef(0);
  // eventSeqRef: tracks last processed event sequence to discard duplicates
  const lastEventSeqRef = useRef<Record<string,number>>({});
  // Every authoritative hand-off gets one monotonically increasing version.
  // Both clients carry it forward so delayed state syncs can never restore an
  // older turn and re-enable the wrong player's die.
  const stateSyncSeqRef = useRef(0);
  // Each player owns its own state sequence. Comparing both players against
  // one shared counter makes simultaneous updates with seq=1 discard each
  // other, leaving one client on an old turn.
  const remoteStateSeqRef = useRef<Record<Player,number>>({blue:0,green:0});
  // Each roll phase is a transaction of its own. React state can be one render
  // behind a click or a delayed realtime message, so phase/turn checks alone
  // are not enough to prevent a second roll in the same turn.
  const turnEpochRef = useRef(0);
  const rolledEpochRef = useRef<number|null>(null);
  // Hard one-roll-per-turn gate. Only an explicit hand-off or legal extra
  // turn may release it; remote snapshots cannot re-arm the die.
  const rollConsumedRef = useRef(false);

  const myTurnMsg  = `${playerName.split(" ")[0]} — clica nos dados!`;
  const oppTurnMsg = `A aguardar ${opponentName}…`;
  const [msg,setMsg] = useState(myColor==="blue" ? myTurnMsg : oppTurnMsg);

  const piecesRef    = useRef(pieces);
  const phaseRef     = useRef(phase);
  const movableRef   = useRef(movable);
  const diceBlueRef  = useRef(diceBlue);
  const diceGreenRef = useRef(diceGreen);
  const turnRef      = useRef(turn);
  const winnerRef    = useRef(winner);
  const channelRef   = useRef<ReturnType<typeof supabase.channel>|null>(null);
  const captureAnimRef = useRef(false);
  const rollBusyRef   = useRef(false);
  const moveBusyRef   = useRef(false);
  // A timeout must finish the whole turn, not only roll the die. This flag
  // carries the intent through the asynchronous dice animation so a roll
  // with several legal pieces is selected automatically.
  const autoMoveAfterRollRef = useRef(false);
  // Persiste em sessionStorage para não re-debitar se o utilizador fizer back e retomar
  const betDeductedRef = useRef(
    gameId !== "local"
      ? sessionStorage.getItem(`wm_bet_deducted_ludo_${gameId}`) === "1"
      : false
  );
  const winCreditedRef = useRef(false);
  const rewardFiredRef = useRef(false);

  // Pre-load audio buffers on first render so sounds play instantly
  useEffect(() => { _loadAudioBuffers(); }, []);

  useEffect(()=>{piecesRef.current=pieces;},[pieces]);
  useEffect(()=>{phaseRef.current=phase;},[phase]);
  useEffect(()=>{movableRef.current=movable;},[movable]);
  useEffect(()=>{diceBlueRef.current=diceBlue;},[diceBlue]);
  useEffect(()=>{diceGreenRef.current=diceGreen;},[diceGreen]);
  useEffect(()=>{turnRef.current=turn;},[turn]);
  useEffect(()=>{winnerRef.current=winner;},[winner]);
  useEffect(()=>{stuckTurnsRef.current=stuckTurns;},[stuckTurns]);
  useEffect(()=>{livesRef.current=lives;},[lives]);

  // Persist game state for reconnection
  useEffect(()=>{
    if(gameId==="local"||winner||phase==="done") return;
    try{
      sessionStorage.setItem(`wm_ludo_${gameId}`,JSON.stringify({
        pieces:piecesRef.current,turn,phase,
        diceBlue:diceBlueRef.current,diceGreen:diceGreenRef.current,
        lives,
      }));
    }catch{/* ignore */}
    // Keep wm_active_game always current so Resume works even on native back-swipe
    if(BET_AMOUNT > 0){
      try{
        localStorage.setItem("wm_active_game", JSON.stringify({
          gameId, gameType: "ludo", betAmount: BET_AMOUNT,
          opponentName, savedAt: Date.now(), ttlMs: 30 * 60_000,
          playerColor: myColor, playerName,
        }));
      }catch{/* ignore */}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pieces,turn,phase,lives]);

  useEffect(()=>{
    if((winner||phase==="done")&&gameId!=="local"){
      try{
        sessionStorage.removeItem(`wm_ludo_${gameId}`);
        sessionStorage.removeItem(`wm_bet_deducted_ludo_${gameId}`);
        localStorage.removeItem("wm_active_game");
      }catch{}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[winner,phase]);

  // Credit winner + register match result when game ends (server-side)
  useEffect(()=>{
    if(!winner||!profile?.id||BET_AMOUNT<=0||gameId==="local"||winCreditedRef.current) return;
    winCreditedRef.current = true;
    const isWinner = winner === myColor;
    (async()=>{
      try {
        if (isWinner) {
          const result = await serverWin(gameId, "ludo", BET_AMOUNT);
          if (!result.ok) { winCreditedRef.current = false; return; }
          await refreshProfile();
        }
      } catch { winCreditedRef.current = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[winner]);

  const other=(p:Player):Player=>p==="blue"?"green":"blue";

  function calcMovable(ps:GamePiece[],pl:Player,d:number):PieceId[] {
    return ps.filter(p=>p.player===pl).filter(p=>{
      if(p.pos>=56) return false; // pos 56 = center (finished)
      if(p.pos===-1) return d===6;
      // In the home stretch (pos 51-55), piece must land exactly on center (56) — no overshooting
      if(p.pos>=51) return p.pos+d<=56;
      return p.pos+d<=56;
    }).map(p=>p.id) as PieceId[];
  }

  function finishedCount(ps:GamePiece[],pl:Player):number {
    return ps.filter(p=>p.player===pl&&p.pos>=56).length;
  }

  function movePieceSteps(id:PieceId,curPos:number,steps:number,isExit:boolean,onDone:()=>void){
    if(isExit){
      setPieces(prev=>prev.map(p=>p.id===id?{...p,pos:0}:p));
      setTimeout(onDone,280); return;
    }
    if(steps<=0){
      onDone();
      return;
    }
    for(let i=1;i<=steps;i++){
      const s=i;
      setTimeout(()=>{
        setPieces(prev=>prev.map(p=>p.id!==id?p:{...p,pos:curPos+s}));
        if(s===steps) setTimeout(onDone,140);
      },s*270);
    }
  }

  function captureAtPos(mover:GamePiece): boolean {
    const [mr,mc]=getPieceCoord(mover);
    const ck=`${mr},${mc}`;
    if(SAFE_COORDS.has(ck)||mover.pos<0||mover.pos>50) return false;
    const opp=other(mover.player);
    let captured = false;
    piecesRef.current
      .filter(p=>p.player===opp&&p.pos>=0&&p.pos<=50)
      .forEach(p=>{
        const [pr,pc]=getPieceCoord(p);
        if(pr===mr&&pc===mc && !SAFE_COORDS.has(`${pr},${pc}`)){
          if(!captured){
            // Som 1x por lance — mesmo capturando várias peças de uma vez
            captured = true;
            captureAnimRef.current = true;
            playCaptureSound();
            const capturerName=mover.player===myColor?playerName.split(" ")[0]:opponentName;
            setMsg(`${capturerName} capturou uma peça! +1 jogada`);
          }
          let pos=p.pos;
          // Safety: always clear captureAnimRef after at most 900ms so it never blocks dice rolls
          const safetyTimer = setTimeout(()=>{ captureAnimRef.current=false; }, 900);
          function stepBack(){
            setPieces(prev=>prev.map(x=>x.id!==p.id?x:{...x,pos:Math.max(-1,pos)}));
            if(pos>-1){pos--;setTimeout(stepBack,35);}
            else { captureAnimRef.current=false; clearTimeout(safetyTimer); }
          }
          stepBack();
        }
      });
    return captured;
  }

  function handleMoveComplete(pieceId:PieceId,diceVal:number,currentTurn:Player,prevPos:number){
    moveBusyRef.current = false;
    // Keep the ref in lockstep with the state immediately. A click arriving
    // before React commits setPhase("moving") must not select another piece.
    phaseRef.current = "moving";
    setPhase("moving");
    const ps=piecesRef.current;
    const finalPos = prevPos === -1 ? 0 : prevPos + diceVal;
    const baseMover = ps.find(p=>p.id===pieceId);
    const mover: GamePiece = baseMover ? {...baseMover, pos: finalPos} : {id:pieceId, player:currentTurn, pos:finalPos};
    const captured = captureAtPos(mover);
    if (!captured) playMoveSound();
    // Build updated snapshot that includes this piece at its new position
    const updatedPs = ps.map(p => p.id===pieceId ? mover : p);

    // Compute authoritative final state with captures resolved (for broadcast)
    const [mr,mc]=getPieceCoord(mover);
    const captureKey=`${mr},${mc}`;
    const authPieces:GamePiece[]=captured?updatedPs.map(p=>{
      if(p.player!==currentTurn&&p.pos>=0&&p.pos<=50&&!SAFE_COORDS.has(captureKey)){
        const[pr,pc]=getPieceCoord(p);
        if(pr===mr&&pc===mc) return{...p,pos:-1};
      }
      return p;
    }):updatedPs;

    // Helper: broadcast authoritative state to opponent (only moving player sends this)
    const broadcastSync=(syncTurn:Player,syncPhase:Phase,delay:number,syncWinner?:Player)=>{
      if(isBot||currentTurn!==myColor||!channelRef.current) return;
      const stateSeq = ++stateSyncSeqRef.current;
      setTimeout(()=>{
        channelRef.current?.send({type:"broadcast",event:"ludo_state_sync",payload:{
           pieces:authPieces, turn:syncTurn, phase:syncPhase,
          diceBlue:null, diceGreen:null,
          stateSeq,
           sourcePlayer: currentTurn,
          ...(syncWinner?{winner:syncWinner}:{}),
        }});
      },delay);
    };

    if(finishedCount(updatedPs,currentTurn)===4){
      setWinner(currentTurn); setPhase("done");
      if(currentTurn===myColor) playWinFanfare();
      broadcastSync(currentTurn,"done",100,currentTurn);
      return;
    }
    const enteredHome = mover.pos>=56 && prevPos<56;
    if(enteredHome) playVictoryChime();
    const extraTurn = diceVal===6 || captured || enteredHome;
    if(extraTurn){
      const reason = diceVal===6?"tirou 6":captured?"capturou uma peça":"chegou ao centro!";
      const plName=currentTurn===myColor?playerName.split(" ")[0]:opponentName;
      setMsg(`${plName} ${reason} — joga de novo!`);
      setMovable([]);
      // Keep consecutiveSixes for this extra turn (don't reset, it accumulates)
      setTimeout(()=>{
        turnEpochRef.current++;
        rolledEpochRef.current = null;
        if(currentTurn===myColor) rollConsumedRef.current = false;
        turnRef.current = currentTurn;
        phaseRef.current = "roll";
        setPhase("roll");setDiceBlue(null);setDiceGreen(null);
      },400);
      broadcastSync(currentTurn,"roll",500);
    } else {
      const next=other(currentTurn);
      const justMoved = prevPos !== mover.pos;
      if(justMoved){
        setStuckTurns(prev=>({...prev,[currentTurn]:0}));
      }
      setMovable([]);
      consecutiveSixesRef.current=0;
      setTimeout(()=>{
        turnEpochRef.current++;
        rolledEpochRef.current = null;
        turnRef.current = next;
        phaseRef.current = "roll";
        setTurn(next); setPhase("roll");
        // Clear both faces at hand-off so the next player never sees the
        // previous player's result as if it were their own roll.
        setDiceBlue(null); setDiceGreen(null);
        setMsg(next===myColor ? myTurnMsg : oppTurnMsg);
      },500);
      broadcastSync(next,"roll",600);
    }
  }

  const doSelectPiece=useCallback((pid:PieceId,diceVal:number,pl:Player,ps:GamePiece[])=>{
    if(moveBusyRef.current) return;
    const piece=ps.find(p=>p.id===pid);
    if(!piece || piece.player!==pl || !calcMovable(ps,pl,diceVal).includes(pid)) return;
    moveBusyRef.current = true;
    movableRef.current = [];
    phaseRef.current = "moving";
    setMovable([]); setPhase("moving");
    const isExit=piece.pos===-1;
    const prevPos=piece.pos;
    const plName=pl===myColor?playerName.split(" ")[0]:opponentName;
    if(isExit){
      setMsg(`${plName} coloca peça no tabuleiro!`);
      movePieceSteps(pid,-1,1,true,()=>handleMoveComplete(pid,diceVal,pl,-1));
    } else {
      // Auto-enter stretch: if piece would land exactly on arrow cell (pos 50), push it to pos 51
      const willLandOnArrow = piece.pos + diceVal === 50;
      // Stretch: pieces at pos 51-55 cap their move at 56 (center)
      const inStretch = piece.pos >= 51;
      let effectiveSteps = diceVal;
      if (willLandOnArrow) effectiveSteps = diceVal + 1;
      if (inStretch) effectiveSteps = Math.min(diceVal, 56 - piece.pos);
      setMsg(`${plName} move ${diceVal} ${diceVal===1?"casa":"casas"}!`);
      movePieceSteps(pid,piece.pos,effectiveSteps,false,()=>handleMoveComplete(pid,effectiveSteps,pl,prevPos));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playerName,opponentName,myColor]);

  // ── Opponent animation only (no handleMoveComplete — state comes via ludo_state_sync) ──
  function doOpponentMove(pid:PieceId,diceVal:number,_pl:Player,ps:GamePiece[]){
    if(moveBusyRef.current) return;
    moveBusyRef.current = true;
    movableRef.current = [];
    phaseRef.current = "moving";
    setMovable([]); setPhase("moving");
    const piece=ps.find(p=>p.id===pid);
    if(!piece){ moveBusyRef.current = false; return; }
    const prevPos=piece.pos;
    const plName=opponentName;
    if(piece.pos===-1){
      setMsg(`${plName} coloca peça no tabuleiro!`);
      // Release the lock after an opponent exits the base too. Without this,
      // the next local selection could remain blocked forever.
      movePieceSteps(pid,-1,1,true,()=>{ moveBusyRef.current = false; });
    } else {
      const willLandOnArrow=piece.pos+diceVal===50;
      const inStretch=piece.pos>=51;
      let effectiveSteps=diceVal;
      if(willLandOnArrow) effectiveSteps=diceVal+1;
      if(inStretch) effectiveSteps=Math.min(diceVal,56-piece.pos);
      setMsg(`${plName} move ${diceVal} ${diceVal===1?"casa":"casas"}!`);
      // O oponente ouve o som do movimento assim como eu ouço o meu
      playMoveSound();
      const finalPos=prevPos+effectiveSteps;
      movePieceSteps(pid,piece.pos,effectiveSteps,false,()=>{
        // Run capture animation cosmetically — authoritative state arrives via ludo_state_sync
        const moved=piecesRef.current.find(p=>p.id===pid);
        if(moved) captureAtPos({...moved,pos:finalPos});
        moveBusyRef.current = false;
      });
    }
  }

  // ── Apply a dice roll locally (no broadcast) ────────────────────────────────
  const applyRoll=useCallback((pl:Player,val:number,alreadyLocked=false,rollEpoch?:number)=>{
    // Realtime events may arrive late. A roll is valid only for the player
    // whose turn is currently active and while the UI is waiting for a roll.
    if(
      turnRef.current!==pl ||
      phaseRef.current!=="roll" ||
      winnerRef.current ||
      (rollEpoch !== undefined && rollEpoch !== turnEpochRef.current)
    ) {
      if(alreadyLocked) rollBusyRef.current = false;
      return;
    }
    // A local request locks before the server call; remote/bot rolls lock here.
    // This prevents duplicate broadcasts from starting parallel animations.
    if(!alreadyLocked){
      if(rollBusyRef.current) return;
      rollBusyRef.current = true;
    }
    const setR=pl==="blue"?setRollingB:setRollingG;
    const setD=pl==="blue"?setDiceBlue:setDiceGreen;
    setR(true);
    setTimeout(()=>{
      // Re-check after the dice animation delay because a state sync can hand
      // the turn to the other player during those 800ms.
      if(
        turnRef.current!==pl ||
        phaseRef.current!=="roll" ||
        winnerRef.current ||
        (rollEpoch !== undefined && rollEpoch !== turnEpochRef.current)
      ){
        setR(false);
        rollBusyRef.current = false;
        return;
      }
      setD(val); setR(false);

      // Track consecutive sixes (Rule 4) — update ref synchronously to avoid timing bugs
      if(val===6){
        consecutiveSixesRef.current++;
      } else {
        // Non-six rolled: update stuckTurns if all pieces still in base
        const allInBase = piecesRef.current.filter(p=>p.player===pl).every(p=>p.pos===-1);
        if(allInBase){
          setStuckTurns(prev=>({...prev,[pl]:prev[pl]+1}));
        }
      }

      const mv=calcMovable(piecesRef.current,pl,val);
      const plName=pl===myColor?playerName.split(" ")[0]:opponentName;

      // Rule 4: third consecutive roll is forced non-6 — allow player to move normally
      if(val!==6 && consecutiveSixesRef.current>=2){
        consecutiveSixesRef.current=0;
      }

      if(mv.length===0){
        setMsg(val===6
          ?`${plName} — 6 mas sem movimento!`
          :`${plName} — ${val} sem jogadas.`);
        consecutiveSixesRef.current=0;
        // No piece moved, so the player who owns this turn must publish the
        // hand-off. Without this event the other device could keep an old
        // turn/phase and reject the next player's roll forever.
        setTimeout(()=>{
          const next=other(pl);
          turnEpochRef.current++;
          rolledEpochRef.current = null;
          if(next===myColor) rollConsumedRef.current = false;
          turnRef.current = next;
          phaseRef.current = "roll";
          setTurn(next); setPhase("roll");
          setDiceBlue(null); setDiceGreen(null);
          setMsg(next===myColor ? myTurnMsg : oppTurnMsg);
          rollBusyRef.current = false;
          if (pl===myColor && !isBot) {
            channelRef.current?.send({type:"broadcast",event:"ludo_state_sync",payload:{
              pieces:piecesRef.current, turn:next, phase:"roll",
              diceBlue:null, diceGreen:null,
              stateSeq:++stateSyncSeqRef.current,
              sourcePlayer: pl,
            }});
          }
        },1300);
      } else if(mv.length===1){
        setMsg(`${plName} tirou ${val}!`);
        if(pl===myColor){
          // Auto-move: broadcast piece_selected so opponent can animate
          channelRef.current?.send({type:"broadcast",event:"piece_selected",
            payload:{pieceId:mv[0],diceVal:val,player:pl,seq:Date.now()}});
          doSelectPiece(mv[0],val,pl,piecesRef.current);
          setTimeout(()=>{ rollBusyRef.current = false; },120);
        } else if(isBot){
          // Bot opponent: move directly (no channel)
          doSelectPiece(mv[0],val,pl,piecesRef.current);
          setTimeout(()=>{ rollBusyRef.current = false; },120);
        }
        // else: multiplayer opponent — piece_selected broadcast will arrive shortly,
        //       doOpponentMove handles animation + ludo_state_sync sets final state
      } else {
        if(pl===myColor||isBot){
          // My turn or bot: show selectable pieces + enter select phase
          setMovable(mv); setPhase("select");
          setMsg(`${plName} — ${val}! ${pl===myColor?"Escolhe uma peça.":""}`);
           if(pl===myColor||isBot) setTimeout(()=>{ rollBusyRef.current = false; },120);
          if (pl===myColor && autoMoveAfterRollRef.current) {
            autoMoveAfterRollRef.current = false;
            // Let React commit the select phase before choosing a piece.
            setTimeout(() => {
              if (turnRef.current !== pl || phaseRef.current !== "select" || winnerRef.current) return;
              const available = movableRef.current.length > 0
                ? movableRef.current
                : calcMovable(piecesRef.current, pl, val);
              const pid = available[Math.floor(Math.random() * available.length)];
              if (pid) doSelectPiece(pid, val, pl, piecesRef.current);
            }, 220);
          }
        } else {
          // Multiplayer opponent: only show the message.
          // Do NOT touch phase/movable — ludo_state_sync from the opponent
          // is the authoritative state update. Changing phase here would
          // race with that sync and could freeze the next turn.
          setMsg(`${plName} — ${val}!`);
        }
      }
    },800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[myColor,playerName,opponentName,doSelectPiece,isBot]);

  // ── Roll my color dice — server-side secure roll + broadcasts ───────────────
  const doRoll=useCallback(async()=>{
    const rollEpoch = turnEpochRef.current;
    if(
      phaseRef.current!=="roll" ||
      turnRef.current!==myColor ||
      winnerRef.current ||
      captureAnimRef.current ||
      rollBusyRef.current ||
      rollConsumedRef.current ||
      rolledEpochRef.current === rollEpoch
    ) return;
    // Mark the current turn before awaiting the server. This is deliberately
    // synchronous so two fast clicks cannot create two dice requests.
    rolledEpochRef.current = rollEpoch;
    rollConsumedRef.current = true;
    rollBusyRef.current = true;
    // Start the visual roll before waiting for the server. Previously a slow
    // API made the die look dead even though the click and sound were handled.
    (myColor==="blue"?setRollingB:setRollingG)(true);
    playRollSound();

    const myPieces  = piecesRef.current.filter(p=>p.player===myColor);
    const allInBase = myPieces.every(p=>p.pos===-1);
    const stuckTurns = stuckTurnsRef.current[myColor];
    const consecutiveSixes = consecutiveSixesRef.current;
    let val = 0;
    let rollError = "";
    if(gameId==="local"){
      // The demo board must remain playable without authentication or an API
      // server. Real-money games always use the server-side roll below.
      val = generateWeightedDice(
        myPieces,
        piecesRef.current.filter(p=>p.player===opponentColor),
        myColor,
        stuckTurns,
        consecutiveSixes,
        gameId,
      );
    } else {
      const result = await rollLudoDice(gameId, allInBase, stuckTurns, consecutiveSixes);
      val = result.value;
      rollError = result.error ?? "";
    }
    if(!val){
      (myColor==="blue"?setRollingB:setRollingG)(false);
      rollBusyRef.current = false;
      rolledEpochRef.current = null;
      rollConsumedRef.current = false;
      autoMoveAfterRollRef.current = false;
      setMsg(rollError || "Não foi possível rolar o dado. Tenta novamente.");
      return;
    }
    // The server call can outlive the turn (for example after a tab switch or
    // a remote state sync). Never publish a stale roll into the next turn.
    if (
      phaseRef.current !== "roll" ||
      turnRef.current !== myColor ||
      winnerRef.current ||
      rollEpoch !== turnEpochRef.current
    ) {
      (myColor==="blue"?setRollingB:setRollingG)(false);
      rollBusyRef.current = false;
      autoMoveAfterRollRef.current = false;
      return;
    }

    // Game has definitively started — credit referral reward now (player's own first roll)
    if(BET_AMOUNT > 0 && !rewardFiredRef.current){
      rewardFiredRef.current=true;
      supabase.auth.getSession().then(({data:{session}})=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
    }
    const seq = Date.now();
    channelRef.current?.send({
      type:"broadcast",
      event:"dice_rolled",
      payload:{ player:myColor, value:val, seq },
    });
    applyRoll(myColor,val,true,rollEpoch);
  },[myColor,applyRoll,gameId]);

  // ── Select piece — broadcasts + applies ────────────────────────────────────
  function handleSelectPiece(pid:PieceId){
    // Guard: only act when it's my turn in select phase, dice must have a value
    if(phaseRef.current!=="select"||turnRef.current!==myColor||moveBusyRef.current) return;
    const dv=myColor==="blue"?diceBlueRef.current:diceGreenRef.current;
    if(dv===null) return;
    // Guard: piece must still be in the movable list
    if(!movableRef.current.includes(pid)) return;

    const seq = Date.now();
    channelRef.current?.send({
      type:"broadcast",
      event:"piece_selected",
      payload:{ pieceId:pid, diceVal:dv, player:myColor, seq },
    });
    doSelectPiece(pid,dv,myColor,piecesRef.current);
  }

  // ── Supabase Realtime channel ──────────────────────────────────────────────
  // ── Bot: deduct bet + create match on mount (server-side) ────────────────────
  useEffect(()=>{
    if(!isBot||!profile?.id||BET_AMOUNT<=0||betDeductedRef.current) return;
    betDeductedRef.current=true;
    (async()=>{
      try{
        const result = await serverBet(BET_AMOUNT, "ludo", `Aposta (Ludo) vs ${opponentName}`, gameId);
        if(!result.ok){ betDeductedRef.current=false; return; }
        supabase.auth.getSession().then(({data:{session}})=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
        try{sessionStorage.setItem(`wm_bet_deducted_ludo_${gameId}`,"1");}catch{}
        await refreshProfile();
        if(profile?.id) evaluateBotDifficulty(profile.id).catch(()=>{});
      }catch{betDeductedRef.current=false;}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isBot]);

  // ── Bot AI — strategic piece selection ────────────────────────────────────────
  function selectBotPiece(ps:GamePiece[],movable:PieceId[],diceVal:number):PieceId{
    if(movable.length===1) return movable[0];
    const diff=getBotDifficultySync(profile?.id??"");
    // Easy mode: random selection ~55% of time (opaque — not always)
    if(diff==="easy"&&Math.random()<0.55){
      return movable[Math.floor(Math.random()*movable.length)];
    }
    // Hard mode: strategic scoring
    let best=movable[0];
    let bestScore=-Infinity;
    const botStart=PLAYER_START[opponentColor];
    const userStart=PLAYER_START[myColor];
    for(const pid of movable){
      const piece=ps.find(p=>p.id===pid)!;
      const newPos=piece.pos===-1?0:piece.pos+diceVal;
      let score=0;
      // Finish: highest priority
      if(newPos>=56){score+=3000;}
      // Exit from base
      else if(piece.pos===-1){score+=600;}
      else{
        // Capture check: see if landing on opponent piece
        const absNew=(botStart+newPos)%52;
        if(absNew<TRACK.length){
          const coord=TRACK[absNew];
          const ck=`${coord[0]},${coord[1]}`;
          if(!SAFE_COORDS.has(ck)){
            for(const opp of ps.filter(p=>p.player===myColor&&p.pos>0&&p.pos<=50)){
              const absOpp=(userStart+opp.pos)%52;
              if(absOpp===absNew){score+=1200;}
            }
          }
        }
        // Progress: further is better (don't retreat)
        score+=newPos*4;
        // Prefer piece that is furthest back to bring it forward
        score-=piece.pos*0.5;
      }
      if(score>bestScore){bestScore=score;best=pid;}
    }
    return best;
  }

  // ── Bot AI turn trigger ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!isBot||winner||phase==="done") return;
    if(turn!==opponentColor) return;
    if(phase!=="roll"&&phase!=="select") return;
    const delay=600+Math.random()*1000;
    const t=setTimeout(()=>{
      if(phase==="roll"){
        const botPieces=piecesRef.current.filter(p=>p.player===opponentColor);
        const allInBase=botPieces.every(p=>p.pos===-1);
        const stk=stuckTurnsRef.current[opponentColor];
        let val:number;
        if(allInBase&&stk>=9){
          val=6; // anti-frustration
        } else {
          val=Math.floor(Math.random()*6)+1;
        }
        applyRoll(opponentColor,val);
      } else if(phase==="select"){
        const mv=movableRef.current;
        if(mv.length===0) return;
        const dv=diceGreenRef.current??1;
        const pid=selectBotPiece(piecesRef.current,mv,dv);
        doSelectPiece(pid,dv,opponentColor,piecesRef.current);
      }
    },delay);
    return()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,phase,winner,isBot]);

  useEffect(()=>{
    if(gameId==="local"||isBot) return;
    const channel=supabase.channel(`ludo_game_${gameId}`,{
      config:{ broadcast:{ self:false } },
    });
    channelRef.current=channel;

    channel.on("broadcast",{ event:"dice_rolled" },({ payload })=>{
      // Only process opponent's rolls; ignore our own echoes
      if(payload.player===myColor) return;
      // Deduplicate: ignore if we already processed this exact event
      const seq:number = payload.seq ?? 0;
      const key = `dice_${payload.player}`;
      if(seq && lastEventSeqRef.current[key] >= seq) return;
      if(seq) lastEventSeqRef.current[key] = seq;
      // Only apply if it is actually the opponent's turn and we are waiting
      // for a roll. Delayed broadcasts from the previous turn are ignored.
      if(phaseRef.current!=="roll"||turnRef.current!==payload.player||winnerRef.current) return;
      // Security: validate dice value is in expected range
      const val = payload.value as number;
      if(typeof val !== "number" || val < 1 || val > 6 || !Number.isInteger(val)) return;
      // Game has definitively started — credit referral reward now (opponent's first move)
      if(BET_AMOUNT > 0 && !rewardFiredRef.current){
        rewardFiredRef.current=true;
        supabase.auth.getSession().then(({data:{session}})=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
      }
      // O oponente ouve o mesmo som de dado que eu ouço quando jogo
      playRollSound();
      applyRoll(payload.player as Player, val);
    });

    channel.on("broadcast",{ event:"piece_selected" },({ payload })=>{
      // Only process opponent's selections
      if(payload.player===myColor) return;
      // Deduplicate
      const seq:number = payload.seq ?? 0;
      const key = `select_${payload.player}`;
      if(seq && lastEventSeqRef.current[key] >= seq) return;
      if(seq) lastEventSeqRef.current[key] = seq;
      if(phaseRef.current==="done"||winnerRef.current) return;
      // Security: validate pieceId format and diceVal range
      const pieceId = payload.pieceId as string;
      const diceVal = payload.diceVal as number;
      if(!/^[BG][0-3]$/.test(pieceId)) return;
      if(typeof diceVal !== "number" || diceVal < 1 || diceVal > 6 || !Number.isInteger(diceVal)) return;
      // A delayed selection from the previous turn must not animate or lock
      // the board after the turn has already changed.
      if(turnRef.current!==payload.player) return;
      const expectedPrefix = payload.player === "blue" ? "B" : "G";
      if(pieceId[0] !== expectedPrefix) return;
      // Use doOpponentMove (animation only) — final state comes via ludo_state_sync
      doOpponentMove(
        pieceId as PieceId,
        diceVal,
        payload.player as Player,
        piecesRef.current
      );
    });

    channel.on("broadcast",{ event:"ludo_timer" },({ payload })=>{
      if((payload.player as string)!==myColor){
        const t = payload.t as number;
        setOpponentTimeLeft(t);
        oppTimerRecvAtRef.current  = Date.now();
        oppTimerRecvValRef.current = t;
      }
    });

    channel.on("broadcast",{ event:"ludo_lives_sync" },({ payload })=>{
      const newLives = payload.lives as {blue:number;green:number};
      if(!newLives||typeof newLives.blue!=="number"||typeof newLives.green!=="number") return;
      if (payload.player && payload.player !== opponentColor) return;
      setLives(newLives);
      livesRef.current = newLives;
      if(payload.gameOver){
        setWinner(myColor);
        setPhase("done");
        setMsg(`${playerName.split(" ")[0]} venceu! ${opponentName} perdeu todas as vidas.`);
      }
    });

    channel.on("broadcast",{ event:"ludo_forfeit" },()=>{
      if(winnerRef.current||phaseRef.current==="done") return;
      setWinner(myColor);
      setPhase("done");
      setMsg(`${opponentName} desistiu! Tu venceste!`);
    });

    channel.on("broadcast",{ event:"ludo_resync_req" },()=>{
      if(winnerRef.current||phaseRef.current==="done") return;
      channel.send({ type:"broadcast", event:"ludo_resync_state", payload:{
        pieces:piecesRef.current, turn:turnRef.current, phase:phaseRef.current,
        diceBlue:diceBlueRef.current, diceGreen:diceGreenRef.current,
        stateSeq:stateSyncSeqRef.current,
        sourcePlayer:myColor,
      }});
    });

    channel.on("broadcast",{ event:"ludo_resync_state" },({ payload })=>{
       const p=payload as{pieces:GamePiece[];turn:Player;phase:Phase;diceBlue:number|null;diceGreen:number|null;stateSeq?:number;sourcePlayer?:Player};
      const sourcePlayer = p.sourcePlayer === "blue" || p.sourcePlayer === "green"
        ? p.sourcePlayer
        : other(myColor);
      if(sourcePlayer===myColor) return;
      if(typeof p.stateSeq==="number" && p.stateSeq <= remoteStateSeqRef.current[sourcePlayer]) return;
      if(typeof p.stateSeq==="number") remoteStateSeqRef.current[sourcePlayer]=p.stateSeq;
       const previousTurn = turnRef.current;
      setPieces(p.pieces); setTurn(p.turn); setPhase(p.phase);
      setDiceBlue(p.diceBlue); setDiceGreen(p.diceGreen);
      piecesRef.current=p.pieces; turnRef.current=p.turn; phaseRef.current=p.phase;
      diceBlueRef.current=p.diceBlue; diceGreenRef.current=p.diceGreen;
       if(p.phase==="roll" && p.turn!==previousTurn){
         turnEpochRef.current++;
         rolledEpochRef.current=null;
         if(p.turn===myColor) rollConsumedRef.current=false;
       }
      rollBusyRef.current = false;
    });

    // ── Authoritative state sync — sent by the moving player after every move ──
    channel.on("broadcast",{ event:"ludo_state_sync" },({ payload })=>{
      if(phaseRef.current==="done") return;
       const p=payload as{pieces:GamePiece[];turn:Player;phase:Phase;diceBlue:number|null;diceGreen:number|null;stateSeq?:number;sourcePlayer?:Player;winner?:Player};
       const sourcePlayer = p.sourcePlayer === "blue" || p.sourcePlayer === "green"
         ? p.sourcePlayer
         : other(myColor);
       if(sourcePlayer===myColor) return;
      const stateSeq = typeof p.stateSeq==="number" ? p.stateSeq : null;
       if(stateSeq !== null && stateSeq <= remoteStateSeqRef.current[sourcePlayer]) return;
       if(stateSeq !== null) remoteStateSeqRef.current[sourcePlayer]=stateSeq;
      // Delay slightly so ongoing capture animation can finish before state is overwritten
      setTimeout(()=>{
        // A newer sync may have arrived while this one was waiting for the
        // remote movement animation to finish.
         if(stateSeq !== null && stateSeq !== remoteStateSeqRef.current[sourcePlayer]) return;
        // A same-player "roll" snapshot can be an old hand-off arriving after
        // the local player already rolled. It must never re-arm the die.
        // Only ownership changing to the other player starts a new turn here;
        // the local player already advances its epoch when it grants a legal
        // extra turn (six/capture/finish).
        const isNewRollTurn =
          p.phase === "roll" &&
          p.turn !== turnRef.current;
        if(isNewRollTurn){
          turnEpochRef.current++;
          rolledEpochRef.current = null;
          if(p.turn===myColor) rollConsumedRef.current = false;
        }
        setPieces(p.pieces);
        setTurn(p.turn);
        setPhase(p.phase);
        setDiceBlue(p.diceBlue??null);
        setDiceGreen(p.diceGreen??null);
        piecesRef.current=p.pieces;
        turnRef.current=p.turn;
        phaseRef.current=p.phase;
        diceBlueRef.current=p.diceBlue??null;
        diceGreenRef.current=p.diceGreen??null;
        // The sync is authoritative. An interrupted remote animation must
        // never leave the board locked for the next local turn.
        moveBusyRef.current = false;
         rollBusyRef.current = false;
        if(p.winner){
          setWinner(p.winner);
          winnerRef.current=p.winner;
          phaseRef.current="done";
        } else if(p.phase==="roll"){
          setMsg(p.turn===myColor ? myTurnMsg : oppTurnMsg);
        }
      },200);
    });

    channel.on("broadcast",{ event:"rematch_request" },({ payload })=>{
      setRematchRequester((payload.name as string) ?? opponentName);
      setRematchPhase("received");
    });

    channel.on("broadcast",{ event:"rematch_response" },async({ payload })=>{
      if(payload.accepted){
        if(BET_AMOUNT > 0 && profile?.id){
          const result = await serverBet(BET_AMOUNT, "ludo", "Aposta de revanche (Ludo)");
          if(!result.ok){
            channel.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } }).catch(()=>{});
            setRematchPhase("no_balance");
            return;
          }
          await refreshProfile();
        }
        setRematchPhase("idle");
        resetGame();
        // Prevent channel re-subscribe from deducting the bet a second time
        betDeductedRef.current = true;
      } else if((payload.reason as string)==="no_balance"){
        setRematchPhase("opp_no_balance");
      } else {
        setRematchPhase("declined");
      }
    });

    channel.on("presence",{ event:"sync" },()=>{
      const state = channel.presenceState<{ color:string; balance?:string }>();
      const allPresences = Object.values(state).flat() as Array<{ color:string; balance?:string }>;
      for(const p of allPresences){
        if(p.color !== myColor && p.balance){ setOpponentBal(p.balance); }
      }
      // Reward fires only on first real game move (see dice roll send / dice_rolled handler)
      void allPresences;
    });

    channel.subscribe(async(status)=>{
      if(status==="SUBSCRIBED"&&profile?.id){
        await channel.track({ userId:profile.id, color:myColor, balance:playerBal });
        if(_savedLudo&&gameId!=="local"){
          setTimeout(()=>{
            channel.send({type:"broadcast",event:"ludo_resync_req",payload:{}});
          },800);
        }
        // Deduct bet from balance when game starts (once per game) — server-side
        if(BET_AMOUNT > 0 && !betDeductedRef.current){
          betDeductedRef.current = true;
          try {
            const result = await serverBet(BET_AMOUNT, "ludo", "Aposta de jogo (Ludo)", gameId);
            if(!result.ok){ betDeductedRef.current = false; }
            else {
              try { sessionStorage.setItem(`wm_bet_deducted_ludo_${gameId}`, "1"); } catch { /* ignore */ }
              await refreshProfile();
            }
          } catch { betDeductedRef.current = false; }
        }
        // Only "blue" (first player) registers the match to avoid duplicates
        if (myColor === "blue" && BET_AMOUNT > 0 && gameId !== "local") {
          try {
            await supabase.from("matches").upsert({
              id: gameId,
              game_type: "ludo",
              player1_id: profile.id,
              player1_name: playerName,
              player2_name: opponentName,
              bet_amount: BET_AMOUNT,
              winner_payout: Math.floor(BET_AMOUNT * 2 * 0.90),
              status: "active",
              created_at: new Date().toISOString(),
            }, { onConflict: "id" });
          } catch { /* non-critical */ }
        }
      }
    });

    return()=>{ supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[gameId,myColor]);

  // ── Timer — counts down when it's MY turn; wall-clock based to survive tab-switches ──
  const autoPlayRef    = useRef<(()=>void)|null>(null);
  const timerStartRef  = useRef<number>(0);
  autoPlayRef.current  = () => {
    const l    = livesRef.current;
    const nb   = l[myColor] - 1;
    const newLives = { ...l, [myColor]: Math.max(0, nb) };
    setLives(newLives);
    livesRef.current = newLives;
    if (nb <= 0) {
      setWinner(opponentColor); setPhase("done");
      setMsg(`${opponentName} venceu! ${playerName.split(" ")[0]} perdeu todas as vidas.`);
      if (!isBot) channelRef.current?.send({ type:"broadcast", event:"ludo_lives_sync",
        payload:{ lives: newLives, gameOver: true, player: myColor, timedOut: true } });
      return;
    }
    setMsg(`Tempo esgotado! ${playerName.split(" ")[0]} perde 1 vida (${nb} restante${nb===1?"":"s"}).`);
    if (!isBot) channelRef.current?.send({ type:"broadcast", event:"ludo_lives_sync",
      payload:{ lives: newLives, gameOver: false, player: myColor, timedOut: true } });
    const cur = phaseRef.current;
    const mv  = movableRef.current;
    const dv  = myColor === "blue" ? diceBlueRef.current : diceGreenRef.current;
    if (cur === "roll") {
      autoMoveAfterRollRef.current = true;
      setTimeout(() => void doRoll(), 200);
    }
    else if (cur === "select" && mv.length > 0 && dv !== null)
      setTimeout(() => doSelectPiece(mv[Math.floor(Math.random() * mv.length)], dv, myColor, piecesRef.current), 200);
  };

  // ── Local countdown for opponent timer (keeps ticking even when their tab is throttled) ──
  useEffect(()=>{
    if(winner||isBot||gameId==="local"||turn===myColor) return;
    oppTimerRecvAtRef.current  = Date.now();
    oppTimerRecvValRef.current = 30;
    const tick = setInterval(()=>{
      const elapsed = Math.floor((Date.now() - oppTimerRecvAtRef.current) / 1000);
      const t = Math.max(0, oppTimerRecvValRef.current - elapsed);
      setOpponentTimeLeft(t);
    }, 400);
    return ()=>clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn, winner]);

  useEffect(() => {
    setTimeLeft(30);
    if (winner || (phase !== "roll" && phase !== "select") || turn !== myColor) return;
    timerStartRef.current = Date.now();
    channelRef.current?.send({ type:"broadcast", event:"ludo_timer", payload:{ player:myColor, t:30 } });

    let firedExpiry = false;
    const fireExpiry = () => {
      if (firedExpiry) return;
      firedExpiry = true;
      setTimeout(() => autoPlayRef.current?.(), 0);
    };

    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
      const newT    = Math.max(0, 30 - elapsed);
      setTimeLeft(newT);
      channelRef.current?.send({ type:"broadcast", event:"ludo_timer", payload:{ player:myColor, t:newT } });
      if (newT <= 0) { clearInterval(tick); fireExpiry(); }
    }, 400); // check every 400ms — stays accurate even when throttled

    // Catch-up on visibility-change: recalculate immediately when tab is refocused
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
      const newT    = Math.max(0, 30 - elapsed);
      setTimeLeft(newT);
      channelRef.current?.send({ type:"broadcast", event:"ludo_timer", payload:{ player:myColor, t:newT } });
      if (newT <= 0) { clearInterval(tick); fireExpiry(); }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, winner, myColor]);

  function resetGame(){
    betDeductedRef.current=false;
    winCreditedRef.current=false;
    rewardFiredRef.current=false;
    setPieces(initialPieces()); setTurn("blue"); setPhase("roll");
    setDiceBlue(null); setDiceGreen(null); setRollingB(false); setRollingG(false);
    setMovable([]); setWinner(null); setLives({blue:5,green:5}); setTimeLeft(30);
    setOpponentTimeLeft(30);
    setStuckTurns({blue:0,green:0}); consecutiveSixesRef.current=0;
    autoMoveAfterRollRef.current = false;
    rollBusyRef.current = false;
    turnEpochRef.current = 0;
    rolledEpochRef.current = null;
    rollConsumedRef.current = false;
    remoteStateSeqRef.current = {blue:0,green:0};
    moveBusyRef.current = false;
    lastEventSeqRef.current = {};
    setMsg(myColor==="blue"?myTurnMsg:oppTurnMsg);
  }

  function handleForfeit(){
    if(winner||phase==="done")return;
    if(!window.confirm("Tens a certeza que queres desistir? Irás perder a partida."))return;
    if(!isBot) channelRef.current?.send({type:"broadcast",event:"ludo_forfeit",payload:{player:myColor}});
    setWinner(opponentColor); setPhase("done");
    setMsg("Desististe da partida.");
  }

  function handleBack(){
    if(!winner&&phase!=="done"&&gameId!=="local"&&BET_AMOUNT>0){
      try {
        localStorage.setItem("wm_active_game", JSON.stringify({
          gameId, gameType:"ludo", betAmount:BET_AMOUNT,
          opponentName, savedAt:Date.now(), ttlMs:30*60_000,
          playerColor: myColor, playerName,
        }));
      } catch { /* ignore */ }
    }
    setLocation("/");
  }

  async function handleReplay(){
    if(gameId==="local"||BET_AMOUNT===0){ resetGame(); return; }
    // Bot rematch: just deduct + reset immediately
    if(isBot){
      if(!profile?.id) return;
      try{
        const result = await serverBet(BET_AMOUNT, "ludo", "Aposta de revanche (Ludo) vs bot");
        if(!result.ok){ setRematchPhase("no_balance"); return; }
        await refreshProfile();
        resetGame();
      }catch{ setRematchPhase("no_balance"); }
      return;
    }
    if(!profile?.id){ setRematchPhase("no_balance"); return; }
    if(!channelRef.current){ setRematchPhase("no_balance"); return; }
    setRematchPhase("waiting");
    channelRef.current.send({ type:"broadcast", event:"rematch_request", payload:{ name: playerName.split(" ")[0] } }).catch(()=>{});
  }

  async function handleRematchAccept(){
    if(!profile?.id) return;
    if(BET_AMOUNT>0){
      const result = await serverBet(BET_AMOUNT, "ludo", "Aposta de revanche (Ludo)").catch(()=>null);
      if(!result?.ok){
        channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } });
        setRematchPhase("opp_no_balance"); return;
      }
      await refreshProfile();
    }
    channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:true } });
    setRematchPhase("idle");
    resetGame();
    betDeductedRef.current = true;
  }

  function handleRematchDecline(){
    channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"declined" } });
    setRematchPhase("idle");
  }

  const blueFinished  = finishedCount(pieces,"blue");
  const greenFinished = finishedCount(pieces,"green");

  // Keep the local player at the bottom of the screen. The board is rotated
  // separately for green, so the panel order must follow the same perspective.
  function renderPlayerPanel(player:Player){
    const isGreen = player === "green";
    return (
      <div key={player} style={{ padding:player===opponentColor ? "5px 10px 3px" : "2px 10px 3px", flexShrink:0 }}>
        <PlayerPanel
          player={player}
          name={myColor===player ? playerName : opponentName}
          balance={myColor===player ? playerBal : opponentBal}
          isActive={turn===player&&!winner}
          diceValue={isGreen ? diceGreen : diceBlue}
          rolling={isGreen ? rollingGreen : rollingBlue}
          onRoll={doRoll}
          finished={isGreen ? greenFinished : blueFinished}
          lives={isGreen ? lives.green : lives.blue}
          timeLeft={myColor===player ? timeLeft : opponentTimeLeft}
          isMe={myColor===player}
          canRoll={phase==="roll" && !winner && !rollBusyRef.current}
        />
      </div>
    );
  }

  return (
    <div className="responsive-game-viewport" style={{
      height:"100vh", width:"100%", overflow:"hidden",
      background:"#fff",
      display:"flex", justifyContent:"center",
    }}>

      <div className="responsive-game-shell" style={{
        width:"100%", maxWidth:430,
        height:"100vh", overflow:"hidden",
        display:"flex", flexDirection:"column",
        position:"relative",
      }}>

        {/* ── Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 14px 8px",
          borderBottom:"1px solid #e5e7eb",
          background:"#fff",
          flexShrink:0,
        }}>
          <button onClick={handleBack} style={{
            width:34, height:34,
            background:"none",
            border:"1px solid #e5e7eb",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}>
            <ArrowLeft style={{ width:16, height:16, color:"#374151" }}/>
          </button>
          <div style={{ textAlign:"center" }}>
            <p style={{
              fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:17,
              color:"#0a0a0a", lineHeight:1, letterSpacing:5,
            }}>LUDO</p>
            <p style={{ fontSize:9, color:"#9ca3af", marginTop:1, letterSpacing:2.5, fontWeight:700 }}>
              1 VS 1
            </p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {!winner&&phase!=="done"&&gameId!=="local"&&(
              <button onClick={handleForfeit} style={{width:34,height:34,
                background:"#fef2f2",border:"1px solid #fecaca",
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <LogOut style={{width:15,height:15,color:"#EF4444"}}/>
              </button>
            )}
            <div style={{
              padding:"4px 10px",
              background:"#fefce8",
              border:"1px solid #fde68a",
            }}>
              <span style={{ fontSize:10, color:"#92400e", fontWeight:700, fontFamily:"'Syne',sans-serif" }}>
                {BET_AMOUNT>0?`${BET_AMOUNT} MT`:"Demo"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Opponent panel: always above the board */}
        {renderPlayerPanel(opponentColor)}

        {/* ── Status message */}
        <div style={{ padding:"2px 10px", flexShrink:0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={msg}
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              transition={{duration:0.18}}
              style={{textAlign:"center"}}>
              <p style={{
                fontSize:10.5, fontWeight:600,
                color:"#6b7280", letterSpacing:0.2, lineHeight:1,
              }}>{msg}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Board */}
        <div style={{
          flex:1, minHeight:0,
          padding:"0 8px",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{ width:"100%", maxHeight:"100%", aspectRatio:"1" }}>
             <Board
               pieces={pieces}
               movable={movable}
               onSelectPiece={handleSelectPiece}
               rotateForPlayer={myColor==="green"}
             />
          </div>
        </div>

        {/* ── Turn indicator */}
        <div style={{ padding:"2px 10px 2px", display:"flex", justifyContent:"center", flexShrink:0 }}>
          <motion.div
            animate={{ opacity:[0.6,1,0.6] }}
            transition={{ duration:1.8, repeat:Infinity }}
            style={{
              display:"flex", alignItems:"center", gap:4,
              background:"#f8fafc",
              border:"1px solid #e5e7eb",
              borderRadius:20, padding:"3px 10px",
            }}>
            <div style={{
              width:4.5, height:4.5, borderRadius:"50%",
              background:turn==="blue"?"#4F8EF7":"#34D469",
              boxShadow:turn==="blue"?"0 0 4px #4F8EF7":"0 0 4px #34D469",
            }}/>
            <span style={{
              fontSize:9, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase",
              color:turn==="blue"?"#3b82f6":"#22c55e",
            }}>
              {turn===myColor
                ?`Tua vez — ${playerName.split(" ")[0]}`
                :`Vez de ${opponentName}`
              }
            </span>
          </motion.div>
        </div>

        {/* ── Local player panel: always below the board */}
        {renderPlayerPanel(myColor)}

        {/* ── Ad banner */}
        <div style={{ padding:"0 10px 5px", flexShrink:0 }}>
          <AdBanner compact />
        </div>

      </div>

      {/* ── Win overlay */}
      <AnimatePresence>
        {winner && (
          <WinScreen
            winner={winner}
            winnerName={winner===myColor?playerName:opponentName}
            loserName={winner===myColor?opponentName:playerName}
            betAmount={BET_AMOUNT}
            isWinner={winner===myColor}
            onReplay={handleReplay}
            onQuit={()=>setLocation("/")}
          />
        )}
      </AnimatePresence>

      {/* ── Rematch overlay */}
      <AnimatePresence>
        {rematchPhase!=="idle"&&(
          <RematchOverlay
            phase={rematchPhase}
            requesterName={rematchRequester||opponentName}
            onAccept={handleRematchAccept}
            onDecline={handleRematchDecline}
            onClose={()=>setRematchPhase("idle")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
