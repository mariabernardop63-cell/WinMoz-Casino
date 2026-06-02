import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────────
type PType = "K"|"Q"|"R"|"B"|"N"|"P";
type PColor = "w"|"b";
interface Piece { t: PType; c: PColor; moved: boolean; }
type Sq = [number,number];
type Board = (Piece|null)[][];

const EMPTY_BOARD = (): Board => Array.from({length:8},()=>Array(8).fill(null));

function cloneBoard(b: Board): Board {
  return b.map(row=>row.map(p=>p?{...p}:null));
}

// ─── Initial Setup ──────────────────────────────────────────────────────────────
function makeInitialBoard(): Board {
  const b = EMPTY_BOARD();
  const order: PType[] = ["R","N","B","Q","K","B","N","R"];
  for(let c=0;c<8;c++){
    b[0][c]={t:order[c],c:"b",moved:false};
    b[1][c]={t:"P",c:"b",moved:false};
    b[6][c]={t:"P",c:"w",moved:false};
    b[7][c]={t:order[c],c:"w",moved:false};
  }
  return b;
}

// ─── Attack Detection ───────────────────────────────────────────────────────────
function isAttacked(b: Board, r: number, c: number, byColor: PColor): boolean {
  const opp = byColor;
  // Knight
  for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<8&&nc>=0&&nc<8){const p=b[nr][nc];if(p?.c===opp&&p.t==="N")return true;}
  }
  // Diagonals (bishop+queen)
  for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      const p=b[nr][nc];
      if(p){if(p.c===opp&&(p.t==="B"||p.t==="Q"))return true;break;}
      nr+=dr;nc+=dc;
    }
  }
  // Straights (rook+queen)
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      const p=b[nr][nc];
      if(p){if(p.c===opp&&(p.t==="R"||p.t==="Q"))return true;break;}
      nr+=dr;nc+=dc;
    }
  }
  // King
  for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<8&&nc>=0&&nc<8){const p=b[nr][nc];if(p?.c===opp&&p.t==="K")return true;}
  }
  // Pawn (white pawns attack upward = row-1, black pawns attack downward = row+1)
  const pDir = opp==="w"?1:-1; // pawn is 1 row behind target in its attack direction
  for(const dc of [-1,1]){
    const nr=r+pDir,nc=c+dc;
    if(nr>=0&&nr<8&&nc>=0&&nc<8){const p=b[nr][nc];if(p?.c===opp&&p.t==="P")return true;}
  }
  return false;
}

function findKing(b: Board, color: PColor): Sq {
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(b[r][c]?.c===color&&b[r][c]?.t==="K")return[r,c];
  return[-1,-1];
}

function inCheck(b: Board, color: PColor): boolean {
  const[kr,kc]=findKing(b,color);
  if(kr<0)return false;
  return isAttacked(b,kr,kc,color==="w"?"b":"w");
}

// ─── Pseudo-legal Move Generation ──────────────────────────────────────────────
function getPawnMoves(b: Board, r: number, c: number, ep: Sq|null): Sq[] {
  const pc=b[r][c]!;
  const dir=pc.c==="w"?-1:1;
  const startRow=pc.c==="w"?6:1;
  const res:Sq[]=[];
  const nr1=r+dir;
  if(nr1>=0&&nr1<8){
    if(!b[nr1][c]){
      res.push([nr1,c]);
      if(r===startRow&&!b[r+2*dir]?.[c])res.push([r+2*dir,c]);
    }
    for(const dc of [-1,1]){
      if(c+dc<0||c+dc>7)continue;
      const target=b[nr1][c+dc];
      if(target&&target.c!==pc.c)res.push([nr1,c+dc]);
      if(ep&&ep[0]===nr1&&ep[1]===c+dc)res.push([nr1,c+dc]);
    }
  }
  return res;
}

function getSliders(b: Board, r: number, c: number, dirs:[number,number][]): Sq[] {
  const pc=b[r][c]!;const res:Sq[]=[];
  for(const[dr,dc]of dirs){
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      if(!b[nr][nc]){res.push([nr,nc]);}else{if(b[nr][nc]!.c!==pc.c)res.push([nr,nc]);break;}
      nr+=dr;nc+=dc;
    }
  }
  return res;
}

function getSteppers(b: Board, r: number, c: number, deltas:[number,number][]): Sq[] {
  const pc=b[r][c]!;
  return deltas.map(([dr,dc]):[number,number]=>[r+dr,c+dc])
    .filter(([nr,nc])=>nr>=0&&nr<8&&nc>=0&&nc<8&&(!b[nr][nc]||b[nr][nc]!.c!==pc.c)) as Sq[];
}

