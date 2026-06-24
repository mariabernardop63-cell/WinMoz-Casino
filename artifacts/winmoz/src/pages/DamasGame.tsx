import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { evaluateBotDifficulty, getBotDifficultySync } from "@/lib/botBrain";
import AdBanner from "@/components/AdBanner";
import captureSoundUrl from "@assets/som_para_quando_o_peao_é_matado_1781479683373.mp3";

// ─── Sound helpers ────────────────────────────────────────────────────────────
function playDamasCapture() {
  try { const a = new Audio(captureSoundUrl); a.volume = 0.65; a.play().catch(()=>{}); } catch {}
}
function playDamasMove() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
    // Short percussive wood-on-wood "clack" — two layered tones
    const freqs = [280, 420];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.018;
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.2);
    });
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PColor = "w" | "b";
interface Piece { color: PColor; isDame: boolean; }
type Cell = Piece | null;
type Board = Cell[][];
type Sq = [number, number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inB = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const isLight = (r: number, c: number) => (r + c) % 2 === 0;
const sqKey = (r: number, c: number) => `${r},${c}`;
const opp = (c: PColor): PColor => c === "w" ? "b" : "w";

// ─── Board Operations ─────────────────────────────────────────────────────────
function makeInitialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++)
    if (isLight(r, c)) b[r][c] = { color: "b", isDame: false };
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++)
    if (isLight(r, c)) b[r][c] = { color: "w", isDame: false };
  return b;
}

function cloneBoard(b: Board): Board { return b.map(row => [...row]); }

function applyBoardMove(b: Board, from: Sq, to: Sq, captured: Sq[]): Board {
  const nb = cloneBoard(b);
  const piece = nb[from[0]][from[1]]!;
  nb[to[0]][to[1]] = piece;
  nb[from[0]][from[1]] = null;
  for (const [cr, cc] of captured) nb[cr][cc] = null;
  if (!piece.isDame) {
    if (piece.color === "w" && to[0] === 0) nb[to[0]][to[1]] = { ...piece, isDame: true };
    if (piece.color === "b" && to[0] === 7) nb[to[0]][to[1]] = { ...piece, isDame: true };
  }
  return nb;
}

// ─── Move Logic ───────────────────────────────────────────────────────────────
// forbiddenDir: direction the king just came FROM — prevents reversing along the same diagonal
function getCaptures(
  b: Board, r: number, c: number,
  excl: Set<string> = new Set(),
  forbiddenDir?: [number, number]
): { to: Sq; cap: Sq }[] {
  const piece = b[r][c];
  if (!piece) return [];
  const color = piece.color;
  const res: { to: Sq; cap: Sq }[] = [];

  if (piece.isDame) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as [number,number][]) {
      // Kings cannot reverse direction along the same diagonal in a chain capture
      if (forbiddenDir && dr === forbiddenDir[0] && dc === forbiddenDir[1]) continue;
      let nr = r+dr, nc = c+dc, found: Sq | null = null;
      while (inB(nr, nc)) {
        const cell = b[nr][nc]; const k = sqKey(nr, nc);
        if (!found) {
          if (cell && cell.color !== color && !excl.has(k)) found = [nr, nc];
          else if (cell) break;
        } else {
          if (!cell) res.push({ to: [nr, nc], cap: found });
          else if (!excl.has(k)) break;
        }
        nr += dr; nc += dc;
      }
    }
  } else {
    // Em Damas portuguesas, peças normais PODEM comer para trás (todas as 4 diagonais)
    const dirs: [number,number][] = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of dirs) {
      const mr = r+dr, mc = c+dc, tr = r+2*dr, tc = c+2*dc;
      if (!inB(mr, mc) || !inB(tr, tc)) continue;
      const mid = b[mr][mc];
      if (mid && mid.color !== color && !excl.has(sqKey(mr, mc)) && !b[tr][tc])
        res.push({ to: [tr, tc], cap: [mr, mc] });
    }
  }
  return res;
}

function maxDepth(
  b: Board, r: number, c: number,
  excl: Set<string> = new Set(),
  forbiddenDir?: [number, number]
): number {
  const caps = getCaptures(b, r, c, excl, forbiddenDir);
  if (!caps.length) return 0;
  let mx = 0;
  for (const { to, cap } of caps) {
    const ne = new Set(excl); ne.add(sqKey(cap[0], cap[1]));
    const tb = cloneBoard(b);
    tb[to[0]][to[1]] = tb[r][c]; tb[r][c] = null; tb[cap[0]][cap[1]] = null;
    // Propagate forbidden direction: next step cannot reverse what we just did
    const piece = tb[to[0]][to[1]];
    const mdr = Math.sign(to[0] - r), mdc = Math.sign(to[1] - c);
    const nextForbidden: [number,number] | undefined = piece?.isDame ? [-mdr as -1|1, -mdc as -1|1] : undefined;
    const d = 1 + maxDepth(tb, to[0], to[1], ne, nextForbidden);
    if (d > mx) mx = d;
  }
  return mx;
}

// Reconstruct intermediate positions for chain capture animation
function computeChainPath(board: Board, move: { from: Sq; to: Sq; captured: Sq[] }): Array<{ from: Sq; to: Sq; cap: Sq }> {
  if (move.captured.length <= 1)
    return move.captured.length === 1
      ? [{ from: move.from, to: move.to, cap: move.captured[0] }]
      : [];
  const steps: Array<{ from: Sq; to: Sq; cap: Sq }> = [];
  let cur: Sq = move.from;
  let curBoard = cloneBoard(board);
  for (let i = 0; i < move.captured.length; i++) {
    const cap = move.captured[i];
    const isLast = i === move.captured.length - 1;
    const dr = Math.sign(cap[0] - cur[0]);
    const dc = Math.sign(cap[1] - cur[1]);
    let landing: Sq;
    if (isLast) {
      landing = move.to;
    } else {
      // Find first empty square past the captured piece in capture direction
      let tr = cap[0] + dr, tc = cap[1] + dc;
      while (inB(tr, tc) && curBoard[tr][tc] !== null) { tr += dr; tc += dc; }
      landing = inB(tr, tc) ? [tr, tc] : move.to;
    }
    steps.push({ from: cur, to: landing, cap });
    // Update temp board (no promotion) for next step
    const nb = cloneBoard(curBoard);
    nb[landing[0]][landing[1]] = nb[cur[0]][cur[1]]; nb[cur[0]][cur[1]] = null; nb[cap[0]][cap[1]] = null;
    curBoard = nb;
    cur = landing;
  }
  return steps;
}

// Returns only captures that are on maximum-depth paths (mandatory maximum capture rule)
function filterMaxCaptures(
  b: Board, r: number, c: number,
  excl: Set<string> = new Set(),
  forbiddenDir?: [number, number]
): { to: Sq; cap: Sq }[] {
  const all = getCaptures(b, r, c, excl, forbiddenDir);
  if (all.length <= 1) return all;
  const withDepth = all.map(({ to, cap }) => {
    const ne = new Set(excl); ne.add(sqKey(cap[0], cap[1]));
    const nb = cloneBoard(b);
    nb[to[0]][to[1]] = nb[r][c]; nb[r][c] = null; nb[cap[0]][cap[1]] = null;
    const piece = nb[to[0]][to[1]];
    const mdr = Math.sign(to[0] - r), mdc = Math.sign(to[1] - c);
    const nextForbidden: [number,number] | undefined = piece?.isDame ? [-mdr as -1|1, -mdc as -1|1] : undefined;
    return { to, cap, total: 1 + maxDepth(nb, to[0], to[1], ne, nextForbidden) };
  });
  const mx = Math.max(...withDepth.map(x => x.total));
  return withDepth.filter(x => x.total === mx).map(({ to, cap }) => ({ to, cap }));
}

function getNonCaptures(b: Board, r: number, c: number): Sq[] {
  const piece = b[r][c]; if (!piece) return [];
  const res: Sq[] = [];
  if (piece.isDame) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as [number,number][]) {
      let nr = r+dr, nc = c+dc;
      while (inB(nr, nc) && !b[nr][nc]) { res.push([nr, nc]); nr += dr; nc += dc; }
    }
  } else {
    const dirs: [number,number][] = piece.color === "w" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
    for (const [dr, dc] of dirs) { const nr=r+dr, nc=c+dc; if(inB(nr,nc)&&!b[nr][nc]) res.push([nr,nc]); }
  }
  return res;
}

function countPieces(b: Board, c: PColor) {
  let n = 0;
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) if (b[r][col]?.color === c) n++;
  return n;
}
function allKings(b: Board): boolean {
  return b.flat().every(cell => cell === null || cell.isDame);
}

function getSelectablePieces(b: Board, color: PColor): { sq: Sq; depth: number }[] {
  const all: { sq: Sq; depth: number }[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (b[r][c]?.color !== color) continue;
    const d = maxDepth(b, r, c);
    if (d > 0) all.push({ sq: [r, c], depth: d });
  }
  if (all.length > 0) {
    const mx = Math.max(...all.map(x => x.depth));
    return all.filter(x => x.depth === mx);
  }
  const nonCap: { sq: Sq; depth: number }[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (b[r][c]?.color === color && getNonCaptures(b, r, c).length > 0)
      nonCap.push({ sq: [r, c], depth: 0 });
  }
  return nonCap;
}

