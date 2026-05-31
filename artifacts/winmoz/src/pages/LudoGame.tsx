import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut, Shield, Zap, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type Player = "blue" | "green";
type PieceId = "B0"|"B1"|"B2"|"B3"|"G0"|"G1"|"G2"|"G3";
type Phase = "roll"|"select"|"moving"|"done";
interface GamePiece { id: PieceId; player: Player; pos: number; }

// ─── Board Geometry ───────────────────────────────────────────────────────────
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
// Home stretch — entered AFTER the arrow cell (TRACK[50] for blue, TRACK[24] for green)
const BLUE_STRETCH:  [number,number][] = [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]];
const GREEN_STRETCH: [number,number][] = [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]];
const PLAYER_START: Record<Player,number> = { blue:0, green:26 };
const HOME_SLOTS: Record<Player,[number,number][]> = {
  blue:  [[10,1],[10,3],[12,1],[12,3]],
  green: [[2,10],[2,12],[4,10],[4,12]],
};

// Safe squares — captures not allowed here
// Visual stars at these exact positions: pawns here cannot be captured
const STAR_DISPLAY: [number,number][] = [
  [8,1],   // TRACK[9]  — top arm
  [5,6],   // TRACK[18] — left arm
  [6,13],  // TRACK[35] — right arm
  [9,8],   // TRACK[44] — bottom arm
];
const SAFE_IDX = [0,9,13,18,26,35,39,44];
const SAFE_COORDS = new Set<string>([
  ...SAFE_IDX.map(i=>`${TRACK[i][0]},${TRACK[i][1]}`),
  ...STAR_DISPLAY.map(([r,c])=>`${r},${c}`),
  // colored starting squares are always safe
  "13,6", "1,8",
]);

// Pawn sizing constants
const PIECE_BOX = 38;   // hit-area / ring box (px)
const PAWN_SIZE = 22;   // pawn SVG width (px)
const PAWN_H = Math.round(PAWN_SIZE * 80 / 56);  // ≈31px height

// ─── getPieceCoord  — stretch entered after pos 50 (arrow cell) ───────────────
function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1) return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 50)  return TRACK[(PLAYER_START[p.player]+p.pos)%52];
  if (p.pos <= 56)  return (p.player==="blue"?BLUE_STRETCH:GREEN_STRETCH)[p.pos-51];
  return [7,7]; // finished — center
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const Q = {
  red:    { main:"#E8181C", bg:"#C41014" },
  green:  { main:"#1CBF3C", bg:"#15992E" },
  blue:   { main:"#1565E8", bg:"#0F50CC" },
  yellow: { main:"#F5C800", bg:"#D4AA00" },
};
// Vibrant stretch colours — closer to parent colour
const STRETCH_COL = {
  red:    "#FF5B5B",
  green:  "#1CD44C",
  blue:   "#2E8EFF",
  yellow: "#FFCC00",
};

type PawnColor = "red"|"green"|"blue"|"yellow";
const PAWN_PALETTE: Record<PawnColor,{s:string;m:string;d:string;sh:string}> = {
  red:    { s:"#FF9494", m:"#EF4444", d:"#B91C1C", sh:"#7F1D1D" },
  green:  { s:"#72F094", m:"#22C55E", d:"#15803D", sh:"#14532D" },
  blue:   { s:"#82C4FF", m:"#3B82F6", d:"#1D4ED8", sh:"#1E3A8A" },
  yellow: { s:"#FFE570", m:"#EAB308", d:"#A16207", sh:"#713F12" },
};

// ─── Location-Pin Pawn ────────────────────────────────────────────────────────
function Pawn({ color, size=PAWN_SIZE, glow=false }: {
  color: PawnColor; size?: number; glow?: boolean;
}) {
  const p = PAWN_PALETTE[color];
  const id = `pw_${color}`;
  return (
    <div style={{
      filter: glow
        ? `drop-shadow(0 0 6px ${p.m}) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`
        : "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
      display:"flex", flexShrink:0,
    }}>
      <svg viewBox="0 0 56 80" width={size} height={Math.round(size*80/56)}>
        <defs>
          <radialGradient id={`${id}_g`} cx="32%" cy="26%" r="70%">
            <stop offset="0%"  stopColor={p.s}/>
            <stop offset="45%" stopColor={p.m}/>
            <stop offset="100%" stopColor={p.d}/>
          </radialGradient>
          <radialGradient id={`${id}_inner`} cx="40%" cy="35%" r="62%">
            <stop offset="0%"  stopColor="white"/>
            <stop offset="100%" stopColor={p.s}/>
          </radialGradient>
        </defs>
        <ellipse cx="28" cy="77" rx="13" ry="3.5" fill="rgba(0,0,0,0.18)"/>
        <path d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill={`url(#${id}_g)`}/>
        <path d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill="none" stroke={p.d} strokeWidth="1" opacity="0.4"/>
        <circle cx="28" cy="27" r="13.5" fill={`url(#${id}_inner)`} opacity="0.96"/>
        <circle cx="28" cy="27" r="9" fill={p.m} opacity="0.28"/>
        <ellipse cx="19" cy="17" rx="7.5" ry="5.5" fill="white" opacity="0.7"/>
      </svg>
    </div>
  );
}

