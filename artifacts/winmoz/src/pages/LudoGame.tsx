import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import bgImg from "@assets/Gemini_Generated_Image_grc2w7grc2w7grc2_1780220609974.png";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Player  = "blue" | "green";
type PieceId = "B0"|"B1"|"B2"|"B3"|"G0"|"G1"|"G2"|"G3";
type Phase   = "roll"|"select"|"moving"|"done";
interface GamePiece { id: PieceId; player: Player; pos: number; }

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
const BLUE_STRETCH:  [number,number][] = [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]];
const GREEN_STRETCH: [number,number][] = [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]];

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

// ─── Safe squares — ORIGINAL star positions + starting squares ─────────────────
const STAR_DISPLAY: [number,number][] = [[8,2],[2,6],[6,12],[12,8]];
const SAFE_IDX = [0,9,13,18,26,35,39,44];
const SAFE_COORDS = new Set<string>([
  ...SAFE_IDX.map(i=>`${TRACK[i][0]},${TRACK[i][1]}`),
  ...STAR_DISPLAY.map(([r,c])=>`${r},${c}`),
  "13,6", "1,8",
]);

// ─── Sizing — sphere pawn fits exactly in cell ─────────────────────────────────
const PIECE_BOX  = 28;  // px — matches ~27px cell
const PAWN_SIZE  = 22;  // px — sphere width = height (square)

// ─── getPieceCoord: stretch entered after pos 50 (arrow cell) ──────────────────
function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1)  return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 50)   return TRACK[(PLAYER_START[p.player] + p.pos) % 52];
  if (p.pos <= 56)   return (p.player==="blue" ? BLUE_STRETCH : GREEN_STRETCH)[p.pos - 51];
  return [7,7]; // pos 57 = finished (center)
}

// ─── Colors ─────────────────────────────────────────────────────────────────────
const Q = {
  red:    { main:"#E8181C", bg:"#C41014" },
  green:  { main:"#1CBF3C", bg:"#15992E" },
  blue:   { main:"#1565E8", bg:"#0F50CC" },
  yellow: { main:"#F5C800", bg:"#D4AA00" },
};
const STRETCH_COL = { red:"#FF5B5B", green:"#1CD44C", blue:"#2E8EFF", yellow:"#FFCC00" };

type PawnColor = "red"|"green"|"blue"|"yellow";
const PAWN_PAL: Record<PawnColor,{s:string;m:string;d:string}> = {
  red:    { s:"#FF9898", m:"#EF4444", d:"#9B1C1C" },
  green:  { s:"#86EFAC", m:"#22C55E", d:"#166534" },
  blue:   { s:"#93C5FD", m:"#3B82F6", d:"#1E3A8A" },
  yellow: { s:"#FDE68A", m:"#EAB308", d:"#713F12" },
};

// ─── Classic Ludo sphere pawn ──────────────────────────────────────────────────
function Pawn({ color, size=PAWN_SIZE, glow=false }: {
  color:PawnColor; size?:number; glow?:boolean;
}) {
  const p = PAWN_PAL[color];
  const id = `sp_${color}`;
  return (
    <div style={{
      display:"flex", flexShrink:0,
      filter: glow
        ? `drop-shadow(0 0 ${Math.round(size*0.3)}px ${p.m}CC) drop-shadow(0 1px 3px rgba(0,0,0,0.6))`
        : "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
    }}>
      <svg viewBox="0 0 36 36" width={size} height={size} style={{display:"block"}}>
        <defs>
          <radialGradient id={`${id}_g`} cx="35%" cy="28%" r="72%">
            <stop offset="0%"   stopColor={p.s}/>
            <stop offset="50%"  stopColor={p.m}/>
            <stop offset="100%" stopColor={p.d}/>
          </radialGradient>
        </defs>
        {/* Shadow */}
        <ellipse cx="18" cy="34" rx="10" ry="2.5" fill="rgba(0,0,0,0.2)"/>
        {/* Sphere body */}
        <circle cx="18" cy="17" r="15" fill={`url(#${id}_g)`}/>
        <circle cx="18" cy="17" r="15" fill="none" stroke={p.d} strokeWidth="0.7" opacity="0.55"/>
        {/* Inner ring detail — classic Ludo */}
        <circle cx="18" cy="17" r="8"  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
        {/* Shine */}
        <ellipse cx="11" cy="9" rx="5" ry="3.8" fill="white" opacity="0.52" transform="rotate(-18 11 9)"/>
        <ellipse cx="11" cy="9" rx="2.2" ry="1.6" fill="white" opacity="0.8" transform="rotate(-18 11 9)"/>
      </svg>
    </div>
  );
}

