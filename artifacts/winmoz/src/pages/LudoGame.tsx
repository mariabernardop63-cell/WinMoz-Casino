import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Player = "blue" | "green";
type PieceId = "B0"|"B1"|"B2"|"B3"|"G0"|"G1"|"G2"|"G3";
type Phase = "roll"|"select"|"moving"|"done";
interface GamePiece { id: PieceId; player: Player; pos: number; }

// ─── Board Geometry (unchanged) ───────────────────────────────────────────────
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
const BLUE_STRETCH:  [number,number][] = [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]];
const GREEN_STRETCH: [number,number][] = [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]];
const PLAYER_START: Record<Player,number> = { blue:0, green:26 };
const HOME_SLOTS: Record<Player,[number,number][]> = {
  blue:  [[10,1],[10,3],[12,1],[12,3]],
  green: [[2,10],[2,12],[4,10],[4,12]],
};
const SAFE_IDX = [0,9,13,18,26,35,39,44];
const SAFE_COORDS = new Set(SAFE_IDX.map(i=>`${TRACK[i][0]},${TRACK[i][1]}`));

function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1) return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 51)  return TRACK[(PLAYER_START[p.player]+p.pos)%52];
  if (p.pos <= 57)  return (p.player==="blue"?BLUE_STRETCH:GREEN_STRETCH)[p.pos-52];
  return [7,7];
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const Q = {
  red:    { main:"#E8181C", bg:"#C41014" },
  green:  { main:"#1CBF3C", bg:"#15992E" },
  blue:   { main:"#1565E8", bg:"#0F50CC" },
  yellow: { main:"#F5C800", bg:"#D4AA00" },
};
const STRETCH = {
  red:    "#F87171",
  green:  "#4ADE80",
  blue:   "#60A5FA",
  yellow: "#FACC15",
};

// ─── Location-Pin Pawn (Ludo King style) ─────────────────────────────────────
type PawnColor = "red"|"green"|"blue"|"yellow";
const PAWN_PALETTE: Record<PawnColor,{s:string;m:string;d:string;sh:string}> = {
  red:    { s:"#FF9494", m:"#EF4444", d:"#B91C1C", sh:"#7F1D1D" },
  green:  { s:"#72F094", m:"#22C55E", d:"#15803D", sh:"#14532D" },
  blue:   { s:"#82C4FF", m:"#3B82F6", d:"#1D4ED8", sh:"#1E3A8A" },
  yellow: { s:"#FFE570", m:"#EAB308", d:"#A16207", sh:"#713F12" },
};

function Pawn({ color, size=28, glow=false }: {
  color: PawnColor; size?: number; vibrate?: boolean; glow?: boolean;
}) {
  const p = PAWN_PALETTE[color];
  const id = `pw_${color}`;
  return (
    <div
      style={{
        filter: glow
          ? `drop-shadow(0 0 7px ${p.m}) drop-shadow(0 2px 5px rgba(0,0,0,0.55))`
          : "drop-shadow(0 2px 5px rgba(0,0,0,0.48))",
        display:"flex", flexShrink:0,
      }}
    >
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
        {/* Ground shadow */}
        <ellipse cx="28" cy="77" rx="15" ry="4" fill="rgba(0,0,0,0.22)"/>
        {/* Pin body — teardrop */}
        <path
          d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill={`url(#${id}_g)`}
        />
        {/* Outline */}
        <path
          d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill="none" stroke={p.d} strokeWidth="1" opacity="0.4"
        />
        {/* White inner circle */}
        <circle cx="28" cy="27" r="13.5" fill={`url(#${id}_inner)`} opacity="0.96"/>
        {/* Inner tint */}
        <circle cx="28" cy="27" r="9" fill={p.m} opacity="0.28"/>
        {/* Specular top-left */}
        <ellipse cx="19" cy="17" rx="7.5" ry="5.5" fill="white" opacity="0.7"/>
      </svg>
    </div>
  );
}