// ─── Bot AI Engine ────────────────────────────────────────────────────────────

interface AIMove { from: Sq; to: Sq; captured: Sq[]; }

function _expandAIMoves(
  board: Board, orig: Sq, cur: Sq,
  caps: Sq[], excl: Set<string>, out: AIMove[],
  forbiddenDir?: [number, number]
): void {
  const nextCaps = getCaptures(board, cur[0], cur[1], excl, forbiddenDir);
  if (nextCaps.length === 0) {
    if (caps.length > 0) out.push({ from: orig, to: cur, captured: caps });
    return;
  }
  for (const { to, cap } of nextCaps) {
    const nb = cloneBoard(board);
    nb[to[0]][to[1]] = nb[cur[0]][cur[1]];
    nb[cur[0]][cur[1]] = null;
    nb[cap[0]][cap[1]] = null;
    const piece = nb[to[0]][to[1]]!;
    if (!piece.isDame) {
      if (piece.color === "w" && to[0] === 0) nb[to[0]][to[1]] = { ...piece, isDame: true };
      if (piece.color === "b" && to[0] === 7) nb[to[0]][to[1]] = { ...piece, isDame: true };
    }
    const ne = new Set(excl); ne.add(sqKey(cap[0], cap[1]));
    // King: after moving in direction (dr,dc), the reverse direction is forbidden next
    const mdr = Math.sign(to[0] - cur[0]), mdc = Math.sign(to[1] - cur[1]);
    const nextForbidden: [number,number] | undefined = piece.isDame ? [-mdr as -1|1, -mdc as -1|1] : undefined;
    _expandAIMoves(nb, orig, to, [...caps, cap], ne, out, nextForbidden);
  }
}

function aiGetAllMoves(b: Board, color: PColor): AIMove[] {
  const captures: AIMove[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c]?.color === color)
        _expandAIMoves(b, [r, c], [r, c], [], new Set(), captures);
  if (captures.length > 0) {
    // Enforce mandatory maximum capture rule: only return chains with most captures
    const maxCaps = Math.max(...captures.map(m => m.captured.length));
    return captures.filter(m => m.captured.length === maxCaps);
  }
  const moves: AIMove[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c]?.color === color)
        for (const to of getNonCaptures(b, r, c))
          moves.push({ from: [r, c], to, captured: [] });
  return moves;
}

function getMobility(b: Board, color: PColor): number {
  let count = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (b[r][c]?.color !== color) continue;
      count += getCaptures(b, r, c).length + getNonCaptures(b, r, c).length;
    }
  return count;
}

function aiEval(b: Board, forColor: PColor): number {
  const oppColor = opp(forColor);
  let score = 0;
  const forPieces: Array<{ r: number; c: number; isDame: boolean }> = [];
  const oppPieces: Array<{ r: number; c: number; isDame: boolean }> = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (!p) continue;
      const sign = p.color === forColor ? 1 : -1;
      const pieceVal = p.isDame ? 300 : 100;
      const adv = p.isDame ? 0 : (p.color === "w" ? (7 - r) * 6 : r * 6);
      const back = !p.isDame && ((p.color === "w" && r === 7) || (p.color === "b" && r === 0)) ? 15 : 0;
      const center = (r >= 2 && r <= 5 && c >= 1 && c <= 6) ? 8 : 0;
      score += sign * (pieceVal + adv + back + center);
      if (p.color === forColor) forPieces.push({ r, c, isDame: p.isDame });
      else oppPieces.push({ r, c, isDame: p.isDame });
    }
  }

  const forKings = forPieces.filter(p => p.isDame);
  const oppKings = oppPieces.filter(p => p.isDame);

  // ── King endgame: we have kings + opponent has only 1 king left ──────────
  if (oppPieces.length === 1 && oppKings.length === 1 && forPieces.length >= 2 && forKings.length >= 1) {
    const ok = oppKings[0];
    // Push opponent king to corners/edges (centre distance = escaping space)
    const centerDist = Math.abs(ok.r - 3.5) + Math.abs(ok.c - 3.5);
    score += centerDist * 35; // opponent near corner = much better for us

    // Bring ALL our kings as close as possible to opponent king
    for (const fk of forKings) {
      const dist = Math.abs(fk.r - ok.r) + Math.abs(fk.c - ok.c);
      score -= dist * 22;
    }

    // Restrict opponent mobility heavily
    const oppMob = getMobility(b, oppColor);
    score -= oppMob * 40;

    // Triangulation bonus: multiple kings surrounding opponent
    if (forKings.length >= 2) {
      const dists = forKings.map(fk => Math.abs(fk.r - ok.r) + Math.abs(fk.c - ok.c)).sort((a, b) => a - b);
      if (dists[0] <= 3) score += 60;
      if (dists.length >= 2 && dists[1] <= 5) score += 45;
    }
  } else if (forKings.length >= 1 || oppKings.length >= 1) {
    // General king/endgame mobility advantage
    const forMob = getMobility(b, forColor);
    const oppMob = getMobility(b, oppColor);
    score += (forMob - oppMob) * 5;
  }

  return score;
}

