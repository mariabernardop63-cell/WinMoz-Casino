import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

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
function getCaptures(b: Board, r: number, c: number, excl: Set<string> = new Set()): { to: Sq; cap: Sq }[] {
  const piece = b[r][c];
  if (!piece) return [];
  const color = piece.color;
  const res: { to: Sq; cap: Sq }[] = [];

  if (piece.isDame) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as [number,number][]) {
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

function maxDepth(b: Board, r: number, c: number, excl: Set<string> = new Set()): number {
  const caps = getCaptures(b, r, c, excl);
  if (!caps.length) return 0;
  let mx = 0;
  for (const { to, cap } of caps) {
    const ne = new Set(excl); ne.add(sqKey(cap[0], cap[1]));
    const tb = cloneBoard(b);
    tb[to[0]][to[1]] = tb[r][c]; tb[r][c] = null; tb[cap[0]][cap[1]] = null;
    const d = 1 + maxDepth(tb, to[0], to[1], ne);
    if (d > mx) mx = d;
  }
  return mx;
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
  caps: Sq[], excl: Set<string>, out: AIMove[]
): void {
  const nextCaps = getCaptures(board, cur[0], cur[1], excl);
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
    _expandAIMoves(nb, orig, to, [...caps, cap], ne, out);
  }
}

function aiGetAllMoves(b: Board, color: PColor): AIMove[] {
  const captures: AIMove[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c]?.color === color)
        _expandAIMoves(b, [r, c], [r, c], [], new Set(), captures);
  if (captures.length > 0) return captures;
  const moves: AIMove[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c]?.color === color)
        for (const to of getNonCaptures(b, r, c))
          moves.push({ from: [r, c], to, captured: [] });
  return moves;
}

function aiEval(b: Board, forColor: PColor): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (!p) continue;
      const sign = p.color === forColor ? 1 : -1;
      const pieceVal = p.isDame ? 300 : 100;
      const adv = p.isDame ? 0 : (p.color === "w" ? (7 - r) * 6 : r * 6);
      const back = !p.isDame && ((p.color === "w" && r === 7) || (p.color === "b" && r === 0)) ? 15 : 0;
      const center = (r >= 2 && r <= 5 && c >= 1 && c <= 6) ? 8 : 0;
      score += sign * (pieceVal + adv + back + center);
    }
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