// ─── Star shape helper ─────────────────────────────────────────────────────────
function StarShape({ cx, cy, r, fill, stroke, strokeWidth=0, opacity=1 }:{
  cx:number; cy:number; r:number; fill:string; stroke?:string; strokeWidth?:number; opacity?:number;
}) {
  const pts: string[] = [];
  for (let i=0;i<10;i++) {
    const angle = (i*36 - 90) * Math.PI/180;
    const rad = i%2===0 ? r : r*0.42;
    pts.push(`${cx+Math.cos(angle)*rad},${cy+Math.sin(angle)*rad}`);
  }
  return (
    <polygon
      points={pts.join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
    />
  );
}

// ─── SVG Board Background ─────────────────────────────────────────────────────
const CS = 40; // cell size in SVG units
const SZ = 15 * CS; // 600

function cellColor(r:number, c:number): string {
  // Colored home stretches
  if (c===7 && r>=1 && r<=6)  return STRETCH.green;
  if (c===7 && r>=8 && r<=13) return STRETCH.blue;
  if (r===7 && c>=1 && c<=6)  return STRETCH.red;
  if (r===7 && c>=8 && c<=13) return STRETCH.yellow;
  // Starting squares (colored with player color + will get star)
  if (r===13 && c===6) return Q.blue.main;    // blue start
  if (r===1  && c===8) return Q.green.main;   // green start
  if (r===6  && c===1) return Q.red.main;     // red start
  if (r===8  && c===13) return Q.yellow.main; // yellow start
  return "#FFFFFF";
}

// Home slot positions (grid [r,c] → SVG px, py)
const HOME_SLOT_SVG: Record<"red"|"green"|"blue"|"yellow",[number,number][]> = {
  red:    [[1,1],[1,3],[3,1],[3,3]].map(([r,c])=>[(c+0.5)*CS,(r+0.5)*CS]) as [number,number][],
  green:  [[2,10],[2,12],[4,10],[4,12]].map(([r,c])=>[(c+0.5)*CS,(r+0.5)*CS]) as [number,number][],
  blue:   [[10,1],[10,3],[12,1],[12,3]].map(([r,c])=>[(c+0.5)*CS,(r+0.5)*CS]) as [number,number][],
  yellow: [[10,10],[10,12],[12,10],[12,12]].map(([r,c])=>[(c+0.5)*CS,(r+0.5)*CS]) as [number,number][],
};

// Directional arrows on border path cells
const ARROWS: { r:number; c:number; sym:string }[] = [
  { r:7,  c:0,  sym:"→" },
  { r:7,  c:14, sym:"←" },
  { r:0,  c:7,  sym:"↓" },
  { r:14, c:7,  sym:"↑" },
];

function BoardSVG() {
  const pathCells: [number,number][] = [];
  for (let r=0;r<15;r++) {
    for (let c=0;c<15;c++) {
      const inQ = (r<=5&&c<=5)||(r<=5&&c>=9)||(r>=9&&c<=5)||(r>=9&&c>=9);
      if (!inQ) pathCells.push([r,c]);
    }
  }
  const coloredStarts = new Set(["13,6","1,8","6,1","8,13"]);
  const arrowCells = new Set(ARROWS.map(a=>`${a.r},${a.c}`));

  return (
    <svg
      viewBox={`0 0 ${SZ} ${SZ}`}
      width="100%" height="100%"
      style={{ display:"block", position:"absolute", inset:0 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Outer background */}
      <rect x={0} y={0} width={SZ} height={SZ} fill="#0E1B4A" rx={4}/>

      {/* ── Quadrant fills ── */}
      <rect x={0}   y={0}   width={240} height={240} fill={Q.red.main}/>
      <rect x={360} y={0}   width={240} height={240} fill={Q.green.main}/>
      <rect x={0}   y={360} width={240} height={240} fill={Q.blue.main}/>
      <rect x={360} y={360} width={240} height={240} fill={Q.yellow.main}/>

      {/* ── Path cells ── */}
      {pathCells.map(([r,c])=>{
        const x=c*CS, y=r*CS;
        const isCenter = r>=6&&r<=8&&c>=6&&c<=8;
        if (isCenter) return null;
        const fill = cellColor(r,c);
        return (
          <rect key={`${r},${c}`} x={x} y={y} width={CS} height={CS}
            fill={fill} stroke="#BBBBBB" strokeWidth="0.7"/>
        );
      })}

      {/* ── Center 3×3 colored triangles ── */}
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

      {/* ── Safe square stars (gray outline) ── */}
      {SAFE_IDX.map(i=>{
        const [r,c] = TRACK[i];
        const key = `${r},${c}`;
        if (coloredStarts.has(key)) return null;
        return (
          <StarShape key={key} cx={(c+0.5)*CS} cy={(r+0.5)*CS} r={CS*0.33}
            fill="none" stroke="#AAAAAA" strokeWidth={1.6} opacity={0.85}/>
        );
      })}

      {/* ── Start square stars (white filled) ── */}
      {["13,6","1,8","6,1","8,13"].map(key=>{
        const [r,c] = key.split(",").map(Number);
        return (
          <StarShape key={key} cx={(c+0.5)*CS} cy={(r+0.5)*CS} r={CS*0.33}
            fill="white" opacity={0.92}/>
        );
      })}

      {/* ── Directional arrows ── */}
      {ARROWS.map(({r,c,sym})=>(
        <text key={sym}
          x={(c+0.5)*CS} y={(r+0.5)*CS+6}
          textAnchor="middle" dominantBaseline="middle"
          fill="#888" fontSize={16} fontWeight="bold" opacity={0.75}
          fontFamily="Arial, sans-serif"
        >{sym}</text>
      ))}

      {/* ── Home white inner rectangles (straight borders) ── */}
      <rect x={36} y={36} width={168} height={168} rx={8} fill="white"/>
      <rect x={396} y={36} width={168} height={168} rx={8} fill="white"/>
      <rect x={36} y={396} width={168} height={168} rx={8} fill="white"/>
      <rect x={396} y={396} width={168} height={168} rx={8} fill="white"/>

      {/* ── Red home: 4 solid red circles ── */}
      {HOME_SLOT_SVG.red.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="red"/>
      ))}

      {/* ── Yellow home: 4 solid yellow circles ── */}
      {HOME_SLOT_SVG.yellow.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="yellow"/>
      ))}

      {/* ── Blue home: 4 location-pin pawns ── */}
      {HOME_SLOT_SVG.blue.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="blue"/>
      ))}

      {/* ── Green home: 4 location-pin pawns ── */}
      {HOME_SLOT_SVG.green.map(([px,py],i)=>(
        <DecoSVGPawn key={i} cx={px} cy={py} color="green"/>
      ))}

      {/* ── Board border ── */}
      <rect x={0} y={0} width={SZ} height={SZ} fill="none" stroke="#0A1440" strokeWidth={3} rx={4}/>
    </svg>
  );
}

