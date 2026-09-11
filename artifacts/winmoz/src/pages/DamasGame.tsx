import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { evaluateBotDifficulty } from "@/lib/botBrain";
import { serverBet, serverWin } from "@/lib/gameApi";
import { API_BASE } from "@/lib/apiBase";
import AdBanner from "@/components/AdBanner";
// ─── Sound helpers ────────────────────────────────────────────────────────────
function playDamasCapture() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;

    // Low thud: filtered noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass"; lpf.frequency.value = 180;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    noise.connect(lpf); lpf.connect(ng); ng.connect(ctx.destination);
    noise.start(t); noise.stop(t + 0.18);

    // Short tonal impact
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.09);
    og.gain.setValueAtTime(0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch { /* noop */ }
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

// ─── Crown icon (professional SVG, replaces the 👑 emoji) ──────────────────────
function CrownIcon({ size = 16, tone = "light", fluid = false }: { size?: number; tone?: "light" | "dark"; fluid?: boolean }) {
  const gid = tone === "light" ? "damaCrownLight" : "damaCrownDark";
  const metal = tone === "light" ? ["#FFE9A8", "#F5C542", "#B8860B"] : ["#F3E3B0", "#D4A017", "#7A5A08"];
  const stroke = tone === "light" ? "rgba(90,60,0,.55)" : "rgba(50,32,0,.7)";
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={fluid ? { width: "64%", height: "64%", display: "block" } : { width: size, height: size, display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={metal[0]} />
          <stop offset="50%" stopColor={metal[1]} />
          <stop offset="100%" stopColor={metal[2]} />
        </linearGradient>
      </defs>
      <path
        d="M5 22 L4 9 L10.5 14.5 L16 6.5 L21.5 14.5 L28 9 L27 22 Z"
        fill={`url(#${gid})`}
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="4.6" y="22" width="22.8" height="4.4" rx="1.6" fill={`url(#${gid})`} stroke={stroke} strokeWidth="1.2" />
      <circle cx="4" cy="8" r="2.1" fill={metal[1]} stroke={stroke} strokeWidth="1" />
      <circle cx="16" cy="5.6" r="2.1" fill={metal[1]} stroke={stroke} strokeWidth="1" />
      <circle cx="28" cy="8" r="2.1" fill={metal[1]} stroke={stroke} strokeWidth="1" />
      <circle cx="16" cy="18.2" r="1.9" fill={tone === "light" ? "#B8860B" : "#7A5A08"} opacity="0.85" />
    </svg>
  );
}

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

// True when `to` lies on a straight diagonal from `from` and every square
// strictly between them is empty.
function isClearDiagonal(b: Board, from: Sq, to: Sq): boolean {
  const dr = Math.sign(to[0] - from[0]);
  const dc = Math.sign(to[1] - from[1]);
  if (dr === 0 || dc === 0) return false;
  if (Math.abs(to[0] - from[0]) !== Math.abs(to[1] - from[1])) return false;
  let r = from[0] + dr, c = from[1] + dc;
  while (r !== to[0] || c !== to[1]) {
    if (!inB(r, c) || b[r][c]) return false;
    r += dr; c += dc;
  }
  return true;
}

// Rebuild the exact sequence of capture steps from the recorded list of victims
// and the final destination. Each intermediate landing is chosen from the real
// valid capture landings (getCaptures) so the king lines up with the next victim
// instead of stopping right after the current one. The last step must land
// exactly on `finalTo`, guaranteeing the animation matches the true move.
function buildChainSteps(
  board: Board, from: Sq, captured: Sq[], finalTo: Sq
): Array<{ from: Sq; to: Sq; cap: Sq }> | null {
  const steps: Array<{ from: Sq; to: Sq; cap: Sq }> = [];
  const excl = new Set<string>();
  let cur = from;
  let b = cloneBoard(board);
  let forbidden: [number, number] | undefined = undefined;

  for (let i = 0; i < captured.length; i++) {
    const target = captured[i];
    const isLast = i === captured.length - 1;
    // All valid landings for capturing `target` from the current square.
    let opts: { to: Sq; cap: Sq }[] = getCaptures(b, cur[0], cur[1], excl, forbidden)
      .filter((x: { to: Sq; cap: Sq }) => x.cap[0] === target[0] && x.cap[1] === target[1]);
    if (isLast) {
      opts = opts.filter((x: { to: Sq; cap: Sq }) => x.to[0] === finalTo[0] && x.to[1] === finalTo[1]);
    }
    if (opts.length === 0) return null;

    let chosen: { to: Sq; cap: Sq } = opts[0];
    if (!isLast) {
      // Prefer a landing that already points at the next victim (cleaner reading).
      const nextCap = captured[i + 1];
      const aligned = opts.find((x: { to: Sq; cap: Sq }) => {
        const lr = x.to[0] - nextCap[0], lc = x.to[1] - nextCap[1];
        if (!(Math.abs(lr) === Math.abs(lc) && Math.abs(lr) > 0)) return false;
        const odr = Math.sign(nextCap[0] - x.to[0]), odc = Math.sign(nextCap[1] - x.to[1]);
        const br = nextCap[0] + odr, bc = nextCap[1] + odc;
        return inB(br, bc) && !b[br][bc];
      });
      if (aligned) chosen = aligned;
    }

    steps.push({ from: cur, to: chosen.to, cap: target });

    const nb = cloneBoard(b);
    nb[chosen.to[0]][chosen.to[1]] = nb[cur[0]][cur[1]];
    nb[cur[0]][cur[1]] = null;
    nb[target[0]][target[1]] = null;
    excl.add(sqKey(target[0], target[1]));
    const piece = nb[chosen.to[0]][chosen.to[1]] as Piece | null;
    const mdr = Math.sign(chosen.to[0] - cur[0]), mdc = Math.sign(chosen.to[1] - cur[1]);
    forbidden = piece?.isDame ? [-mdr as -1 | 1, -mdc as -1 | 1] : undefined;
    b = nb;
    cur = chosen.to;
  }
  return steps;
}

// Reconstruct intermediate positions for chain capture animation
function computeChainPath(board: Board, move: { from: Sq; to: Sq; captured: Sq[] }): Array<{ from: Sq; to: Sq; cap: Sq }> {
  if (move.captured.length === 0) return [];
  if (move.captured.length === 1) return [{ from: move.from, to: move.to, cap: move.captured[0] }];
  const built = buildChainSteps(board, move.from, move.captured, move.to);
  if (built) return built;
  // Last-resort fallback: single-step landings (should not normally happen).
  const steps: Array<{ from: Sq; to: Sq; cap: Sq }> = [];
  let cur: Sq = move.from;
  let curBoard = cloneBoard(board);
  for (let i = 0; i < move.captured.length; i++) {
    const cap = move.captured[i];
    const isLast = i === move.captured.length - 1;
    const dr = Math.sign(cap[0] - cur[0]), dc = Math.sign(cap[1] - cur[1]);
    let landing: Sq;
    if (isLast) {
      landing = move.to;
    } else {
      let tr = cap[0] + dr, tc = cap[1] + dc;
      while (inB(tr, tc) && curBoard[tr][tc] !== null) { tr += dr; tc += dc; }
      landing = inB(tr, tc) ? [tr, tc] : move.to;
    }
    steps.push({ from: cur, to: landing, cap });
    const nb = cloneBoard(curBoard);
    nb[landing[0]][landing[1]] = nb[cur[0]][cur[1]]; nb[cur[0]][cur[1]] = null; nb[cap[0]][cap[1]] = null;
    curBoard = nb; cur = landing;
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
    // Check if this move causes promotion (piece reaches far row for the first time)
    const willPromote = !piece.isDame && (
      (piece.color === "w" && to[0] === 0) ||
      (piece.color === "b" && to[0] === 7)
    );
    if (willPromote) {
      nb[to[0]][to[1]] = { ...piece, isDame: true };
    } else if (!piece.isDame) {
      // no promotion needed, piece stays normal
    }
    const ne = new Set(excl); ne.add(sqKey(cap[0], cap[1]));
    // Rule (Damas de Moçambique): when a piece becomes a dame for the first time
    // in a chain capture, the chain STOPS — it cannot immediately continue
    // capturing with long-range dame logic in the same turn.
    if (willPromote) {
      out.push({ from: orig, to, captured: [...caps, cap] });
      continue;
    }
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
       const pieceVal = p.isDame ? 380 : 100;
       const adv = p.isDame ? 0 : (p.color === "w" ? (7 - r) * 7 : r * 7);
       const back = !p.isDame && ((p.color === "w" && r === 7) || (p.color === "b" && r === 0)) ? 12 : 0;
       const center = (r >= 2 && r <= 5 && c >= 1 && c <= 6) ? 10 : 0;
       const edgePenalty = p.isDame ? 0 : (c === 0 || c === 7 ? 5 : 0);
       score += sign * (pieceVal + adv + back + center - edgePenalty);
      if (p.color === forColor) forPieces.push({ r, c, isDame: p.isDame });
      else oppPieces.push({ r, c, isDame: p.isDame });
    }
  }

  const forKings = forPieces.filter(p => p.isDame);
  const oppKings = oppPieces.filter(p => p.isDame);
  const onlyKingsLeft = forPieces.length === forKings.length && oppPieces.length === oppKings.length;
  const forMob = getMobility(b, forColor);
  const oppMob = getMobility(b, oppColor);

  // A forced capture is strategically more valuable than raw mobility.
  // This prevents the bot from choosing a pretty-looking move that allows
  // the opponent to create a forcing sequence on the next turn.
  const forMoves = aiGetAllMoves(b, forColor);
  const oppMoves = aiGetAllMoves(b, oppColor);
  const forForced = forMoves.filter(m => m.captured.length > 0).length;
  const oppForced = oppMoves.filter(m => m.captured.length > 0).length;
  const forMaxCapture = Math.max(0, ...forMoves.map(m => m.captured.length));
  const oppMaxCapture = Math.max(0, ...oppMoves.map(m => m.captured.length));
  score += (forMob - oppMob) * 4;
  score += (forForced - oppForced) * 16;
  // Prefer positions that create a real multi-capture threat, not just
  // positions where one isolated pawn can be taken.
  score += (forMaxCapture - oppMaxCapture) * 34;

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
     score -= oppMob * 40;

    // Triangulation bonus: multiple kings surrounding opponent
    if (forKings.length >= 2) {
      const dists = forKings.map(fk => Math.abs(fk.r - ok.r) + Math.abs(fk.c - ok.c)).sort((a, b) => a - b);
      if (dists[0] <= 3) score += 60;
      if (dists.length >= 2 && dists[1] <= 5) score += 45;
    }
  } else if (onlyKingsLeft && forKings.length > 0 && oppKings.length > 0) {
    // ── All-kings endgame (both sides only kings) ──────────────────────────
    // Mobility advantage is critical in king endgames
    score += (forMob - oppMob) * 18;

    if (forKings.length > oppKings.length) {
      // We have more kings: push opponent kings to edges/corners
      for (const ok of oppKings) {
        const edgeDist = Math.min(ok.r, 7 - ok.r, ok.c, 7 - ok.c);
        score += (3 - edgeDist) * 30; // penalise opponent kings near centre
        // Bring our kings close to each opponent king
        for (const fk of forKings) {
          const dist = Math.abs(fk.r - ok.r) + Math.abs(fk.c - ok.c);
          score -= dist * 10;
        }
      }
      score += (forKings.length - oppKings.length) * 120;
    } else if (forKings.length === oppKings.length) {
      // Equal kings: favour diagonal opposition and central control
      for (const fk of forKings) {
        const centralBonus = (fk.r >= 2 && fk.r <= 5 && fk.c >= 2 && fk.c <= 5) ? 20 : 0;
        score += centralBonus;
      }
      score += (forMob - oppMob) * 25;
    }
    // Restrict opponent mobility
    score -= oppMob * 12;
  } else if (forKings.length >= 1 || oppKings.length >= 1) {
    // General king/endgame mobility advantage
    score += (forMob - oppMob) * 5;
  }

  return score;
}