function _minimax(b: Board, depth: number, alpha: number, beta: number, maximizing: boolean, botColor: PColor): number {
  const curColor: PColor = maximizing ? botColor : opp(botColor);
  const moves = aiGetAllMoves(b, curColor);
  if (depth === 0 || moves.length === 0) return aiEval(b, botColor);
  if (maximizing) {
    let best = -Infinity;
    for (const mv of moves) {
      const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
      best = Math.max(best, _minimax(nb, depth - 1, alpha, beta, false, botColor));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const mv of moves) {
      const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
      best = Math.min(best, _minimax(nb, depth - 1, alpha, beta, true, botColor));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

const AI_DEPTH = 7;

function getBestBotMove(b: Board, botColor: PColor, depth: number = AI_DEPTH): AIMove | null {
  const moves = aiGetAllMoves(b, botColor);
  if (moves.length === 0) return null;
  // Move ordering: captures first → better alpha-beta pruning
  moves.sort((a, z) => z.captured.length - a.captured.length);
  // Easy mode: occasionally return a random legal move (opaque — not every time)
  if (depth < 4 && Math.random() < 0.45) {
    return moves[Math.floor(Math.random() * Math.min(moves.length, 4))];
  }
  // Increase depth for king endgame (opponent has single king, we must corner it)
  const oppColor = opp(botColor);
  const oppPieces = b.flat().filter(p => p?.color === oppColor);
  const allKingsOnly = b.flat().every(p => p === null || p.isDame);
  const endgameDepth = (oppPieces.length <= 2 && allKingsOnly) ? Math.max(depth, 10) : depth;

  let bestMove: AIMove = moves[0];
  let bestVal = -Infinity;
  for (const mv of moves) {
    const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
    const val = _minimax(nb, endgameDepth - 1, -Infinity, Infinity, false, botColor);
    if (val > bestVal) { bestVal = val; bestMove = mv; }
  }
  return bestMove;
}

// ─── Timer Arc ────────────────────────────────────────────────────────────────
function TimerArc({ val, total=30, size=28 }: { val: number; total?: number; size?: number }) {
  const r = (size - 4) / 2, circ = 2 * Math.PI * r;
  const fill = val / total;
  const col = val > 10 ? "#4ade80" : val > 5 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", display:"block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ*(1-fill)} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.85s linear,stroke 0.3s" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:8, fontWeight:800, color:col, lineHeight:1 }}>{val}</span>
      </div>
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ color, name, balance, isMe, isActive, piecesLeft, damesLeft, timeLeft, lives }: {
  color: PColor; name: string; balance: string; isMe: boolean;
  isActive: boolean; piecesLeft: number; damesLeft: number; timeLeft: number; lives: number;
}) {
  const isWhite = color === "w";
  const accentColor = isWhite ? "#D4A35A" : "#5C7A2E";
  const pieceGrad = isWhite
    ? "radial-gradient(circle at 35% 30%,#F5F0E8,#C8C0A8,#A89880)"
    : "radial-gradient(circle at 35% 30%,#4A4040,#2A2020,#181010)";
  return (
    <div style={{
      display:"flex", alignItems:"center",
      background:"#FFFFFF", borderRadius:14,
      border:`2px solid ${isActive ? accentColor : "#E2E8F0"}`,
      overflow:"hidden", height:60,
      boxShadow: isActive ? `0 4px 20px ${accentColor}30,0 1px 4px rgba(0,0,0,0.06)` : "0 1px 6px rgba(0,0,0,0.07)",
      transition:"border-color 0.3s,box-shadow 0.3s",
    }}>
      <div style={{ width:4, alignSelf:"stretch", flexShrink:0,
        background: isActive ? `linear-gradient(180deg,${accentColor},${accentColor}88)` : "#E2E8F0",
        transition:"background 0.3s" }}/>
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, margin:"0 8px",
        background:pieceGrad, border:`2px solid ${isActive ? accentColor+"50" : "#E2E8F0"}`,
        boxShadow:`inset 0 2px 4px rgba(255,255,255,0.3),inset 0 -2px 3px rgba(0,0,0,0.2)`,
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {damesLeft > 0 && <span style={{ fontSize:14 }}>👑</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
          <span style={{ fontWeight:700, fontSize:13, color: isActive ? "#0F172A" : "#94A3B8",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 }}>{name}</span>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase",
            color: isMe ? "#FFFFFF" : "#64748B",
            background: isMe ? accentColor : "#E2E8F0", borderRadius:4, padding:"2px 5px", flexShrink:0 }}>
            {isMe?"Tu":"Rival"}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:10, color:"rgba(0,0,0,0.35)", fontWeight:600 }}>{balance}</span>
          <span style={{ fontSize:10, color: isActive ? accentColor : "#94A3B8", fontWeight:700 }}>
            {piecesLeft} peças{damesLeft > 0 ? ` (${damesLeft} 👑)` : ""}
          </span>
        </div>
      </div>
      <div style={{ padding:"0 10px 0 4px", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
        {isActive ? <TimerArc val={timeLeft}/> : <div style={{ width:28, height:28 }}/>}
        <div style={{ display:"flex", gap:3 }}>
          {Array.from({ length: 5 }).map((_, i) => {
            const alive = i < lives;
            return (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: alive ? "#EF4444" : "#CBD5E1",
                border: alive ? "none" : "1px solid #94A3B8",
                boxShadow: alive ? "0 0 4px rgba(239,68,68,0.6)" : "none",
                transition: "all 0.3s ease",
              }}/>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Rematch types & overlay ──────────────────────────────────────────────────
type RematchPhase = "idle"|"checking"|"no_balance"|"waiting"|"received"|"declined"|"opp_no_balance";

function RematchOverlay({ phase, requesterName, onAccept, onDecline, onClose }: {
  phase: RematchPhase; requesterName: string;
  onAccept: () => void; onDecline: () => void; onClose: () => void;
}) {
  const msgs: Record<RematchPhase, { title: string; body: string; actions?: "accept_decline"|"close" }> = {
    idle:          { title:"", body:"" },
    checking:      { title:"A verificar saldo…", body:"Por favor aguarda.", actions:"close" },
    no_balance:    { title:"Saldo insuficiente", body:`Precisas de pelo menos ${0} MT para rever o desafio.`, actions:"close" },
    waiting:       { title:"Desafio enviado!", body:`Aguardando resposta de ${requesterName}…`, actions:"close" },
    received:      { title:`${requesterName} quer revanche!`, body:"Aceitas o desafio?", actions:"accept_decline" },
    declined:      { title:"Desafio recusado", body:`${requesterName} recusou a revanche.`, actions:"close" },
    opp_no_balance:{ title:"Adversário sem saldo", body:`${requesterName} não tem saldo suficiente.`, actions:"close" },
  };
  const m = msgs[phase];
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)" }}>
      <motion.div initial={{ scale:0.85, y:20 }} animate={{ scale:1, y:0 }}
        transition={{ type:"spring", stiffness:280, damping:22 }}
        style={{ width:"82%", maxWidth:300, background:"rgba(18,28,18,0.98)",
          border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:"28px 22px 22px",
          boxShadow:"0 24px 60px rgba(0,0,0,0.6)", textAlign:"center" }}>
        <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18,
          color:"#E8F0FF", marginBottom:8 }}>{m.title}</p>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:20, lineHeight:1.5 }}>{m.body}</p>
        {m.actions === "accept_decline" ? (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onDecline} style={{ flex:1, padding:"12px 0", borderRadius:12,
              background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)",
              color:"#EF4444", fontWeight:700, fontSize:13, cursor:"pointer" }}>Recusar</button>
            <button onClick={onAccept} style={{ flex:1, padding:"12px 0", borderRadius:12,
              background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none",
              color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Aceitar</button>
          </div>
        ) : (
          <button onClick={onClose} style={{ width:"100%", padding:"12px 0", borderRadius:12,
            background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
            color:"rgba(255,255,255,0.7)", fontWeight:700, fontSize:13, cursor:"pointer" }}>Fechar</button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Win Screen ───────────────────────────────────────────────────────────────
function DrawScreen({ onContinue, movesLeft }: { onContinue: () => void; movesLeft: number }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:"absolute", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(5,12,5,0.92)", backdropFilter:"blur(6px)" }}>
      <motion.div initial={{ scale:0.6, opacity:0, y:40 }} animate={{ scale:1, opacity:1, y:0 }}
        transition={{ type:"spring", stiffness:260, damping:22 }}
        style={{ background:"linear-gradient(160deg,#1a2a1a,#0f1f0f)", borderRadius:28,
          border:"1.5px solid rgba(212,163,90,0.4)", padding:"32px 28px", width:"85%", maxWidth:340,
          boxShadow:"0 0 60px rgba(212,163,90,0.15)", textAlign:"center" }}>
        <motion.div animate={{ rotate:[0,10,-10,8,-8,0] }} transition={{ delay:0.3, duration:0.7 }}
          style={{ fontSize:52, marginBottom:12 }}>🤝</motion.div>
        <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:26,
          color:"rgba(212,163,90,0.9)", letterSpacing:4, marginBottom:6 }}>EMPATE</p>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:20, lineHeight:1.5 }}>
          Ambos os jogadores só têm damas.{"\n"}Ninguém ganhou nem perdeu.
        </p>
        <div style={{ background:"rgba(212,163,90,0.08)", borderRadius:14, padding:"12px 16px",
          border:"1px solid rgba(212,163,90,0.2)", marginBottom:20 }}>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4, fontWeight:700, letterSpacing:1 }}>
            JOGO REINICIADO AUTOMATICAMENTE
          </p>
          <motion.div animate={{ width:["0%","100%"] }} transition={{ duration:3, ease:"linear" }}
            style={{ height:3, background:"rgba(212,163,90,0.6)", borderRadius:4 }} />
        </div>
        <button onClick={onContinue}
          style={{ width:"100%", height:44, borderRadius:13, border:"none", cursor:"pointer",
            background:"linear-gradient(135deg,#D4A35A,#B8862E)", color:"#fff",
            fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13 }}>
          Continuar agora
        </button>
      </motion.div>
    </motion.div>
  );
}