// ─── Home slot: circle + optional location-pin pawn ───────────────────────────
function DecoSVGPawn({ cx, cy, color }: { cx:number; cy:number; color:"red"|"yellow"|"blue"|"green" }) {
  const p = PAWN_PALETTE[color];
  const slotR = 23;
  const isPin = color === "blue" || color === "green";
  const id = `hs_${color}_${Math.round(cx)}_${Math.round(cy)}`;

  if (!isPin) {
    // Red / Yellow — big solid colored disc
    return (
      <g>
        {/* Shadow */}
        <ellipse cx={cx+1} cy={cy+2} rx={slotR} ry={slotR*0.55} fill="rgba(0,0,0,0.18)"/>
        {/* Disc */}
        <circle cx={cx} cy={cy} r={slotR} fill={p.m}/>
        <circle cx={cx} cy={cy} r={slotR} fill="none" stroke={p.d} strokeWidth={2}/>
        {/* Shine */}
        <ellipse cx={cx-slotR*0.3} cy={cy-slotR*0.32} rx={slotR*0.38} ry={slotR*0.28} fill="white" opacity={0.32}/>
      </g>
    );
  }

  // Blue / Green — slot circle with location-pin pawn inside
  // Pin is drawn in a 56×80 viewBox then scaled/translated to fit
  const sc = 0.60;
  const pinW = 56*sc, pinH = 80*sc;
  const tx = cx - pinW/2;
  const ty = cy - pinH*0.66; // shift up so pin bottom aligns near cy+6

  return (
    <g>
      {/* Slot circle background */}
      <circle cx={cx} cy={cy} r={slotR} fill="rgba(255,255,255,0.78)"/>
      <circle cx={cx} cy={cy} r={slotR} fill="none" stroke={p.m} strokeWidth={1.8} opacity={0.55}/>
      {/* Location-pin pawn */}
      <defs>
        <radialGradient id={`${id}_g`} cx="32%" cy="26%" r="70%">
          <stop offset="0%"  stopColor={p.s}/>
          <stop offset="45%" stopColor={p.m}/>
          <stop offset="100%" stopColor={p.d}/>
        </radialGradient>
        <radialGradient id={`${id}_in`} cx="40%" cy="35%" r="62%">
          <stop offset="0%"  stopColor="white"/>
          <stop offset="100%" stopColor={p.s}/>
        </radialGradient>
      </defs>
      <g transform={`translate(${tx},${ty}) scale(${sc})`}>
        {/* Shadow at base */}
        <ellipse cx="28" cy="77" rx="14" ry="3.5" fill="rgba(0,0,0,0.18)"/>
        {/* Pin body */}
        <path
          d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill={`url(#${id}_g)`}
        />
        {/* Outline */}
        <path
          d="M28 74 C28 74 7 46 7 28 C7 14.7 16.5 4 28 4 C39.5 4 49 14.7 49 28 C49 46 28 74 28 74Z"
          fill="none" stroke={p.d} strokeWidth="1.2" opacity="0.4"
        />
        {/* White inner circle */}
        <circle cx="28" cy="27" r="13.5" fill={`url(#${id}_in)`} opacity="0.96"/>
        <circle cx="28" cy="27" r="9"    fill={p.m} opacity="0.25"/>
        {/* Specular */}
        <ellipse cx="19" cy="17" rx="7.5" ry="5.5" fill="white" opacity="0.7"/>
      </g>
    </g>
  );
}

