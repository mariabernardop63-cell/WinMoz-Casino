import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy } from "lucide-react";

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
const BLUE_STRETCH:  [number,number][] = [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]];
const GREEN_STRETCH: [number,number][] = [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]];
const PLAYER_START: Record<Player,number> = { blue:0, green:26 };
const HOME_SLOTS: Record<Player,[number,number][]> = {
  blue:  [[10,1],[10,3],[12,1],[12,3]],
  green: [[2,10],[2,12],[4,10],[4,12]],
};
const RED_SLOTS:    [number,number][] = [[2,1],[2,3],[4,1],[4,3]];
const YELLOW_SLOTS: [number,number][] = [[10,10],[10,12],[12,10],[12,12]];
const SAFE_IDX = [0,9,13,18,26,35,39,44];
const SAFE_COORDS = new Set(SAFE_IDX.map(i=>`${TRACK[i][0]},${TRACK[i][1]}`));

function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1) return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 51)  return TRACK[(PLAYER_START[p.player]+p.pos)%52];
  if (p.pos <= 57)  return (p.player==="blue"?BLUE_STRETCH:GREEN_STRETCH)[p.pos-52];
  return [7,7];
}

// ─── Cell background ──────────────────────────────────────────────────────────
function cellBg(r:number,c:number):string {
  if (c===7&&r>=8&&r<=13) return "#93c5fd";
  if (c===7&&r>=1&&r<=6)  return "#86efac";
  if (r===7&&c>=1&&c<=6)  return "#fca5a5";
  if (r===7&&c>=8&&c<=13) return "#fde047";
  if (r>=9&&c<=5) { if(r>=10&&r<=13&&c>=1&&c<=4) return "#dbeafe"; return "#2563eb"; }
  if (r<=5&&c>=9) { if(r>=1&&r<=4&&c>=10&&c<=13) return "#dcfce7"; return "#16a34a"; }
  if (r<=5&&c<=5) { if(r>=1&&r<=4&&c>=1&&c<=4)   return "#fee2e2"; return "#dc2626"; }
  if (r>=9&&c>=9) { if(r>=10&&r<=13&&c>=10&&c<=13)return "#fef9c3"; return "#ca8a04"; }
  if (r>=6&&r<=8&&c>=6&&c<=8) {
    if(r===7&&c===7) return "transparent";
    if(r===8&&c===7) return "#93c5fd";
    if(r===6&&c===7) return "#86efac";
    if(r===7&&c===6) return "#fca5a5";
    if(r===7&&c===8) return "#fde047";
    return "#f1f5f9";
  }
  return "#ffffff";
}

const BOARD_BG = Array.from({length:15},(_,r)=>Array.from({length:15},(_,c)=>cellBg(r,c)));

// ─── Is a home circle slot ────────────────────────────────────────────────────
function isHomeCircle(r:number,c:number): string|null {
  if(r>=1&&r<=4&&c>=1&&c<=4) return "red";
  if(r>=1&&r<=4&&c>=10&&c<=13) return "green";
  if(r>=10&&r<=13&&c>=1&&c<=4) return "blue";
  if(r>=10&&r<=13&&c>=10&&c<=13) return "yellow";
  return null;
}

// ─── Center triangle SVG ──────────────────────────────────────────────────────
function CenterStar() {
  return (
    <svg viewBox="0 0 3 3" width="100%" height="100%" style={{display:"block"}}>
      {/* 4 triangles */}
      <polygon points="0,0 3,0 1.5,1.5" fill="#fca5a5" opacity="0.9"/>
      <polygon points="3,0 3,3 1.5,1.5" fill="#fde047" opacity="0.9"/>
      <polygon points="3,3 0,3 1.5,1.5" fill="#93c5fd" opacity="0.9"/>
      <polygon points="0,3 0,0 1.5,1.5" fill="#86efac" opacity="0.9"/>
      {/* border lines */}
      <line x1="0" y1="0" x2="1.5" y2="1.5" stroke="white" strokeWidth="0.06" opacity="0.6"/>
      <line x1="3" y1="0" x2="1.5" y2="1.5" stroke="white" strokeWidth="0.06" opacity="0.6"/>
      <line x1="3" y1="3" x2="1.5" y2="1.5" stroke="white" strokeWidth="0.06" opacity="0.6"/>
      <line x1="0" y1="3" x2="1.5" y2="1.5" stroke="white" strokeWidth="0.06" opacity="0.6"/>
      {/* center circle */}
      <circle cx="1.5" cy="1.5" r="0.45" fill="white" opacity="0.9"/>
      <circle cx="1.5" cy="1.5" r="0.3" fill="#f8fafc"/>
    </svg>
  );
}

