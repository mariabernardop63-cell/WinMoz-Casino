import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, Home as HomeIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Player = "blue" | "green";
type PieceId = "B0"|"B1"|"B2"|"B3"|"G0"|"G1"|"G2"|"G3";
type Phase = "roll"|"select"|"moving"|"done";

interface GamePiece { id: PieceId; player: Player; pos: number; }
// pos: -1=home, 0-51=track(relative), 52-57=stretch(0-5), 58=finished

// ─── Board Geometry ──────────────────────────────────────────────────────────
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
const SAFE_COORDS = new Set([0,9,13,18,26,35,39,44].map(i=>`${TRACK[i][0]},${TRACK[i][1]}`));

function getPieceCoord(p: GamePiece): [number,number] {
  if (p.pos === -1) return HOME_SLOTS[p.player][parseInt(p.id[1])];
  if (p.pos <= 51)  return TRACK[(PLAYER_START[p.player]+p.pos)%52];
  if (p.pos <= 57)  return (p.player==="blue"?BLUE_STRETCH:GREEN_STRETCH)[p.pos-52];
  return [7,7];
}

// ─── Cell colors ─────────────────────────────────────────────────────────────
const BOARD_BG = Array.from({length:15},(_,r)=>Array.from({length:15},(_,c)=>cellBg(r,c)));
function cellBg(r:number,c:number):string {
  // Stretches (checked before corners so they override)
  if (c===7&&r>=8&&r<=13) return "#bfdbfe";
  if (c===7&&r>=1&&r<=6)  return "#bbf7d0";
  if (r===7&&c>=1&&c<=6)  return "#fecaca";
  if (r===7&&c>=8&&c<=13) return "#fef08a";
  // Homes
  if (r>=9&&c<=5) { if(r>=10&&r<=13&&c>=1&&c<=4) return "#dbeafe"; return "#2563eb"; }
  if (r<=5&&c>=9) { if(r>=1&&r<=4&&c>=10&&c<=13) return "#dcfce7"; return "#16a34a"; }
  if (r<=5&&c<=5) { if(r>=1&&r<=4&&c>=1&&c<=4)   return "#fee2e2"; return "#dc2626"; }
  if (r>=9&&c>=9) { if(r>=10&&r<=13&&c>=10&&c<=13)return "#fef9c3"; return "#ca8a04"; }
  // Center
  if (r>=6&&r<=8&&c>=6&&c<=8) {
    if(r===7&&c===7) return "#f8fafc";
    if(r===8&&c===7) return "#bfdbfe";
    if(r===6&&c===7) return "#bbf7d0";
    if(r===7&&c===6) return "#fecaca";
    if(r===7&&c===8) return "#fef08a";
    return "#f1f5f9";
  }
  return "#ffffff";
}

// ─── Dice dot patterns ───────────────────────────────────────────────────────
const DOT_MAP: Record<number,number[]> = {
  1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]
};
function DiceDots({value,sz=48}:{value:number;sz?:number}) {
  const dots = DOT_MAP[value] || [];
  const dot = sz*0.12;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",width:"80%",height:"80%",gap:sz*0.04}}>
      {[0,1,2,3,4,5,6,7,8].map(i=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
          {dots.includes(i) && <div style={{width:dot,height:dot,borderRadius:"50%",background:"#1e293b"}}/>}
        </div>
      ))}
    </div>
  );
}