// ─── Star shape ───────────────────────────────────────────────────────────────
function StarShape({ cx, cy, r, fill, stroke, strokeWidth=0, opacity=1 }:{
  cx:number; cy:number; r:number; fill:string; stroke?:string; strokeWidth?:number; opacity?:number;
}) {
  const pts: string[] = [];
  for (let i=0;i<10;i++) {
    const angle = (i*36 - 90) * Math.PI/180;
    const rad = i%2===0 ? r : r*0.42;
    pts.push(`${cx+Math.cos(angle)*rad},${cy+Math.sin(angle)*rad}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}/>;
}

// ─── Board SVG ────────────────────────────────────────────────────────────────
const CS = 40;
const SZ = 15 * CS; // 600

function cellColor(r:number, c:number): string {
  if (c===7 && r>=1 && r<=6)  return STRETCH_COL.green;
  if (c===7 && r>=8 && r<=13) return STRETCH_COL.blue;
  if (r===7 && c>=1 && c<=6)  return STRETCH_COL.red;
  if (r===7 && c>=8 && c<=13) return STRETCH_COL.yellow;
  if (r===13 && c===6) return Q.blue.main;
  if (r===1  && c===8) return Q.green.main;
  if (r===6  && c===1) return Q.red.main;
  if (r===8  && c===13) return Q.yellow.main;
  return "#FFFFFF";
}

const ALL_SLOT_DISPLAY: Record<"red"|"green"|"blue"|"yellow",[number,number][]> = {
  red:    [[80,80],[160,80],[80,160],[160,160]],
  green:  [[440,80],[520,80],[440,160],[520,160]],
  blue:   [[80,440],[160,440],[80,520],[160,520]],
  yellow: [[440,440],[520,440],[440,520],[520,520]],
};

const ARROWS: { r:number; c:number; sym:string }[] = [
  { r:7,  c:0,  sym:"→" },
  { r:7,  c:14, sym:"←" },
  { r:0,  c:7,  sym:"↓" },
  { r:14, c:7,  sym:"↑" },
];

function BoardSVG({ pieces }: { pieces: GamePiece[] }) {
  const inHome: Record<"blue"|"green", Set<number>> = {
    blue:  new Set(pieces.filter(p=>p.player==="blue"  && p.pos===-1).map(p=>+p.id[1])),
    green: new Set(pieces.filter(p=>p.player==="green" && p.pos===-1).map(p=>+p.id[1])),
  };
  const pathCells: [number,number][] = [];
  for (let r=0;r<15;r++) {
    for (let c=0;c<15;c++) {
      const inQ = (r<=5&&c<=5)||(r<=5&&c>=9)||(r>=9&&c<=5)||(r>=9&&c>=9);
      if (!inQ) pathCells.push([r,c]);
    }
  }
  const safeStarSet = new Set(STAR_DISPLAY.map(([r,c])=>`${r},${c}`));
  return (
    <svg viewBox={`0 0 ${SZ} ${SZ}`} width="100%" height="100%"
      style={{ display:"block", position:"absolute", inset:0 }}
      preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={SZ} height={SZ} fill="#0E1B4A" rx={4}/>
      <rect x={0}   y={0}   width={240} height={240} fill={Q.red.main}/>
      <rect x={360} y={0}   width={240} height={240} fill={Q.green.main}/>
      <rect x={0}   y={360} width={240} height={240} fill={Q.blue.main}/>
      <rect x={360} y={360} width={240} height={240} fill={Q.yellow.main}/>
      {pathCells.map(([r,c])=>{
        const x=c*CS, y=r*CS;
        const isCenter = r>=6&&r<=8&&c>=6&&c<=8;
        if (isCenter) return null;
        const fill = cellColor(r,c);
        return (
          <rect key={`${r},${c}`} x={x} y={y} width={CS} height={CS}
            fill={fill} stroke="#C5C5C5" strokeWidth="0.7"/>
        );
      })}
      {/* Center triangles */}
      <rect x={240} y={240} width={120} height={120} fill="#FFFFFF"/>
      <polygon points={`240,240 360,240 300,300`} fill={Q.green.main}/>
      <polygon points={`360,240 360,360 300,300`} fill={Q.yellow.main}/>
      <polygon points={`360,360 240,360 300,300`} fill={Q.blue.main}/>
      <polygon points={`240,360 240,240 300,300`} fill={Q.red.main}/>
      <line x1={240} y1={240} x2={300} y2={300} stroke="white" strokeWidth="1.5" opacity="0.8"/>
      <line x1={360} y1={240} x2={300} y2={300} stroke="white" strokeWidth="1.5" opacity="0.8"/>
      <line x1={360} y1={360} x2={300} y2={300} stroke="white" strokeWidth="1.5" opacity="0.8"/>
      <line x1={240} y1={360} x2={300} y2={300} stroke="white" strokeWidth="1.5" opacity="0.8"/>
      <rect x={240} y={240} width={120} height={120} fill="none" stroke="#BBBBBB" strokeWidth="0.7"/>
      {/* Safe stars — now match SAFE_COORDS exactly */}
      {safeStarSet && STAR_DISPLAY.map(([r,c])=>(
        <g key={`star_${r},${c}`}>
          <StarShape cx={(c+0.5)*CS} cy={(r+0.5)*CS} r={CS*0.30}
            fill="rgba(255,210,0,0.18)" stroke="#FFD700" strokeWidth={1.4} opacity={0.9}/>
          <StarShape cx={(c+0.5)*CS} cy={(r+0.5)*CS} r={CS*0.30}
            fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} opacity={0.7}/>
        </g>
      ))}
      {/* Directional arrows */}
      {ARROWS.map(({r,c,sym})=>(
        <text key={sym} x={(c+0.5)*CS} y={(r+0.5)*CS+6}
          textAnchor="middle" dominantBaseline="middle"
          fill="#666" fontSize={16} fontWeight="bold" opacity={0.7}
          fontFamily="Arial, sans-serif">{sym}</text>
      ))}
      {/* Home rectangles */}
      <rect x={36} y={36} width={168} height={168} rx={6} fill="white"/>
      <rect x={396} y={36} width={168} height={168} rx={6} fill="white"/>
      <rect x={36} y={396} width={168} height={168} rx={6} fill="white"/>
      <rect x={396} y={396} width={168} height={168} rx={6} fill="white"/>
      {/* Decorative home slots */}
      {ALL_SLOT_DISPLAY.red.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="red" showPin={false}/>
      ))}
      {ALL_SLOT_DISPLAY.yellow.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="yellow" showPin={false}/>
      ))}
      {ALL_SLOT_DISPLAY.blue.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="blue" showPin={inHome.blue.has(i)}/>
      ))}
      {ALL_SLOT_DISPLAY.green.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="green" showPin={inHome.green.has(i)}/>
      ))}
      <rect x={0} y={0} width={SZ} height={SZ} fill="none" stroke="#0A1440" strokeWidth={3} rx={4}/>
    </svg>
  );
}

function DecoSVGPawn({ cx, cy, color, showPin }: {
  cx:number; cy:number; color:"red"|"yellow"|"blue"|"green"; showPin:boolean;
}) {
  const p = PAWN_PALETTE[color];
  const slotR = 26;
  const id = `hs_${color}_${Math.round(cx)}_${Math.round(cy)}`;
  const slotCircle = (
    <>
      <circle cx={cx} cy={cy} r={slotR} fill={p.m}/>
      <circle cx={cx} cy={cy} r={slotR} fill="none" stroke={p.d} strokeWidth={1.8}/>
      <ellipse cx={cx-slotR*0.28} cy={cy-slotR*0.3} rx={slotR*0.38} ry={slotR*0.28} fill="white" opacity={0.25}/>
    </>
  );
  if (!showPin) return <g>{slotCircle}</g>;
  const sc = 0.58;
  const tx = cx - 28*sc;
  const ty = cy - 54*sc;
  return (
    <g>
      {slotCircle}
      <defs>
        <radialGradient id={`${id}_g`} cx="32%" cy="26%" r="70%">
          <stop offset="0%"  stopColor={p.s}/><stop offset="45%" stopColor={p.m}/><stop offset="100%" stopColor={p.d}/>
        </radialGradient>
        <radialGradient id={`${id}_in`} cx="40%" cy="35%" r="62%">
          <stop offset="0%"  stopColor="white"/><stop offset="100%" stopColor={p.s}/>
        </radialGradient>
      </defs>
      <g transform={`translate(${tx},${ty}) scale(${sc})`}>
        <path d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill={`url(#${id}_g)`}/>
        <path d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill="none" stroke={p.d} strokeWidth="1.5" opacity="0.45"/>
        <circle cx="28" cy="27" r="13.5" fill={`url(#${id}_in)`} opacity="0.96"/>
        <circle cx="28" cy="27" r="9"    fill={p.m} opacity="0.25"/>
        <ellipse cx="19" cy="17" rx="7.5" ry="5.5" fill="white" opacity="0.7"/>
      </g>
    </g>
  );
}

// ─── Selection Ring — tight ring at the BASE of the pin (below pawn body) ─────
// Sits below the pawn head so it looks like a ground halo/indicator
function SelectionRing({ color }: { color: PawnColor }) {
  const p = PAWN_PALETTE[color];
  const N = 10;
  const cx = PIECE_BOX / 2;
  // Place ring at ~80% down the box — right around the pin tip
  const cy = PIECE_BOX * 0.80;
  const dotR = 2.4;
  const R = 9;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}
    >
      {Array.from({length:N},(_,i)=>{
        const angle = (i*360/N)*Math.PI/180;
        return (
          <div key={i} style={{
            position:"absolute",
            width: dotR*2, height: dotR*2,
            borderRadius:"50%",
            background: i%2===0 ? "white" : p.m,
            left: cx + R*Math.cos(angle) - dotR,
            top:  cy + R*Math.sin(angle) - dotR,
            boxShadow: i%2===0 ? `0 0 5px ${p.m}` : `0 0 3px white`,
            opacity: i%2===0 ? 1 : 0.7,
          }}/>
        );
      })}
    </motion.div>
  );
}