interface DamasSearchContext {
  cache: Map<string, { depth: number; value: number }>;
  deadline: number;
  nodes: number;
  aborted: boolean;
}

function damasBoardKey(b: Board): string {
  return b.map(row => row.map(p => p ? (p.color === "w" ? (p.isDame ? "W" : "w") : (p.isDame ? "B" : "b")) : ".").join("")).join("/");
}

function orderDamasMoves(b: Board, moves: AIMove[]): AIMove[] {
  return [...moves].sort((a, z) => {
    const aPiece = b[a.from[0]][a.from[1]];
    const zPiece = b[z.from[0]][z.from[1]];
    const aPromotes = !!aPiece && !aPiece.isDame && ((aPiece.color === "w" && a.to[0] === 0) || (aPiece.color === "b" && a.to[0] === 7));
    const zPromotes = !!zPiece && !zPiece.isDame && ((zPiece.color === "w" && z.to[0] === 0) || (zPiece.color === "b" && z.to[0] === 7));
    const aCenter = 4 - Math.abs(a.to[0] - 3.5) - Math.abs(a.to[1] - 3.5);
    const zCenter = 4 - Math.abs(z.to[0] - 3.5) - Math.abs(z.to[1] - 3.5);
    return (z.captured.length - a.captured.length) * 1000
      + (Number(zPromotes) - Number(aPromotes)) * 220
      + zCenter - aCenter;
  });
}