function WinScreen({ isWinner, winnerName, loserName, betAmount, onReplay, onQuit }: {
  isWinner: boolean; winnerName: string; loserName: string; betAmount: number;
  onReplay: () => void; onQuit: () => void;
}) {
  if (!isWinner) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.82)",
        backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
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
            color:"#6b7280",lineHeight:1.2,marginBottom:4}}>Perdeste para</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#0a0a0a",lineHeight:1.1}}>{winnerName}</p>
        </div>
        <div style={{background:"#fff",padding:"20px 24px 22px"}}>
          {betAmount > 0 && (
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",
              padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",marginBottom:4}}>PERDIDO</p>
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
              <RotateCcw style={{width:13,height:13}}/>Revanche
            </button>
            <button onClick={onQuit} style={{flex:1,background:"#f8fafc",
              border:"1px solid #e5e7eb",color:"#374151",
              padding:"14px 0",fontFamily:"'Syne',sans-serif",fontWeight:700,
              fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <LogOut style={{width:13,height:13}}/>Sair
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.82)",
        backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        style={{background:"#fff",maxWidth:310,width:"88%",overflow:"hidden",
          boxShadow:"0 24px 64px rgba(0,0,0,0.4)",border:"1px solid #e5e7eb"}}>
        <div style={{background:"#f8fafc",padding:"28px 24px 22px",textAlign:"center",borderBottom:"1px solid #e5e7eb"}}>
          <motion.div animate={{y:[0,-4,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <svg width={68} height={68} viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="dwtg2" x1="25%" y1="0%" x2="75%" y2="100%">
                  <stop offset="0%" stopColor="#FFE566"/>
                  <stop offset="50%" stopColor="#FFD700"/>
                  <stop offset="100%" stopColor="#B8860B"/>
                </linearGradient>
              </defs>
              <path d="M28 12 L72 12 L68 52 Q65 64 50 68 Q35 64 32 52 Z" fill="url(#dwtg2)"/>
              <path d="M28 16 Q14 16 14 32 Q14 44 28 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <path d="M72 16 Q86 16 86 32 Q86 44 72 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <rect x="44" y="68" width="12" height="12" fill="url(#dwtg2)" rx="2"/>
              <rect x="30" y="80" width="40" height="7" fill="url(#dwtg2)" rx="3.5"/>
              <ellipse cx="38" cy="30" rx="7" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-18 38 30)"/>
            </svg>
          </motion.div>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
            color:"#9ca3af",marginBottom:6}}>VENCEDOR</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#0a0a0a",lineHeight:1.1}}>{winnerName}</p>
        </div>
        <div style={{background:"#fff",padding:"20px 24px 22px"}}>
          {betAmount > 0 && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",padding:"14px 16px",
              display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",marginBottom:4}}>GANHOS</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#16a34a",lineHeight:1}}>
                  +{Math.floor(betAmount * 2 * 0.90).toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div style={{width:44,height:44,background:"#f0fdf4",border:"1px solid #bbf7d0",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}
          <p style={{fontSize:12,color:"#9ca3af",textAlign:"center",marginBottom:16}}>
            <span style={{color:"#374151",fontWeight:600}}>{loserName}</span> foi eliminado
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} style={{flex:1,background:"#0a0a0a",color:"#fff",
              padding:"14px 0",border:"none",
              fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <RotateCcw style={{width:13,height:13}}/>Jogar Novamente
            </button>
            <button onClick={onQuit} style={{flex:1,background:"#f8fafc",
              border:"1px solid #e5e7eb",color:"#374151",
              padding:"14px 0",fontFamily:"'Syne',sans-serif",fontWeight:700,
              fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <LogOut style={{width:13,height:13}}/>Sair
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────
export default function DamasGame() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const gameId   = sp.get("gameId") ?? "local";
  const myColor  = (sp.get("color") ?? "w") as PColor;
  const BET      = parseInt(sp.get("bet") ?? "0");
  const oppUrl   = sp.get("opp") ?? "";

  const oppColor: PColor = myColor === "w" ? "b" : "w";
  const isBot    = sp.get("bot") === "1";
  const botBal   = parseInt(sp.get("botbalance") ?? "0");
  const myNameUrl = sp.get("myname") ?? "";
  const playerName = myNameUrl ? decodeURIComponent(myNameUrl) : (profile?.full_name ?? "Jogador");
  const playerBal    = profile?.balance ? `${Number(profile.balance).toLocaleString("pt-MZ")} MT` : "0 MT";
  const opponentName = oppUrl ? decodeURIComponent(oppUrl) : "Adversário";

  // Saved state for reconnection support (navigating away and back)
  const _savedDamas = (() => {
    if (gameId === "local") return null;
    try {
      const s = sessionStorage.getItem(`wm_damas_${gameId}`);
      return s ? JSON.parse(s) as { board: Board; turn: PColor; seq: number } : null;
    } catch { return null; }
  })();

  // ── Game state ────────────────────────────────────────────────────────────
  const [board, setBoard]         = useState<Board>(_savedDamas?.board ?? makeInitialBoard());
  const [turn, setTurn]           = useState<PColor>(_savedDamas?.turn ?? "w");
  const [selected, setSelected]   = useState<Sq | null>(null);
  const [validDests, setValidDests] = useState<Sq[]>([]);
  const [validCapDests, setValidCapDests] = useState<{ to: Sq; cap: Sq }[]>([]);
  const [chainPiece, setChainPiece] = useState<Sq | null>(null);
  const [chainExcl, setChainExcl]   = useState<Set<string>>(new Set());
  const [chainFrom, setChainFrom]   = useState<Sq | null>(null);
  const [allCaptured, setAllCaptured] = useState<Sq[]>([]);
  // Forbidden direction for king chain captures: prevents reversing along the same diagonal
  const [chainForbiddenDir, setChainForbiddenDir] = useState<[number,number] | null>(null);
  const [winner, setWinner]         = useState<PColor | null>(null);
  const [winReason, setWinReason]   = useState("");
  const [timers, setTimers]         = useState<Record<PColor, number>>({ w:30, b:30 });
  const [lastMove, setLastMove]     = useState<{ from:Sq; to:Sq } | null>(null);
  const [selectableKeys, setSelectableKeys] = useState<Set<string>>(new Set());
  const [lives, setLives]           = useState<Record<PColor, number>>({ w:5, b:5 });
  const seqRef  = useRef(_savedDamas?.seq ?? 0);
  const livesRef = useRef<Record<PColor, number>>({ w:5, b:5 });
  const boardRef = useRef(board);
  const turnRef  = useRef(turn);
  const winnerRef = useRef(winner);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Persiste em sessionStorage para não re-debitar se o utilizador fizer back e retomar
  const betDeductedRef = useRef(
    gameId !== "local"
      ? sessionStorage.getItem(`wm_bet_deducted_damas_${gameId}`) === "1"
      : false
  );
  const winCreditedRef = useRef(false);
  const rewardFiredRef = useRef(false);
  const lastMoveTimeRef = useRef<number>(0); // rate limit: min 200ms between moves
  const [opponentBal, setOpponentBal] = useState(isBot && botBal ? `${botBal} MT` : "—");
  const oppTimerRecvAtRef  = useRef<number>(0);
  const oppTimerRecvValRef = useRef<number>(30);
  const [botThinking, setBotThinking] = useState(false);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
  const [kingsOnlyCount, setKingsOnlyCount] = useState(0);
  const kingsOnlyCountRef = useRef(0);
  const [isDraw, setIsDraw] = useState(false);
  const [rematchRequester, setRematchRequester] = useState("");
  const [wrongClickSq, setWrongClickSq] = useState<string | null>(null);
  const wrongClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { turnRef.current = turn; }, [turn]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);
  useEffect(() => { livesRef.current = lives; }, [lives]);

  // Persist game state for reconnection (navigating away and back)
  useEffect(() => {
    if (gameId === "local" || winner) return;
    try {
      sessionStorage.setItem(`wm_damas_${gameId}`, JSON.stringify({
        board: boardRef.current, turn, seq: seqRef.current,
      }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn]);

  useEffect(() => {
    if (winner && gameId !== "local") {
      try {
        sessionStorage.removeItem(`wm_damas_${gameId}`);
        sessionStorage.removeItem(`wm_bet_deducted_damas_${gameId}`);
        localStorage.removeItem("wm_active_game");
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  // ── Bot: deduct bet once on mount (no channel subscription for bot games) ─────
  useEffect(() => {
    if (!isBot || !profile?.id || BET <= 0 || betDeductedRef.current) return;
    betDeductedRef.current = true;
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("balance").eq("id", profile.id).single();
        if (data) {
          await supabase.from("profiles").update({ balance: parseFloat(String(data.balance)) - BET }).eq("id", profile.id);
          await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: `Aposta (Damas) [bot] vs ${opponentName}`, status: "approved" });
          fetch("/api/record-bet-reward", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: profile.id }) }).catch(() => {});
          try { sessionStorage.setItem(`wm_bet_deducted_damas_${gameId}`, "1"); } catch {}
          await supabase.from("matches").upsert({
            id: gameId, game_type: "dama",
            player1_id: profile.id, player1_name: playerName,
            player2_name: opponentName,
            bet_amount: BET, winner_payout: Math.floor(BET * 2 * 0.90),
            status: "active", created_at: new Date().toISOString(),
          }, { onConflict: "id" });
          await refreshProfile();
          if (profile?.id) evaluateBotDifficulty(profile.id).catch(() => {});
        }
      } catch { betDeductedRef.current = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBot]);

  // ── Bot AI turn trigger ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBot || turn !== oppColor || !!winner) return;
    setBotThinking(true);
    const delay = 900 + Math.random() * 700;
    const pendingTimers: ReturnType<typeof setTimeout>[] = [];

    const mainTimer = setTimeout(() => {
      setBotThinking(false);
      const _diff = getBotDifficultySync(profile?.id ?? "");
      const _depth = _diff === "easy" ? (Math.random() < 0.5 ? 2 : 3) : AI_DEPTH;
      const move = getBestBotMove(boardRef.current, oppColor, _depth);
      if (!move) {
        setWinner(myColor); winnerRef.current = myColor;
        setWinReason(`${opponentName} ficou sem movimentos`);
        return;
      }

      // Called after the last animation step to resolve game state
      const finalizeBotMove = (finalBoard: Board, hadCapture: boolean) => {
        if (hadCapture) playDamasCapture(); else playDamasMove();
        setSelected(null); setValidDests([]); setValidCapDests([]);
        setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
        const myCnt = countPieces(finalBoard, myColor);
        if (myCnt === 0) {
          setWinner(oppColor); winnerRef.current = oppColor;
          setWinReason("Todas as peças foram capturadas pelo bot");
        } else {
          if (allKings(finalBoard)) {
            const newCount = kingsOnlyCountRef.current + 1;
            kingsOnlyCountRef.current = newCount;
            setKingsOnlyCount(newCount);
            if (newCount >= 30) { triggerDraw(); return; }
          } else {
            kingsOnlyCountRef.current = 0; setKingsOnlyCount(0);
          }
          setTurn(myColor);
          setTimers(t => ({ ...t, [myColor]: 30 }));
        }
      };

      if (move.captured.length <= 1) {
        // Single move or single capture — apply immediately
        const nb = applyBoardMove(boardRef.current, move.from, move.to, move.captured);
        boardRef.current = nb; setBoard(nb);
        setLastMove({ from: move.from, to: move.to });
        finalizeBotMove(nb, move.captured.length > 0);
      } else {
        // Chain capture — animate each step separately (380ms per step)
        const steps = computeChainPath(boardRef.current, move);
        let animBoard = boardRef.current;

        steps.forEach(({ from, to, cap }, i) => {
          const isLastStep = i === steps.length - 1;
          const stepTimer = setTimeout(() => {
            if (isLastStep) {
              // Final step: use applyBoardMove (handles promotion correctly)
              const finalBoard = applyBoardMove(animBoard, from, to, [cap]);
              boardRef.current = finalBoard;
              setBoard(finalBoard);
              setLastMove({ from, to });
              finalizeBotMove(finalBoard, true);
            } else {
              // Intermediate step: move without promotion
              const nb = cloneBoard(animBoard);
              nb[to[0]][to[1]] = nb[from[0]][from[1]];
              nb[from[0]][from[1]] = null;
              nb[cap[0]][cap[1]] = null;
              animBoard = nb;
              boardRef.current = nb;
              setBoard(nb);
              setLastMove({ from, to });
            }
          }, i * 380);
          pendingTimers.push(stepTimer);
        });
      }
    }, delay);

    pendingTimers.push(mainTimer);
    return () => { pendingTimers.forEach(clearTimeout); setBotThinking(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, isBot]);

  // Credit winner + register match result when game ends
  useEffect(() => {
    if (!winner || !profile?.id || BET <= 0 || (gameId === "local" && !isBot) || winCreditedRef.current) return;
    winCreditedRef.current = true;
    const payout = Math.floor(BET * 2 * 0.90);
    const platformFee = BET * 2 - payout;
    const isWinner = winner === myColor;
    (async () => {
      try {
        // Credit winner's balance — fetch fresh balance to avoid stale read
        if (isWinner) {
          const { data: freshData } = await supabase.from("profiles").select("balance").eq("id", profile.id).single();
          // Use fetched balance if available, fall back to profile context balance
          const currentBal = freshData
            ? parseFloat(String(freshData.balance))
            : parseFloat(String(profile.balance ?? 0));
          const { error: creditErr } = await supabase
            .from("profiles").update({ balance: currentBal + payout }).eq("id", profile.id);
          if (creditErr) throw creditErr; // triggers retry via catch block
          await supabase.from("transactions").insert({ user_id: profile.id, type: "win", amount: payout, description: `Vitória de jogo (Damas) +${payout} MT`, status: "approved" });
          await refreshProfile();
        } else if (isBot) {
          // Bot won — insert zero-amount marker so admin panel can detect game ended
          await supabase.from("transactions").insert({ user_id: profile.id, type: "win", amount: 0, description: `Fim de jogo (Damas) [bot] [bot-fim]`, status: "approved" });
        }
        // Update match record as finished (only player "w" to avoid duplicate updates)
        if (myColor === "w") {
          await supabase.from("matches").update({
            status: "finished",
            winner_name: winner === "w" ? playerName : opponentName,
            winner_id: winner === "w" ? profile.id : null,
            completed_at: new Date().toISOString(),
          }).eq("id", gameId);
          // Register platform earnings (fee)
          if (platformFee > 0) {
            await supabase.from("platform_earnings").insert({
              amount: platformFee,
              source: "game_fee",
              description: `Taxa de jogo (Damas) — aposta ${BET} MT`,
              reference_id: gameId,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch { winCreditedRef.current = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  // Compute selectable pieces when board/turn changes
  useEffect(() => {
    if (winnerRef.current) return;
    const selectable = getSelectablePieces(board, turn);
    const keys = new Set(selectable.map(x => sqKey(x.sq[0], x.sq[1])));
    setSelectableKeys(keys);
    if (selectable.length === 0 && !winnerRef.current) {
      const w = opp(turn);
      setWinner(w);
      winnerRef.current = w;
      setWinReason(turn === myColor ? "Ficaste sem movimentos válidos" : `${opponentName} ficou sem movimentos`);
    }
  }, [board, turn]);

  // ── Timer expiry handler ref (always fresh, avoids stale closure) ────────────
  const timerExpiryRef = useRef<() => void>(() => {});
  timerExpiryRef.current = () => {
    const remaining = livesRef.current[myColor] - 1;
    livesRef.current = { ...livesRef.current, [myColor]: Math.max(0, remaining) };
    if (remaining <= 0) {
      setLives(prev => ({ ...prev, [myColor]: 0 }));
      setWinner(oppColor);
      setWinReason(`${playerName.split(" ")[0]} perdeu todas as vidas`);
      setTimers(prev => ({ ...prev, [myColor]: 0 }));
      channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: myColor, lives: 0, gameOver: true } });
    } else {
      setLives(prev => ({ ...prev, [myColor]: remaining }));
      // Pass the turn to the opponent on timer expiry
      const nextTurn = oppColor;
      setTurn(nextTurn);
      setTimers({ w: 30, b: 30 });
      setSelected(null); setValidDests([]); setValidCapDests([]);
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
      channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: myColor, lives: remaining, gameOver: false, nextTurn } });
    }
  };

  // ── Timer expiry for bot (deducts bot life or forces turn back to user) ──────
  const botTimerExpiryRef = useRef<() => void>(() => {});
  botTimerExpiryRef.current = () => {
    if (!isBot) return;
    const remaining = livesRef.current[oppColor] - 1;
    livesRef.current = { ...livesRef.current, [oppColor]: Math.max(0, remaining) };
    if (remaining <= 0) {
      setLives(prev => ({ ...prev, [oppColor]: 0 }));
      setWinner(myColor);
      setWinReason(`${opponentName} perdeu todas as vidas (tempo esgotado)`);
      setTimers(prev => ({ ...prev, [oppColor]: 0 }));
    } else {
      setLives(prev => ({ ...prev, [oppColor]: remaining }));
      setTurn(myColor);
      setTimers({ w: 30, b: 30 });
      setSelected(null); setValidDests([]); setValidCapDests([]);
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    }
  };

  // ── Timers ────────────────────────────────────────────────────────────────
  // My turn timer (wall-clock based + visibilitychange catch-up)
  useEffect(() => {
    if (winner || turn !== myColor || chainPiece) return;
    channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:30 } });
    const timerStart = Date.now();
    let firedExpiry = false;
    const fireExpiry = () => {
      if (firedExpiry) return;
      firedExpiry = true;
      clearInterval(tick);
      channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:0 } });
      setTimeout(() => timerExpiryRef.current(), 0);
    };
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      const nv = Math.max(0, 30 - elapsed);
      setTimers(prev => ({ ...prev, [myColor]: nv }));
      if (nv <= 0) { fireExpiry(); return; }
      channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:nv } });
    }, 500);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      const nv = Math.max(0, 30 - elapsed);
      setTimers(prev => ({ ...prev, [myColor]: nv }));
      if (nv <= 0) fireExpiry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, chainPiece]);

  // Bot turn timer (visual countdown + safety auto-forfeit if bot hangs)
  useEffect(() => {
    if (!isBot || winner || turn !== oppColor) return;
    const timerStart = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      const nv = Math.max(0, 30 - elapsed);
      setTimers(prev => ({ ...prev, [oppColor]: nv }));
      if (nv <= 0) {
        clearInterval(tick);
        setTimeout(() => botTimerExpiryRef.current(), 0);
      }
    }, 500);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, isBot]);

  // ── Local countdown for opponent timer (ticks locally so display never freezes) ──
  useEffect(() => {
    if (winner || isBot || gameId === "local" || turn === myColor) return;
    oppTimerRecvAtRef.current  = Date.now();
    oppTimerRecvValRef.current = 30;
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - oppTimerRecvAtRef.current) / 1000);
      const t = Math.max(0, oppTimerRecvValRef.current - elapsed);
      setTimers(prev => ({ ...prev, [oppColor]: t }));
    }, 400);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner]);

  // ── Apply remote move ─────────────────────────────────────────────────────
  const applyRemoteMove = useCallback((from: Sq, to: Sq, captured: Sq[], nextTurn: PColor) => {
    // Compute new board eagerly from ref so boardRef stays in sync for resyncs
    const nb = applyBoardMove(boardRef.current, from, to, captured);
    boardRef.current = nb;
    // nextTurn is who moves next; the player who just moved is opp(nextTurn).
    // If the just-moved player captured all of nextTurn's pieces → they win.
    const nextPlayerPieces = countPieces(nb, nextTurn);
    setBoard(nb);
    setLastMove({ from, to });
    setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    if (nextPlayerPieces === 0) {
      const w = opp(nextTurn);
      setWinner(w);
      winnerRef.current = w;
      setWinReason("Todas as peças foram capturadas");
    } else {
      // Kings-only draw rule for remote moves
      if (allKings(nb)) {
        const newCount = kingsOnlyCountRef.current + 1;
        kingsOnlyCountRef.current = newCount;
        setKingsOnlyCount(newCount);
        // If opponent already broadcast draw, we'll handle via damas_kings_draw event
      } else {
        kingsOnlyCountRef.current = 0;
        setKingsOnlyCount(0);
      }
      setTurn(nextTurn);
      setTimers(t => ({ ...t, [nextTurn]: 30 }));
    }
  }, []);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (gameId === "local" || isBot) return;
    const ch = supabase.channel(`damas_${gameId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on("broadcast", { event: "damas_move" }, ({ payload }) => {
      if (winnerRef.current) return;
      // ── Security: validate payload shape ──
      const from = payload.from as Sq;
      const to   = payload.to as Sq;
      const nextTurn = payload.nextTurn as PColor;
      if (!Array.isArray(from) || !Array.isArray(to)) return;
      if (from[0] < 0 || from[0] > 7 || from[1] < 0 || from[1] > 7) return;
      if (to[0]   < 0 || to[0]   > 7 || to[1]   < 0 || to[1]   > 7) return;
      if (nextTurn !== "w" && nextTurn !== "b") return;
      const seq: number = payload.seq ?? 0;
      if (seq && seqRef.current >= seq) return;
      if (seq) seqRef.current = seq;
      // Game has definitively started — credit referral reward now (opponent's first move)
      if (BET > 0 && !rewardFiredRef.current) {
        rewardFiredRef.current = true;
        fetch("/api/record-bet-reward", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: profile?.id }) }).catch(() => {});
      }
      applyRemoteMove(from, to, payload.captured as Sq[], nextTurn);
    });

    ch.on("broadcast", { event: "damas_timer" }, ({ payload }) => {
      if ((payload.player as string) !== myColor) {
        const t = payload.t as number;
        if (typeof t === "number" && t >= 0 && t <= 30) {
          setTimers(prev => ({ ...prev, [payload.player as string]: t }));
          oppTimerRecvAtRef.current  = Date.now();
          oppTimerRecvValRef.current = t;
        }
      }
    });

    ch.on("broadcast", { event: "damas_timer_forfeit" }, ({ payload }) => {
      if (winnerRef.current) return;
      const player = payload.player as PColor;
      if (player === myColor) return; // ignore own events (self: false should catch this)
      const lives = payload.lives as number;
      const gameOver = payload.gameOver as boolean;
      if (gameOver) {
        setWinner(myColor);
        setWinReason(`${opponentName} perdeu todas as vidas`);
      } else {
        // Opponent's timer expired: update their lives and switch turn to us
        setLives(prev => ({ ...prev, [player]: Math.max(0, lives) }));
        setTurn(myColor);
        setTimers({ w: 30, b: 30 });
      }
    });

    ch.on("broadcast", { event: "damas_forfeit" }, () => {
      if (winnerRef.current) return;
      setWinner(myColor);
      setWinReason(`${opponentName} desistiu da partida!`);
    });

    ch.on("broadcast", { event: "damas_kings_draw" }, () => {
      if (winnerRef.current) return;
      setIsDraw(true);
      kingsOnlyCountRef.current = 0;
      setKingsOnlyCount(0);
    });

    ch.on("broadcast", { event: "damas_resync_req" }, () => {
      if (winnerRef.current) return;
      ch.send({
        type: "broadcast", event: "damas_resync_state",
        payload: { board: boardRef.current, turn: turnRef.current, seq: seqRef.current },
      });
    });

    ch.on("broadcast", { event: "damas_resync_state" }, ({ payload }) => {
      const incoming = payload as { board: Board; turn: PColor; seq: number };
      if (incoming.turn !== "w" && incoming.turn !== "b") return;
      if ((incoming.seq ?? 0) >= seqRef.current) {
        setBoard(incoming.board);
        setTurn(incoming.turn);
        seqRef.current = incoming.seq ?? seqRef.current;
        boardRef.current = incoming.board;
        turnRef.current = incoming.turn;
      }
    });

    ch.on("broadcast", { event: "rematch_request" }, ({ payload }) => {
      setRematchRequester((payload.name as string) ?? opponentName);
      setRematchPhase("received");
    });

    ch.on("broadcast", { event: "rematch_response" }, async ({ payload }) => {
      if (payload.accepted) {
        if (BET > 0 && profile?.id) {
          const { data } = await supabase.from("profiles").select("balance").eq("id", profile.id).single();
          if (!data || parseFloat(String(data.balance)) < BET) {
            // Requester no longer has enough balance — notify opponent and abort
            ch.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } }).catch(() => {});
            setRematchPhase("no_balance");
            return;
          }
          const newBal = parseFloat(String(data.balance)) - BET;
          await supabase.from("profiles").update({ balance: newBal }).eq("id", profile.id);
          await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: "Aposta de revanche (Damas)", status: "approved" });
          await refreshProfile();
        }
        setRematchPhase("idle");
        resetGame();
        betDeductedRef.current = true;
      } else if ((payload.reason as string) === "no_balance") {
        setRematchPhase("opp_no_balance");
      } else {
        setRematchPhase("declined");
      }
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ color: string; balance?: string }>();
      const allPresences = Object.values(state).flat() as Array<{ color: string; balance?: string; userId?: string }>;
      for (const p of allPresences) {
        if (p.color !== myColor && p.balance) setOpponentBal(p.balance);
      }
      // Reward fires only on first real game move (see broadcastMove / damas_move handler)
      void allPresences;
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && profile?.id) {
        await ch.track({ userId: profile.id, color: myColor, balance: playerBal });
        // If reconnecting (saved state exists), request current board from opponent
        if (_savedDamas && gameId !== "local") {
          setTimeout(() => {
            ch.send({ type: "broadcast", event: "damas_resync_req", payload: {} });
          }, 800);
        }
        if(BET > 0 && !betDeductedRef.current){
          betDeductedRef.current = true;
          try{
            const { data } = await supabase.from("profiles").select("balance").eq("id", profile.id).single();
            if(data){
              await supabase.from("profiles").update({ balance: parseFloat(String(data.balance)) - BET }).eq("id", profile.id);
              await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: "Aposta de jogo (Damas)", status: "approved" });
              // Persiste flag para não re-debitar se o componente remontar (back + resume)
              try { sessionStorage.setItem(`wm_bet_deducted_damas_${gameId}`, "1"); } catch { /* ignore */ }
              await refreshProfile();
            }
          }catch{ betDeductedRef.current = false; }
        }
        // Only player "w" (blue/first) registers the match to avoid duplicates
        if (myColor === "w" && BET > 0 && gameId !== "local") {
          try {
            await supabase.from("matches").upsert({
              id: gameId,
              game_type: "dama",
              player1_id: profile.id,
              player1_name: playerName,
              player2_name: opponentName,
              bet_amount: BET,
              winner_payout: Math.floor(BET * 2 * 0.90),
              status: "active",
              created_at: new Date().toISOString(),
            }, { onConflict: "id" });
          } catch { /* non-critical */ }
        }
      }
    });

    return () => { supabase.removeChannel(ch); };
  }, [gameId, applyRemoteMove]);

  // ── Broadcast move ────────────────────────────────────────────────────────
  function broadcastMove(from: Sq, to: Sq, captured: Sq[], nextTurn: PColor) {
    // Game has definitively started — credit referral reward now (player's own first move)
    if (BET > 0 && !rewardFiredRef.current) {
      rewardFiredRef.current = true;
      fetch("/api/record-bet-reward", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: profile?.id }) }).catch(() => {});
    }
    seqRef.current++;
    channelRef.current?.send({
      type: "broadcast", event: "damas_move",
      payload: { from, to, captured, nextTurn, seq: seqRef.current },
    });
  }

  // ── Execute a complete move (end of chain or non-capture) ─────────────────
  // finalBoard must already have the move applied (piece at `to`, captures removed)
  function finalizeTurn(from: Sq, to: Sq, captured: Sq[], finalBoard: Board) {
    if (captured.length > 0) playDamasCapture(); else playDamasMove();
    // Count opponent's pieces — if 0, I captured them all and win
    const oppCnt = countPieces(finalBoard, opp(turn));
    setBoard(finalBoard); boardRef.current = finalBoard;
    setLastMove({ from, to });
    setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    if (oppCnt === 0) {
      setWinner(turn);
      winnerRef.current = turn;
      setWinReason("Todas as peças foram capturadas");
      broadcastMove(from, to, captured, opp(turn));
      return;
    }
    // ── Kings-only draw rule: 30 consecutive moves with only kings → draw ──
    if (allKings(finalBoard)) {
      const newCount = kingsOnlyCountRef.current + 1;
      kingsOnlyCountRef.current = newCount;
      setKingsOnlyCount(newCount);
      if (newCount >= 30) {
        broadcastMove(from, to, captured, opp(turn));
        setTimeout(() => {
          channelRef.current?.send({ type:"broadcast", event:"damas_kings_draw", payload:{} });
          triggerDraw();
        }, 400);
        return;
      }
    } else {
      kingsOnlyCountRef.current = 0;
      setKingsOnlyCount(0);
    }
    const nextTurn = opp(turn);
    setTurn(nextTurn);
    setTimers(t => ({ ...t, [nextTurn]: 30 }));
    broadcastMove(from, to, captured, nextTurn);
  }

  // ── Handle square click ───────────────────────────────────────────────────
  function handleSquareClick(r: number, c: number) {
    if (winner || turn !== myColor) return;
    // Security: rate limit — prevent move flooding (min 200ms between actions)
    const now = Date.now();
    if (now - lastMoveTimeRef.current < 200) return;
    lastMoveTimeRef.current = now;

    // In chain capture mode
    if (chainPiece) {
      const dest = validCapDests.find(d => d.to[0] === r && d.to[1] === c);
      if (!dest) return;
      const newBoard = applyBoardMove(boardRef.current, chainPiece, dest.to, [dest.cap]);
      setBoard(newBoard);
      boardRef.current = newBoard;
      const newExcl = new Set(chainExcl); newExcl.add(sqKey(dest.cap[0], dest.cap[1]));
      const newAllCaptured = [...allCaptured, dest.cap];
      const origFrom = chainFrom ?? chainPiece;
      // Compute forbidden direction for king: cannot reverse the direction just moved
      const movedPiece = newBoard[dest.to[0]][dest.to[1]];
      const mdr = Math.sign(dest.to[0] - chainPiece[0]), mdc = Math.sign(dest.to[1] - chainPiece[1]);
      const newForbidden: [number,number] | null = movedPiece?.isDame ? [-mdr as -1|1, -mdc as -1|1] : null;
      // Check for more captures — only show captures on the maximum-depth path
      const nextCaps = filterMaxCaptures(newBoard, dest.to[0], dest.to[1], newExcl, newForbidden ?? undefined);
      if (nextCaps.length > 0) {
        setChainPiece(dest.to); setChainExcl(newExcl); setAllCaptured(newAllCaptured);
        setChainFrom(origFrom); setChainForbiddenDir(newForbidden);
        setValidCapDests(nextCaps);
        setSelected(dest.to);
        setValidDests(nextCaps.map(x => x.to));
      } else {
        finalizeTurn(origFrom, dest.to, newAllCaptured, newBoard);
      }
      return;
    }

    const clickedPiece = boardRef.current[r][c];

    // If a piece is selected
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); setValidDests([]); setValidCapDests([]); return; }

      // Try move to destination
      const capDest = validCapDests.find(d => d.to[0] === r && d.to[1] === c);
      if (capDest) {
        const newBoard = applyBoardMove(boardRef.current, selected, capDest.to, [capDest.cap]);
        setBoard(newBoard); boardRef.current = newBoard;
        const newExcl = new Set(chainExcl); newExcl.add(sqKey(capDest.cap[0], capDest.cap[1]));
        // Forbidden direction for first chain step (king only)
        const firstPiece = newBoard[capDest.to[0]][capDest.to[1]];
        const fdr = Math.sign(capDest.to[0] - selected[0]), fdc = Math.sign(capDest.to[1] - selected[1]);
        const firstForbidden: [number,number] | null = firstPiece?.isDame ? [-fdr as -1|1, -fdc as -1|1] : null;
        // Only show captures on the maximum-depth path (mandatory maximum capture rule)
        const nextCaps = filterMaxCaptures(newBoard, capDest.to[0], capDest.to[1], newExcl, firstForbidden ?? undefined);
        if (nextCaps.length > 0) {
          setChainPiece(capDest.to); setChainExcl(newExcl);
          setAllCaptured([capDest.cap]); setChainFrom(selected);
          setChainForbiddenDir(firstForbidden);
          setValidCapDests(nextCaps); setSelected(capDest.to);
          setValidDests(nextCaps.map(x => x.to));
        } else {
          finalizeTurn(selected, capDest.to, [capDest.cap], newBoard);
        }
        return;
      }
      if (validDests.some(d => d[0] === r && d[1] === c)) {
        const nb = applyBoardMove(boardRef.current, selected, [r, c], []);
        finalizeTurn(selected, [r, c], [], nb);
        return;
      }
    }

    // Select a new piece
    if (clickedPiece?.color === myColor && selectableKeys.has(sqKey(r, c))) {
      setSelected([r, c]);
      // Use filterMaxCaptures to only show captures on maximum-depth paths
      const caps = filterMaxCaptures(boardRef.current, r, c);
      if (caps.length > 0) {
        setValidCapDests(caps); setValidDests(caps.map(x => x.to));
      } else {
        setValidCapDests([]); setValidDests(getNonCaptures(boardRef.current, r, c));
      }
    } else if (clickedPiece?.color === myColor && !selectableKeys.has(sqKey(r, c))) {
      if (wrongClickTimerRef.current) clearTimeout(wrongClickTimerRef.current);
      setWrongClickSq(sqKey(r, c));
      wrongClickTimerRef.current = setTimeout(() => setWrongClickSq(null), 600);
    }
  }

  // ── Kings-only draw ────────────────────────────────────────────────────────
  function triggerDraw() {
    setIsDraw(true);
    kingsOnlyCountRef.current = 0;
    setKingsOnlyCount(0);
    winnerRef.current = null;
  }

  function resetForDraw() {
    setIsDraw(false);
    winCreditedRef.current = false;
    const nb = makeInitialBoard();
    setBoard(nb); boardRef.current = nb;
    setTurn("w"); turnRef.current = "w";
    setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    setWinner(null); winnerRef.current = null; setWinReason(""); setLastMove(null);
    setTimers({ w:30, b:30 });
    setLives({ w:5, b:5 });
    kingsOnlyCountRef.current = 0;
    setKingsOnlyCount(0);
  }

  // ── Forfeit / Back ────────────────────────────────────────────────────────
  function handleForfeit() {
    if (winner) return;
    if (!window.confirm("Tens a certeza que queres desistir?")) return;
    channelRef.current?.send({ type:"broadcast", event:"damas_forfeit", payload:{ player:myColor } });
    setWinner(oppColor); setWinReason("Desististe da partida");
  }

  function handleBack() {
    if (!winner && gameId !== "local" && BET > 0) {
      // Save active game so the player can resume instead of forfeiting
      try {
        localStorage.setItem("wm_active_game", JSON.stringify({
          gameId, gameType:"damas", betAmount:BET,
          opponentName, savedAt:Date.now(), ttlMs:30*60_000,
          playerColor: myColor, playerName,
        }));
      } catch { /* ignore */ }
    }
    setLocation("/");
  }

  async function handleReplay() {
    if (gameId === "local" || BET === 0) { resetGame(); return; }
    if (isBot) {
      if (!profile?.id) return;
      try {
        const { data } = await supabase.from("profiles").select("balance").eq("id", profile.id).single();
        if (!data || parseFloat(String(data.balance)) < BET) { setRematchPhase("no_balance"); return; }
        await supabase.from("profiles").update({ balance: parseFloat(String(data.balance)) - BET }).eq("id", profile.id);
        await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: "Aposta de revanche (Damas) vs bot", status: "approved" });
        await refreshProfile();
        resetGame();
      } catch { setRematchPhase("no_balance"); }
      return;
    }
    if (!profile?.id) { setRematchPhase("no_balance"); return; }
    if (!channelRef.current) { setRematchPhase("no_balance"); return; }
    setRematchPhase("checking");
    try {
      const timeout   = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
      const fetchBal  = supabase.from("profiles").select("balance").eq("id", profile.id).single()
                         .then(r => r.data);
      const data = await Promise.race([fetchBal, timeout]) as { balance: string | number } | null;
      if (!data || parseFloat(String(data.balance)) < BET) {
        setRematchPhase("no_balance"); return;
      }
      setRematchPhase("waiting");
      channelRef.current.send({ type:"broadcast", event:"rematch_request", payload:{ name: playerName.split(" ")[0] } }).catch(() => {});
    } catch {
      setRematchPhase("no_balance");
    }
  }

  async function handleRematchAccept() {
    if (!profile?.id) return;
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
      const fetch   = supabase.from("profiles").select("balance").eq("id", profile.id).single()
                       .then(r => r.data);
      const data = await Promise.race([fetch, timeout]) as { balance: string | number } | null;
      if (!data || parseFloat(String(data.balance)) < BET) {
        channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } });
        setRematchPhase("opp_no_balance"); return;
      }
      if (BET > 0) {
        const newBal = parseFloat(String(data.balance)) - BET;
        await supabase.from("profiles").update({ balance: newBal }).eq("id", profile.id);
        await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: "Aposta de revanche (Damas)", status: "approved" });
      }
      channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:true } });
      setRematchPhase("idle");
      resetGame();
      betDeductedRef.current = true;
    } catch {
      channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } });
      setRematchPhase("no_balance");
    }
  }

  function handleRematchDecline() {
    channelRef.current?.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"declined" } });
    setRematchPhase("idle");
  }

  function resetGame() {
    betDeductedRef.current = false;
    winCreditedRef.current = false;
    rewardFiredRef.current = false;
    kingsOnlyCountRef.current = 0;
    setKingsOnlyCount(0);
    setIsDraw(false);
    const nb = makeInitialBoard();
    setBoard(nb); boardRef.current = nb;
    setTurn("w"); setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    setWinner(null); winnerRef.current = null; setWinReason(""); setLastMove(null);
    setTimers({ w:30, b:30 });
    setLives({ w:5, b:5 });
  }

  // ── Board display helpers ─────────────────────────────────────────────────
  // Flip board 180° for "b" player so their pieces are at the bottom
  const DR = myColor === "b" ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const DC = myColor === "b" ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const myPieces   = countPieces(board, myColor);
  const oppPieces  = countPieces(board, oppColor);
  const myDames    = board.flat().filter(p => p?.color === myColor && p.isDame).length;
  const oppDames   = board.flat().filter(p => p?.color === oppColor && p.isDame).length;
  const myTurn     = turn === myColor;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", width:"100%", overflow:"hidden",
      background:"linear-gradient(180deg,#0B1A0B 0%,#162716 50%,#0B1A0B 100%)",
      display:"flex", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:430, height:"100vh", overflow:"hidden",
        display:"flex", flexDirection:"column", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 14px 8px", borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(5,12,5,0.9)", flexShrink:0 }}>
          <button onClick={handleBack} style={{ width:34, height:34, borderRadius:9,
            background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <ArrowLeft style={{ width:16, height:16, color:"#9BB4E8" }}/>
          </button>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:17,
              color:"#E8F0FF", lineHeight:1, letterSpacing:5,
              textShadow:"0 0 20px rgba(212,163,90,0.5)" }}>DAMAS</p>
            {kingsOnlyCount > 0
              ? <p style={{ fontSize:9, color:"rgba(212,163,90,0.85)", marginTop:1, letterSpacing:1.5, fontWeight:700 }}>
                  👑 SÓ DAMAS — {30 - kingsOnlyCount} JOGADAS
                </p>
              : <p style={{ fontSize:9, color:"rgba(255,255,255,0.28)", marginTop:1, letterSpacing:2.5, fontWeight:700 }}>1 VS 1</p>
            }
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {!winner && gameId !== "local" && (
              <button onClick={handleForfeit} style={{ width:34, height:34, borderRadius:9,
                background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                <LogOut style={{ width:15, height:15, color:"#EF4444" }}/>
              </button>
            )}
            <div style={{ padding:"4px 10px",
              background:"linear-gradient(135deg,rgba(212,163,90,0.15),rgba(212,163,90,0.06))",
              border:"1px solid rgba(212,163,90,0.25)", borderRadius:8 }}>
              <span style={{ fontSize:10, color:"#D4A35A", fontWeight:700, fontFamily:"'Syne',sans-serif" }}>
                {BET > 0 ? `${BET} MT` : "Demo"}
              </span>
            </div>
          </div>
        </div>

        {/* Opponent panel */}
        <div style={{ padding:"6px 10px 4px", flexShrink:0 }}>
          <PlayerCard
            color={oppColor} name={opponentName} balance={opponentBal} isMe={false}
            isActive={turn === oppColor && !winner}
            piecesLeft={oppPieces} damesLeft={oppDames}
            timeLeft={timers[oppColor]} lives={lives[oppColor]}
          />
        </div>

        {/* Board */}
        <div style={{ flex:1, minHeight:0, padding:"4px 10px",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:"100%", maxHeight:"100%", aspectRatio:"1",
            borderRadius:8, overflow:"hidden",
            boxShadow:"0 8px 32px rgba(0,0,0,0.6), 0 0 0 3px #2A1A0A",
            position:"relative" }}>

            {/* Board grid */}
            <div style={{ width:"100%", height:"100%", display:"grid",
              gridTemplateColumns:"repeat(8,1fr)", gridTemplateRows:"repeat(8,1fr)" }}>
              {DR.map((boardRow, dRow) =>
                DC.map((boardCol, dCol) => {
                  const light = isLight(boardRow, boardCol);
                  const piece = board[boardRow][boardCol];
                  const isSel = selected?.[0] === boardRow && selected?.[1] === boardCol;
                  const isChain = chainPiece?.[0] === boardRow && chainPiece?.[1] === boardCol;
                  const isDest = validDests.some(d => d[0] === boardRow && d[1] === boardCol);
                  const isLastFrom = lastMove?.from[0] === boardRow && lastMove?.from[1] === boardCol;
                  const isLastTo   = lastMove?.to[0]   === boardRow && lastMove?.to[1]   === boardCol;
                  const isSelectable = !selected && !chainPiece && selectableKeys.has(sqKey(boardRow, boardCol));
                  const isWrongClick = wrongClickSq === sqKey(boardRow, boardCol);
                  const bg = light
                    ? (isLastFrom || isLastTo ? "#2A2A2A" : "#111111")
                    : (isLastFrom || isLastTo ? "#B8892A" : "#D4A017");

                  return (
                    <div key={`${boardRow},${boardCol}`}
                      onClick={() => handleSquareClick(boardRow, boardCol)}
                      style={{
                        background: bg,
                        position:"relative", cursor: light ? "pointer" : "default",
                        boxShadow: isWrongClick ? "inset 0 0 0 3px #EF4444" :
                          (isSel || isChain) ? "inset 0 0 0 3px #FFD700" :
                          isLastTo ? "inset 0 0 0 2px #D4A35A88" : "none",
                        transition:"box-shadow 0.15s",
                      }}>

                      {/* Valid destination indicator */}
                      {isDest && light && (
                        <div style={{ position:"absolute", inset:0,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          zIndex:2, pointerEvents:"none" }}>
                          {piece ? (
                            <div style={{ width:"90%", height:"90%", borderRadius:"50%",
                              border:"3px solid #EF4444", boxSizing:"border-box",
                              background:"rgba(239,68,68,0.15)" }}/>
                          ) : (
                            <div style={{ width:"32%", height:"32%", borderRadius:"50%",
                              background:"rgba(80,200,80,0.7)",
                              boxShadow:"0 0 6px rgba(80,200,80,0.5)" }}/>
                          )}
                        </div>
                      )}

                      {/* Selectable hint */}
                      {isSelectable && piece?.color === myColor && !isDest && (
                        <div style={{ position:"absolute", inset:0, borderRadius:0,
                          background:"rgba(255,215,0,0.08)", zIndex:1, pointerEvents:"none" }}/>
                      )}

                      {/* Piece */}
                      {piece && (
                        <div style={{ position:"absolute", inset:"6%",
                          borderRadius:"50%", zIndex:3,
                          background: piece.color === "w"
                            ? "radial-gradient(circle at 35% 30%,#F5F0E0,#D8D0B8,#B0A888)"
                            : "radial-gradient(circle at 35% 30%,#4A4040,#222,#111)",
                          boxShadow: piece.color === "w"
                            ? "inset 0 3px 6px rgba(255,255,255,0.6),inset 0 -3px 5px rgba(0,0,0,0.25),0 3px 8px rgba(0,0,0,0.4)"
                            : "inset 0 3px 6px rgba(255,255,255,0.12),inset 0 -3px 5px rgba(0,0,0,0.5),0 3px 8px rgba(0,0,0,0.5)",
                          border: `2px solid ${piece.color === "w" ? "rgba(200,192,160,0.8)" : "rgba(80,60,50,0.8)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"transform 0.15s",
                          transform: (isSel || isChain) ? "scale(1.1)" : "scale(1)",
                        }}>
                          {piece.isDame && (
                            <span style={{ fontSize:"55%", lineHeight:1, filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>👑</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Turn indicator */}
        <div style={{ padding:"2px 10px", flexShrink:0, textAlign:"center" }}>
          <span style={{ fontSize:11, fontWeight:600,
            color: myTurn ? "#D4A35A" : "rgba(255,255,255,0.35)" }}>
            {winner ? `Jogo terminado — ${winner === myColor ? "Venceste!" : "Perdeste"}` :
              chainPiece ? "Captura em cadeia! Continua a capturar." :
              myTurn ? `${playerName.split(" ")[0]} — faz o teu movimento` : `A aguardar ${opponentName}…`}
          </span>
        </div>

        {/* My panel */}
        <div style={{ padding:"4px 10px 3px", flexShrink:0 }}>
          <PlayerCard
            color={myColor} name={playerName} balance={playerBal} isMe={true}
            isActive={myTurn && !winner}
            piecesLeft={myPieces} damesLeft={myDames}
            timeLeft={timers[myColor]} lives={lives[myColor]}
          />
        </div>

        {/* Ad banner */}
        <div style={{ padding:"0 10px 5px", flexShrink:0 }}>
          <AdBanner compact />
        </div>

      </div>

      {/* Kings-only draw overlay */}
      <AnimatePresence>
        {isDraw && (
          <DrawScreen
            movesLeft={0}
            onContinue={resetForDraw}
          />
        )}
      </AnimatePresence>

      {/* Win overlay */}
      <AnimatePresence>
        {winner && !isDraw && (
          <WinScreen
            isWinner={winner === myColor}
            winnerName={winner === myColor ? playerName : opponentName}
            loserName={winner === myColor ? opponentName : playerName}
            betAmount={BET}
            onReplay={handleReplay}
            onQuit={() => setLocation("/")}
          />
        )}
      </AnimatePresence>

      {/* Rematch overlay */}
      <AnimatePresence>
        {rematchPhase !== "idle" && (
          <RematchOverlay
            phase={rematchPhase}
            requesterName={rematchRequester || opponentName}
            onAccept={handleRematchAccept}
            onDecline={handleRematchDecline}
            onClose={() => setRematchPhase("idle")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