function pseudoMoves(b: Board, sq: Sq, ep: Sq|null): Sq[] {
  const[r,c]=sq;const pc=b[r][c];if(!pc)return[];
  switch(pc.t){
    case"P":return getPawnMoves(b,r,c,ep);
    case"N":return getSteppers(b,r,c,[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]);
    case"B":return getSliders(b,r,c,[[-1,-1],[-1,1],[1,-1],[1,1]]);
    case"R":return getSliders(b,r,c,[[-1,0],[1,0],[0,-1],[0,1]]);
    case"Q":return getSliders(b,r,c,[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    case"K":return getSteppers(b,r,c,[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
    default:return[];
  }
}

// ─── Legal Move Generation (filters moves leaving own king in check) ────────────
function legalMoves(b: Board, sq: Sq, ep: Sq|null): Sq[] {
  const[r,c]=sq;const pc=b[r][c];if(!pc)return[];
  const pseudo=pseudoMoves(b,sq,ep);const legal:Sq[]=[];
  for(const[tr,tc]of pseudo){
    const nb=cloneBoard(b);
    nb[tr][tc]={...nb[r][c]!,moved:true};nb[r][c]=null;
    // En passant capture: remove the captured pawn
    if(pc.t==="P"&&ep&&tr===ep[0]&&tc===ep[1]){
      nb[pc.c==="w"?tr+1:tr-1][tc]=null;
    }
    if(!inCheck(nb,pc.c))legal.push([tr,tc]);
  }
  // Castling
  if(pc.t==="K"&&!pc.moved&&!inCheck(b,pc.c)){
    const opp=pc.c==="w"?"b":"w";
    // Kingside
    const rk=b[r][7];
    if(rk?.t==="R"&&rk.c===pc.c&&!rk.moved&&!b[r][5]&&!b[r][6]){
      if(!isAttacked(b,r,5,opp)&&!isAttacked(b,r,6,opp))legal.push([r,6]);
    }
    // Queenside
    const rq=b[r][0];
    if(rq?.t==="R"&&rq.c===pc.c&&!rq.moved&&!b[r][1]&&!b[r][2]&&!b[r][3]){
      if(!isAttacked(b,r,3,opp)&&!isAttacked(b,r,2,opp))legal.push([r,2]);
    }
  }
  return legal;
}

// ─── Apply Move ─────────────────────────────────────────────────────────────────
interface MoveResult {
  board: Board;
  ep: Sq|null;
  captured: PType|null;
  castled: "k"|"q"|null;
  promoted: boolean;
}

function applyMove(b: Board, from: Sq, to: Sq, promotion: PType="Q"): MoveResult {
  const[fr,fc]=from;const[tr,tc]=to;
  const pc=b[fr][fc]!;
  const nb=cloneBoard(b);
  let captured:PType|null=null;
  let castled:"k"|"q"|null=null;
  let newEp:Sq|null=null;
  let promoted=false;

  if(nb[tr][tc])captured=nb[tr][tc]!.t;
  nb[tr][tc]={...pc,moved:true};
  nb[fr][fc]=null;

  // En passant capture
  if(pc.t==="P"&&fc!==tc&&!captured){
    nb[pc.c==="w"?tr+1:tr-1][tc]=null;
    captured="P";
  }
  // New ep target
  if(pc.t==="P"&&Math.abs(tr-fr)===2)newEp=[(fr+tr)/2,fc];

  // Castling rook move
  if(pc.t==="K"&&Math.abs(tc-fc)===2){
    if(tc===6){nb[fr][5]={...nb[fr][7]!,moved:true};nb[fr][7]=null;castled="k";}
    else{nb[fr][3]={...nb[fr][0]!,moved:true};nb[fr][0]=null;castled="q";}
  }
  // Promotion
  if(pc.t==="P"&&(tr===0||tr===7)){
    nb[tr][tc]={t:promotion,c:pc.c,moved:true};
    promoted=true;
  }
  return{board:nb,ep:newEp,captured,castled,promoted};
}

// ─── Game Status ────────────────────────────────────────────────────────────────
function getAllLegalMoves(b: Board, color: PColor, ep: Sq|null): [Sq,Sq][] {
  const moves:[Sq,Sq][]=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const pc=b[r][c];if(!pc||pc.c!==color)continue;
    for(const to of legalMoves(b,[r,c],ep))moves.push([[r,c],to]);
  }
  return moves;
}

type GameStatus="playing"|"check"|"checkmate"|"stalemate"|"draw";
function getStatus(b: Board, turn: PColor, ep: Sq|null): GameStatus {
  const moves=getAllLegalMoves(b,turn,ep);
  const check=inCheck(b,turn);
  if(moves.length===0)return check?"checkmate":"stalemate";
  if(check)return"check";
  // Insufficient material draw
  const pieces:PType[]=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(p&&p.t!=="K")pieces.push(p.t);}
  if(pieces.length===0||(pieces.length===1&&(pieces[0]==="N"||pieces[0]==="B")))return"draw";
  return"playing";
}

// ─── Algebraic Notation ────────────────────────────────────────────────────────
const FILE_LETTERS="abcdefgh";
function sqLabel(r:number,c:number){return`${FILE_LETTERS[c]}${8-r}`;}
function moveNotation(pc:Piece,from:Sq,to:Sq,captured:PType|null,castled:"k"|"q"|null,promoted:boolean,prom:PType,isCheck:boolean,isMate:boolean):string{
  if(castled==="k")return isMate?"O-O#":isCheck?"O-O+":"O-O";
  if(castled==="q")return isMate?"O-O-O#":isCheck?"O-O-O+":"O-O-O";
  let n="";
  if(pc.t!=="P")n+=pc.t;
  if(pc.t==="P"&&captured)n+=FILE_LETTERS[from[1]];
  if(captured)n+="x";
  n+=sqLabel(to[0],to[1]);
  if(promoted)n+=`=${prom}`;
  if(isMate)n+="#";else if(isCheck)n+="+";
  return n;
}

// ─── Chess Piece SVG Renderer ───────────────────────────────────────────────────
const PIECE_SYMBOLS:Record<PColor,Record<PType,string>>={
  w:{K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙"},
  b:{K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"},
};

function ChessPiece({piece}:{piece:Piece}){
  const isWhite=piece.c==="w";
  return(
    <div style={{
      width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"min(9vw,46px)",lineHeight:1,userSelect:"none",
      color:isWhite?"#FFFFFF":"#111111",
      textShadow:isWhite
        ?"0 1px 3px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.5)"
        :"0 1px 3px rgba(255,255,255,0.3),0 0 6px rgba(0,0,0,0.6)",
      filter:isWhite
        ?"drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
        :"drop-shadow(0 2px 4px rgba(0,0,0,0.9))",
    }}>
      {PIECE_SYMBOLS[piece.c][piece.t]}
    </div>
  );
}

// ─── Captured Pieces Row ────────────────────────────────────────────────────────
const PIECE_VALUES:Record<PType,number>={P:1,N:3,B:3,R:5,Q:9,K:0};
function CapturedPieces({pieces,color}:{pieces:PType[];color:PColor}){
  if(!pieces.length)return<div style={{height:16}}/>;
  const sorted=[...pieces].sort((a,b)=>PIECE_VALUES[b]-PIECE_VALUES[a]);
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:0,alignItems:"center"}}>
      {sorted.map((t,i)=>(
        <span key={i} style={{fontSize:14,lineHeight:1,color:color==="w"?"#FFFFFF":"#1a1a1a",
          textShadow:color==="w"?"0 1px 2px rgba(0,0,0,0.8)":"none",opacity:0.8}}>
          {PIECE_SYMBOLS[color][t]}
        </span>
      ))}
    </div>
  );
}

// ─── Player Panel ───────────────────────────────────────────────────────────────
function PlayerPanel({name,isMe,isActive,color,timer,captured,isCheck}:{
  name:string;isMe:boolean;isActive:boolean;color:PColor;
  timer:number;captured:PType[];isCheck:boolean;
}){
  const accent=color==="w"?"#F5C842":"#6B7280";
  const mins=String(Math.floor(timer/60)).padStart(2,"0");
  const secs=String(timer%60).padStart(2,"0");
  const timerRed=isActive&&timer<30;
  return(
    <div style={{
      display:"flex",alignItems:"center",gap:10,
      padding:"8px 12px",background:"#FFFFFF",
      borderRadius:12,border:`2px solid ${isActive?accent:"#E2E8F0"}`,
      boxShadow:isActive?`0 2px 16px ${accent}40`:"0 1px 4px rgba(0,0,0,0.06)",
      transition:"all 0.3s",
    }}>
      <div style={{
        width:36,height:36,borderRadius:10,flexShrink:0,
        background:color==="w"?"#F8F8F0":"#2D2D2D",
        border:`2px solid ${isActive?accent:"#E2E8F0"}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:18,
      }}>
        {color==="w"?"♔":"♚"}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
          <span style={{fontWeight:700,fontSize:13,color:"#0F172A",lineHeight:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>
            {name}
          </span>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",
            color:isMe?"#FFFFFF":"#64748B",background:isMe?accent:"#E2E8F0",
            borderRadius:4,padding:"2px 5px",flexShrink:0}}>
            {isMe?"Tu":"Rival"}
          </span>
          {isCheck&&<motion.span animate={{opacity:[1,0.3,1]}} transition={{duration:0.6,repeat:Infinity}}
            style={{fontSize:9,fontWeight:700,color:"#EF4444",background:"#FEF2F2",
              border:"1px solid #FCA5A5",borderRadius:4,padding:"2px 5px",flexShrink:0}}>
            XEQUE!
          </motion.span>}
        </div>
        <CapturedPieces pieces={captured} color={color==="w"?"b":"w"}/>
      </div>
      <div style={{
        padding:"4px 10px",borderRadius:8,
        background:timerRed?"#FEF2F2":isActive?"#F8FAFC":"#F1F5F9",
        border:`1.5px solid ${timerRed?"#FCA5A5":isActive?`${accent}60`:"#E2E8F0"}`,
        minWidth:52,textAlign:"center",
      }}>
        <span style={{
          fontFamily:"'Syne',monospace",fontWeight:800,fontSize:14,
          color:timerRed?"#EF4444":isActive?"#0F172A":"#CBD5E1",
          letterSpacing:1,
        }}>
          {mins}:{secs}
        </span>
      </div>
    </div>
  );
}

// ─── Promotion Modal ────────────────────────────────────────────────────────────
function PromotionModal({color,onChoose}:{color:PColor;onChoose:(t:PType)=>void}){
  const pieces:PType[]=["Q","R","B","N"];
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,
        display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.8,y:20}} animate={{scale:1,y:0}}
        style={{background:"#fff",borderRadius:20,padding:"24px",
          boxShadow:"0 24px 60px rgba(0,0,0,0.5)",textAlign:"center"}}>
        <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,
          color:"#0F172A",marginBottom:16}}>Escolhe a promoção do peão</p>
        <div style={{display:"flex",gap:12}}>
          {pieces.map(t=>(
            <button key={t} onClick={()=>onChoose(t)} style={{
              width:64,height:64,borderRadius:12,background:"#F8FAFC",
              border:"2px solid #E2E8F0",cursor:"pointer",fontSize:36,
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all 0.15s",
            }}
            onMouseEnter={e=>(e.currentTarget.style.background="#F0F9FF",e.currentTarget.style.borderColor="#3B82F6")}
            onMouseLeave={e=>(e.currentTarget.style.background="#F8FAFC",e.currentTarget.style.borderColor="#E2E8F0")}>
              {PIECE_SYMBOLS[color][t]}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
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
    no_balance:    { title:"Saldo insuficiente", body:"Não tens saldo suficiente para a revanche.", actions:"close" },
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
        style={{ width:"82%", maxWidth:300, background:"rgba(10,15,30,0.98)",
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

// ─── Win Screen ─────────────────────────────────────────────────────────────────
function WinScreen({winner,winnerName,loserName,reason,betAmount,isWinner,onReplay,onQuit}:{
  winner:PColor;winnerName:string;loserName:string;reason:string;betAmount:number;
  isWinner:boolean;onReplay:()=>void;onQuit:()=>void;
}){
  const isWhiteWinner=winner==="w";
  const accent=isWhiteWinner?"#F5C842":"#6366F1";
  const winnerBg=isWhiteWinner?"linear-gradient(145deg,#B8960C,#9A7D0A)":"linear-gradient(145deg,#1A1A2E,#16213E)";
  const loserBg="linear-gradient(145deg,#1a0a0a,#2a0f0f)";

  if(!isWinner){
    return(
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.88)",
          backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
          transition={{type:"spring",stiffness:220,damping:22}}
          style={{borderRadius:26,maxWidth:310,width:"88%",overflow:"hidden",
            boxShadow:"0 32px 80px rgba(0,0,0,0.75),0 0 60px rgba(239,68,68,0.15)",
            border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{background:loserBg,padding:"28px 24px 22px",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <svg width={68} height={68} viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="36" r="34" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth="1.5"/>
                <path d="M22 22 L50 50 M50 22 L22 50" stroke="#EF4444" strokeWidth="5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
              color:"rgba(255,100,100,0.8)",marginBottom:6}}>DERROTA</p>
            <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,color:"rgba(255,255,255,0.7)",lineHeight:1.2,marginBottom:4}}>
              Perdeste para
            </p>
            <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#fff",lineHeight:1.1}}>
              {winnerName}
            </p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:6}}>{reason}</p>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.08)",
            padding:"20px 24px 22px"}}>
            {betAmount>0&&(
              <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
                borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",
                    color:"rgba(255,255,255,0.4)",marginBottom:4}}>PERDIDO</p>
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
              <button onClick={onReplay} style={{flex:1,background:"rgba(239,68,68,0.15)",
                color:"#EF4444",borderRadius:14,padding:"14px 0",
                border:"1px solid rgba(239,68,68,0.3)",
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
  }

  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.88)",
        backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <motion.div initial={{scale:0.6,opacity:0,y:40}} animate={{scale:1,opacity:1,y:0}}
        transition={{type:"spring",stiffness:220,damping:22}}
        style={{borderRadius:26,maxWidth:310,width:"88%",overflow:"hidden",
          boxShadow:`0 32px 80px rgba(0,0,0,0.75),0 0 60px ${accent}22`,
          border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{background:winnerBg,padding:"28px 24px 22px",textAlign:"center"}}>
          <motion.div animate={{y:[0,-5,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <svg width={72} height={72} viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="cwtg" x1="25%" y1="0%" x2="75%" y2="100%">
                  <stop offset="0%" stopColor="#FFE566"/>
                  <stop offset="50%" stopColor="#FFD700"/>
                  <stop offset="100%" stopColor="#B8860B"/>
                </linearGradient>
              </defs>
              <path d="M28 12 L72 12 L68 52 Q65 64 50 68 Q35 64 32 52 Z" fill="url(#cwtg)"/>
              <path d="M28 16 Q14 16 14 32 Q14 44 28 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <path d="M72 16 Q86 16 86 32 Q86 44 72 44" stroke="#FFD700" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
              <rect x="44" y="68" width="12" height="12" fill="url(#cwtg)" rx="2"/>
              <rect x="30" y="80" width="40" height="7" fill="url(#cwtg)" rx="3.5"/>
              <ellipse cx="38" cy="30" rx="7" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-18 38 30)"/>
            </svg>
          </motion.div>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",
            color:"rgba(255,255,255,0.65)",marginBottom:6}}>VENCEDOR</p>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#fff",lineHeight:1.1}}>
            {winnerName}
          </p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4}}>{reason}</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.08)",
          padding:"20px 24px 22px"}}>
          {betAmount>0&&(
            <div style={{background:"linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05))",
              border:"1px solid rgba(255,215,0,0.3)",borderRadius:14,padding:"14px 16px",
              display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",
                  color:"rgba(255,255,255,0.4)",marginBottom:4}}>GANHOS</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",lineHeight:1}}>
                  +{betAmount.toLocaleString("pt-MZ")}<span style={{fontSize:12}}> MT</span>
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
            <button onClick={onReplay} style={{flex:1,background:`linear-gradient(135deg,${accent},${accent}CC)`,
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

// ─── Move History Panel ─────────────────────────────────────────────────────────
function MoveHistory({history}:{history:string[]}){
  const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[history]);
  if(!history.length)return null;
  const pairs:string[][]=[];
  for(let i=0;i<history.length;i+=2)pairs.push(history.slice(i,i+2));
  return(
    <div style={{overflowY:"auto",maxHeight:80,padding:"4px 10px",
      background:"rgba(0,0,0,0.25)",borderRadius:8}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:"2px 8px",alignItems:"center"}}>
        {pairs.map((p,i)=>(
          <span key={i} style={{fontSize:10,color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap"}}>
            <span style={{color:"rgba(255,255,255,0.35)",marginRight:3}}>{i+1}.</span>
            <span style={{color:"rgba(255,255,255,0.85)",fontWeight:600}}>{p[0]}</span>
            {p[1]&&<span style={{color:"rgba(255,255,255,0.65)",marginLeft:5}}>{p[1]}</span>}
          </span>
        ))}
        <div ref={endRef}/>
      </div>
    </div>
  );
}

// ─── Chess Board Component ──────────────────────────────────────────────────────
interface BoardProps {
  board: Board;
  selected: Sq|null;
  legalDests: Sq[];
  lastMove: [Sq,Sq]|null;
  checkSquare: Sq|null;
  myColor: PColor;
  onSquareClick: (sq:Sq)=>void;
}

function ChessBoard({board,selected,legalDests,lastMove,checkSquare,myColor,onSquareClick}:BoardProps){
  const LIGHT="#D4A017";const DARK="#1A1008";
  const rows=myColor==="w"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  const cols=myColor==="w"?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  function sqEq(a:Sq|null,b:Sq):boolean{return!!a&&a[0]===b[0]&&a[1]===b[1];}
  function isLegal(sq:Sq):boolean{return legalDests.some(d=>sqEq(d,sq));}
  function isLastMove(sq:Sq):boolean{return!!lastMove&&(sqEq(lastMove[0],sq)||sqEq(lastMove[1],sq));}
  return(
    <div style={{position:"relative",width:"100%",aspectRatio:"1",flexShrink:0}}>
      {/* Rank labels left */}
      <div style={{position:"absolute",left:-16,top:0,height:"100%",display:"flex",flexDirection:"column"}}>
        {rows.map(r=>(
          <div key={r} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:3}}>
            <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{8-r}</span>
          </div>
        ))}
      </div>
      {/* File labels bottom */}
      <div style={{position:"absolute",bottom:-15,left:0,width:"100%",display:"flex"}}>
        {cols.map(c=>(
          <div key={c} style={{flex:1,textAlign:"center"}}>
            <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{FILE_LETTERS[c]}</span>
          </div>
        ))}
      </div>
      {/* Board grid */}
      <div style={{width:"100%",height:"100%",display:"grid",gridTemplateColumns:"repeat(8,1fr)",
        gridTemplateRows:"repeat(8,1fr)",borderRadius:6,overflow:"hidden",
        boxShadow:"0 12px 40px rgba(0,0,0,0.8),0 2px 8px rgba(0,0,0,0.5)",
        border:"3px solid #8B6914"}}>
        {rows.map(r=>cols.map(c=>{
          const sq:[number,number]=[r,c];
          const isLight=(r+c)%2===0;
          const baseBg=isLight?LIGHT:DARK;
          const piece=board[r][c];
          const sel=sqEq(selected,sq);
          const legal=isLegal(sq);
          const lastMv=isLastMove(sq);
          const isCheck=sqEq(checkSquare,sq);
          let bg=baseBg;
          if(sel)bg=isLight?"#F5E55A":"#9A8B10";
          else if(lastMv)bg=isLight?"#E8CC4A":"#7A6A0A";
          return(
            <div key={`${r}${c}`} onClick={()=>onSquareClick(sq)}
              style={{position:"relative",background:bg,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                transition:"background 0.15s",
              }}>
              {/* Check flash */}
              {isCheck&&(
                <motion.div animate={{opacity:[0.6,0,0.6]}} transition={{duration:0.5,repeat:Infinity}}
                  style={{position:"absolute",inset:0,background:"rgba(239,68,68,0.6)",zIndex:1}}/>
              )}
              {/* Legal move indicator */}
              {legal&&!piece&&(
                <div style={{width:"32%",height:"32%",borderRadius:"50%",
                  background:"rgba(0,0,0,0.25)",pointerEvents:"none",zIndex:2}}/>
              )}
              {legal&&piece&&(
                <div style={{position:"absolute",inset:0,
                  border:"3px solid rgba(0,0,0,0.4)",borderRadius:1,
                  boxShadow:"inset 0 0 8px rgba(0,0,0,0.3)",pointerEvents:"none",zIndex:2}}/>
              )}
              {/* Piece */}
              {piece&&(
                <motion.div
                  key={`${piece.c}${piece.t}${r}${c}`}
                  initial={{scale:0.7,opacity:0}}
                  animate={{scale:sel?1.12:1,opacity:1}}
                  transition={{duration:0.15}}
                  style={{position:"absolute",inset:0,zIndex:3}}>
                  <ChessPiece piece={piece}/>
                </motion.div>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

// ─── Main Chess Game Component ──────────────────────────────────────────────────
export default function ChessGame(){
  const[,setLocation]=useLocation();
  const{profile}=useAuth();

  const sp=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");
  const gameId=sp.get("gameId")??"local";
  const myColorStr=sp.get("color")??"white";
  const myColor:PColor=myColorStr==="white"?"w":"b";
  const BET=parseInt(sp.get("bet")??"0");
  const oppFromUrl=sp.get("opp")??"";

  const opponentColor:PColor=myColor==="w"?"b":"w";
  const playerName=profile?.full_name??(myColor==="w"?"Brancas":"Pretas");
  const opponentName=oppFromUrl?decodeURIComponent(oppFromUrl):"Adversário";

  // ── Game state ────────────────────────────────────────────────────────────────
  const[board,setBoard]=useState<Board>(makeInitialBoard);
  const[turn,setTurn]=useState<PColor>("w");
  const[ep,setEp]=useState<Sq|null>(null);
  const[selected,setSelected]=useState<Sq|null>(null);
  const[legalDests,setLegalDests]=useState<Sq[]>([]);
  const[lastMove,setLastMove]=useState<[Sq,Sq]|null>(null);
  const[history,setHistory]=useState<string[]>([]);
  const[captured,setCaptured]=useState<Record<PColor,PType[]>>({w:[],b:[]});
  const[status,setStatus]=useState<GameStatus>("playing");
  const[winner,setWinner]=useState<PColor|null>(null);
  const[winReason,setWinReason]=useState("");
  const[promotionPending,setPromotionPending]=useState<{from:Sq;to:Sq}|null>(null);
  const[timers,setTimers]=useState<Record<PColor,number>>({w:600,b:600});

  // Refs for realtime callbacks
  const boardRef=useRef(board);const turnRef=useRef(turn);
  const epRef=useRef(ep);const statusRef=useRef(status);
  const channelRef=useRef<ReturnType<typeof supabase.channel>|null>(null);
  const lastSeqRef=useRef<Record<string,number>>({});
  const[rematchPhase,setRematchPhase]=useState<RematchPhase>("idle");
  const[rematchRequester,setRematchRequester]=useState("");

  useEffect(()=>{boardRef.current=board;},[board]);
  useEffect(()=>{turnRef.current=turn;},[turn]);
  useEffect(()=>{epRef.current=ep;},[ep]);
  useEffect(()=>{statusRef.current=status;},[status]);

  // ── Timer countdown ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(status!=="playing"&&status!=="check")return;
    const tick=setInterval(()=>{
      setTimers(prev=>{
        const nb={...prev,[turn]:prev[turn]-1};
        if(nb[turn]<=0){
          setWinner(turn==="w"?"b":"w");
          setWinReason("Tempo esgotado!");
          setStatus("checkmate");
          clearInterval(tick);
        }
        return nb;
      });
    },1000);
    return()=>clearInterval(tick);
  },[turn,status]);

  // ── Check king square ─────────────────────────────────────────────────────────
  const checkSquare:Sq|null=(status==="check"||status==="checkmate")?findKing(board,turn):null;

  // ── Apply a move to local state ───────────────────────────────────────────────
  const applyMoveToState=useCallback((b:Board,from:Sq,to:Sq,prom:PType,currentEp:Sq|null,currentTurn:PColor)=>{
    const result=applyMove(b,from,to,prom);
    const nextTurn:PColor=currentTurn==="w"?"b":"w";
    const newStatus=getStatus(result.board,nextTurn,result.ep);

    // Build notation
    const pc=b[from[0]][from[1]]!;
    const notation=moveNotation(pc,from,to,result.captured,result.castled,result.promoted,prom,
      newStatus==="check",newStatus==="checkmate");

    setBoard(result.board);
    setTurn(nextTurn);
    setEp(result.ep);
    setLastMove([from,to]);
    setSelected(null);
    setLegalDests([]);
    setHistory(prev=>[...prev,notation]);
    if(result.captured)setCaptured(prev=>({...prev,[currentTurn]:[...prev[currentTurn],result.captured!]}));
    setStatus(newStatus);

    if(newStatus==="checkmate"){
      setWinner(currentTurn);
      setWinReason("Xeque-Mate!");
    }else if(newStatus==="stalemate"||newStatus==="draw"){
      setWinReason(newStatus==="stalemate"?"Afogamento — Empate!":"Empate por material insuficiente");
    }
    return result;
  },[]);

  // ── Handle square click ───────────────────────────────────────────────────────
  function handleSquareClick(sq:Sq){
    if(status==="checkmate"||status==="stalemate"||status==="draw")return;
    if(turn!==myColor)return; // not my turn
    const[r,c]=sq;
    const piece=board[r][c];

    if(selected){
      // Try to move selected piece to this square
      const isMovable=legalDests.some(d=>d[0]===sq[0]&&d[1]===sq[1]);
      if(isMovable){
        // Check if pawn promotion needed
        const selPiece=board[selected[0]][selected[1]]!;
        const isPromotion=selPiece.t==="P"&&((myColor==="w"&&sq[0]===0)||(myColor==="b"&&sq[0]===7));
        if(isPromotion){
          setPromotionPending({from:selected,to:sq});
          return;
        }
        executeMove(selected,sq,"Q");
        return;
      }
      // Click on own piece → re-select
      if(piece&&piece.c===myColor){
        setSelected(sq);
        setLegalDests(legalMoves(board,sq,ep));
        return;
      }
      // Deselect
      setSelected(null);setLegalDests([]);
    } else {
      if(piece&&piece.c===myColor){
        setSelected(sq);
        setLegalDests(legalMoves(board,sq,ep));
      }
    }
  }

  function executeMove(from:Sq,to:Sq,prom:PType){
    const seq=Date.now();
    channelRef.current?.send({type:"broadcast",event:"chess_move",
      payload:{from,to,prom,seq}});
    applyMoveToState(boardRef.current,from,to,prom,epRef.current,turnRef.current);
    setPromotionPending(null);
  }

  function handlePromotion(prom:PType){
    if(!promotionPending)return;
    executeMove(promotionPending.from,promotionPending.to,prom);
  }

  // ── Supabase Realtime ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(gameId==="local")return;
    const ch=supabase.channel(`chess_${gameId}`,{config:{broadcast:{self:false}}});
    channelRef.current=ch;
    ch.on("broadcast",{event:"chess_move"},({payload})=>{
      const seq:number=payload.seq??0;
      const key=`mv_${payload.from}`;
      if(seq&&lastSeqRef.current[key]>=seq)return;
      if(seq)lastSeqRef.current[key]=seq;
      if(statusRef.current==="checkmate"||statusRef.current==="stalemate")return;
      applyMoveToState(boardRef.current,payload.from as Sq,payload.to as Sq,
        payload.prom as PType,epRef.current,turnRef.current);
    });
    ch.on("broadcast",{event:"chess_forfeit"},()=>{
      if(statusRef.current==="checkmate"||statusRef.current==="stalemate")return;
      setWinner(myColor);
      setWinReason(`${opponentName} desistiu da partida!`);
      setStatus("checkmate");
    });

    ch.on("broadcast",{event:"rematch_request"},({payload})=>{
      setRematchRequester((payload.name as string)??opponentName);
      setRematchPhase("received");
    });

    ch.on("broadcast",{event:"rematch_response"},async({payload})=>{
      if(payload.accepted){
        if(BET>0&&profile?.id){
          const{data}=await supabase.from("profiles").select("balance").eq("id",profile.id).single();
          if(data)await supabase.from("profiles").update({balance:parseFloat(String(data.balance))-BET}).eq("id",profile.id);
        }
        setRematchPhase("idle");
        resetGame();
      }else if((payload.reason as string)==="no_balance"){
        setRematchPhase("opp_no_balance");
      }else{
        setRematchPhase("declined");
      }
    });

    ch.subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[gameId,applyMoveToState]);

  function resetGame(){
    setBoard(makeInitialBoard());setTurn("w");setEp(null);
    setSelected(null);setLegalDests([]);setLastMove(null);
    setHistory([]);setCaptured({w:[],b:[]});setStatus("playing");
    setWinner(null);setWinReason("");setPromotionPending(null);
    setTimers({w:600,b:600});
  }

  function handleForfeit(){
    if(status!=="playing"&&status!=="check")return;
    if(!window.confirm("Tens a certeza que queres desistir? Irás perder a partida."))return;
    channelRef.current?.send({type:"broadcast",event:"chess_forfeit",payload:{player:myColor}});
    setWinner(opponentColor);
    setWinReason("Desististe da partida");
    setStatus("checkmate");
  }

  function handleBack(){
    if((status==="playing"||status==="check")&&gameId!=="local"){
      if(!window.confirm("Se saíres agora, perdes a partida. Confirmas?"))return;
      channelRef.current?.send({type:"broadcast",event:"chess_forfeit",payload:{player:myColor}});
    }
    setLocation("/");
  }

  async function handleReplay(){
    if(gameId==="local"||BET===0){resetGame();return;}
    setRematchPhase("checking");
    const{data}=await supabase.from("profiles").select("balance").eq("id",profile!.id).single();
    if(!data||parseFloat(String(data.balance))<BET){setRematchPhase("no_balance");return;}
    setRematchPhase("waiting");
    channelRef.current?.send({type:"broadcast",event:"rematch_request",payload:{name:playerName.split(" ")[0]}});
  }

  async function handleRematchAccept(){
    if(!profile?.id)return;
    const{data}=await supabase.from("profiles").select("balance").eq("id",profile.id).single();
    if(!data||parseFloat(String(data.balance))<BET){
      channelRef.current?.send({type:"broadcast",event:"rematch_response",payload:{accepted:false,reason:"no_balance"}});
      setRematchPhase("idle");return;
    }
    if(BET>0)await supabase.from("profiles").update({balance:parseFloat(String(data.balance))-BET}).eq("id",profile.id);
    channelRef.current?.send({type:"broadcast",event:"rematch_response",payload:{accepted:true}});
    setRematchPhase("idle");
    resetGame();
  }

  function handleRematchDecline(){
    channelRef.current?.send({type:"broadcast",event:"rematch_response",payload:{accepted:false,reason:"declined"}});
    setRematchPhase("idle");
  }

  const oppTimer=timers[opponentColor];
  const myTimer=timers[myColor];
  const oppCheck=status==="check"&&turn===opponentColor;
  const myCheck=status==="check"&&turn===myColor;

  return(
    <div style={{height:"100vh",width:"100%",overflow:"hidden",
      background:"linear-gradient(180deg,#0A0F1E 0%,#060B14 100%)",
      display:"flex",justifyContent:"center"}}>

      <div style={{width:"100%",maxWidth:430,height:"100vh",
        display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 14px 8px",borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(5,12,32,0.9)",flexShrink:0}}>
          <button onClick={handleBack} style={{width:34,height:34,borderRadius:9,
            background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <ArrowLeft style={{width:16,height:16,color:"#9BB4E8"}}/>
          </button>
          <div style={{textAlign:"center"}}>
            <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:17,
              color:"#E8F0FF",lineHeight:1,letterSpacing:5,
              textShadow:"0 0 20px rgba(245,200,66,0.5)"}}>XADREZ</p>
            <p style={{fontSize:9,color:"rgba(255,255,255,0.28)",marginTop:1,letterSpacing:2.5,fontWeight:700}}>
              1 VS 1
            </p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {(status==="playing"||status==="check")&&gameId!=="local"&&(
              <button onClick={handleForfeit} style={{width:34,height:34,borderRadius:9,
                background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <LogOut style={{width:15,height:15,color:"#EF4444"}}/>
              </button>
            )}
            <div style={{padding:"4px 10px",background:"linear-gradient(135deg,rgba(245,200,66,0.15),rgba(245,200,66,0.06))",
              border:"1px solid rgba(245,200,66,0.25)",borderRadius:8}}>
              <span style={{fontSize:10,color:"#F5C842",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>
                {BET>0?`${BET} MT`:"Demo"}
              </span>
            </div>
          </div>
        </div>

        {/* Opponent panel (top) */}
        <div style={{padding:"6px 10px 4px",flexShrink:0}}>
          <PlayerPanel
            name={opponentName} isMe={false} isActive={turn===opponentColor}
            color={opponentColor} timer={oppTimer}
            captured={captured[opponentColor]} isCheck={oppCheck}
          />
        </div>

        {/* Move history */}
        <div style={{padding:"0 10px 4px",flexShrink:0}}>
          <MoveHistory history={history}/>
        </div>

        {/* Board */}
        <div style={{flex:1,minHeight:0,padding:"0 26px 0 26px",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:"100%",maxHeight:"100%",aspectRatio:"1"}}>
            <ChessBoard
              board={board} selected={selected} legalDests={legalDests}
              lastMove={lastMove} checkSquare={checkSquare}
              myColor={myColor} onSquareClick={handleSquareClick}
            />
          </div>
        </div>

        {/* My panel (bottom) */}
        <div style={{padding:"4px 10px 8px",flexShrink:0}}>
          <PlayerPanel
            name={playerName} isMe={true} isActive={turn===myColor}
            color={myColor} timer={myTimer}
            captured={captured[myColor]} isCheck={myCheck}
          />
        </div>

        {/* Turn indicator */}
        <div style={{padding:"3px 10px 8px",display:"flex",justifyContent:"center",flexShrink:0}}>
          <motion.div animate={{opacity:[0.6,1,0.6]}} transition={{duration:1.8,repeat:Infinity}}
            style={{display:"flex",alignItems:"center",gap:4,background:"rgba(5,12,32,0.65)",
              border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"3px 10px"}}>
            <div style={{width:4.5,height:4.5,borderRadius:"50%",
              background:turn==="w"?"#F5C842":"#6366F1",
              boxShadow:turn==="w"?"0 0 4px #F5C842":"0 0 4px #6366F1"}}/>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",
              color:turn==="w"?"#F5C842":"#6366F1"}}>
              {turn===myColor?`Tua vez — ${playerName.split(" ")[0]}`:`Vez de ${opponentName}`}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Promotion modal */}
      <AnimatePresence>
        {promotionPending&&<PromotionModal color={myColor} onChoose={handlePromotion}/>}
      </AnimatePresence>

      {/* Win screen */}
      <AnimatePresence>
        {(winner||status==="stalemate"||status==="draw")&&(
          <WinScreen
            winner={winner??myColor}
            winnerName={winner?(winner===myColor?playerName:opponentName):"Empate"}
            loserName={winner?(winner===myColor?opponentName:playerName):"—"}
            reason={winReason}
            betAmount={BET}
            isWinner={!!(winner&&winner===myColor)}
            onReplay={handleReplay}
            onQuit={()=>setLocation("/")}
          />
        )}
      </AnimatePresence>

      {/* Rematch overlay */}
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