function _minimax(
  b: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  botColor: PColor,
  ctx: DamasSearchContext,
  ply: number,
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() >= ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const curColor: PColor = maximizing ? botColor : opp(botColor);
  const key = `${damasBoardKey(b)}|${curColor}|${depth}`;
  const cached = ctx.cache.get(key);
  if (cached && cached.depth >= depth) return cached.value;

  const moves = aiGetAllMoves(b, curColor);
  if (moves.length === 0 || countPieces(b, curColor) === 0) {
    // A side with no legal move or no pieces has lost. Prefer the
    // quickest forced win and delay a forced loss as long as possible.
    return curColor === botColor ? -900000 + ply : 900000 - ply;
  }
  if (depth === 0) return aiEval(b, botColor);

  const ordered = orderDamasMoves(b, moves);
  let cutoff = false;
  let result: number;
  if (maximizing) {
    let best = -Infinity;
    for (const mv of ordered) {
      const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
      best = Math.max(best, _minimax(nb, depth - 1, alpha, beta, false, botColor, ctx, ply + 1));
      if (ctx.aborted) return 0;
      alpha = Math.max(alpha, best);
      if (alpha >= beta) { cutoff = true; break; }
    }
    result = best;
  } else {
    let best = Infinity;
    for (const mv of ordered) {
      const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
      best = Math.min(best, _minimax(nb, depth - 1, alpha, beta, true, botColor, ctx, ply + 1));
      if (ctx.aborted) return 0;
      beta = Math.min(beta, best);
      if (alpha >= beta) { cutoff = true; break; }
    }
    result = best;
  }
  if (!cutoff) ctx.cache.set(key, { depth, value: result });
  return result;
}

const AI_DEPTH = 9;