// ─── Selection ring — STATIC pulsing circle, centered on the square ────────────
// NOT spinning/rotating — just a breathing glow ring around the pawn
function SelectionRing({ color }: { color: PawnColor }) {
  const p = PAWN_PAL[color];
  return (
    <motion.div
      animate={{ scale:[1,1.08,1], opacity:[0.55,1,0.55] }}
      transition={{ duration:1.1, repeat:Infinity, ease:"easeInOut" }}
      style={{
        position:"absolute",
        inset: -3,          // ring is 3px larger than PIECE_BOX on each side
        borderRadius:"50%",
        border:`2.5px solid ${p.m}`,
        boxShadow:`0 0 10px ${p.m}66, 0 0 18px ${p.m}22, inset 0 0 6px ${p.m}11`,
        pointerEvents:"none",
        zIndex:0,
      }}
    />
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
  return "#FFFFFF";
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
      {/* Board background */}
      <rect x={0} y={0} width={SZ} height={SZ} fill="#101830" rx={4}/>
      {/* Quadrant fills */}
      <rect x={0}   y={0}   width={240} height={240} fill={Q.red.main}/>
      <rect x={360} y={0}   width={240} height={240} fill={Q.green.main}/>
      <rect x={0}   y={360} width={240} height={240} fill={Q.blue.main}/>
      <rect x={360} y={360} width={240} height={240} fill={Q.yellow.main}/>
      {/* Path cells */}
      {pathCells.map(([r,c])=>{
        if(r>=6&&r<=8&&c>=6&&c<=8) return null;
        return <rect key={`${r},${c}`} x={c*CS} y={r*CS} width={CS} height={CS}
          fill={cellColor(r,c)} stroke="#C0C0C0" strokeWidth="0.6"/>;
      })}
      {/* Center triangles */}
      <rect x={240} y={240} width={120} height={120} fill="#F5F5F5"/>
      <polygon points="240,240 360,240 300,300" fill={Q.green.main}/>
      <polygon points="360,240 360,360 300,300" fill={Q.yellow.main}/>
      <polygon points="360,360 240,360 300,300" fill={Q.blue.main}/>
      <polygon points="240,360 240,240 300,300" fill={Q.red.main}/>
      {/* Center border */}
      <rect x={240} y={240} width={120} height={120} fill="none" stroke="#AAAAAA" strokeWidth="0.6"/>
      {/* SVG sphere gradients (shared) */}
      <defs>
        {(["blue","green","red","yellow"] as PawnColor[]).map(color=>{
          const p=PAWN_PAL[color];
          return (
            <radialGradient key={color} id={`hs_${color}`} cx="35%" cy="28%" r="72%">
              <stop offset="0%"   stopColor={p.s}/>
              <stop offset="50%"  stopColor={p.m}/>
              <stop offset="100%" stopColor={p.d}/>
            </radialGradient>
          );
        })}
      </defs>
      {/* Home slot circles + resting pawns */}
      {HOME_DECO.map(({ color, slots })=>
        slots.map(([px,py],i)=>{
          const p=PAWN_PAL[color];
          const isActive=(color==="blue"&&inHome.blue.has(i))||(color==="green"&&inHome.green.has(i));
          return (
            <g key={`${color}_${i}`}>
              <circle cx={px} cy={py} r={26} fill={p.d} opacity={0.28}/>
              <circle cx={px} cy={py} r={26} fill="none" stroke={p.m} strokeWidth={2.2} opacity={0.7}/>
              {isActive && (
                <>
                  <circle cx={px} cy={py} r={16} fill={`url(#hs_${color})`}/>
                  <circle cx={px} cy={py} r={16} fill="none" stroke={p.d} strokeWidth="0.8" opacity="0.5"/>
                  <circle cx={px} cy={py} r={9}  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
                  <ellipse cx={px-5} cy={py-7} rx="4.5" ry="3" fill="white" opacity="0.48" transform={`rotate(-18 ${px-5} ${py-7})`}/>
                </>
              )}
            </g>
          );
        })
      )}
      {/* Home rect backgrounds */}
      <rect x={36} y={36}   width={168} height={168} rx={6} fill="white" opacity={0.15}/>
      <rect x={396} y={36}  width={168} height={168} rx={6} fill="white" opacity={0.15}/>
      <rect x={36} y={396}  width={168} height={168} rx={6} fill="white" opacity={0.15}/>
      <rect x={396} y={396} width={168} height={168} rx={6} fill="white" opacity={0.15}/>
      {/* Stars — original positions restored */}
      {STAR_DISPLAY.map(([sr,sc])=>(
        <g key={`star_${sr},${sc}`}>
          <StarShape cx={(sc+0.5)*CS} cy={(sr+0.5)*CS} r={CS*0.28}
            fill="rgba(255,210,0,0.15)" stroke="#FFD700" strokeW={1.5} opacity={0.92}/>
        </g>
      ))}
      {/* Directional arrows */}
      {ARROWS.map(({r,c,s})=>(
        <text key={s} x={(c+0.5)*CS} y={(r+0.5)*CS+6}
          textAnchor="middle" fill="#555" fontSize={16} fontWeight="bold"
          opacity={0.65} fontFamily="Arial,sans-serif">{s}</text>
      ))}
      {/* Board border */}
      <rect x={0} y={0} width={SZ} height={SZ} fill="none" stroke="#0A1028" strokeWidth={3} rx={4}/>
    </svg>
  );
}