// ─── Board Component ───────────────────────────────────────────────────────────
function Board({ pieces, movable, onSelectPiece }: {
  pieces: GamePiece[]; movable: PieceId[]; onSelectPiece: (id:PieceId)=>void;
}) {
  const cellMap = new Map<string, GamePiece[]>();
  pieces.forEach(p => {
    if (p.pos === -1) return;
    const [r,c] = getPieceCoord(p);
    const k = `${r},${c}`;
    cellMap.set(k, [...(cellMap.get(k)||[]), p]);
  });

  return (
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1",
      borderRadius:6, overflow:"hidden",
      boxShadow:"0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
    }}>
      <BoardSVG pieces={pieces}/>

      {pieces.map(p => {
        const selectable = movable.includes(p.id);
        const color: PawnColor = p.player === "blue" ? "blue" : "green";
        const isHome = p.pos === -1;
        const isDone = p.pos === 57;

        if (isDone) return null; // finished pieces hidden (they are in the center triangle)

        if (isHome) {
          const slotIdx = +p.id[1];
          const [svgX, svgY] = ALL_SLOT_DISPLAY[p.player][slotIdx];
          return (
            <div key={p.id}
              onClick={selectable ? () => onSelectPiece(p.id) : undefined}
              style={{
                position:"absolute",
                width: PIECE_BOX, height: PIECE_BOX,
                left:`${svgX / SZ * 100}%`,
                top:`${svgY / SZ * 100}%`,
                transform:"translate(-50%, -50%)",
                zIndex: selectable ? 25 : 5,
                cursor: selectable ? "pointer" : "default",
              }}>
              {selectable && <SelectionRing color={color}/>}
            </div>
          );
        }

        const [r,c] = getPieceCoord(p);
        const here = cellMap.get(`${r},${c}`) || [];
        const idx = here.findIndex(x => x.id === p.id);
        const OFFSETS: [number,number][] = [[0,0],[-5,-4],[5,-4],[-5,4],[5,4]];
        const [offX, offY] = here.length > 1 ? (OFFSETS[idx] ?? [0,0]) : [0,0];

        // Y_SHIFT: +5 centers the pin's circular head (not tip) at the cell center
        // The pin head is at ~37% from top of PAWN_H, centering it needs downward shift
        const Y_SHIFT = 5;

        return (
          <div key={p.id}
            onClick={selectable ? () => onSelectPiece(p.id) : undefined}
            style={{
              position:"absolute",
              width: PIECE_BOX, height: PIECE_BOX,
              left:`${(c + 0.5) / 15 * 100}%`,
              top:`${(r + 0.5) / 15 * 100}%`,
              transform:`translate(calc(-50% + ${offX}px), calc(-50% + ${offY + Y_SHIFT}px))`,
              zIndex: selectable ? 25 : 10,
              cursor: selectable ? "pointer" : "default",
            }}>
            {/* Ring BEHIND pawn — zIndex:0 vs pawn zIndex:2 */}
            {selectable && <SelectionRing color={color}/>}
            {/* Pawn absolutely centered from top so ring is visually below head */}
            <div style={{
              position:"absolute",
              top: Math.round((PIECE_BOX - PAWN_H) / 2),
              left:"50%", transform:"translateX(-50%)",
              zIndex:2,
            }}>
              <Pawn color={color} size={PAWN_SIZE} glow={selectable}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 3D Dice ──────────────────────────────────────────────────────────────────
const DOT_POS: Record<number,[number,number][]> = {
  1: [[50,50]],
  2: [[27,27],[73,73]],
  3: [[27,27],[50,50],[73,73]],
  4: [[27,27],[73,27],[27,73],[73,73]],
  5: [[27,27],[73,27],[50,50],[27,73],[73,73]],
  6: [[27,22],[73,22],[27,50],[73,50],[27,78],[73,78]],
};
function DiceFace({ value, sz, faceId }: { value:number; sz:number; faceId:string }) {
  const dots = DOT_POS[value] || [];
  return (
    <svg viewBox="0 0 100 100" width={sz} height={sz} style={{display:"block"}}>
      <defs>
        <radialGradient id={`dot_${faceId}_${value}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#444"/><stop offset="100%" stopColor="#0a0a0a"/>
        </radialGradient>
      </defs>
      {dots.map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={10} fill={`url(#dot_${faceId}_${value})`}/>
      ))}
    </svg>
  );
}
function Dice3D({ value, rolling, onClick, active, sz=48 }: {
  value:number|null; rolling:boolean; onClick:()=>void; active:boolean; sz?:number;
}) {
  const h = sz/2;
  const [rollKey, setRollKey] = useState(0);
  const [disp, setDisp] = useState(1);
  const faceRot: Record<number,{rx:number;ry:number}> = {
    1:{rx:0,ry:0},2:{rx:-90,ry:0},3:{rx:0,ry:-90},4:{rx:0,ry:90},5:{rx:90,ry:0},6:{rx:0,ry:180},
  };
  useEffect(()=>{
    if (!rolling) { if (value!==null) setDisp(value); return; }
    setRollKey(k=>k+1);
    let n=0;
    const iv=setInterval(()=>{ setDisp(Math.floor(Math.random()*6)+1); n++; if(n>14) clearInterval(iv); },45);
    return()=>clearInterval(iv);
  },[rolling,value]);
  const tr = faceRot[disp]||{rx:0,ry:0};
  const faces: [number,string,string][] = [
    [1,`translateZ(${h}px)`,"#FAFAF8"],
    [6,`rotateY(180deg) translateZ(${h}px)`,"#F0EEE8"],
    [2,`rotateX(90deg) translateZ(${h}px)`,"#F5F4F0"],
    [5,`rotateX(-90deg) translateZ(${h}px)`,"#E8E6E0"],
    [3,`rotateY(90deg) translateZ(${h}px)`,"#F2F0EB"],
    [4,`rotateY(-90deg) translateZ(${h}px)`,"#ECEAE4"],
  ];
  const rad = sz * 0.17;
  return (
    <div onClick={active&&!rolling ? onClick : undefined}
      style={{
        perspective:"400px", width:sz, height:sz,
        cursor: active&&!rolling ? "pointer" : "default",
        filter: active
          ? "drop-shadow(0 6px 16px rgba(0,0,0,0.7)) drop-shadow(0 2px 5px rgba(0,0,0,0.45))"
          : "drop-shadow(0 3px 8px rgba(0,0,0,0.5))",
      }}>
      <motion.div key={rollKey}
        animate={rolling
          ? {rotateX:[0,-180,-360,tr.rx+360], rotateY:[0,180,360,tr.ry+360]}
          : {rotateX:tr.rx, rotateY:tr.ry}}
        transition={rolling ? {duration:0.75,ease:"easeOut"} : {duration:0.14}}
        style={{ width:sz, height:sz, transformStyle:"preserve-3d", position:"relative" }}>
        {faces.map(([v,t,bg])=>(
          <div key={v} style={{
            position:"absolute", inset:0,
            background:`radial-gradient(ellipse at 30% 25%, #FFFFFF, ${bg} 60%, #D8D5CC)`,
            borderRadius:rad,
            border:"1px solid rgba(140,135,120,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center",
            backfaceVisibility:"hidden", transform:t,
            boxShadow:"inset 2px 2px 5px rgba(255,255,255,0.95), inset -2px -2px 5px rgba(0,0,0,0.18)",
          }}>
            <DiceFace value={v} sz={sz*0.76} faceId={`f${v}`}/>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Circular Timer Arc ───────────────────────────────────────────────────────
function TimerArc({ timeLeft, total=30, size=34 }: { timeLeft:number; total?:number; size?:number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const fill = timeLeft / total;
  const dashoffset = circ * (1 - fill);
  const col = timeLeft > 12 ? "#4ade80" : timeLeft > 6 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", display:"block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={dashoffset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.85s linear, stroke 0.3s" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:10, fontWeight:800, color:col, lineHeight:1, fontFamily:"'Syne',sans-serif" }}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}

// ─── Premium Trophy SVG ────────────────────────────────────────────────────────
function TrophySVG({ size=72, color="#FFD700" }: { size?:number; color?:string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="tg" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#FFE566"/>
          <stop offset="50%" stopColor={color}/>
          <stop offset="100%" stopColor="#B8860B"/>
        </linearGradient>
        <filter id="tglow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Cup */}
      <path d="M28 14 L72 14 L68 52 Q65 66 50 70 Q35 66 32 52 Z" fill="url(#tg)" filter="url(#tglow)"/>
      {/* Handles */}
      <path d="M28 18 Q14 18 14 34 Q14 46 28 46" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M72 18 Q86 18 86 34 Q86 46 72 46" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Stem */}
      <rect x="44" y="70" width="12" height="14" fill="url(#tg)" rx="2"/>
      {/* Base */}
      <rect x="30" y="83" width="40" height="7" fill="url(#tg)" rx="3.5"/>
      {/* Shine */}
      <ellipse cx="40" cy="32" rx="7" ry="12" fill="rgba(255,255,255,0.22)" transform="rotate(-15 40 32)"/>
    </svg>
  );
}

// ─── Player Avatar ────────────────────────────────────────────────────────────
function PlayerAvatar({ color, name, size=48, isActive }: {
  color: PawnColor; name: string; size?: number; isActive: boolean;
}) {
  const p = PAWN_PALETTE[color];
  const initials = name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  return (
    <div style={{
      width:size, height:size, borderRadius:size*0.28, flexShrink:0,
      background:`linear-gradient(145deg,${p.s}30,${p.d}80)`,
      border:`2px solid ${isActive ? p.m+"88" : "rgba(255,255,255,0.1)"}`,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      position:"relative", overflow:"hidden",
      boxShadow: isActive ? `0 0 18px ${p.d}55, 0 2px 8px rgba(0,0,0,0.5)` : "0 2px 6px rgba(0,0,0,0.4)",
      transition:"border 0.3s, box-shadow 0.3s",
    }}>
      {/* Pawn icon small */}
      <div style={{ opacity:0.85 }}>
        <Pawn color={color} size={size*0.52}/>
      </div>
      {/* Initials overlay if no pawn fits */}
      {size < 36 && (
        <span style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:size*0.36, fontWeight:800, color:"white", letterSpacing:-0.5,
          fontFamily:"'Syne',sans-serif", textShadow:"0 1px 3px rgba(0,0,0,0.6)",
        }}>{initials}</span>
      )}
    </div>
  );
}

// ─── Player Panel ─────────────────────────────────────────────────────────────
function PlayerPanel({ player, name, balance, isActive, diceValue, rolling, onRoll,
  finished, lives, timeLeft, isHuman }: {
  player: Player; name:string; balance:string; isActive:boolean; diceValue:number|null;
  rolling:boolean; onRoll:()=>void; finished:number; lives:number; timeLeft:number; isHuman:boolean;
}) {
  const color: PawnColor = player === "blue" ? "blue" : "green";
  const pal = PAWN_PALETTE[color];

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
      background: isActive
        ? `linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)`
        : "rgba(255,255,255,0.03)",
      borderRadius:18,
      border: isActive ? `1.5px solid ${pal.m}55` : "1.5px solid rgba(255,255,255,0.07)",
      boxShadow: isActive ? `0 0 28px ${pal.m}1A, inset 0 1px 0 rgba(255,255,255,0.06)` : "none",
      transition:"all 0.35s",
    }}>

      {/* Avatar */}
      <PlayerAvatar color={color} name={name} size={50} isActive={isActive}/>

      {/* Info block */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Row 1: name + badge */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <p style={{
            fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13,
            color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
            lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            maxWidth:90,
            transition:"color 0.35s",
          }}>{name}</p>
          {isHuman && (
            <span style={{
              fontSize:8.5, fontWeight:700, color: pal.m,
              background:`${pal.m}1A`, border:`1px solid ${pal.m}44`,
              borderRadius:4, padding:"1px 5px", letterSpacing:0.5,
              textTransform:"uppercase",
            }}>Tu</span>
          )}
          {!isHuman && (
            <span style={{
              fontSize:8.5, fontWeight:700, color:"rgba(255,255,255,0.4)",
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:4, padding:"1px 5px", letterSpacing:0.5,
              textTransform:"uppercase",
            }}>IA</span>
          )}
        </div>

        {/* Row 2: balance */}
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6 }}>
          <div style={{
            background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.2)",
            borderRadius:6, padding:"2px 7px", display:"flex", alignItems:"center", gap:4,
          }}>
            <div style={{
              width:6, height:6, borderRadius:"50%",
              background:"radial-gradient(circle at 35% 35%, #FFE566, #FFD700)",
              boxShadow:"0 0 4px rgba(255,215,0,0.7)",
            }}/>
            <span style={{ fontSize:10.5, fontWeight:700, color:"rgba(255,215,0,0.85)", letterSpacing:0.3 }}>
              {balance}
            </span>
          </div>
        </div>

        {/* Row 3: lives + pieces finished */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Lives */}
          <div style={{ display:"flex", gap:3, alignItems:"center" }}>
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{
                width:7, height:7, borderRadius:"50%",
                background: i < lives ? "#ef4444" : "rgba(255,255,255,0.08)",
                boxShadow: i < lives ? "0 0 5px #ef444488" : "none",
                transition:"all 0.3s",
              }}/>
            ))}
          </div>
          {/* Divider */}
          <div style={{ width:1, height:10, background:"rgba(255,255,255,0.1)" }}/>
          {/* Pieces home */}
          <div style={{ display:"flex", gap:3, alignItems:"center" }}>
            {Array.from({length:4}).map((_,i)=>(
              <motion.div key={i}
                animate={{ scale: i < finished ? [1,1.3,1] : 1 }}
                transition={{ duration:0.3 }}
                style={{
                  width:7, height:7, borderRadius:"50%",
                  background: i < finished ? pal.m : "rgba(255,255,255,0.08)",
                  boxShadow: i < finished ? `0 0 6px ${pal.m}` : "none",
                  transition:"background 0.3s, box-shadow 0.3s",
                }}/>
            ))}
          </div>
          {/* Separator */}
          {isActive && isHuman && (
            <>
              <div style={{ width:1, height:10, background:"rgba(255,255,255,0.1)" }}/>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <Clock style={{ width:9, height:9, color:"rgba(255,255,255,0.3)" }}/>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:600 }}>
                  {timeLeft}s
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dice + Timer */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0 }}>
        {/* Timer arc — only for human active player */}
        {isHuman && isActive && <TimerArc timeLeft={timeLeft} size={32}/>}
        {!(isHuman && isActive) && <div style={{ height:32 }}/>}

        <div style={{
          background:"rgba(0,0,0,0.35)", borderRadius:12, padding:5,
          border: isActive ? `1.5px solid ${pal.m}40` : "1.5px solid rgba(255,255,255,0.07)",
          boxShadow: isActive ? `0 0 16px ${pal.m}30` : "none",
        }}>
          <Dice3D value={diceValue} rolling={rolling} onClick={onRoll} active={isActive} sz={44}/>
        </div>
      </div>
    </div>
  );
}