// ─── 3-D Dice ────────────────────────────────────────────────────────────────
function Dice3D({value,rolling,onClick,active,sz=54}:{value:number|null;rolling:boolean;onClick:()=>void;active:boolean;sz?:number}) {
  const h = sz/2;
  const [rollKey,setRollKey] = useState(0);
  const [disp,setDisp] = useState(1);
  const targetFaceRot: Record<number,{rx:number,ry:number}> = {
    1:{rx:0,ry:0},2:{rx:-90,ry:0},3:{rx:0,ry:-90},
    4:{rx:0,ry:90},5:{rx:90,ry:0},6:{rx:0,ry:180}
  };
  useEffect(()=>{
    if(!rolling){if(value!==null)setDisp(value);return;}
    setRollKey(k=>k+1);
    let n=0;
    const iv=setInterval(()=>{setDisp(Math.floor(Math.random()*6)+1);n++;if(n>10)clearInterval(iv);},55);
    return()=>clearInterval(iv);
  },[rolling,value]);
  const tr = targetFaceRot[disp]||{rx:0,ry:0};
  const faces:[number,string][]=[
    [1,`translateZ(${h}px)`],
    [6,`rotateY(180deg) translateZ(${h}px)`],
    [2,`rotateX(90deg) translateZ(${h}px)`],
    [5,`rotateX(-90deg) translateZ(${h}px)`],
    [3,`rotateY(90deg) translateZ(${h}px)`],
    [4,`rotateY(-90deg) translateZ(${h}px)`],
  ];
  return (
    <div
      onClick={active&&!rolling?onClick:undefined}
      style={{perspective:"200px",width:sz,height:sz,cursor:active&&!rolling?"pointer":"default"}}
    >
      <motion.div
        key={rollKey}
        animate={rolling?{rotateX:[0,-180,-360,tr.rx+360],rotateY:[0,180,360,tr.ry+360]}
                        :{rotateX:tr.rx,rotateY:tr.ry}}
        transition={rolling?{duration:0.75,ease:"easeOut"}:{duration:0.12}}
        style={{width:sz,height:sz,transformStyle:"preserve-3d",position:"relative"}}
      >
        {faces.map(([v,t])=>(
          <div key={v} style={{
            position:"absolute",inset:0,background:"#fff",borderRadius:10,
            border:"2px solid #e2e8f0",display:"flex",alignItems:"center",
            justifyContent:"center",backfaceVisibility:"hidden",
            transform:t,boxShadow:"inset 0 0 8px rgba(0,0,0,0.06)",
          }}>
            <DiceDots value={v} sz={sz}/>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Piece SVG ───────────────────────────────────────────────────────────────
const COLORS:Record<Player,{fill:string;dark:string}> = {
  blue:  {fill:"#3b82f6",dark:"#1d4ed8"},
  green: {fill:"#22c55e",dark:"#15803d"},
};
function Pawn({player,size=22,vibrate=false,glow=false}:{player:Player;size?:number;vibrate?:boolean;glow?:boolean}) {
  const {fill,dark} = COLORS[player];
  return (
    <motion.div
      animate={vibrate?{y:[0,-2,0,-2,0]}:{y:0}}
      transition={vibrate?{duration:0.5,repeat:Infinity,ease:"easeInOut"}:{}}
      style={{filter:glow?`drop-shadow(0 0 5px ${fill})`:"none",display:"flex"}}
    >
      <svg viewBox="0 0 24 30" width={size} height={size*1.25}>
        <ellipse cx="12" cy="24" rx="8" ry="5" fill={dark} opacity="0.7"/>
        <circle cx="12" cy="11" r="9" fill={fill}/>
        <circle cx="12" cy="11" r="9" fill="none" stroke={dark} strokeWidth="1.5"/>
        <path d="M8 20 Q12 16 16 20" fill={dark} opacity="0.5"/>
        <ellipse cx="9" cy="8" rx="3" ry="2" fill="white" opacity="0.4"/>
      </svg>
    </motion.div>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────
function Board({pieces,movable,onSelectPiece}:{
  pieces:GamePiece[];movable:PieceId[];onSelectPiece:(id:PieceId)=>void;
}) {
  // Build cell→piece map
  const cellMap = new Map<string,GamePiece[]>();
  pieces.forEach(p=>{
    const [r,c]=getPieceCoord(p);
    const k=`${r},${c}`;
    cellMap.set(k,[...(cellMap.get(k)||[]),p]);
  });
  // Red/Yellow decorative slots
  const allDecoSlots: [number,number][] = [...RED_SLOTS,...YELLOW_SLOTS];

  return (
    <div style={{
      display:"grid",gridTemplateColumns:"repeat(15,1fr)",gridTemplateRows:"repeat(15,1fr)",
      width:"100%",aspectRatio:"1",border:"3px solid #1e3a5f",borderRadius:6,overflow:"hidden",
    }}>
      {Array.from({length:225},(_,i)=>{
        const r=Math.floor(i/15), c=i%15;
        const k=`${r},${c}`;
        const bg=BOARD_BG[r][c];
        const here=(cellMap.get(k)||[]);
        const isSafe=SAFE_COORDS.has(k);
        const isDecoSlot=allDecoSlots.some(([dr,dc])=>dr===r&&dc===c);
        const isCenter=r===7&&c===7;
        return (
          <div key={i} style={{
            background:bg,
            border:"0.5px solid rgba(0,0,0,0.08)",
            display:"flex",alignItems:"center",justifyContent:"center",
            position:"relative",overflow:"visible",
          }}>
            {isSafe&&here.length===0&&<span style={{fontSize:"55%",opacity:0.45,lineHeight:1}}>★</span>}
            {isCenter&&here.length===0&&<span style={{fontSize:"70%",lineHeight:1}}>★</span>}
            {isDecoSlot&&here.length===0&&(
              <div style={{width:"58%",height:"58%",borderRadius:"50%",
                border:`2px solid ${c<=5?"#dc2626":"#ca8a04"}`,opacity:0.5}}/>
            )}
            {here.map((p,pi)=>{
              const selectable=movable.includes(p.id);
              const offset=here.length>1?(pi===0?-3:3):0;
              return (
                <div key={p.id}
                  style={{position:"absolute",transform:`translate(${offset}px,${offset>0?-offset:offset}px)`,
                    zIndex:selectable?10:5,cursor:selectable?"pointer":"default"}}
                  onClick={selectable?()=>onSelectPiece(p.id):undefined}
                >
                  <Pawn player={p.player} size={16} vibrate={selectable} glow={selectable}/>
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
  player:Player;name:string;isActive:boolean;diceValue:number|null;
  rolling:boolean;onRoll:()=>void;showArrow:boolean;finished:number;
}) {
  const {fill,dark}=COLORS[player];
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
      background:isActive?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.03)",
      borderRadius:14,border:isActive?`2px solid ${fill}33`:"2px solid transparent",
      transition:"all 0.3s",
    }}>
      {/* Avatar */}
      <div style={{width:36,height:36,borderRadius:10,background:fill,
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
        border:`2px solid ${dark}`,
      }}>
        <Pawn player={player} size={20}/>
      </div>
      {/* Name + finished */}
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,
          color:isActive?"#fff":"rgba(255,255,255,0.45)",lineHeight:1}}>{name}</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>
          {finished}/4 peões no centro
        </p>
      </div>
      {/* Dice + arrow */}
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <AnimatePresence>
          {showArrow&&(
            <motion.div initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0}}
              style={{fontSize:18}}>
              {player==="blue"?"👉":"👈"}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{
          background:"rgba(255,255,255,0.1)",borderRadius:10,padding:5,
          border:isActive?`1.5px solid ${fill}55`:"1.5px solid transparent",
        }}>
          <Dice3D value={diceValue} rolling={rolling} onClick={onRoll} active={isActive} sz={48}/>
        </div>
      </div>
    </div>
  );
}

// ─── Scripted dice ─────────────────────────────────────────────────────────────
// Blue T1:6 → exit; Blue T2:5 → move5; Green T1:2 → no exit; Blue T3:2 → move2;
// Green T2:6 → exit; Green T3:5 → move5; then random
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
  const [turn,setTurn]         = useState<Player>("blue");
  const [phase,setPhase]       = useState<Phase>("roll");
  const [diceBlue,setDiceBlue] = useState<number|null>(null);
  const [diceGreen,setDiceGreen]=useState<number|null>(null);
  const [rollingBlue,setRollingBlue]   = useState(false);
  const [rollingGreen,setRollingGreen] = useState(false);
  const [movable,setMovable]   = useState<PieceId[]>([]);
  const [winner,setWinner]     = useState<Player|null>(null);
  const [msg,setMsg]           = useState("Jogador Azul – clica nos dados para começar!");
  const scriptIdx = useRef(0);
  const piecesRef = useRef(pieces);
  useEffect(()=>{piecesRef.current=pieces;},[pieces]);

  const other = (p:Player):Player => p==="blue"?"green":"blue";

  function rollDice():number {
    const idx = scriptIdx.current;
    scriptIdx.current++;
    if(idx<SCRIPTED.length) return SCRIPTED[idx];
    return Math.floor(Math.random()*6)+1;
  }

  function calcMovable(ps:GamePiece[],pl:Player,d:number):PieceId[] {
    return ps
      .filter(p=>p.player===pl)
      .filter(p=>{
        if(p.pos===58) return false;
        if(p.pos===-1) return d===6;
        return p.pos+d<=58;
      })
      .map(p=>p.id) as PieceId[];
  }

  function finishedCount(ps:GamePiece[],pl:Player):number {
    return ps.filter(p=>p.player===pl&&p.pos===58).length;
  }

  // Step-by-step piece movement
  function movePieceSteps(pieceId:PieceId, curPos:number, steps:number, isExit:boolean, onDone:()=>void) {
    if(isExit) {
      // Just place piece at pos=0 (entry cell)
      setPieces(prev=>prev.map(p=>p.id===pieceId?{...p,pos:0}:p));
      setTimeout(()=>{
        // Now move remaining (steps-1) if any... but exit counts as 1 step
        // Actually the whole roll "6" is used for exiting, so no extra movement
        onDone();
      },300);
      return;
    }
    // Move step by step
    for(let i=1;i<=steps;i++){
      const step=i;
      setTimeout(()=>{
        setPieces(prev=>prev.map(p=>{
          if(p.id!==pieceId) return p;
          return {...p,pos:curPos+step};
        }));
        if(step===steps){
          setTimeout(onDone,150);
        }
      },step*220);
    }
  }

  function handleMoveComplete(pieceId:PieceId, diceVal:number, currentTurn:Player) {
    setPhase("moving"); // keep moving briefly
    const ps = piecesRef.current;

    // Check capture: opponent piece on same cell (not safe)
    const mover = ps.find(p=>p.id===pieceId)!;
    const moverCoord = getPieceCoord(mover);
    const ck = `${moverCoord[0]},${moverCoord[1]}`;
    if(!SAFE_COORDS.has(ck) && mover.pos>=0 && mover.pos<=51) {
      const opp = other(currentTurn);
      const captured = ps.filter(p=>
        p.player===opp && p.pos>=0 && p.pos<=51
      ).filter(p=>{
        const [pr,pc]=getPieceCoord(p);
        return pr===moverCoord[0]&&pc===moverCoord[1];
      });
      if(captured.length>0){
        setPieces(prev=>prev.map(p=>
          captured.some(c=>c.id===p.id)?{...p,pos:-1}:p
        ));
        setMsg(`${currentTurn==="blue"?"Azul":"Verde"} capturou uma peça!`);
      }
    }

    // Check win
    const updatedPs = piecesRef.current;
    if(finishedCount(updatedPs,currentTurn)===4){
      setWinner(currentTurn);
      setPhase("done");
      setMsg(`${currentTurn==="blue"?"Jogador Azul":"Jogador Verde"} VENCEU! 🏆`);
      return;
    }

    // Dice was 6 → same player rolls again
    if(diceVal===6){
      setMsg(`${currentTurn==="blue"?"Azul":"Verde"} tirou 6 – joga novamente!`);
      setMovable([]);
      setTimeout(()=>{
        setPhase("roll");
        if(currentTurn==="blue") setDiceBlue(null);
        else setDiceGreen(null);
      },400);
    } else {
      // Pass to next player
      const next=other(currentTurn);
      setMovable([]);
      setTimeout(()=>{
        setTurn(next);
        setPhase("roll");
        if(next==="blue"){setDiceBlue(null);setMsg("Jogador Azul – clica nos dados!");}
        else {setDiceGreen(null);setMsg("Jogador Verde – a pensar…");}
      },500);
    }
  }

  function doRoll(pl:Player){
    if(phase!=="roll"||turn!==pl) return;
    const setRolling = pl==="blue"?setRollingBlue:setRollingGreen;
    const setDice    = pl==="blue"?setDiceBlue:setDiceGreen;
    setRolling(true);
    setTimeout(()=>{
      const val=rollDice();
      setDice(val);
      setRolling(false);
      const mv=calcMovable(piecesRef.current,pl,val);
      if(mv.length===0){
        setMsg(val===6?`${pl==="blue"?"Azul":"Verde"} tirou 6 mas não pode mover!`
                      :`${pl==="blue"?"Azul":"Verde"} tirou ${val} – sem jogadas. Vez de ${other(pl)==="blue"?"Azul":"Verde"}.`);
        setTimeout(()=>{
          const next=other(pl);
          setTurn(next);
          setPhase("roll");
          if(next==="blue"){setDiceBlue(null);setMsg("Jogador Azul – clica nos dados!");}
          else {setDiceGreen(null);setMsg("Jogador Verde – a pensar…");}
        },1400);
      } else if(mv.length===1){
        setMsg(`${pl==="blue"?"Azul":"Verde"} tirou ${val}!`);
        doSelectPiece(mv[0],val,pl,piecesRef.current);
      } else {
        setMovable(mv);
        setPhase("select");
        setMsg(`${pl==="blue"?"Azul":"Verde"} tirou ${val} – escolhe uma peça!`);
      }
    },780);
  }

  function doSelectPiece(pid:PieceId,diceVal:number,pl:Player,ps:GamePiece[]){
    setMovable([]);
    setPhase("moving");
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
  },[turn,phase,movable,winner]);

  // Counts
  const blueFinished  = finishedCount(pieces,"blue");
  const greenFinished = finishedCount(pieces,"green");

  return (
    <div style={{minHeight:"100vh",width:"100%",display:"flex",justifyContent:"center",
      background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)"}}>
      <div style={{width:"100%",maxWidth:430,display:"flex",flexDirection:"column",minHeight:"100vh",padding:"0 0 16px 0"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"12px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>setLocation("/")}
            style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.08)",
              border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",
              justifyContent:"center",cursor:"pointer"}}>
            <ArrowLeft style={{width:17,height:17,color:"#fff"}}/>
          </button>
          <div style={{textAlign:"center"}}>
            <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"#fff",lineHeight:1}}>LUDO</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>1 VS 1</p>
          </div>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",
            justifyContent:"center"}}>
            <HomeIcon style={{width:16,height:16,color:"rgba(255,255,255,0.4)"}}/>
          </div>
        </div>

        {/* Player 2 (Green) panel – top */}
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

        {/* Status message */}
        <div style={{padding:"4px 12px 8px"}}>
          <motion.div
            key={msg}
            initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
            style={{background:"rgba(255,255,255,0.06)",borderRadius:10,
              padding:"7px 14px",textAlign:"center"}}>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontWeight:600}}>{msg}</p>
          </motion.div>
        </div>

        {/* Board */}
        <div style={{padding:"0 12px",flex:1}}>
          <Board pieces={pieces} movable={movable} onSelectPiece={handleSelectPiece}/>
        </div>

        {/* Player 1 (Blue) panel – bottom */}
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
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
              display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
            <motion.div
              initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}}
              transition={{type:"spring",stiffness:260,damping:18}}
              style={{background:winner==="blue"?"#1d4ed8":"#15803d",
                borderRadius:24,padding:"36px 40px",textAlign:"center",
                border:`3px solid ${winner==="blue"?"#3b82f6":"#22c55e"}`,
                maxWidth:300,width:"90%"}}>
              <Trophy style={{width:56,height:56,color:"#fbbf24",margin:"0 auto 12px"}}/>
              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#fff",marginBottom:6}}>
                {winner==="blue"?"Jogador Azul":"Jogador Verde"}
              </p>
              <p style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginBottom:28}}>Venceu a partida!</p>
              <button onClick={()=>setLocation("/")}
                style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",
                  color:"#fff",borderRadius:12,padding:"12px 32px",fontFamily:"'Syne',sans-serif",
                  fontWeight:700,fontSize:15,cursor:"pointer",width:"100%"}}>
                Sair
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