function getBestBotMove(b: Board, botColor: PColor): AIMove | null {
  const moves = aiGetAllMoves(b, botColor);
  if (moves.length === 0) return null;
  // Move ordering: captures first → better alpha-beta pruning
  moves.sort((a, z) => z.captured.length - a.captured.length);
  let bestMove: AIMove = moves[0];
  let bestVal = -Infinity;
  for (const mv of moves) {
    const nb = applyBoardMove(b, mv.from, mv.to, mv.captured);
    const val = _minimax(nb, AI_DEPTH - 1, -Infinity, Infinity, false, botColor);
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
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:60,
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
function WinScreen({ isWinner, winnerName, loserName, betAmount, onReplay, onQuit }: {
  isWinner: boolean; winnerName: string; loserName: string; betAmount: number;
  onReplay: () => void; onQuit: () => void;
}) {
  if (!isWinner) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.88)",
        backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        style={{borderRadius:26,maxWidth:310,width:"88%",overflow:"hidden",
          boxShadow:"0 32px 80px rgba(0,0,0,0.75),0 0 60px rgba(239,68,68,0.15)",
          border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{background:"linear-gradient(145deg,#1a0a0a,#2a0f0f)",padding:"28px 24px 22px",textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <svg width={72} height={72} viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="34" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth="1.5"/>
              <path d="M22 22 L50 50 M50 22 L22 50" stroke="#EF4444" strokeWidth="5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
            color:"rgba(255,100,100,0.8)",marginBottom:6}}>DERROTA</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,
            color:"rgba(255,255,255,0.65)",lineHeight:1.2,marginBottom:4}}>Perdeste para</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#fff",lineHeight:1.1}}>{winnerName}</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.08)",padding:"20px 24px 22px"}}>
          {betAmount > 0 && (
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>PERDIDO</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:20,color:"#EF4444",lineHeight:1}}>
                  -{betAmount.toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div style={{width:40,height:40,borderRadius:10,background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <path d="M3 17 L9 11 L13 15 L21 7" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 7 L21 7 L21 11" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} style={{flex:1,background:"rgba(239,68,68,0.15)",color:"#EF4444",
              borderRadius:14,padding:"14px 0",border:"1px solid rgba(239,68,68,0.3)",
              fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <RotateCcw style={{width:13,height:13}}/>Revanche
            </button>
            <button onClick={onQuit} style={{flex:1,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.65)",
              borderRadius:14,padding:"14px 0",fontFamily:"'Syne',sans-serif",fontWeight:700,
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
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.88)",
        backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        style={{borderRadius:26,maxWidth:310,width:"88%",overflow:"hidden",
          boxShadow:"0 32px 80px rgba(0,0,0,0.75),0 0 60px rgba(212,163,90,0.2)",
          border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{background:"linear-gradient(145deg,#5A3A10,#3A2008)",padding:"28px 24px 22px",textAlign:"center"}}>
          <motion.div animate={{y:[0,-5,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <svg width={72} height={72} viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="dwtg" x1="25%" y1="0%" x2="75%" y2="100%">
                  <stop offset="0%" stopColor="#FFE566"/>
                  <stop offset="50%" stopColor="#FFD700"/>
                  <stop offset="100%" stopColor="#B8860B"/>
                </linearGradient>
              </defs>
              <path d="M28 12 L72 12 L68 52 Q65 64 50 68 Q35 64 32 52 Z" fill="url(#dwtg)"/>
              <path d="M28 16 Q14 16 14 32 Q14 44 28 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <path d="M72 16 Q86 16 86 32 Q86 44 72 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <rect x="44" y="68" width="12" height="12" fill="url(#dwtg)" rx="2"/>
              <rect x="30" y="80" width="40" height="7" fill="url(#dwtg)" rx="3.5"/>
              <ellipse cx="38" cy="30" rx="7" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-18 38 30)"/>
            </svg>
          </motion.div>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
            color:"rgba(255,215,0,0.7)",marginBottom:6}}>VENCEDOR</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#fff",lineHeight:1.1}}>{winnerName}</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.08)",padding:"20px 24px 22px"}}>
          {betAmount > 0 && (
            <div style={{background:"linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05))",
              border:"1px solid rgba(255,215,0,0.3)",borderRadius:14,padding:"14px 16px",
              display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:4}}>GANHOS</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",lineHeight:1}}>
                  +{Math.floor(betAmount * 2 * 0.90).toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
                </p>
              </div>
              <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,215,0,0.12)",
                border:"1px solid rgba(255,215,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#FFD700" strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}
          <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",marginBottom:16}}>
            <span style={{color:"rgba(255,255,255,0.65)",fontWeight:600}}>{loserName}</span> foi eliminado
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onReplay} style={{flex:1,background:"linear-gradient(135deg,#D4A35A,#B8860B)",
              color:"#fff",borderRadius:14,padding:"14px 0",border:"none",
              fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <RotateCcw style={{width:13,height:13}}/>Jogar Novamente
            </button>
            <button onClick={onQuit} style={{flex:1,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.65)",
              borderRadius:14,padding:"14px 0",fontFamily:"'Syne',sans-serif",fontWeight:700,
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
  const lastMoveTimeRef = useRef<number>(0); // rate limit: min 200ms between moves
  const [opponentBal, setOpponentBal] = useState(isBot && botBal ? `${botBal} MT` : "—");
  const [botThinking, setBotThinking] = useState(false);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
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
          await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: `Aposta (Damas) vs ${opponentName}`, status: "approved" });
          try { sessionStorage.setItem(`wm_bet_deducted_damas_${gameId}`, "1"); } catch {}
          await supabase.from("matches").upsert({
            id: gameId, game_type: "dama",
            player1_id: profile.id, player1_name: playerName,
            player2_name: opponentName,
            bet_amount: BET, winner_payout: Math.floor(BET * 2 * 0.90),
            status: "active", created_at: new Date().toISOString(),
          }, { onConflict: "id" });
          await refreshProfile();
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
    const t = setTimeout(() => {
      setBotThinking(false);
      const move = getBestBotMove(boardRef.current, oppColor);
      if (!move) {
        setWinner(myColor); winnerRef.current = myColor;
        setWinReason(`${opponentName} ficou sem movimentos`);
        return;
      }
      const nb = applyBoardMove(boardRef.current, move.from, move.to, move.captured);
      boardRef.current = nb;
      setBoard(nb);
      setLastMove({ from: move.from, to: move.to });
      setSelected(null); setValidDests([]); setValidCapDests([]);
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]);
      const myCnt = countPieces(nb, myColor);
      if (myCnt === 0) {
        setWinner(oppColor); winnerRef.current = oppColor;
        setWinReason("Todas as peças foram capturadas pelo bot");
      } else {
        setTurn(myColor);
        setTimers(t => ({ ...t, [myColor]: 30 }));
      }
    }, delay);
    return () => { clearTimeout(t); setBotThinking(false); };
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
      setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]);
      channelRef.current?.send({ type: "broadcast", event: "damas_timer_forfeit", payload: { player: myColor, lives: remaining, gameOver: false, nextTurn } });
    }
  };

  // ── Timers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (winner || turn !== myColor || chainPiece) return;
    // Broadcast timer reset to opponent
    channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:30 } });
    const tick = setInterval(() => {
      setTimers(prev => {
        const nv = prev[myColor] - 1;
        if (nv <= 0) {
          setTimeout(() => timerExpiryRef.current(), 0);
          channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:0 } });
          return { ...prev, [myColor]: 0 };
        }
        channelRef.current?.send({ type:"broadcast", event:"damas_timer", payload:{ player:myColor, t:nv } });
        return { ...prev, [myColor]: nv };
      });
    }, 1000);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, chainPiece]);

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
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]);
    if (nextPlayerPieces === 0) {
      const w = opp(nextTurn);
      setWinner(w);
      winnerRef.current = w;
      setWinReason("Todas as peças foram capturadas");
    } else {
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
      applyRemoteMove(from, to, payload.captured as Sq[], nextTurn);
    });

    ch.on("broadcast", { event: "damas_timer" }, ({ payload }) => {
      if ((payload.player as string) !== myColor) {
        const t = payload.t as number;
        if (typeof t === "number" && t >= 0 && t <= 30) {
          setTimers(prev => ({ ...prev, [payload.player as string]: t }));
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
          if (data) {
            const newBal = parseFloat(String(data.balance)) - BET;
            await supabase.from("profiles").update({ balance: newBal }).eq("id", profile.id);
            await supabase.from("transactions").insert({ user_id: profile.id, type: "bet", amount: -BET, description: "Aposta de revanche (Damas)", status: "approved" });
          }
        }
        setRematchPhase("idle");
        resetGame();
      } else if ((payload.reason as string) === "no_balance") {
        setRematchPhase("opp_no_balance");
      } else {
        setRematchPhase("declined");
      }
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ color: string; balance?: string }>();
      for (const presences of Object.values(state)) {
        for (const p of presences as Array<{ color: string; balance?: string }>) {
          if (p.color !== myColor && p.balance) setOpponentBal(p.balance);
        }
      }
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
    seqRef.current++;
    channelRef.current?.send({
      type: "broadcast", event: "damas_move",
      payload: { from, to, captured, nextTurn, seq: seqRef.current },
    });
  }

  // ── Execute a complete move (end of chain or non-capture) ─────────────────
  // finalBoard must already have the move applied (piece at `to`, captures removed)
  function finalizeTurn(from: Sq, to: Sq, captured: Sq[], finalBoard: Board) {
    // Count opponent's pieces — if 0, I captured them all and win
    const oppCnt = countPieces(finalBoard, opp(turn));
    setBoard(finalBoard); boardRef.current = finalBoard;
    setLastMove({ from, to });
    setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]);
    if (oppCnt === 0) {
      setWinner(turn);
      winnerRef.current = turn;
      setWinReason("Todas as peças foram capturadas");
      broadcastMove(from, to, captured, opp(turn));
      return;
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
      const [pr, pc] = chainPiece;
      const newBoard = applyBoardMove(boardRef.current, chainPiece, dest.to, [dest.cap]);
      setBoard(newBoard);
      boardRef.current = newBoard;
      const newExcl = new Set(chainExcl); newExcl.add(sqKey(dest.cap[0], dest.cap[1]));
      const newAllCaptured = [...allCaptured, dest.cap];
      const origFrom = chainFrom ?? chainPiece;
      // Check for more captures
      const nextCaps = getCaptures(newBoard, dest.to[0], dest.to[1], newExcl);
      if (nextCaps.length > 0) {
        setChainPiece(dest.to); setChainExcl(newExcl); setAllCaptured(newAllCaptured);
        setChainFrom(origFrom);
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
        const nextCaps = getCaptures(newBoard, capDest.to[0], capDest.to[1], newExcl);
        if (nextCaps.length > 0) {
          setChainPiece(capDest.to); setChainExcl(newExcl);
          setAllCaptured([capDest.cap]); setChainFrom(selected);
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
      const caps = getCaptures(boardRef.current, r, c);
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
    if (gameId === "local" || BET === 0 || isBot) { resetGame(); return; }
    setRematchPhase("checking");
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
      const fetch   = supabase.from("profiles").select("balance").eq("id", profile!.id).single()
                       .then(r => r.data);
      const data = await Promise.race([fetch, timeout]) as { balance: string | number } | null;
      if (!data || parseFloat(String(data.balance)) < BET) {
        setRematchPhase("no_balance"); return;
      }
      setRematchPhase("waiting");
      channelRef.current?.send({ type:"broadcast", event:"rematch_request", payload:{ name: playerName.split(" ")[0] } });
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
    const nb = makeInitialBoard();
    setBoard(nb); boardRef.current = nb;
    setTurn("w"); setSelected(null); setValidDests([]); setValidCapDests([]);
    setChainPiece(null); setChainExcl(new Set()); setChainFrom(null); setAllCaptured([]);
    setWinner(null); setWinReason(""); setLastMove(null);
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
            <p style={{ fontSize:9, color:"rgba(255,255,255,0.28)", marginTop:1, letterSpacing:2.5, fontWeight:700 }}>1 VS 1</p>
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
        <div style={{ padding:"4px 10px 8px", flexShrink:0 }}>
          <PlayerCard
            color={myColor} name={playerName} balance={playerBal} isMe={true}
            isActive={myTurn && !winner}
            piecesLeft={myPieces} damesLeft={myDames}
            timeLeft={timers[myColor]} lives={lives[myColor]}
          />
        </div>

      </div>

      {/* Win overlay */}
      <AnimatePresence>
        {winner && (
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