function getBestBotMove(
  b: Board,
  botColor: PColor,
  depth: number = AI_DEPTH,
  precomputedMoves?: AIMove[],
): AIMove | null {
  const moves = precomputedMoves ?? aiGetAllMoves(b, botColor);
  if (moves.length === 0) return null;
  // Do not spend several seconds re-searching a forced move. The strategic
  // search is valuable only when there is an actual choice to make.
  if (moves.length === 1) return moves[0];
  const ordered = orderDamasMoves(b, moves);
  const totalPieces = b.flat().filter(Boolean).length;
  const targetDepth = totalPieces <= 6 ? Math.max(depth + 5, 14) : totalPieces <= 10 ? Math.max(depth + 2, 11) : depth;
  const ctx: DamasSearchContext = {
    cache: new Map(),
    deadline: Date.now() + (totalPieces <= 6 ? 5200 : totalPieces <= 10 ? 4500 : 3400),
    nodes: 0,
    aborted: false,
  };

  // Iterative deepening means a difficult position always has a legal,
  // fully evaluated answer, while endgames get as much calculation as the
  // available thinking window allows.
  let bestMove: AIMove = ordered[0];
  for (let currentDepth = 1; currentDepth <= targetDepth && !ctx.aborted; currentDepth++) {
    let roundBest = ordered[0];
    let roundBestVal = -Infinity;
    for (const mv of ordered) {
      const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
      const val = _minimax(nb, currentDepth - 1, -Infinity, Infinity, false, botColor, ctx, 1);
      if (ctx.aborted) break;
      if (val > roundBestVal) { roundBestVal = val; roundBest = mv; }
    }
    if (!ctx.aborted) bestMove = roundBest;
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
  const pieceGrad = isWhite
    ? "radial-gradient(circle at 35% 30%,#F5F0E8,#C8C0A8,#A89880)"
    : "radial-gradient(circle at 35% 30%,#4A4040,#2A2020,#181010)";
  return (
    <div className={`gz-playerpanel ${isActive ? "active" : ""}`}>
      <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
        background: pieceGrad,
        border:`2px solid ${isActive ? "rgba(212,160,23,.6)" : isWhite ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.1)"}`,
        boxShadow:"inset 0 2px 4px rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.35)",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {damesLeft > 0 && <CrownIcon size={18} tone={isWhite ? "light" : "dark"} />}
        {isActive && (
          <motion.span
            animate={{opacity:[.4,1,.4]}}
            transition={{duration:1.8,repeat:Infinity}}
            style={{position:"absolute",width:40,height:40,borderRadius:12,border:"2px solid rgba(212,160,23,.5)"}}
          />
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
          <span className={`gz-player-name ${isActive ? "" : "idle"}`}
            style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 }}>{name}</span>
          <span className={`gz-playerbadge ${isMe ? "me" : "rival"}`}>{isMe?"Tu":"Rival"}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span className="gz-player-meta">{balance}</span>
          <span style={{ fontSize:10, color: isActive ? "#f2d38a" : "rgba(244,236,217,.4)", fontWeight:700 }}>
            {piecesLeft} peças{damesLeft > 0 ? ` · ${damesLeft} dama${damesLeft === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      </div>
      <div style={{ padding:"0 12px 0 4px", display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
        {isActive ? <TimerArc val={timeLeft}/> : <div style={{ width:28, height:28 }}/>}
        <div style={{ display:"flex", gap:3 }}>
          {Array.from({ length: 5 }).map((_, i) => {
            const alive = i < lives;
            return (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: alive ? "#EF4444" : "rgba(255,255,255,.12)",
                border: alive ? "none" : "1px solid rgba(255,255,255,.12)",
                boxShadow: alive ? "0 0 5px rgba(239,68,68,.7)" : "none",
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
      style={{ position:"fixed", inset:0, zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center" }}
      className="gz-modal-backdrop">
      <motion.div initial={{ scale:0.85, y:20 }} animate={{ scale:1, y:0 }}
        transition={{ type:"spring", stiffness:280, damping:22 }}
        style={{ width:"82%", maxWidth:300, borderRadius:24, padding:"28px 22px 22px",
          textAlign:"center", background:"linear-gradient(180deg,#221c15,#14100b)",
          border:"1px solid rgba(212,160,23,.22)",
          boxShadow:"0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)" }}>
        <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18,
          color:"#f6e6bf", marginBottom:8 }}>{m.title}</p>
        <p style={{ fontSize:12, color:"rgba(246,230,191,.5)", marginBottom:20, lineHeight:1.5 }}>{m.body}</p>
        {m.actions === "accept_decline" ? (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onDecline} style={{ flex:1, padding:"12px 0", borderRadius:12,
              background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)",
              color:"#fca5a5", fontWeight:700, fontSize:13, cursor:"pointer" }}>Recusar</button>
            <button onClick={onAccept} className="gz-btn-primary">Aceitar</button>
          </div>
        ) : (
          <button onClick={onClose} className="gz-btn-ghost" style={{ width:"100%" }}>Fechar</button>
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
  if (!isWinner)   return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="gz-modal-backdrop">
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        className="gz-modal-card">
        <div className="gz-modal-head">
          <div className="gz-modal-icon-badge">
            <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
              <path d="M8 8 L24 24 M24 8 L8 24" stroke="#f87171" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="gz-modal-label" style={{marginBottom:6}}>DERROTA</p>
          <p style={{fontSize:13,color:"rgba(246,230,191,.6)",lineHeight:1.2,marginBottom:4}}>Perdeste para</p>
          <p className="gz-modal-title">{winnerName}</p>
        </div>
        <div className="gz-modal-body">
          {betAmount > 0 && (
            <div className="gz-stake-box loss">
              <div>
                <p className="gz-stake-label">PERDIDO</p>
                <p className="gz-stake-value loss">
                  -{betAmount.toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div className="gz-stake-icon loss">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <path d="M3 17 L9 11 L13 15 L21 7" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 7 L21 7 L21 11" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} className="gz-btn-primary">
              <RotateCcw style={{width:13,height:13}}/>Revanche
            </button>
            <button onClick={onQuit} className="gz-btn-ghost">
              <LogOut style={{width:13,height:13}}/>Sair
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="gz-modal-backdrop">
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        className="gz-modal-card">
        <div className="gz-modal-head">
          <motion.div animate={{y:[0,-4,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            className="gz-modal-icon-badge">
            <svg width={40} height={40} viewBox="0 0 100 100" fill="none">
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
          <p className="gz-modal-label" style={{marginBottom:6}}>VENCEDOR</p>
          <p className="gz-modal-title">{winnerName}</p>
        </div>
        <div className="gz-modal-body">
          {betAmount > 0 && (
            <div className="gz-stake-box win">
              <div>
                <p className="gz-stake-label">GANHOS</p>
                <p className="gz-stake-value win">
                  +{Math.floor(betAmount * 2 * 0.90).toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div className="gz-stake-icon win">
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#6ee7a0" strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2" stroke="#6ee7a0" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}
          <p style={{fontSize:12,color:"rgba(246,230,191,.5)",textAlign:"center",marginBottom:16}}>
            <span style={{color:"#f6e6bf",fontWeight:600}}>{loserName}</span> foi eliminado
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} className="gz-btn-primary">
              <RotateCcw style={{width:13,height:13}}/>Jogar Novamente
            </button>
            <button onClick={onQuit} className="gz-btn-ghost">
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
  // Config do bot viaja por sessionStorage (URL limpa — o jogador nunca vê
  // que está a jogar contra um bot).
  const botSession = (() => {
    try { return JSON.parse(sessionStorage.getItem(`wm_bot_session_${gameId}`) ?? "null") as { bot?: boolean; botBalance?: number } | null; }
    catch { return null; }
  })();
  const isBot    = botSession?.bot === true;
  const botBal   = Number(botSession?.botBalance ?? 0);
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
  // ── Bot rematch simulation ──
  // Mimics a human opponent: a short "a verificar", an "a aguardar resposta"
  // then accept or decline. A bot that WON accepts up to 3 revanches; a bot
  // that LOST accepts only 1. The counter resets whenever the outcome flips.
  // O contador vive em sessionStorage (wm_bot_rematch) para sobreviver à
  // navegação da revanche (a nova partida é um remount da página).
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
    // Keep wm_active_game always current so Resume works even on native back-swipe
    if (BET > 0) {
      try {
        localStorage.setItem("wm_active_game", JSON.stringify({
          gameId, gameType: "damas", betAmount: BET,
          opponentName, savedAt: Date.now(), ttlMs: 30 * 60_000,
          playerColor: myColor, playerName,
        }));
      } catch { /* ignore */ }
    }
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

  // ── Bot: deduct bet once on mount — server-side ──────────────────────────────
  useEffect(() => {
    if (!isBot || !profile?.id || BET <= 0 || betDeductedRef.current) return;
    // Idempotência: em revanche, a aposta já foi debitada pelo
    // /api/games/bot-session antes da navegação — a flag evita cobrar duas vezes.
    try {
      if (sessionStorage.getItem(`wm_bet_deducted_damas_${gameId}`) === "1") {
        betDeductedRef.current = true;
        return;
      }
    } catch { /* noop */ }
    betDeductedRef.current = true;
    (async () => {
      try {
        const result = await serverBet(BET, "damas", `Aposta (Damas) vs ${opponentName}`, gameId);
        if (!result.ok) { betDeductedRef.current = false; return; }
        getSessionWithRefresh().then((session)=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
        try { sessionStorage.setItem(`wm_bet_deducted_damas_${gameId}`, "1"); } catch {}
        await refreshProfile();
        if (profile?.id) evaluateBotDifficulty(profile.id).catch(() => {});
      } catch { betDeductedRef.current = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBot]);

  // ── Bot AI turn trigger ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBot || turn !== oppColor || !!winner) return;
    setBotThinking(true);
    // Thinking delay follows the position, not an arbitrary long timer:
    // forced moves stay around 2–3 seconds while strategic positions get
    // enough time to calculate without making every turn feel slow.
    const currentMoves = aiGetAllMoves(boardRef.current, oppColor);
    const hasCaptures = currentMoves.some(m => m.captured.length > 0);
    const allKingsCurrent = boardRef.current.flat().every(p => p === null || p.isDame);
    const onlyMove = currentMoves.length === 1;
    const minDelay = onlyMove ? 1900 : allKingsCurrent ? 2800 : hasCaptures ? 2300 : 2000;
    const maxDelay = onlyMove ? 2700 : allKingsCurrent ? 4200 : hasCaptures ? 3600 : 3000;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    const pendingTimers: ReturnType<typeof setTimeout>[] = [];

    const mainTimer = setTimeout(() => {
      setBotThinking(false);
        const move = getBestBotMove(boardRef.current, oppColor, AI_DEPTH, currentMoves);
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

  // Credit winner + register match result when game ends — server-side
  useEffect(() => {
    if (!winner || !profile?.id || BET <= 0 || (gameId === "local" && !isBot) || winCreditedRef.current) return;
    winCreditedRef.current = true;
    const isWinner = winner === myColor;
    (async () => {
      try {
        if (isWinner) {
          const result = await serverWin(gameId, "damas", BET);
          if (!result.ok) { winCreditedRef.current = false; return; }
          await refreshProfile();
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
      // The timed-out player still loses a life, but the system plays a random
      // valid move for them so the game keeps progressing (same rule as Ludo).
      const moves = aiGetAllMoves(boardRef.current, myColor);
      if (moves.length > 0) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        const nb = applyBoardMove(boardRef.current, pick.from, pick.to, pick.captured);
        boardRef.current = nb;
        setBoard(nb);
        setLastMove({ from: pick.from, to: pick.to });
        seqRef.current += 1;
        channelRef.current?.send({ type: "broadcast", event: "damas_move", payload: {
          from: pick.from, to: pick.to, captured: pick.captured, nextTurn: oppColor, seq: seqRef.current,
        }});
        // A forced random move may capture the last opponent piece.
        if (countPieces(nb, oppColor) === 0) {
          setWinner(myColor);
          winnerRef.current = myColor;
          setWinReason("Todas as peças foram capturadas");
          setSelected(null); setValidDests([]); setValidCapDests([]);
          setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
          setTurn(oppColor);
          setTimers({ w: 30, b: 30 });
          return;
        }
      }
      const nextTurn = oppColor;
      setTurn(nextTurn);
      setTimers({ w: 30, b: 30 });
      setSelected(null); setValidDests([]); setValidCapDests([]);
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
      channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: myColor, lives: remaining, gameOver: false, nextTurn } });
    }
  };

  // Bot turn timer (visual countdown + safety auto-forfeit if bot hangs)
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
      // Safety: the bot loses a life but still plays a valid move, so the game
      // never freezes waiting on a hung bot.
      const moves = aiGetAllMoves(boardRef.current, oppColor);
      if (moves.length > 0) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        const nb = applyBoardMove(boardRef.current, pick.from, pick.to, pick.captured);
        boardRef.current = nb;
        setBoard(nb);
        setLastMove({ from: pick.from, to: pick.to });
        if (countPieces(nb, myColor) === 0) {
          setWinner(oppColor);
          winnerRef.current = oppColor;
          setWinReason("Todas as peças foram capturadas pelo bot");
        }
      }
      setTurn(myColor);
      setTimers({ w: 30, b: 30 });
      setSelected(null); setValidDests([]); setValidCapDests([]);
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]); setChainForbiddenDir(null);
    }
  };

  // ── Timers ────────────────────────────────────────────────────────────────
  // My turn timer (wall-clock based; NUNCA reinicia ao retomar — o início do
  // turno persiste em sessionStorage, o countdown continua de onde parou)
  const turnTimerKey = `wm_damas_timer_${gameId}_${myColor}`;
  const prevTimerTurnRef = useRef<PColor|null>(_savedDamas?.turn ?? null);
  useEffect(() => {
    if (winner || turn !== myColor) {
      try { sessionStorage.removeItem(turnTimerKey); } catch { /* ignore */ }
      return;
    }
    // Cadeia de captura a decorrer: timer em pausa visual, mantém o registo
    if (chainPiece) return;
    // Novo turno real? → começa agora. Retoma (back + voltar)? → continua.
    const isNewTurn = prevTimerTurnRef.current !== turn;
    prevTimerTurnRef.current = turn;
    let start = 0;
    if (!isNewTurn) {
      try {
        const saved = sessionStorage.getItem(turnTimerKey);
        const parsed = saved ? parseInt(saved, 10) : 0;
        if (parsed && parsed > Date.now() - 120_000) start = parsed; // sanidade <2min
      } catch { /* ignore */ }
    }
    if (!start) {
      start = Date.now();
      try { sessionStorage.setItem(turnTimerKey, String(start)); } catch { /* ignore */ }
    }
    channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:Math.max(0, 30 - Math.floor((Date.now() - start) / 1000)) } });
    let firedExpiry = false;
    const fireExpiry = () => {
      if (firedExpiry) return;
      firedExpiry = true;
      clearInterval(tick);
      const t0 = Math.max(0, 30 - Math.floor((Date.now() - start) / 1000));
      channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:t0 } });
      setTimeout(() => timerExpiryRef.current(), 0);
    };
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const nv = Math.max(0, 30 - elapsed);
      setTimers(prev => ({ ...prev, [myColor]: nv }));
      if (nv <= 0) { fireExpiry(); return; }
      channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:nv } });
    }, 500);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const nv = Math.max(0, 30 - elapsed);
      setTimers(prev => ({ ...prev, [myColor]: nv }));
      if (nv <= 0) fireExpiry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", onVisible);
      // Sem remoção aqui: o user pode sair e retomar — countdown contínuo.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, chainPiece]);
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

  // ── Continuação automática — adversário ausente no turno dele ─────────────
  // O timer nunca pausa: se o adversário saiu (back/tab suspensa) e o tempo
  // dele esgota, o sistema desconta 1 vida e joga um movimento aleatório
  // válido por ele. Vidas a zero → derrota dele.
  const oppAbsenceHandledRef = useRef<number>(0);
  useEffect(() => {
    if (winner || isBot || gameId === "local") return;
    const iv = setInterval(() => {
      if (winnerRef.current) return;
      if (turnRef.current !== oppColor) return;
      // Tempo do adversário esgotado há >20s sem resposta (30s timer + 20s folga)
      const expireAt = oppTimerRecvAtRef.current + oppTimerRecvValRef.current * 1000;
      const sinceExpire = Math.floor((Date.now() - expireAt) / 1000);
      if (sinceExpire < 20) return;
      const stamp = Math.floor(Date.now() / 1000);
      if (oppAbsenceHandledRef.current === stamp) return;
      oppAbsenceHandledRef.current = stamp;
      // 1) Desconta 1 vida ao adversário
      const remaining = Math.max(0, (livesRef.current[oppColor] ?? 3) - 1);
      const newLives = { ...livesRef.current, [oppColor]: remaining };
      livesRef.current = newLives;
      setLives(newLives);
      if (remaining <= 0) {
        winnerRef.current = myColor;
        setWinner(myColor);
        setWinReason(`${opponentName} perdeu todas as vidas (ausente)`);
        channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: oppColor, lives: 0, gameOver: true } });
        return;
      }
      setWinReason(`${opponentName} ausente — o sistema joga por ele.`);
      channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: oppColor, lives: remaining, gameOver: false, nextTurn: myColor } });
      // 2) Sistema joga por ele: um movimento aleatório válido
      const moves = aiGetAllMoves(boardRef.current, oppColor);
      if (moves.length > 0) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        seqRef.current += 1;
        channelRef.current?.send({ type: "broadcast", event: "damas_move", payload: {
          from: pick.from, to: pick.to, captured: pick.captured, nextTurn: myColor, seq: seqRef.current,
        }});
        applyRemoteMove(pick.from, pick.to, pick.captured, myColor);
      } else {
        setTurn(myColor);
        setTimers({ w: 30, b: 30 });
      }
    }, 5000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, isBot, gameId]);

  // ── Apply remote move ─────────────────────────────────────────────────────
  const applyRemoteMove = useCallback((from: Sq, to: Sq, captured: Sq[], nextTurn: PColor) => {
    // Compute new board eagerly from ref so boardRef stays in sync for resyncs
    const nb = applyBoardMove(boardRef.current, from, to, captured);
    boardRef.current = nb;
    // O oponente ouve o som do movimento, tal como eu ouço o meu
    if (captured.length > 0) playDamasCapture(); else playDamasMove();
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
        getSessionWithRefresh().then((session)=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
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
      if (winnerRef.current) {
        // Jogo terminado: responde mesmo assim para o outro lado ver a derrota
        ch.send({
          type: "broadcast", event: "damas_resync_state",
          payload: { board: boardRef.current, turn: turnRef.current, seq: seqRef.current, lives: livesRef.current, winner: winnerRef.current },
        });
        return;
      }
      ch.send({
        type: "broadcast", event: "damas_resync_state",
        payload: { board: boardRef.current, turn: turnRef.current, seq: seqRef.current, lives: livesRef.current },
      });
    });

    ch.on("broadcast", { event: "damas_resync_state" }, ({ payload }) => {
      const incoming = payload as { board: Board; turn: PColor; seq: number; lives?: Record<PColor, number>; winner?: PColor | null };
      if (incoming.turn !== "w" && incoming.turn !== "b") return;
      if (incoming.lives) {
        livesRef.current = incoming.lives;
        setLives(incoming.lives);
      }
      if (incoming.winner) {
        winnerRef.current = incoming.winner;
        setWinner(incoming.winner);
        setWinReason(`${incoming.winner === myColor ? "Venceste" : `${opponentName} venceu`} — jogo terminado.`);
        return;
      }
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
          const result = await serverBet(BET, "damas", "Aposta de revanche (Damas)");
          if (!result.ok) {
            ch.send({ type:"broadcast", event:"rematch_response", payload:{ accepted:false, reason:"no_balance" } }).catch(() => {});
            setRematchPhase("no_balance");
            return;
          }
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
            const result = await serverBet(BET, "damas", "Aposta de jogo (Damas)", gameId);
            if(!result.ok){ betDeductedRef.current = false; }
            else {
              try { sessionStorage.setItem(`wm_bet_deducted_damas_${gameId}`, "1"); } catch { /* ignore */ }
              await refreshProfile();
            }
          }catch{ betDeductedRef.current = false; }
        }
        // A partida é registada APENAS pelo servidor (/api/games/bet) —
        // escrita directa no browser está bloqueada por RLS (hardening v2).
      }
    });

    return () => { supabase.removeChannel(ch); };
  }, [gameId, applyRemoteMove]);

  // ── Broadcast move ────────────────────────────────────────────────────────
  function broadcastMove(from: Sq, to: Sq, captured: Sq[], nextTurn: PColor) {
    // Game has definitively started — credit referral reward now (player's own first move)
    if (BET > 0 && !rewardFiredRef.current) {
      rewardFiredRef.current = true;
      getSessionWithRefresh().then((session)=>{if(session?.access_token)fetch("/api/record-bet-reward",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:"{}"}).catch(()=>{});}).catch(()=>{});
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
      // Check if the piece will be promoted by this capture step
      const pieceBeforeCapture = boardRef.current[chainPiece[0]][chainPiece[1]];
      const newBoard = applyBoardMove(boardRef.current, chainPiece, dest.to, [dest.cap]);
      const pieceAfterCapture = newBoard[dest.to[0]][dest.to[1]];
      const justPromoted = !pieceBeforeCapture?.isDame && pieceAfterCapture?.isDame;
      setBoard(newBoard);
      boardRef.current = newBoard;
      const newExcl = new Set(chainExcl); newExcl.add(sqKey(dest.cap[0], dest.cap[1]));
      const newAllCaptured = [...allCaptured, dest.cap];
      const origFrom = chainFrom ?? chainPiece;
      // Rule: if piece just became a dame, stop the chain — cannot capture as dame in same turn
      if (justPromoted) {
        finalizeTurn(origFrom, dest.to, newAllCaptured, newBoard);
        return;
      }
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
        const pieceBeforeFirst = boardRef.current[selected[0]][selected[1]];
        const newBoard = applyBoardMove(boardRef.current, selected, capDest.to, [capDest.cap]);
        const pieceAfterFirst = newBoard[capDest.to[0]][capDest.to[1]];
        const firstJustPromoted = !pieceBeforeFirst?.isDame && pieceAfterFirst?.isDame;
        setBoard(newBoard); boardRef.current = newBoard;
        const newExcl = new Set(chainExcl); newExcl.add(sqKey(capDest.cap[0], capDest.cap[1]));
        // Rule: if piece just became a dame on this capture, stop the chain
        if (firstJustPromoted) {
          finalizeTurn(selected, capDest.to, [capDest.cap], newBoard);
          return;
        }
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
      // ── Simulate a human opponent accepting/declining a rematch ──
      // Estado persistente por tab: sobrevive à navegação da revanche
      // (nova partida = remount), mantendo o limite de aceitações do bot.
      let st = { count: 0, lastWon: null as boolean | null };
      try {
        const raw = sessionStorage.getItem("wm_bot_rematch");
        if (raw) { const p = JSON.parse(raw); if (p && typeof p.count === "number") st = p; }
      } catch { /* noop */ }
      const botWon = winner === oppColor;
      if (st.lastWon !== botWon) { st.count = 0; st.lastWon = botWon; }
      const maxRematches = botWon ? 3 : 1;
      const willAccept = st.count < maxRematches;

      setRematchPhase("checking");
      // Bot "checks" the request, then decides.
      setTimeout(() => {
        if (!willAccept) {
          setRematchPhase("declined");
          return;
        }
        setRematchPhase("waiting");
        setTimeout(async () => {
          try {
            // Sessão de bot criada no SERVIDOR: débito atómico + partida
            // registada (id "wmb_") para a vitória ser pagável no /games/win.
            const session = await getSessionWithRefresh();
            const token = session?.access_token;
            if (!token) { setRematchPhase("no_balance"); return; }
            const res = await fetch(`${API_BASE}/games/bot-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ gameType: "damas", betAmount: BET }),
            });
            const json = await res.json() as { ok?: boolean; gameId?: string; botName?: string; botBalance?: number; error?: string };
            if (!res.ok || !json.ok || !json.gameId) {
              setRematchPhase(json.error === "Saldo insuficiente" ? "no_balance" : "no_balance");
              return;
            }
            st.count += 1;
            try { sessionStorage.setItem("wm_bot_rematch", JSON.stringify(st)); } catch { /* noop */ }
            try { sessionStorage.setItem(`wm_bet_deducted_damas_${json.gameId}`, "1"); } catch { /* noop */ }
            try { sessionStorage.setItem(`wm_bot_session_${json.gameId}`, JSON.stringify({ bot: true, botBalance: json.botBalance ?? 200 })); } catch { /* noop */ }
            await refreshProfile();
            setRematchPhase("idle");
            const myEnc  = encodeURIComponent(profile?.full_name ?? "Jogador");
            const oppEnc = encodeURIComponent(json.botName ?? opponentName);
            setLocation(`/damas-jogo?gameId=${json.gameId}&color=${myColor}&bet=${BET}&opp=${oppEnc}&myname=${myEnc}`);
          } catch { setRematchPhase("no_balance"); }
        }, 900 + Math.random() * 700);
      }, 700 + Math.random() * 600);
      return;
    }
    if (!profile?.id) { setRematchPhase("no_balance"); return; }
    if (!channelRef.current) { setRematchPhase("no_balance"); return; }
    setRematchPhase("waiting");
    channelRef.current.send({ type:"broadcast", event:"rematch_request", payload:{ name: playerName.split(" ")[0] } }).catch(() => {});
  }

  async function handleRematchAccept() {
    if (!profile?.id) return;
    if (BET > 0) {
      const result = await serverBet(BET, "damas", "Aposta de revanche (Damas)").catch(() => null);
      if (!result?.ok) {
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
    <div className="responsive-game-viewport gz-game-viewport" style={{ height:"100vh", width:"100%", overflow:"hidden",
      display:"flex", justifyContent:"center" }}>
      <div className="responsive-game-shell gz-game-shell" style={{ width:"100%", maxWidth:430, height:"100vh", overflow:"hidden",
        display:"flex", flexDirection:"column", position:"relative" }}>

        {/* Header */}
        <div className="gz-game-header">
          <button onClick={handleBack} className="gz-game-iconbtn" aria-label="Voltar">
            <ArrowLeft style={{ width:17, height:17 }}/>
          </button>
          <div style={{ textAlign:"center", flex:1, minWidth:0 }}>
            <p className="gz-game-title">DAMAS</p>
            {kingsOnlyCount > 0
              ? <p className="gz-game-subtitle" style={{ color:"#f2d38a" }}>
                  SÓ DAMAS — {30 - kingsOnlyCount} JOGADAS
                </p>
              : <p className="gz-game-subtitle">1 VS 1 · ONLINE</p>
            }
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {!winner && gameId !== "local" && (
              <button onClick={handleForfeit} className="gz-game-iconbtn danger" aria-label="Desistir">
                <LogOut style={{ width:16, height:16 }}/>
              </button>
            )}
            <div className="gz-game-chip">
              {BET > 0 ? `${BET} MT` : "Demo"}
            </div>
          </div>
        </div>

        {/* Opponent panel */}
        <div className="gz-game-panelcol" style={{ padding:"8px 10px 4px", flexShrink:0 }}>
          <PlayerCard
            color={oppColor} name={opponentName} balance={opponentBal} isMe={false}
            isActive={turn === oppColor && !winner}
            piecesLeft={oppPieces} damesLeft={oppDames}
            timeLeft={timers[oppColor]} lives={lives[oppColor]}
          />
        </div>

        {/* Board */}
        <div className="gz-game-body" style={{ padding:"4px 10px" }}>
          <div className="gz-board-frame" style={{ width:"100%" }}>
            <div className="gz-board-inner">

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
                            <div style={{
                              position:"absolute", inset:0, borderRadius:"50%",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              background: piece.color === "w"
                                ? "radial-gradient(circle at 50% 42%, rgba(212,160,23,0.28), rgba(212,160,23,0) 70%)"
                                : "radial-gradient(circle at 50% 42%, rgba(245,197,66,0.30), rgba(245,197,66,0) 70%)",
                            }}>
                              <CrownIcon fluid tone={piece.color === "w" ? "light" : "dark"} />
                            </div>
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
        <div className="gz-game-panelcol" style={{ padding:"4px 10px 2px", flexShrink:0, display:"flex", justifyContent:"center" }}>
          <div className={`gz-turn ${myTurn ? "mine" : ""}`}>
            <span className="gz-turndot" style={{
              background: myTurn ? "#f2d38a" : "rgba(244,236,217,.4)",
              color: myTurn ? "#f2d38a" : "transparent",
            }}/>
            {winner ? `Jogo terminado — ${winner === myColor ? "Venceste!" : "Perdeste"}` :
              chainPiece ? "Captura em cadeia! Continua a capturar." :
              myTurn ? `${playerName.split(" ")[0]} — faz o teu movimento` : `A aguardar ${opponentName}...`}
          </div>
        </div>

        {/* My panel */}
        <div className="gz-game-panelcol" style={{ padding:"4px 10px 3px", flexShrink:0 }}>
          <PlayerCard
            color={myColor} name={playerName} balance={playerBal} isMe={true}
            isActive={myTurn && !winner}
            piecesLeft={myPieces} damesLeft={myDames}
            timeLeft={timers[myColor]} lives={lives[myColor]}
          />
        </div>

        {/* Ad banner */}
        <div style={{ padding:"4px 10px 5px", flexShrink:0 }}>
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