// ─── Win Screen ────────────────────────────────────────────────────────────────
function WinScreen({ winner, winnerName, loserName, onReplay, onQuit }: {
  winner: Player; winnerName: string; loserName: string;
  onReplay: ()=>void; onQuit: ()=>void;
}) {
  const color: PawnColor = winner === "blue" ? "blue" : "green";
  const pal = PAWN_PALETTE[color];
  const winnerColor = winner === "blue" ? "#1D4ED8" : "#16A34A";
  const winnerLight = winner === "blue" ? "#3B82F6" : "#22C55E";

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{
        position:"fixed", inset:0,
        background:"rgba(2,6,18,0.90)",
        backdropFilter:"blur(12px)",
        display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
      }}>
      {/* Animated radial glow */}
      <motion.div
        animate={{ scale:[1,1.15,1], opacity:[0.18,0.28,0.18] }}
        transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
        style={{
          position:"absolute",
          width:400, height:400,
          borderRadius:"50%",
          background:`radial-gradient(circle, ${winnerLight}40 0%, transparent 70%)`,
          pointerEvents:"none",
        }}/>

      <motion.div
        initial={{scale:0.5,opacity:0,y:50}}
        animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:200,damping:18,delay:0.1}}
        style={{
          background:`linear-gradient(150deg, ${winnerColor}EE 0%, ${winnerColor}BB 100%)`,
          borderRadius:28, padding:"36px 32px 28px", textAlign:"center",
          border:`2px solid ${winnerLight}66`,
          boxShadow:`0 24px 80px ${winnerColor}55, 0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)`,
          maxWidth:310, width:"88%", position:"relative", overflow:"hidden",
        }}>

        {/* Subtle inner glow top */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:80,
          background:`linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)`,
          pointerEvents:"none",
        }}/>

        {/* Trophy */}
        <motion.div
          animate={{ y:[0,-6,0] }}
          transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}
          style={{ marginBottom:16, display:"flex", justifyContent:"center" }}>
          <TrophySVG size={80} color="#FFD700"/>
        </motion.div>

        {/* Winner label */}
        <p style={{
          fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:11,
          color:winnerLight, letterSpacing:3, textTransform:"uppercase",
          marginBottom:6, opacity:0.85,
        }}>Vencedor</p>

        {/* Winner name */}
        <p style={{
          fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:26,
          color:"#fff", marginBottom:4, letterSpacing:0.5, lineHeight:1.1,
        }}>{winnerName}</p>

        {/* Subtitle */}
        <p style={{
          fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:6,
          fontWeight:500,
        }}>
          Venceu a partida contra <span style={{ color:"rgba(255,255,255,0.75)", fontWeight:700 }}>{loserName}</span>
        </p>

        {/* Divider */}
        <div style={{
          height:1, background:`linear-gradient(90deg, transparent, ${winnerLight}44, transparent)`,
          margin:"18px 0",
        }}/>

        {/* Stats row */}
        <div style={{
          display:"flex", justifyContent:"center", gap:24, marginBottom:24,
        }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ display:"flex", gap:3, justifyContent:"center", marginBottom:4 }}>
              {Array.from({length:4}).map((_,i)=>(
                <div key={i} style={{
                  width:8, height:8, borderRadius:"50%",
                  background: pal.m, boxShadow:`0 0 5px ${pal.m}`,
                }}/>
              ))}
            </div>
            <p style={{ fontSize:9.5, color:"rgba(255,255,255,0.45)", fontWeight:600, letterSpacing:0.5 }}>
              4 PEÇAS
            </p>
          </div>
          <div style={{ width:1, background:"rgba(255,255,255,0.1)" }}/>
          <div style={{ textAlign:"center" }}>
            <p style={{
              fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18,
              color:"#FFD700", lineHeight:1, marginBottom:2,
            }}>1°</p>
            <p style={{ fontSize:9.5, color:"rgba(255,255,255,0.45)", fontWeight:600, letterSpacing:0.5 }}>
              LUGAR
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onReplay} style={{
            flex:1,
            background:`linear-gradient(135deg, ${winnerLight}33, ${winnerLight}15)`,
            border:`1.5px solid ${winnerLight}55`,
            color:"#fff", borderRadius:14, padding:"13px 0",
            fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            transition:"all 0.2s",
          }}>
            <RotateCcw style={{ width:14, height:14 }}/>
            Jogar Novamente
          </button>
          <button onClick={onQuit} style={{
            flex:1,
            background:"rgba(255,255,255,0.07)",
            border:"1.5px solid rgba(255,255,255,0.14)",
            color:"rgba(255,255,255,0.65)", borderRadius:14, padding:"13px 0",
            fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            transition:"all 0.2s",
          }}>
            <LogOut style={{ width:14, height:14 }}/>
            Sair
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Scripted dice (tutorial/first few rolls) ─────────────────────────────────
const SCRIPTED = [6,5,2,2,6,5];

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function LudoGame() {
  const [,setLocation] = useLocation();
  const { profile } = useAuth();

  const playerName  = profile?.full_name ?? "Jogador Azul";
  const playerBal   = profile?.balance
    ? `${Number(profile.balance).toLocaleString("pt-MZ")} MT`
    : "0 MT";
  const opponentName = "Rival Verde";
  const opponentBal  = "843 MT";

  const initialPieces = (): GamePiece[] => [
    {id:"B0",player:"blue",pos:-1},{id:"B1",player:"blue",pos:-1},
    {id:"B2",player:"blue",pos:-1},{id:"B3",player:"blue",pos:-1},
    {id:"G0",player:"green",pos:-1},{id:"G1",player:"green",pos:-1},
    {id:"G2",player:"green",pos:-1},{id:"G3",player:"green",pos:-1},
  ];

  const [pieces,setPieces]             = useState<GamePiece[]>(initialPieces);
  const [turn,setTurn]                 = useState<Player>("blue");
  const [phase,setPhase]               = useState<Phase>("roll");
  const [diceBlue,setDiceBlue]         = useState<number|null>(null);
  const [diceGreen,setDiceGreen]       = useState<number|null>(null);
  const [rollingBlue,setRollingBlue]   = useState(false);
  const [rollingGreen,setRollingGreen] = useState(false);
  const [movable,setMovable]           = useState<PieceId[]>([]);
  const [winner,setWinner]             = useState<Player|null>(null);
  const [msg,setMsg]                   = useState(`${playerName} — clica nos dados para começar!`);
  const [lives,setLives]               = useState({ blue:5, green:5 });
  const [timeLeft,setTimeLeft]         = useState(30);

  const scriptIdx  = useRef(0);
  const piecesRef  = useRef(pieces);
  const phaseRef   = useRef(phase);
  const movableRef = useRef(movable);
  const diceBlueRef= useRef(diceBlue);

  useEffect(()=>{ piecesRef.current  = pieces;   },[pieces]);
  useEffect(()=>{ phaseRef.current   = phase;    },[phase]);
  useEffect(()=>{ movableRef.current = movable;  },[movable]);
  useEffect(()=>{ diceBlueRef.current= diceBlue; },[diceBlue]);

  const other = (p:Player):Player => p==="blue"?"green":"blue";

  function rollDice():number {
    const idx=scriptIdx.current; scriptIdx.current++;
    if(idx<SCRIPTED.length) return SCRIPTED[idx];
    return Math.floor(Math.random()*6)+1;
  }

  function calcMovable(ps:GamePiece[],pl:Player,d:number):PieceId[] {
    return ps.filter(p=>p.player===pl).filter(p=>{
      if(p.pos===57) return false;       // already finished
      if(p.pos===-1) return d===6;       // home — need 6
      return p.pos+d<=57;               // can move without overshooting
    }).map(p=>p.id) as PieceId[];
  }

  function finishedCount(ps:GamePiece[],pl:Player):number {
    return ps.filter(p=>p.player===pl&&p.pos===57).length;
  }

  function movePieceSteps(pieceId:PieceId,curPos:number,steps:number,isExit:boolean,onDone:()=>void) {
    if(isExit){
      setPieces(prev=>prev.map(p=>p.id===pieceId?{...p,pos:0}:p));
      setTimeout(()=>onDone(),300);
      return;
    }
    for(let i=1;i<=steps;i++){
      const step=i;
      setTimeout(()=>{
        setPieces(prev=>prev.map(p=>p.id!==pieceId?p:{...p,pos:curPos+step}));
        if(step===steps) setTimeout(onDone,150);
      },step*200);
    }
  }

  function returnPieceToHome(capturedId:PieceId, fromPos:number) {
    function step(pos:number){
      setPieces(prev=>prev.map(p=>p.id===capturedId?{...p,pos:Math.max(-1,pos)}:p));
      if(pos>-1) setTimeout(()=>step(pos-1), 75);
    }
    step(fromPos);
  }

  function handleMoveComplete(pieceId:PieceId,diceVal:number,currentTurn:Player) {
    setPhase("moving");
    const ps=piecesRef.current;
    const mover=ps.find(p=>p.id===pieceId)!;
    const moverCoord=getPieceCoord(mover);
    const ck=`${moverCoord[0]},${moverCoord[1]}`;

    // Capture — only on regular track (pos 0-50), not on safe squares
    if(!SAFE_COORDS.has(ck) && mover.pos>=0 && mover.pos<=50){
      const opp=other(currentTurn);
      const captured=ps.filter(p=>p.player===opp&&p.pos>=0&&p.pos<=50).filter(p=>{
        const [pr,pc]=getPieceCoord(p);
        return pr===moverCoord[0]&&pc===moverCoord[1];
      });
      if(captured.length>0){
        setMsg(`${currentTurn==="blue"?playerName:opponentName} capturou uma peça!`);
        captured.forEach(c=>returnPieceToHome(c.id as PieceId, c.pos));
      }
    }

    const updatedPs=piecesRef.current;
    if(finishedCount(updatedPs,currentTurn)===4){
      setWinner(currentTurn); setPhase("done");
      setMsg(`${currentTurn==="blue"?playerName:opponentName} venceu!`);
      return;
    }
    if(diceVal===6){
      setMsg(`${currentTurn==="blue"?playerName:opponentName} tirou 6 — joga novamente!`);
      setMovable([]);
      setTimeout(()=>{ setPhase("roll"); if(currentTurn==="blue") setDiceBlue(null); else setDiceGreen(null); },400);
    } else {
      const next=other(currentTurn);
      setMovable([]);
      setTimeout(()=>{
        setTurn(next); setPhase("roll");
        if(next==="blue"){ setDiceBlue(null); setMsg(`${playerName} — clica nos dados!`); }
        else { setDiceGreen(null); setMsg(`${opponentName} — a pensar…`); }
      },500);
    }
  }

  const doSelectPiece = useCallback((pid:PieceId,diceVal:number,pl:Player,ps:GamePiece[])=>{
    setMovable([]); setPhase("moving");
    const piece=ps.find(p=>p.id===pid)!;
    const isExit=piece.pos===-1;
    if(isExit){
      setMsg(`${pl==="blue"?playerName:opponentName} coloca uma peça no tabuleiro!`);
      movePieceSteps(pid,-1,1,true,()=>handleMoveComplete(pid,diceVal,pl));
    } else {
      setMsg(`${pl==="blue"?playerName:opponentName} move ${diceVal} casa${diceVal>1?"s":""}!`);
      movePieceSteps(pid,piece.pos,diceVal,false,()=>handleMoveComplete(pid,diceVal,pl));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playerName, opponentName]);

  const doRoll = useCallback((pl:Player)=>{
    if(phaseRef.current!=="roll"||turn!==pl) return;
    const setRolling=pl==="blue"?setRollingBlue:setRollingGreen;
    const setDice=pl==="blue"?setDiceBlue:setDiceGreen;
    setRolling(true);
    setTimeout(()=>{
      const val=rollDice();
      setDice(val); setRolling(false);
      const mv=calcMovable(piecesRef.current,pl,val);
      if(mv.length===0){
        setMsg(val===6
          ?`${pl==="blue"?playerName:opponentName} tirou 6 mas não pode mover!`
          :`${pl==="blue"?playerName:opponentName} tirou ${val} — sem jogadas. Vez de ${other(pl)==="blue"?playerName:opponentName}.`);
        setTimeout(()=>{
          const next=other(pl); setTurn(next); setPhase("roll");
          if(next==="blue"){ setDiceBlue(null); setMsg(`${playerName} — clica nos dados!`); }
          else { setDiceGreen(null); setMsg(`${opponentName} — a pensar…`); }
        },1400);
      } else if(mv.length===1){
        setMsg(`${pl==="blue"?playerName:opponentName} tirou ${val}!`);
        doSelectPiece(mv[0],val,pl,piecesRef.current);
      } else {
        setMovable(mv); setPhase("select");
        setMsg(`${pl==="blue"?playerName:opponentName} tirou ${val} — escolhe uma peça!`);
      }
    },800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn, playerName, opponentName]);

  function handleSelectPiece(pid:PieceId){
    if(phase!=="select") return;
    const diceVal=turn==="blue"?diceBlue:diceGreen;
    if(diceVal===null) return;
    doSelectPiece(pid,diceVal,turn,piecesRef.current);
  }

  // ── Timer — runs during roll AND select phases for blue (human) player ──────
  const autoPlayRef = useRef<(()=>void)|null>(null);
  autoPlayRef.current = () => {
    setLives(l=>{
      const nb=l.blue-1;
      if(nb<=0){
        setWinner("green"); setPhase("done");
        setMsg(`${opponentName} venceu! ${playerName} perdeu todas as vidas.`);
        return {...l,blue:0};
      }
      setMsg(`Tempo esgotado! ${playerName} perdeu 1 vida (${nb} restante${nb===1?"":"s"}).`);
      const curPhase=phaseRef.current;
      const curMovable=movableRef.current;
      const curDice=diceBlueRef.current;
      if(curPhase==="roll"){
        // auto-roll on their behalf
        setTimeout(()=>doRoll("blue"), 200);
      } else if(curPhase==="select" && curMovable.length>0 && curDice!==null){
        const pick=curMovable[Math.floor(Math.random()*curMovable.length)];
        setTimeout(()=>doSelectPiece(pick,curDice,"blue",piecesRef.current), 200);
      }
      return {...l,blue:nb};
    });
  };

  useEffect(()=>{
    setTimeLeft(30);
    if(winner||(phase!=="roll"&&phase!=="select")||turn!=="blue") return;
    const tick=setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){
          clearInterval(tick);
          setTimeout(()=>autoPlayRef.current?.(), 0);
          return 30;
        }
        return prev-1;
      });
    },1000);
    return()=>clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,phase,winner]);

  // ── AI: auto-play Green ───────────────────────────────────────────────────
  useEffect(()=>{
    if(turn!=="green"||winner) return undefined;
    if(phase==="roll"){
      const t=setTimeout(()=>doRoll("green"),1300);
      return()=>clearTimeout(t);
    }
    if(phase==="select"&&movable.length>0){
      const t=setTimeout(()=>{
        const pick=movable[Math.floor(Math.random()*movable.length)];
        const diceVal=diceGreen;
        if(diceVal===null) return;
        doSelectPiece(pick,diceVal,"green",piecesRef.current);
      },900);
      return()=>clearTimeout(t);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,phase,movable,winner]);

  function resetGame() {
    setPieces(initialPieces());
    setTurn("blue"); setPhase("roll");
    setDiceBlue(null); setDiceGreen(null);
    setRollingBlue(false); setRollingGreen(false);
    setMovable([]); setWinner(null);
    setLives({blue:5,green:5}); setTimeLeft(30);
    scriptIdx.current=0;
    setMsg(`${playerName} — clica nos dados para começar!`);
  }

  const blueFinished  = finishedCount(pieces,"blue");
  const greenFinished = finishedCount(pieces,"green");

  return (
    <div style={{
      minHeight:"100vh", width:"100%", display:"flex", justifyContent:"center",
      background:"linear-gradient(160deg,#040812 0%,#0a1530 40%,#061020 100%)",
    }}>
      <div style={{
        width:"100%", maxWidth:430, display:"flex", flexDirection:"column",
        minHeight:"100vh", paddingBottom:12,
      }}>

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 16px 10px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(0,0,0,0.3)",
        }}>
          <button onClick={()=>setLocation("/")} style={{
            width:38, height:38, borderRadius:10,
            background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}>
            <ArrowLeft style={{width:18,height:18,color:"#fff"}}/>
          </button>
          <div style={{textAlign:"center"}}>
            <p style={{
              fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18,
              color:"#fff", lineHeight:1, letterSpacing:3,
              textShadow:"0 0 24px rgba(99,179,255,0.55)",
            }}>LUDO</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2,letterSpacing:2}}>1 VS 1</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{
              display:"flex", alignItems:"center", gap:4, padding:"5px 9px",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:8,
            }}>
              <Shield style={{ width:11, height:11, color:"rgba(255,255,255,0.3)" }}/>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:600 }}>SEGURO</span>
            </div>
          </div>
        </div>

        {/* Green panel (top — opponent/AI) */}
        <div style={{padding:"10px 12px 6px"}}>
          <PlayerPanel
            player="green" name={opponentName} balance={opponentBal}
            isActive={turn==="green"&&!winner}
            diceValue={diceGreen} rolling={rollingGreen}
            onRoll={()=>doRoll("green")}
            finished={greenFinished} lives={lives.green}
            timeLeft={30} isHuman={false}
          />
        </div>

        {/* Status message */}
        <div style={{padding:"3px 12px 6px"}}>
          <AnimatePresence mode="wait">
            <motion.div key={msg}
              initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              style={{
                background:"rgba(255,255,255,0.04)", borderRadius:10,
                padding:"6px 14px", textAlign:"center",
                border:"1px solid rgba(255,255,255,0.06)",
              }}>
              <p style={{fontSize:11.5,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:0.2}}>
                {msg}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Board */}
        <div style={{padding:"0 10px", flex:1}}>
          <Board pieces={pieces} movable={movable} onSelectPiece={handleSelectPiece}/>
        </div>

        {/* Blue panel (bottom — human player) */}
        <div style={{padding:"8px 12px 4px"}}>
          <PlayerPanel
            player="blue" name={playerName} balance={playerBal}
            isActive={turn==="blue"&&!winner}
            diceValue={diceBlue} rolling={rollingBlue}
            onRoll={()=>doRoll("blue")}
            finished={blueFinished} lives={lives.blue}
            timeLeft={timeLeft} isHuman={true}
          />
        </div>

        {/* Turn indicator bar */}
        <div style={{ padding:"4px 12px 0" }}>
          <div style={{
            height:3, borderRadius:2,
            background:"rgba(255,255,255,0.06)",
            overflow:"hidden",
          }}>
            <motion.div
              animate={{ x: turn==="blue" ? "0%" : "50%" }}
              transition={{ type:"spring", stiffness:180, damping:20 }}
              style={{
                width:"50%", height:"100%",
                background: turn==="blue"
                  ? "linear-gradient(90deg,#3B82F6,#1D4ED8)"
                  : "linear-gradient(90deg,#22C55E,#15803D)",
                borderRadius:2,
              }}/>
          </div>
        </div>

        {/* Active turn hint */}
        <div style={{ padding:"4px 12px 0", textAlign:"center" }}>
          <motion.div
            animate={{ opacity: [0.5,1,0.5] }}
            transition={{ duration:2, repeat:Infinity }}
          >
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              <Zap style={{ width:10, height:10, color: turn==="blue"?"#3B82F6":"#22C55E" }}/>
              <span style={{
                fontSize:10, fontWeight:700, letterSpacing:1,
                color: turn==="blue" ? "#3B82F6" : "#22C55E",
                textTransform:"uppercase",
              }}>
                Vez de {turn==="blue" ? playerName : opponentName}
              </span>
            </div>
          </motion.div>
        </div>

      </div>

      {/* Win overlay */}
      <AnimatePresence>
        {winner && (
          <WinScreen
            winner={winner}
            winnerName={winner==="blue" ? playerName : opponentName}
            loserName={winner==="blue" ? opponentName : playerName}
            onReplay={resetGame}
            onQuit={()=>setLocation("/")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