// ─── Dice Dots (red on ivory) ─────────────────────────────────────────────────
const DOT_POSITIONS: Record<number, [number,number][]> = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
};

function DiceFace({ value, sz }: { value: number; sz: number }) {
  const dots = DOT_POSITIONS[value] || [];
  const dotR = sz * 0.095;
  return (
    <svg viewBox="0 0 100 100" width={sz} height={sz} style={{display:"block"}}>
      {dots.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={dotR*100/sz} fill="#C0140C"
          filter="url(#ds)"/>
      ))}
      <defs>
        <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
      </defs>
    </svg>
  );
}

// ─── 3D Ivory Dice ────────────────────────────────────────────────────────────
function Dice3D({value,rolling,onClick,active,sz=58}:{
  value:number|null; rolling:boolean; onClick:()=>void; active:boolean; sz?:number;
}) {
  const h = sz/2;
  const [rollKey, setRollKey] = useState(0);
  const [disp, setDisp] = useState(1);

  const targetFaceRot: Record<number,{rx:number,ry:number}> = {
    1:{rx:0,ry:0}, 2:{rx:-90,ry:0}, 3:{rx:0,ry:-90},
    4:{rx:0,ry:90}, 5:{rx:90,ry:0}, 6:{rx:0,ry:180}
  };

  useEffect(()=>{
    if(!rolling){ if(value!==null) setDisp(value); return; }
    setRollKey(k=>k+1);
    let n=0;
    const iv=setInterval(()=>{ setDisp(Math.floor(Math.random()*6)+1); n++; if(n>12) clearInterval(iv); },50);
    return ()=>clearInterval(iv);
  },[rolling,value]);

  const tr = targetFaceRot[disp]||{rx:0,ry:0};

  // face: [value, transform, shade]
  const faces: [number, string, string][] = [
    [1, `translateZ(${h}px)`,                "#FFFEF2"],
    [6, `rotateY(180deg) translateZ(${h}px)`, "#F5F0E0"],
    [2, `rotateX(90deg) translateZ(${h}px)`,  "#FAF7E8"],
    [5, `rotateX(-90deg) translateZ(${h}px)`, "#F0EBD8"],
    [3, `rotateY(90deg) translateZ(${h}px)`,  "#F7F3E5"],
    [4, `rotateY(-90deg) translateZ(${h}px)`, "#F2EDE0"],
  ];

  const r = sz * 0.16;

  return (
    <div
      onClick={active&&!rolling ? onClick : undefined}
      style={{
        perspective: "280px", width:sz, height:sz,
        cursor: active&&!rolling ? "pointer" : "default",
        filter: active ? "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" : "drop-shadow(0 2px 5px rgba(0,0,0,0.3))",
      }}
    >
      <motion.div
        key={rollKey}
        animate={rolling
          ? {rotateX:[0,-180,-360,tr.rx+360], rotateY:[0,180,360,tr.ry+360]}
          : {rotateX:tr.rx, rotateY:tr.ry}}
        transition={rolling ? {duration:0.75,ease:"easeOut"} : {duration:0.15}}
        style={{width:sz, height:sz, transformStyle:"preserve-3d", position:"relative"}}
      >
        {faces.map(([v,t,bg])=>(
          <div key={v} style={{
            position:"absolute", inset:0,
            background: `radial-gradient(circle at 32% 28%, #FFFFF8, ${bg})`,
            borderRadius: r,
            border: "1px solid rgba(160,140,100,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            backfaceVisibility:"hidden",
            transform: t,
            boxShadow: "inset 1px 1px 3px rgba(255,255,255,0.9), inset -1px -1px 3px rgba(0,0,0,0.12)",
          }}>
            <DiceFace value={v} sz={sz*0.8}/>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── 3D Pawn ──────────────────────────────────────────────────────────────────
const PAWN_COLORS: Record<Player,{fill:string;mid:string;dark:string;shine:string}> = {
  blue:  {fill:"#4f9ef8", mid:"#2563eb", dark:"#1d4ed8", shine:"#93c5fd"},
  green: {fill:"#4ade80", mid:"#16a34a", dark:"#166534", shine:"#86efac"},
};

function Pawn({player,size=20,vibrate=false,glow=false}:{
  player:Player; size?:number; vibrate?:boolean; glow?:boolean;
}) {
  const {fill,mid,dark,shine} = PAWN_COLORS[player];
  const id = `pg_${player}_${size}`;
  return (
    <motion.div
      animate={vibrate ? {y:[0,-2.5,0,-2.5,0]} : {y:0}}
      transition={vibrate ? {duration:0.5,repeat:Infinity,ease:"easeInOut"} : {}}
      style={{
        filter: glow ? `drop-shadow(0 0 6px ${fill}) drop-shadow(0 0 2px ${fill})` : "drop-shadow(0 2px 2px rgba(0,0,0,0.5))",
        display:"flex", flexShrink:0,
      }}
    >
      <svg viewBox="0 0 28 38" width={size} height={Math.round(size*38/28)}>
        <defs>
          <radialGradient id={`hg_${id}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor={shine}/>
            <stop offset="60%" stopColor={fill}/>
            <stop offset="100%" stopColor={mid}/>
          </radialGradient>
          <radialGradient id={`bg_${id}`} cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor={fill}/>
            <stop offset="100%" stopColor={dark}/>
          </radialGradient>
          <radialGradient id={`sg_${id}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={mid}/>
            <stop offset="100%" stopColor={dark}/>
          </radialGradient>
        </defs>
        {/* Shadow */}
        <ellipse cx="14" cy="36.5" rx="8" ry="2.2" fill="rgba(0,0,0,0.28)"/>
        {/* Base */}
        <ellipse cx="14" cy="33" rx="8.5" ry="3.2" fill={`url(#sg_${id})`}/>
        <ellipse cx="14" cy="33" rx="8.5" ry="3.2" fill="none" stroke={dark} strokeWidth="0.7" opacity="0.6"/>
        {/* Skirt */}
        <path d="M5.5 30 Q6 26 10 24.5 Q14 23.5 18 24.5 Q22 26 22.5 30 Q18 32.5 10 32.5 Z"
          fill={`url(#bg_${id})`} stroke={dark} strokeWidth="0.6" opacity="0.9"/>
        {/* Stem */}
        <rect x="11" y="16" width="6" height="10" rx="2.5"
          fill={`url(#bg_${id})`} stroke={dark} strokeWidth="0.6"/>
        {/* Collar */}
        <ellipse cx="14" cy="17" rx="5.5" ry="2" fill={mid} stroke={dark} strokeWidth="0.5"/>
        {/* Head */}
        <circle cx="14" cy="10" r="8.5" fill={`url(#hg_${id})`} stroke={dark} strokeWidth="0.8"/>
        {/* Head shine */}
        <ellipse cx="11" cy="7" rx="3.5" ry="2.2" fill="white" opacity="0.35"/>
        <ellipse cx="11.5" cy="6.5" rx="1.8" ry="1.1" fill="white" opacity="0.5"/>
      </svg>
    </motion.div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────
function Board({pieces,movable,onSelectPiece}:{
  pieces:GamePiece[]; movable:PieceId[]; onSelectPiece:(id:PieceId)=>void;
}) {
  const cellMap = new Map<string,GamePiece[]>();
  pieces.forEach(p=>{
    const [r,c]=getPieceCoord(p);
    cellMap.set(`${r},${c}`,[...(cellMap.get(`${r},${c}`)||[]),p]);
  });

  const safeCoordSet = SAFE_COORDS;

  // Home slot coords per player
  const blueHomeSet = new Set(HOME_SLOTS.blue.map(([r,c])=>`${r},${c}`));
  const greenHomeSet = new Set(HOME_SLOTS.green.map(([r,c])=>`${r},${c}`));
  const redSet = new Set(RED_SLOTS.map(([r,c])=>`${r},${c}`));
  const yellowSet = new Set(YELLOW_SLOTS.map(([r,c])=>`${r},${c}`));

  return (
    <div style={{
      display:"grid", gridTemplateColumns:"repeat(15,1fr)", gridTemplateRows:"repeat(15,1fr)",
      width:"100%", aspectRatio:"1",
      border:"3px solid #1e3a5f",
      borderRadius:8, overflow:"hidden",
      boxShadow:"0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
    }}>
      {Array.from({length:225},(_,i)=>{
        const r=Math.floor(i/15), c=i%15;
        const k=`${r},${c}`;
        const bg=BOARD_BG[r][c];
        const here=(cellMap.get(k)||[]);
        const isCenter=r===7&&c===7;
        const isSafe = safeCoordSet.has(k);
        const isHomeCircle_ = isHomeCircle(r,c);
        const isBlueHome = blueHomeSet.has(k);
        const isGreenHome = greenHomeSet.has(k);
        const isRedDeco = redSet.has(k);
        const isYellowDeco = yellowSet.has(k);

        let circleColor: string|null = null;
        if (isBlueHome)   circleColor = "#1d4ed8";
        else if (isGreenHome)  circleColor = "#15803d";
        else if (isRedDeco)    circleColor = "#b91c1c";
        else if (isYellowDeco) circleColor = "#a16207";

        return (
          <div key={i} style={{
            background: isCenter ? "transparent" : bg,
            border: "0.5px solid rgba(0,0,0,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            position:"relative", overflow:"visible",
          }}>
            {/* Center triangles */}
            {isCenter && <CenterStar/>}

            {/* Home circle slots */}
            {circleColor && here.length===0 && (
              <div style={{
                width:"72%", height:"72%", borderRadius:"50%",
                border: `2.5px solid ${circleColor}`,
                background: `${circleColor}18`,
                boxShadow: `inset 0 1px 3px rgba(0,0,0,0.15)`,
              }}/>
            )}

            {/* Safe square star */}
            {isSafe && here.length===0 && !isHomeCircle_ && (
              <div style={{
                width:"62%", height:"62%",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg viewBox="0 0 24 24" width="100%" height="100%">
                  <polygon points="12,2 14.9,9.3 22.5,9.3 16.5,14 18.8,21.3 12,17 5.2,21.3 7.5,14 1.5,9.3 9.1,9.3"
                    fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </div>
            )}

            {/* Arrow in home stretch cells pointing toward center */}
            {c===7&&r>=8&&r<=12&&here.length===0 && (
              <div style={{
                width:"45%", height:"45%", display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg viewBox="0 0 10 10" width="100%" height="100%">
                  <polygon points="5,1 9,8 5,6.5 1,8" fill="#1d4ed8" opacity="0.35"/>
                </svg>
              </div>
            )}
            {c===7&&r>=2&&r<=6&&here.length===0 && (
              <div style={{
                width:"45%", height:"45%", display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg viewBox="0 0 10 10" width="100%" height="100%">
                  <polygon points="5,9 9,2 5,3.5 1,2" fill="#15803d" opacity="0.35"/>
                </svg>
              </div>
            )}

            {/* Pieces */}
            {here.map((p,pi)=>{
              const selectable=movable.includes(p.id);
              const offX = here.length>1 ? (pi===0?-3:3) : 0;
              const offY = here.length>1 ? (pi===0?-2:2) : 0;
              return (
                <div key={p.id}
                  style={{
                    position:"absolute",
                    transform:`translate(${offX}px,${offY}px)`,
                    zIndex:selectable?12:6,
                    cursor:selectable?"pointer":"default",
                  }}
                  onClick={selectable ? ()=>onSelectPiece(p.id) : undefined}
                >
                  <Pawn player={p.player} size={15} vibrate={selectable} glow={selectable}/>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Panel ─────────────────────────────────────────────────────────────
function PlayerPanel({player,name,isActive,diceValue,rolling,onRoll,showArrow,finished}:{
  player:Player; name:string; isActive:boolean; diceValue:number|null;
  rolling:boolean; onRoll:()=>void; showArrow:boolean; finished:number;
}) {
  const {fill,dark,shine} = PAWN_COLORS[player];
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
      background: isActive ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.03)",
      borderRadius:16,
      border: isActive ? `2px solid ${fill}55` : "2px solid transparent",
      boxShadow: isActive ? `0 0 16px ${fill}22` : "none",
      transition:"all 0.35s",
    }}>
      {/* Avatar */}
      <div style={{
        width:40, height:40, borderRadius:12,
        background:`linear-gradient(135deg, ${shine}44, ${dark}88)`,
        border:`2px solid ${fill}66`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        boxShadow:`0 2px 8px ${dark}55`,
      }}>
        <Pawn player={player} size={22}/>
      </div>
      {/* Name */}
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,
          color:isActive?"#fff":"rgba(255,255,255,0.4)",lineHeight:1}}>{name}</p>
        <div style={{display:"flex",gap:3,marginTop:4}}>
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} style={{
              width:8,height:8,borderRadius:"50%",
              background:i<finished ? fill : "rgba(255,255,255,0.12)",
              border:`1px solid ${i<finished ? dark : "rgba(255,255,255,0.08)"}`,
              boxShadow:i<finished ? `0 0 4px ${fill}` : "none",
              transition:"all 0.3s",
            }}/>
          ))}
        </div>
      </div>
      {/* Dice */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <AnimatePresence>
          {showArrow&&(
            <motion.div
              initial={{opacity:0,x:player==="blue"?8:-8}}
              animate={{opacity:1,x:0}} exit={{opacity:0}}
              style={{fontSize:16,lineHeight:1}}
            >
              {player==="blue"?"👉":"👈"}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{
          background:"rgba(0,0,0,0.25)",
          borderRadius:12,padding:6,
          border:isActive ? `1.5px solid ${fill}44` : "1.5px solid rgba(255,255,255,0.06)",
          boxShadow:isActive ? `0 0 12px ${fill}33` : "none",
        }}>
          <Dice3D value={diceValue} rolling={rolling} onClick={onRoll} active={isActive} sz={52}/>
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
  const [turn,setTurn]           = useState<Player>("blue");
  const [phase,setPhase]         = useState<Phase>("roll");
  const [diceBlue,setDiceBlue]   = useState<number|null>(null);
  const [diceGreen,setDiceGreen] = useState<number|null>(null);
  const [rollingBlue,setRollingBlue]   = useState(false);
  const [rollingGreen,setRollingGreen] = useState(false);
  const [movable,setMovable]     = useState<PieceId[]>([]);
  const [winner,setWinner]       = useState<Player|null>(null);
  const [msg,setMsg]             = useState("Jogador Azul – clica nos dados para começar!");
  const scriptIdx = useRef(0);
  const piecesRef = useRef(pieces);
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
        minHeight:"100vh", padding:"0 0 12px 0",
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
              background:"rgba(255,255,255,0.05)",
              borderRadius:10,padding:"7px 14px",textAlign:"center",
              border:"1px solid rgba(255,255,255,0.06)",
            }}>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:0.3}}>{msg}</p>
          </motion.div>
        </div>

        {/* Board */}
        <div style={{padding:"0 10px",flex:1}}>
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
        {winner&&(
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:"fixed",inset:0,
              background:"rgba(0,0,0,0.8)",
              backdropFilter:"blur(8px)",
              display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
            <motion.div
              initial={{scale:0.6,opacity:0,y:40}}
              animate={{scale:1,opacity:1,y:0}}
              transition={{type:"spring",stiffness:240,damping:18}}
              style={{
                background: winner==="blue"
                  ? "linear-gradient(135deg,#1e3a8a,#1d4ed8)"
                  : "linear-gradient(135deg,#14532d,#16a34a)",
                borderRadius:24,padding:"40px 36px",textAlign:"center",
                border:`2px solid ${winner==="blue"?"#60a5fa":"#4ade80"}`,
                boxShadow:`0 20px 60px ${winner==="blue"?"#1d4ed855":"#16a34a55"}`,
                maxWidth:300,width:"88%",
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
                  color:"#fff",borderRadius:12,padding:"13px 0",
                  fontFamily:"'Syne',sans-serif",fontWeight:700,
                  fontSize:15,cursor:"pointer",width:"100%",
                  transition:"background 0.2s",
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