// ─── Selection ring: rotating dots around a selectable pawn ───────────────────
function SelectionRing({ size }: { size: number }) {
  const N = 10;
  const R = size * 0.72;
  const dotR = size * 0.09;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
      style={{
        position:"absolute",
        width: size*2, height: size*2,
        left: -size*0.5, top: -size*0.5,
        pointerEvents:"none",
        zIndex:30,
      }}
    >
      {Array.from({length:N},(_,i)=>{
        const angle = (i*360/N)*Math.PI/180;
        return (
          <div key={i} style={{
            position:"absolute",
            width: dotR*2, height: dotR*2,
            borderRadius:"50%",
            background: i%2===0 ? "white" : "rgba(255,255,255,0.55)",
            left: size + R*Math.cos(angle) - dotR,
            top:  size + R*Math.sin(angle) - dotR,
            boxShadow:"0 1px 3px rgba(0,0,0,0.45)",
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
    const [r,c] = getPieceCoord(p);
    const k = `${r},${c}`;
    cellMap.set(k, [...(cellMap.get(k)||[]), p]);
  });

  return (
    <div style={{
      position:"relative",
      width:"100%",
      aspectRatio:"1",
      borderRadius:6,
      overflow:"hidden",
      boxShadow:"0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
    }}>
      <BoardSVG/>

      {/* Piece overlay */}
      {pieces.map(p => {
        const [r,c] = getPieceCoord(p);
        const here = cellMap.get(`${r},${c}`) || [];
        const idx = here.findIndex(x => x.id === p.id);
        const selectable = movable.includes(p.id);
        const color: PawnColor = p.player === "blue" ? "blue" : "green";

        // Stack offset for multiple pieces on same cell
        const OFFSETS = [[0,0],[-5,-4],[5,-4],[-5,4],[5,4]];
        const [offX, offY] = here.length > 1
          ? (OFFSETS[idx] ?? [0,0])
          : [0,0];

        const pawnSize = 26;
        return (
          <div
            key={p.id}
            onClick={selectable ? () => onSelectPiece(p.id) : undefined}
            style={{
              position:"absolute",
              left:`${(c + 0.5) / 15 * 100}%`,
              top:`${(r + 0.5) / 15 * 100}%`,
              transform:`translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px))`,
              zIndex: selectable ? 25 : 10,
              cursor: selectable ? "pointer" : "default",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          >
            {selectable && <SelectionRing size={pawnSize}/>}
            <Pawn color={color} size={pawnSize} glow={selectable}/>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dice ─────────────────────────────────────────────────────────────────────
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
          <stop offset="0%" stopColor="#444444"/>
          <stop offset="100%" stopColor="#0a0a0a"/>
        </radialGradient>
        <filter id={`dotInset_${faceId}`}>
          <feDropShadow dx="0.5" dy="0.8" stdDeviation="0.8" floodOpacity="0.55"/>
          <feDropShadow dx="-0.3" dy="-0.3" stdDeviation="0.4" floodColor="white" floodOpacity="0.15"/>
        </filter>
      </defs>
      {dots.map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={10}
          fill={`url(#dot_${faceId}_${value})`}
          filter={`url(#dotInset_${faceId})`}
        />
      ))}
    </svg>
  );
}

function Dice3D({ value, rolling, onClick, active, sz=54 }: {
  value:number|null; rolling:boolean; onClick:()=>void; active:boolean; sz?:number;
}) {
  const h = sz/2;
  const [rollKey, setRollKey] = useState(0);
  const [disp, setDisp] = useState(1);

  const faceRot: Record<number,{rx:number;ry:number}> = {
    1:{rx:0,ry:0}, 2:{rx:-90,ry:0}, 3:{rx:0,ry:-90},
    4:{rx:0,ry:90}, 5:{rx:90,ry:0}, 6:{rx:0,ry:180},
  };

  useEffect(()=>{
    if (!rolling) { if (value!==null) setDisp(value); return; }
    setRollKey(k=>k+1);
    let n=0;
    const iv=setInterval(()=>{ setDisp(Math.floor(Math.random()*6)+1); n++; if(n>14) clearInterval(iv); },45);
    return ()=>clearInterval(iv);
  },[rolling,value]);

  const tr = faceRot[disp]||{rx:0,ry:0};
  // face: [value, transform, bg-color, shading-dir]
  const faces: [number,string,string][] = [
    [1,`translateZ(${h}px)`,                "#FAFAF8"],
    [6,`rotateY(180deg) translateZ(${h}px)`,"#F0EEE8"],
    [2,`rotateX(90deg) translateZ(${h}px)`, "#F5F4F0"],
    [5,`rotateX(-90deg) translateZ(${h}px)`,"#E8E6E0"],
    [3,`rotateY(90deg) translateZ(${h}px)`, "#F2F0EB"],
    [4,`rotateY(-90deg) translateZ(${h}px)`,"#ECEAE4"],
  ];
  const rad = sz * 0.17;

  return (
    <div
      onClick={active&&!rolling ? onClick : undefined}
      style={{
        perspective:"400px", width:sz, height:sz,
        cursor: active&&!rolling ? "pointer" : "default",
        filter: active
          ? "drop-shadow(0 6px 16px rgba(0,0,0,0.7)) drop-shadow(0 2px 5px rgba(0,0,0,0.45))"
          : "drop-shadow(0 3px 8px rgba(0,0,0,0.5))",
      }}
    >
      <motion.div
        key={rollKey}
        animate={rolling
          ? {rotateX:[0,-180,-360,tr.rx+360], rotateY:[0,180,360,tr.ry+360]}
          : {rotateX:tr.rx, rotateY:tr.ry}}
        transition={rolling ? {duration:0.75,ease:"easeOut"} : {duration:0.14}}
        style={{ width:sz, height:sz, transformStyle:"preserve-3d", position:"relative" }}
      >
        {faces.map(([v,t,bg])=>(
          <div key={v} style={{
            position:"absolute", inset:0,
            background:`radial-gradient(ellipse at 30% 25%, #FFFFFF, ${bg} 60%, #D8D5CC)`,
            borderRadius:rad,
            border:"1px solid rgba(140,135,120,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center",
            backfaceVisibility:"hidden",
            transform:t,
            boxShadow:[
              "inset 2px 2px 5px rgba(255,255,255,0.95)",
              "inset -2px -2px 5px rgba(0,0,0,0.18)",
              "inset 1px 1px 0px rgba(255,255,255,0.6)",
            ].join(", "),
          }}>
            <DiceFace value={v} sz={sz*0.76} faceId={`f${v}`}/>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Player Panel ─────────────────────────────────────────────────────────────
function PlayerPanel({ player, name, isActive, diceValue, rolling, onRoll, showArrow, finished }: {
  player: Player; name:string; isActive:boolean; diceValue:number|null;
  rolling:boolean; onRoll:()=>void; showArrow:boolean; finished:number;
}) {
  const color: PawnColor = player === "blue" ? "blue" : "green";
  const p = PAWN_PALETTE[color];
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
      background: isActive ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.03)",
      borderRadius:16,
      border: isActive ? `2px solid ${p.m}55` : "2px solid transparent",
      boxShadow: isActive ? `0 0 18px ${p.m}22` : "none",
      transition:"all 0.3s",
    }}>
      {/* Avatar */}
      <div style={{
        width:42, height:42, borderRadius:13,
        background:`linear-gradient(135deg,${p.s}40,${p.d}80)`,
        border:`2px solid ${p.m}66`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        boxShadow:`0 2px 8px ${p.d}55`,
      }}>
        <Pawn color={color} size={24}/>
      </div>
      {/* Name + progress */}
      <div style={{flex:1,minWidth:0}}>
        <p style={{
          fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
          color: isActive ? "#fff" : "rgba(255,255,255,0.4)", lineHeight:1,
        }}>{name}</p>
        <div style={{display:"flex", gap:4, marginTop:5}}>
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} style={{
              width:9, height:9, borderRadius:"50%",
              background: i<finished ? p.m : "rgba(255,255,255,0.12)",
              border:`1.5px solid ${i<finished ? p.d : "rgba(255,255,255,0.08)"}`,
              boxShadow: i<finished ? `0 0 5px ${p.m}` : "none",
              transition:"all 0.3s",
            }}/>
          ))}
        </div>
      </div>
      {/* Dice */}
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <AnimatePresence>
          {showArrow && (
            <motion.div
              initial={{opacity:0, x: player==="blue" ? 8 : -8}}
              animate={{opacity:1, x:0}} exit={{opacity:0}}
              style={{fontSize:16, lineHeight:1}}
            >
              {player==="blue" ? "👉" : "👈"}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{
          background:"rgba(0,0,0,0.28)", borderRadius:12, padding:6,
          border: isActive ? `1.5px solid ${p.m}44` : "1.5px solid rgba(255,255,255,0.07)",
          boxShadow: isActive ? `0 0 14px ${p.m}33` : "none",
        }}>
          <Dice3D value={diceValue} rolling={rolling} onClick={onRoll} active={isActive} sz={54}/>
        </div>
      </div>
    </div>
  );
}

// ─── Scripted dice ─────────────────────────────────────────────────────────────
const SCRIPTED = [6,5,2,2,6,5];

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function LudoGame() {
  const [,setLocation] = useLocation();

  const [pieces,setPieces] = useState<GamePiece[]>([
    {id:"B0",player:"blue",pos:-1},{id:"B1",player:"blue",pos:-1},
    {id:"B2",player:"blue",pos:-1},{id:"B3",player:"blue",pos:-1},
    {id:"G0",player:"green",pos:-1},{id:"G1",player:"green",pos:-1},
    {id:"G2",player:"green",pos:-1},{id:"G3",player:"green",pos:-1},
  ]);
  const [turn,setTurn]                     = useState<Player>("blue");
  const [phase,setPhase]                   = useState<Phase>("roll");
  const [diceBlue,setDiceBlue]             = useState<number|null>(null);
  const [diceGreen,setDiceGreen]           = useState<number|null>(null);
  const [rollingBlue,setRollingBlue]       = useState(false);
  const [rollingGreen,setRollingGreen]     = useState(false);
  const [movable,setMovable]               = useState<PieceId[]>([]);
  const [winner,setWinner]                 = useState<Player|null>(null);
  const [msg,setMsg]                       = useState("Jogador Azul – clica nos dados para começar!");
  const scriptIdx                          = useRef(0);
  const piecesRef                          = useRef(pieces);
  useEffect(()=>{ piecesRef.current=pieces; },[pieces]);

  const other = (p:Player):Player => p==="blue"?"green":"blue";

  function rollDice():number {
    const idx=scriptIdx.current; scriptIdx.current++;
    if(idx<SCRIPTED.length) return SCRIPTED[idx];
    return Math.floor(Math.random()*6)+1;
  }

  function calcMovable(ps:GamePiece[],pl:Player,d:number):PieceId[] {
    return ps.filter(p=>p.player===pl).filter(p=>{
      if(p.pos===58) return false;
      if(p.pos===-1) return d===6;
      return p.pos+d<=58;
    }).map(p=>p.id) as PieceId[];
  }

  function finishedCount(ps:GamePiece[],pl:Player):number {
    return ps.filter(p=>p.player===pl&&p.pos===58).length;
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
      },step*220);
    }
  }

  function handleMoveComplete(pieceId:PieceId,diceVal:number,currentTurn:Player) {
    setPhase("moving");
    const ps=piecesRef.current;
    const mover=ps.find(p=>p.id===pieceId)!;
    const moverCoord=getPieceCoord(mover);
    const ck=`${moverCoord[0]},${moverCoord[1]}`;
    if(!SAFE_COORDS.has(ck)&&mover.pos>=0&&mover.pos<=51){
      const opp=other(currentTurn);
      const captured=ps.filter(p=>p.player===opp&&p.pos>=0&&p.pos<=51).filter(p=>{
        const [pr,pc]=getPieceCoord(p);
        return pr===moverCoord[0]&&pc===moverCoord[1];
      });
      if(captured.length>0){
        setPieces(prev=>prev.map(p=>captured.some(c=>c.id===p.id)?{...p,pos:-1}:p));
        setMsg(`${currentTurn==="blue"?"Azul":"Verde"} capturou uma peça! 💥`);
      }
    }
    const updatedPs=piecesRef.current;
    if(finishedCount(updatedPs,currentTurn)===4){
      setWinner(currentTurn); setPhase("done");
      setMsg(`${currentTurn==="blue"?"Jogador Azul":"Jogador Verde"} VENCEU! 🏆`);
      return;
    }
    if(diceVal===6){
      setMsg(`${currentTurn==="blue"?"Azul":"Verde"} tirou 6 – joga novamente!`);
      setMovable([]);
      setTimeout(()=>{ setPhase("roll"); if(currentTurn==="blue") setDiceBlue(null); else setDiceGreen(null); },400);
    } else {
      const next=other(currentTurn);
      setMovable([]);
      setTimeout(()=>{
        setTurn(next); setPhase("roll");
        if(next==="blue"){ setDiceBlue(null); setMsg("Jogador Azul – clica nos dados!"); }
        else { setDiceGreen(null); setMsg("Jogador Verde – a pensar…"); }
      },500);
    }
  }

  function doRoll(pl:Player){
    if(phase!=="roll"||turn!==pl) return;
    const setRolling=pl==="blue"?setRollingBlue:setRollingGreen;
    const setDice=pl==="blue"?setDiceBlue:setDiceGreen;
    setRolling(true);
    setTimeout(()=>{
      const val=rollDice();
      setDice(val); setRolling(false);
      const mv=calcMovable(piecesRef.current,pl,val);
      if(mv.length===0){
        setMsg(val===6
          ?`${pl==="blue"?"Azul":"Verde"} tirou 6 mas não pode mover!`
          :`${pl==="blue"?"Azul":"Verde"} tirou ${val} – sem jogadas. Vez de ${other(pl)==="blue"?"Azul":"Verde"}.`);
        setTimeout(()=>{
          const next=other(pl); setTurn(next); setPhase("roll");
          if(next==="blue"){ setDiceBlue(null); setMsg("Jogador Azul – clica nos dados!"); }
          else { setDiceGreen(null); setMsg("Jogador Verde – a pensar…"); }
        },1400);
      } else if(mv.length===1){
        setMsg(`${pl==="blue"?"Azul":"Verde"} tirou ${val}!`);
        doSelectPiece(mv[0],val,pl,piecesRef.current);
      } else {
        setMovable(mv); setPhase("select");
        setMsg(`${pl==="blue"?"Azul":"Verde"} tirou ${val} – escolhe uma peça!`);
      }
    },800);
  }

  function doSelectPiece(pid:PieceId,diceVal:number,pl:Player,ps:GamePiece[]){
    setMovable([]); setPhase("moving");
    const piece=ps.find(p=>p.id===pid)!;
    const isExit=piece.pos===-1;
    if(isExit){
      setMsg(`${pl==="blue"?"Azul":"Verde"} coloca uma peça no tabuleiro!`);
      movePieceSteps(pid,-1,1,true,()=>handleMoveComplete(pid,diceVal,pl));
    } else {
      setMsg(`${pl==="blue"?"Azul":"Verde"} move ${diceVal} casas!`);
      movePieceSteps(pid,piece.pos,diceVal,false,()=>handleMoveComplete(pid,diceVal,pl));
    }
  }

  function handleSelectPiece(pid:PieceId){
    if(phase!=="select") return;
    const diceVal=turn==="blue"?diceBlue:diceGreen;
    if(diceVal===null) return;
    doSelectPiece(pid,diceVal,turn,piecesRef.current);
  }

  // AI: auto-play Green
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

  const blueFinished  = finishedCount(pieces,"blue");
  const greenFinished = finishedCount(pieces,"green");

  return (
    <div style={{
      minHeight:"100vh", width:"100%", display:"flex", justifyContent:"center",
      background:"linear-gradient(160deg,#0a0f1e 0%,#0f2044 40%,#0a1628 100%)",
    }}>
      <div style={{
        width:"100%", maxWidth:430, display:"flex", flexDirection:"column",
        minHeight:"100vh", paddingBottom:12,
      }}>

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 16px 10px",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(0,0,0,0.2)",
        }}>
          <button onClick={()=>setLocation("/")}
            style={{width:38,height:38,borderRadius:10,
              background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,255,255,0.1)",
              display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <ArrowLeft style={{width:18,height:18,color:"#fff"}}/>
          </button>
          <div style={{textAlign:"center"}}>
            <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,
              color:"#fff",lineHeight:1,letterSpacing:3,
              textShadow:"0 0 20px rgba(99,179,255,0.6)"}}>LUDO</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2,letterSpacing:2}}>1 VS 1</p>
          </div>
          <div style={{width:38,height:38}}/>
        </div>

        {/* Green panel (top) */}
        <div style={{padding:"10px 12px 6px"}}>
          <PlayerPanel
            player="green" name="Jogador Verde (IA)"
            isActive={turn==="green"&&!winner}
            diceValue={diceGreen} rolling={rollingGreen}
            onRoll={()=>doRoll("green")}
            showArrow={turn==="green"&&phase==="roll"&&!winner}
            finished={greenFinished}
          />
        </div>

        {/* Status */}
        <div style={{padding:"4px 12px 8px"}}>
          <motion.div
            key={msg}
            initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
            style={{
              background:"rgba(255,255,255,0.05)", borderRadius:10,
              padding:"7px 14px", textAlign:"center",
              border:"1px solid rgba(255,255,255,0.07)",
            }}>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontWeight:600,letterSpacing:0.3}}>{msg}</p>
          </motion.div>
        </div>

        {/* Board */}
        <div style={{padding:"0 10px", flex:1}}>
          <Board pieces={pieces} movable={movable} onSelectPiece={handleSelectPiece}/>
        </div>

        {/* Blue panel (bottom) */}
        <div style={{padding:"8px 12px 4px"}}>
          <PlayerPanel
            player="blue" name="Tu (Azul)"
            isActive={turn==="blue"&&!winner}
            diceValue={diceBlue} rolling={rollingBlue}
            onRoll={()=>doRoll("blue")}
            showArrow={turn==="blue"&&phase==="roll"&&!winner}
            finished={blueFinished}
          />
        </div>

      </div>

      {/* Win overlay */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.82)",
              backdropFilter:"blur(8px)",
              display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
            }}>
            <motion.div
              initial={{scale:0.6,opacity:0,y:40}}
              animate={{scale:1,opacity:1,y:0}}
              transition={{type:"spring",stiffness:240,damping:18}}
              style={{
                background: winner==="blue"
                  ? "linear-gradient(135deg,#1e3a8a,#1d4ed8)"
                  : "linear-gradient(135deg,#14532d,#16a34a)",
                borderRadius:24, padding:"40px 36px", textAlign:"center",
                border:`2px solid ${winner==="blue"?"#60a5fa":"#4ade80"}`,
                boxShadow:`0 20px 60px ${winner==="blue"?"#1d4ed855":"#16a34a55"}`,
                maxWidth:300, width:"88%",
              }}>
              <div style={{marginBottom:16}}>
                <Trophy style={{width:60,height:60,color:"#fbbf24",margin:"0 auto",
                  filter:"drop-shadow(0 0 12px #fbbf2488)"}}/>
              </div>
              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:26,
                color:"#fff",marginBottom:6,letterSpacing:1}}>
                {winner==="blue"?"Jogador Azul":"Jogador Verde"}
              </p>
              <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",marginBottom:28}}>
                Venceu a partida! 🎉
              </p>
              <button onClick={()=>setLocation("/")}
                style={{
                  background:"rgba(255,255,255,0.15)",
                  border:"1.5px solid rgba(255,255,255,0.3)",
                  color:"#fff", borderRadius:12, padding:"13px 0",
                  fontFamily:"'Syne',sans-serif", fontWeight:700,
                  fontSize:15, cursor:"pointer", width:"100%",
                }}>
                Sair ao Menu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