// ─── Board overlay (interactive pawn layer) ────────────────────────────────────
function Board({ pieces, movable, onSelectPiece }:{
  pieces:GamePiece[]; movable:PieceId[]; onSelectPiece:(id:PieceId)=>void;
}) {
  // Build cell map for stacking offsets (exclude home base and finished)
  const cellMap = new Map<string,GamePiece[]>();
  pieces.forEach(p=>{
    if(p.pos===-1||p.pos===57) return;
    const [r,c]=getPieceCoord(p);
    const k=`${r},${c}`;
    cellMap.set(k,[...(cellMap.get(k)||[]),p]);
  });

  // Finished pieces rendered in center triangles
  const blueFinished  = pieces.filter(p=>p.pos===57&&p.player==="blue");
  const greenFinished = pieces.filter(p=>p.pos===57&&p.player==="green");

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
          <Pawn color={color} size={sz}/>
        </div>
      );
    });
  }

  return (
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1",
      borderRadius:8, overflow:"visible",
      boxShadow:"0 12px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)",
    }}>
      <BoardSVG pieces={pieces}/>

      {pieces.map(p=>{
        const selectable = movable.includes(p.id);
        const color: PawnColor = p.player==="blue" ? "blue" : "green";

        // Finished pieces rendered separately below
        if(p.pos===57) return null;

        // Home pieces: render at SVG slot coordinates
        if(p.pos===-1){
          const slotIdx = +p.id[1];
          const [svgX,svgY] = HOME_SVG_PX[p.player][slotIdx];
          return (
            <div key={p.id}
              onClick={selectable?()=>onSelectPiece(p.id):undefined}
              style={{
                position:"absolute",
                width:PIECE_BOX, height:PIECE_BOX,
                left:`${svgX/SZ*100}%`,
                top:`${svgY/SZ*100}%`,
                transform:"translate(-50%,-50%)",
                zIndex:selectable?20:5,
                cursor:selectable?"pointer":"default",
              }}>
              {selectable && <SelectionRing color={color}/>}
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                zIndex:2,
              }}>
                <Pawn color={color} size={PAWN_SIZE} glow={selectable}/>
              </div>
            </div>
          );
        }

        // Track / stretch pieces: centered exactly on cell
        const [r,c]=getPieceCoord(p);
        const here=cellMap.get(`${r},${c}`) || [];
        const idx=here.findIndex(x=>x.id===p.id);
        const OFFSETS:[number,number][] = [[0,0],[-5,-4],[5,-4],[-5,4],[5,4]];
        const [offX,offY]=here.length>1?(OFFSETS[idx]??[0,0]):[0,0];

        return (
          <div key={p.id}
            onClick={selectable?()=>onSelectPiece(p.id):undefined}
            style={{
              position:"absolute",
              width:PIECE_BOX, height:PIECE_BOX,
              left:`${(c+0.5)/15*100}%`,
              top:`${(r+0.5)/15*100}%`,
              transform:`translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px))`,
              zIndex:selectable?20:10,
              cursor:selectable?"pointer":"default",
            }}>
            {selectable && <SelectionRing color={color}/>}
            <div style={{
              position:"absolute", inset:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:2,
            }}>
              <Pawn color={color} size={PAWN_SIZE} glow={selectable}/>
            </div>
          </div>
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
    if(!rolling){ if(value!==null) setDisp(value); return; }
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
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3}/>
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

// ─── Premium Player Panel ──────────────────────────────────────────────────────
function PlayerPanel({ player, name, balance, isActive, diceValue, rolling, onRoll,
  finished, lives, timeLeft, isHuman }:{
  player:Player; name:string; balance:string; isActive:boolean; diceValue:number|null;
  rolling:boolean; onRoll:()=>void; finished:number; lives:number; timeLeft:number; isHuman:boolean;
}) {
  const color:PawnColor = player==="blue"?"blue":"green";
  const p = PAWN_PAL[color];
  const accentColor = player==="blue" ? "#4F8EF7" : "#34D469";
  const cardBg = player==="blue"
    ? "linear-gradient(135deg,#0D1B3E 0%,#111F45 100%)"
    : "linear-gradient(135deg,#0A2318 0%,#0F2E1E 100%)";
  const borderColor = isActive ? accentColor+"88" : "rgba(255,255,255,0.09)";

  return (
    <div style={{
      display:"flex", alignItems:"center",
      background: cardBg,
      borderRadius:14,
      border:`1.5px solid ${borderColor}`,
      overflow:"hidden",
      boxShadow: isActive
        ? `0 0 0 1px ${accentColor}33, 0 6px 24px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)`
        : "0 2px 10px rgba(0,0,0,0.4)",
      transition:"all 0.3s",
      opacity: isActive ? 1 : 0.7,
      gap:0,
    }}>
      {/* Left accent bar */}
      <div style={{
        width:3, alignSelf:"stretch", flexShrink:0,
        background: isActive
          ? `linear-gradient(180deg,${accentColor},${accentColor}88)`
          : "rgba(255,255,255,0.08)",
        transition:"background 0.3s",
      }}/>

      {/* Avatar */}
      <div style={{ padding:"10px 8px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <div style={{
          width:40, height:40, borderRadius:11, flexShrink:0,
          background:`linear-gradient(145deg,${p.m}1A,${p.d}33)`,
          border:`1.5px solid ${isActive ? p.m+"66" : "rgba(255,255,255,0.1)"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow: isActive ? `0 0 12px ${p.m}33` : "none",
          transition:"all 0.3s",
        }}>
          <Pawn color={color} size={22}/>
        </div>
      </div>

      {/* Info */}
      <div style={{ flex:1, padding:"9px 0", minWidth:0 }}>
        {/* Name + badge */}
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
          <span style={{
            fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13,
            color: isActive ? "#F0F4FF" : "rgba(255,255,255,0.45)",
            lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            maxWidth:88, transition:"color 0.3s", letterSpacing:0.2,
          }}>{name}</span>
          <span style={{
            fontSize:7.5, fontWeight:800, letterSpacing:1, textTransform:"uppercase",
            color: isHuman ? accentColor : "rgba(255,255,255,0.25)",
            background: isHuman ? `${accentColor}18` : "rgba(255,255,255,0.05)",
            border:`1px solid ${isHuman ? accentColor+"40" : "rgba(255,255,255,0.08)"}`,
            borderRadius:4, padding:"2px 5px", flexShrink:0,
          }}>{isHuman?"Tu":"IA"}</span>
        </div>

        {/* Balance */}
        <div style={{ marginBottom:5 }}>
          <span style={{
            fontSize:11.5, fontWeight:700,
            color: isActive ? accentColor : "rgba(255,255,255,0.25)",
            fontFamily:"'Syne',sans-serif",
            transition:"color 0.3s",
          }}>{balance}</span>
        </div>

        {/* Lives + pieces done */}
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ display:"flex", gap:2.5 }}>
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{
                width:5.5, height:5.5, borderRadius:"50%",
                background: i<lives ? "#F05555" : "rgba(255,255,255,0.1)",
                boxShadow: i<lives ? "0 0 4px #F0555577" : "none",
                transition:"all 0.3s",
              }}/>
            ))}
          </div>
          <div style={{ width:1, height:9, background:"rgba(255,255,255,0.1)" }}/>
          <div style={{ display:"flex", gap:2.5 }}>
            {Array.from({length:4}).map((_,i)=>(
              <motion.div key={i}
                animate={{ scale: i===finished-1 ? [1,1.5,1] : 1 }}
                transition={{ duration:0.3 }}
                style={{
                  width:5.5, height:5.5, borderRadius:"50%",
                  background: i<finished ? accentColor : "rgba(255,255,255,0.1)",
                  boxShadow: i<finished ? `0 0 5px ${accentColor}88` : "none",
                  transition:"background 0.3s, box-shadow 0.3s",
                }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Timer + Dice */}
      <div style={{
        padding:"8px 10px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:4,
        flexShrink:0,
      }}>
        {isHuman && isActive
          ? <TimerArc timeLeft={timeLeft} size={26}/>
          : <div style={{ height:26 }}/>
        }
        <div style={{
          background:"rgba(0,0,0,0.45)",
          borderRadius:10, padding:"4px",
          border:`1.5px solid ${isActive ? accentColor+"40" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isActive ? `0 0 10px ${accentColor}20` : "none",
        }}>
          <Dice3D value={diceValue} rolling={rolling} onClick={onRoll} active={isActive} sz={40}/>
        </div>
      </div>
    </div>
  );
}

// ─── Win Screen — premium, fitness-app inspired, shows MT won ─────────────────
function WinScreen({ winner, winnerName, loserName, betAmount, onReplay, onQuit }:{
  winner:Player; winnerName:string; loserName:string; betAmount:number;
  onReplay:()=>void; onQuit:()=>void;
}) {
  const color:PawnColor = winner==="blue"?"blue":"green";
  const p = PAWN_PAL[color];
  const headerBg = winner==="blue"
    ? "linear-gradient(145deg,#1D4ED8,#1E40AF)"
    : "linear-gradient(145deg,#16A34A,#15803D)";
  const accentLight = winner==="blue" ? "#60A5FA" : "#4ADE80";

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{
        position:"fixed", inset:0, zIndex:100,
        background:"rgba(0,0,0,0.85)",
        backdropFilter:"blur(14px)",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
      {/* Ambient glow */}
      <motion.div
        animate={{ scale:[1,1.2,1], opacity:[0.12,0.22,0.12] }}
        transition={{ duration:3, repeat:Infinity }}
        style={{
          position:"absolute", width:380, height:380, borderRadius:"50%",
          background:`radial-gradient(circle, ${p.m}55 0%, transparent 70%)`,
          pointerEvents:"none",
        }}/>

      <motion.div
        initial={{scale:0.55,opacity:0,y:40}}
        animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22,delay:0.08}}
        style={{
          borderRadius:26, maxWidth:310, width:"88%",
          overflow:"hidden",
          boxShadow:`0 32px 80px rgba(0,0,0,0.75), 0 0 60px ${p.m}22`,
          border:"1px solid rgba(255,255,255,0.08)",
        }}>

        {/* Top header — player color gradient */}
        <div style={{
          background:headerBg, padding:"28px 24px 22px",
          textAlign:"center", position:"relative",
        }}>
          {/* Shine line */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:1,
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)",
          }}/>
          <motion.div
            animate={{ y:[0,-5,0] }}
            transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}
            style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <TrophySVG size={76}/>
          </motion.div>
          <p style={{
            fontSize:10, fontWeight:800, letterSpacing:3, textTransform:"uppercase",
            color:"rgba(255,255,255,0.65)", marginBottom:6,
          }}>VENCEDOR</p>
          <p style={{
            fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:26,
            color:"#fff", lineHeight:1.1, letterSpacing:0.3,
          }}>{winnerName}</p>
        </div>

        {/* Body — white/light content section */}
        <div style={{
          background:"rgba(255,255,255,0.04)",
          borderTop:"1px solid rgba(255,255,255,0.08)",
          padding:"20px 24px 22px",
        }}>

          {/* MT won — only shown if bet was placed */}
          {betAmount > 0 && (
            <div style={{
              background:`linear-gradient(135deg, ${p.m}18 0%, ${p.m}08 100%)`,
              border:`1px solid ${p.m}33`,
              borderRadius:14, padding:"14px 16px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:16,
            }}>
              <div>
                <p style={{
                  fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase",
                  color:"rgba(255,255,255,0.4)", marginBottom:4,
                }}>GANHOS</p>
                <p style={{
                  fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:24,
                  color:"#FFD700", lineHeight:1,
                }}>
                  {betAmount.toLocaleString("pt-MZ")} <span style={{fontSize:13}}>MT</span>
                </p>
              </div>
              <div style={{
                width:44, height:44, borderRadius:12,
                background:"rgba(255,215,0,0.12)", border:"1px solid rgba(255,215,0,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#FFD700" strokeWidth="1.5"/>
                  <path d="M12 6v6l4 2" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}

          {/* Loser line */}
          <p style={{
            fontSize:12, color:"rgba(255,255,255,0.4)", textAlign:"center",
            marginBottom:18,
          }}>
            <span style={{color:"rgba(255,255,255,0.65)", fontWeight:600}}>{loserName}</span> foi eliminado
          </p>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onReplay} style={{
              flex:1,
              background:`linear-gradient(135deg,${p.m},${p.d})`,
              color:"#fff", borderRadius:14, padding:"14px 0", border:"none",
              fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              boxShadow:`0 4px 16px ${p.m}44`,
            }}>
              <RotateCcw style={{width:14,height:14}}/>
              Jogar Novamente
            </button>
            <button onClick={onQuit} style={{
              flex:1,
              background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.12)",
              color:"rgba(255,255,255,0.65)", borderRadius:14, padding:"14px 0",
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

// ─── Scripted first rolls ───────────────────────────────────────────────────────
const SCRIPTED=[6,5,2,2,6,5];

// ─── Main Game Component ────────────────────────────────────────────────────────
export default function LudoGame() {
  const [,setLocation] = useLocation();
  const { profile } = useAuth();

  const playerName = profile?.full_name ?? "Jogador Azul";
  const playerBal  = profile?.balance
    ? `${Number(profile.balance).toLocaleString("pt-MZ")} MT`
    : "0 MT";
  const opponentName = "Rival Verde";
  const opponentBal  = "843 MT";
  const BET_AMOUNT   = 100; // MT — fixed demo bet per game

  const initialPieces=():GamePiece[]=>([
    {id:"B0",player:"blue",pos:-1},{id:"B1",player:"blue",pos:-1},
    {id:"B2",player:"blue",pos:-1},{id:"B3",player:"blue",pos:-1},
    {id:"G0",player:"green",pos:-1},{id:"G1",player:"green",pos:-1},
    {id:"G2",player:"green",pos:-1},{id:"G3",player:"green",pos:-1},
  ]);

  const [pieces,setPieces]         = useState<GamePiece[]>(initialPieces);
  const [turn,setTurn]             = useState<Player>("blue");
  const [phase,setPhase]           = useState<Phase>("roll");
  const [diceBlue,setDiceBlue]     = useState<number|null>(null);
  const [diceGreen,setDiceGreen]   = useState<number|null>(null);
  const [rollingBlue,setRollingB]  = useState(false);
  const [rollingGreen,setRollingG] = useState(false);
  const [movable,setMovable]       = useState<PieceId[]>([]);
  const [winner,setWinner]         = useState<Player|null>(null);
  const [msg,setMsg]               = useState(`${playerName.split(" ")[0]} — clica nos dados!`);
  const [lives,setLives]           = useState({blue:5,green:5});
  const [timeLeft,setTimeLeft]     = useState(30);

  const scriptIdx   = useRef(0);
  const piecesRef   = useRef(pieces);
  const phaseRef    = useRef(phase);
  const movableRef  = useRef(movable);
  const diceBlueRef = useRef(diceBlue);

  useEffect(()=>{piecesRef.current=pieces;},[pieces]);
  useEffect(()=>{phaseRef.current=phase;},[phase]);
  useEffect(()=>{movableRef.current=movable;},[movable]);
  useEffect(()=>{diceBlueRef.current=diceBlue;},[diceBlue]);

  const other=(p:Player):Player=>p==="blue"?"green":"blue";

  function rollDice():number {
    const idx=scriptIdx.current++;
    return idx<SCRIPTED.length?SCRIPTED[idx]:Math.floor(Math.random()*6)+1;
  }

  function calcMovable(ps:GamePiece[],pl:Player,d:number):PieceId[] {
    return ps.filter(p=>p.player===pl).filter(p=>{
      if(p.pos===57) return false;
      if(p.pos===-1) return d===6;
      return p.pos+d<=57;
    }).map(p=>p.id) as PieceId[];
  }

  function finishedCount(ps:GamePiece[],pl:Player):number {
    return ps.filter(p=>p.player===pl&&p.pos===57).length;
  }

  function movePieceSteps(id:PieceId,curPos:number,steps:number,isExit:boolean,onDone:()=>void){
    if(isExit){
      setPieces(prev=>prev.map(p=>p.id===id?{...p,pos:0}:p));
      setTimeout(onDone,280); return;
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
        // Only capture if defender is NOT on a safe/star square
        if(pr===mr&&pc===mc && !SAFE_COORDS.has(`${pr},${pc}`)){
          captured = true;
          setMsg(`${mover.player==="blue"?playerName.split(" ")[0]:opponentName} capturou uma peça! +1 jogada`);
          let pos=p.pos;
          function stepBack(){
            setPieces(prev=>prev.map(x=>x.id!==p.id?x:{...x,pos:Math.max(-1,pos)}));
            if(pos>-1){pos--;setTimeout(stepBack,70);}
          }
          stepBack();
        }
      });
    return captured;
  }

  function handleMoveComplete(pieceId:PieceId,diceVal:number,currentTurn:Player,prevPos:number){
    setPhase("moving");
    const ps=piecesRef.current;
    const mover=ps.find(p=>p.id===pieceId)!;
    const captured = captureAtPos(mover);
    if(finishedCount(piecesRef.current,currentTurn)===4){
      setWinner(currentTurn); setPhase("done"); return;
    }
    // Extra turn: rolled 6, captured opponent, or reached home centre (pos 57)
    const enteredHome = mover.pos===57 && prevPos<57;
    const extraTurn = diceVal===6 || captured || enteredHome;
    if(extraTurn){
      const reason = diceVal===6 ? "tirou 6" : captured ? "capturou uma peça" : "chegou ao centro!";
      setMsg(`${currentTurn==="blue"?playerName.split(" ")[0]:opponentName} ${reason} — joga de novo!`);
      setMovable([]);
      setTimeout(()=>{setPhase("roll");if(currentTurn==="blue")setDiceBlue(null);else setDiceGreen(null);},400);
    } else {
      const next=other(currentTurn);
      setMovable([]);
      setTimeout(()=>{
        setTurn(next); setPhase("roll");
        if(next==="blue"){setDiceBlue(null);setMsg(`${playerName.split(" ")[0]} — clica nos dados!`);}
        else{setDiceGreen(null);setMsg(`${opponentName} — a pensar…`);}
      },500);
    }
  }

  const doSelectPiece=useCallback((pid:PieceId,diceVal:number,pl:Player,ps:GamePiece[])=>{
    setMovable([]); setPhase("moving");
    const piece=ps.find(p=>p.id===pid)!;
    const isExit=piece.pos===-1;
    const prevPos=piece.pos;
    if(isExit){
      setMsg(`${pl==="blue"?playerName.split(" ")[0]:opponentName} coloca peça no tabuleiro!`);
      movePieceSteps(pid,-1,1,true,()=>handleMoveComplete(pid,diceVal,pl,0));
    } else {
      setMsg(`${pl==="blue"?playerName.split(" ")[0]:opponentName} move ${diceVal} ${diceVal===1?"casa":"casas"}!`);
      movePieceSteps(pid,piece.pos,diceVal,false,()=>handleMoveComplete(pid,diceVal,pl,prevPos));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playerName,opponentName]);

  const doRoll=useCallback((pl:Player)=>{
    if(phaseRef.current!=="roll"||turn!==pl) return;
    const setR=pl==="blue"?setRollingB:setRollingG;
    const setD=pl==="blue"?setDiceBlue:setDiceGreen;
    setR(true);
    setTimeout(()=>{
      const val=rollDice();
      setD(val); setR(false);
      const mv=calcMovable(piecesRef.current,pl,val);
      if(mv.length===0){
        setMsg(val===6
          ?`${pl==="blue"?playerName.split(" ")[0]:opponentName} — 6 mas sem movimento!`
          :`${pl==="blue"?playerName.split(" ")[0]:opponentName} — ${val} sem jogadas.`);
        setTimeout(()=>{
          const next=other(pl); setTurn(next); setPhase("roll");
          if(next==="blue"){setDiceBlue(null);setMsg(`${playerName.split(" ")[0]} — clica nos dados!`);}
          else{setDiceGreen(null);setMsg(`${opponentName} — a pensar…`);}
        },1300);
      } else if(mv.length===1){
        setMsg(`${pl==="blue"?playerName.split(" ")[0]:opponentName} tirou ${val}!`);
        doSelectPiece(mv[0],val,pl,piecesRef.current);
      } else {
        setMovable(mv); setPhase("select");
        setMsg(`${pl==="blue"?playerName.split(" ")[0]:opponentName} — ${val}! Escolhe uma peça.`);
      }
    },800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,playerName,opponentName]);

  function handleSelectPiece(pid:PieceId){
    if(phase!=="select") return;
    const dv=turn==="blue"?diceBlue:diceGreen;
    if(dv===null) return;
    doSelectPiece(pid,dv,turn,piecesRef.current);
  }

  // ── Timer — runs during roll + select for human player ─────────────────────
  const autoPlayRef=useRef<(()=>void)|null>(null);
  autoPlayRef.current=()=>{
    setLives(l=>{
      const nb=l.blue-1;
      if(nb<=0){
        setWinner("green"); setPhase("done");
        setMsg(`${opponentName} venceu! ${playerName.split(" ")[0]} perdeu todas as vidas.`);
        return {...l,blue:0};
      }
      setMsg(`Tempo esgotado! ${playerName.split(" ")[0]} perde 1 vida (${nb} restante${nb===1?"":"s"}).`);
      const cur=phaseRef.current;
      const mv=movableRef.current;
      const dv=diceBlueRef.current;
      if(cur==="roll") setTimeout(()=>doRoll("blue"),200);
      else if(cur==="select"&&mv.length>0&&dv!==null)
        setTimeout(()=>doSelectPiece(mv[Math.floor(Math.random()*mv.length)],dv,"blue",piecesRef.current),200);
      return {...l,blue:nb};
    });
  };

  useEffect(()=>{
    setTimeLeft(30);
    if(winner||(phase!=="roll"&&phase!=="select")||turn!=="blue") return;
    const tick=setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){ clearInterval(tick); setTimeout(()=>autoPlayRef.current?.(),0); return 30; }
        return prev-1;
      });
    },1000);
    return()=>clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,phase,winner]);

  // ── AI: auto-play green ───────────────────────────────────────────────────
  useEffect(()=>{
    if(turn!=="green"||winner) return undefined;
    if(phase==="roll"){
      const t=setTimeout(()=>doRoll("green"),1300); return()=>clearTimeout(t);
    }
    if(phase==="select"&&movable.length>0){
      const t=setTimeout(()=>{
        const pick=movable[Math.floor(Math.random()*movable.length)];
        if(diceGreen!==null) doSelectPiece(pick,diceGreen,"green",piecesRef.current);
      },900);
      return()=>clearTimeout(t);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[turn,phase,movable,winner]);

  function resetGame(){
    setPieces(initialPieces()); setTurn("blue"); setPhase("roll");
    setDiceBlue(null); setDiceGreen(null); setRollingB(false); setRollingG(false);
    setMovable([]); setWinner(null); setLives({blue:5,green:5}); setTimeLeft(30);
    scriptIdx.current=0;
    setMsg(`${playerName.split(" ")[0]} — clica nos dados!`);
  }

  const blueFinished  = finishedCount(pieces,"blue");
  const greenFinished = finishedCount(pieces,"green");

  return (
    <div style={{
      height:"100vh", width:"100%", overflow:"hidden",
      backgroundImage:`url(${bgImg})`,
      backgroundSize:"320px auto",
      backgroundRepeat:"repeat",
      display:"flex", justifyContent:"center",
    }}>
      {/* Dark overlay */}
      <div style={{
        position:"fixed", inset:0,
        background:"rgba(4,10,28,0.82)",
        pointerEvents:"none", zIndex:0,
      }}/>

      <div style={{
        width:"100%", maxWidth:430,
        height:"100vh", overflow:"hidden",
        display:"flex", flexDirection:"column",
        position:"relative", zIndex:1,
      }}>

        {/* ── Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 14px 8px",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(5,12,32,0.85)",
          flexShrink:0,
        }}>
          <button onClick={()=>setLocation("/")} style={{
            width:34, height:34, borderRadius:9,
            background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.12)",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}>
            <ArrowLeft style={{width:16,height:16,color:"#9BB4E8"}}/>
          </button>
          <div style={{ textAlign:"center" }}>
            <p style={{
              fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:17,
              color:"#E8F0FF", lineHeight:1, letterSpacing:5,
              textShadow:"0 0 20px rgba(99,179,255,0.45)",
            }}>LUDO</p>
            <p style={{ fontSize:9, color:"rgba(255,255,255,0.28)", marginTop:1, letterSpacing:2.5, fontWeight:700 }}>
              1 VS 1
            </p>
          </div>
          <div style={{
            padding:"4px 10px",
            background:"linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,215,0,0.06))",
            border:"1px solid rgba(255,215,0,0.22)",
            borderRadius:8,
          }}>
            <span style={{ fontSize:10, color:"#FFD700", fontWeight:700, fontFamily:"'Syne',sans-serif" }}>
              {BET_AMOUNT} MT
            </span>
          </div>
        </div>

        {/* ── Green panel (AI — top) */}
        <div style={{ padding:"7px 12px 4px", flexShrink:0 }}>
          <PlayerPanel
            player="green" name={opponentName} balance={opponentBal}
            isActive={turn==="green"&&!winner}
            diceValue={diceGreen} rolling={rollingGreen}
            onRoll={()=>doRoll("green")}
            finished={greenFinished} lives={lives.green}
            timeLeft={30} isHuman={false}
          />
        </div>

        {/* ── Status message */}
        <div style={{ padding:"3px 12px 3px", flexShrink:0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={msg}
              initial={{opacity:0,y:-3}} animate={{opacity:1,y:0}} exit={{opacity:0,y:3}}
              style={{
                background:"rgba(6,14,38,0.75)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:9, padding:"5px 12px",
                textAlign:"center",
              }}>
              <p style={{
                fontSize:11, fontWeight:600,
                color:"rgba(220,230,255,0.7)", letterSpacing:0.2,
              }}>{msg}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Board — takes remaining space, stays square */}
        <div style={{
          flex:1, minHeight:0,
          padding:"0 10px",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{ width:"100%", maxHeight:"100%", aspectRatio:"1" }}>
            <Board pieces={pieces} movable={movable} onSelectPiece={handleSelectPiece}/>
          </div>
        </div>

        {/* ── Turn indicator pill */}
        <div style={{ padding:"3px 12px 2px", display:"flex", justifyContent:"center", flexShrink:0 }}>
          <motion.div
            animate={{ opacity:[0.65,1,0.65] }}
            transition={{ duration:1.8, repeat:Infinity }}
            style={{
              display:"flex", alignItems:"center", gap:5,
              background:"rgba(5,12,32,0.7)",
              border:"1px solid rgba(255,255,255,0.09)",
              borderRadius:20, padding:"4px 12px",
            }}>
            <div style={{
              width:5, height:5, borderRadius:"50%",
              background: turn==="blue" ? "#4F8EF7" : "#34D469",
              boxShadow: turn==="blue" ? "0 0 5px #4F8EF7" : "0 0 5px #34D469",
            }}/>
            <span style={{
              fontSize:9.5, fontWeight:700, letterSpacing:1, textTransform:"uppercase",
              color: turn==="blue" ? "#4F8EF7" : "#34D469",
            }}>
              Vez de {turn==="blue" ? playerName.split(" ")[0] : opponentName}
            </span>
          </motion.div>
        </div>

        {/* ── Blue panel (human — bottom) */}
        <div style={{ padding:"2px 12px 8px", flexShrink:0 }}>
          <PlayerPanel
            player="blue" name={playerName} balance={playerBal}
            isActive={turn==="blue"&&!winner}
            diceValue={diceBlue} rolling={rollingBlue}
            onRoll={()=>doRoll("blue")}
            finished={blueFinished} lives={lives.blue}
            timeLeft={timeLeft} isHuman={true}
          />
        </div>

      </div>

      {/* ── Win overlay */}
      <AnimatePresence>
        {winner && (
          <WinScreen
            winner={winner}
            winnerName={winner==="blue"?playerName:opponentName}
            loserName={winner==="blue"?opponentName:playerName}
            betAmount={BET_AMOUNT}
            onReplay={resetGame}
            onQuit={()=>setLocation("/")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
