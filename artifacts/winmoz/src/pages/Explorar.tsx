import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, Play, Users, Clock, Trophy, Zap, Plus, Hash, ArrowRight, Shield, SlidersHorizontal, X, CheckCircle2, Key, Send, Lock, Copy, Check, AlertCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import BottomNav from "@/components/BottomNav";
import { AtualizacoesCards } from "./Home";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getLivePlayerCount, formatPlayerCount, generateMatchPool, getSalaOnlineCount, formatOnlineCount, type SimMatch } from "@/lib/simulation";

const TABS = ["Jogos", "Assistir", "Sala", "Novidades", "Chat"] as const;
type Tab = typeof TABS[number];

const GAME_FILTERS = ["Todos", "Damas", "Ludo", "Xadrez"] as const;
type GameFilter = typeof GAME_FILTERS[number];

const jogosCardsMeta = [
  { id: "damas",        name: "Damas Clássico",  desc: "Jogo de Tabuleiro • 12 Modos", baseIdx: 0, color: "from-blue-500 to-indigo-700",     initials: "DA", hot: true,  category: "Damas",  image: "/damas-card.jpg"   },
  { id: "ludo",         name: "Ludo Turbo",       desc: "Jogo de Dados • 4 Modos",      baseIdx: 1, color: "from-emerald-500 to-teal-700",    initials: "LU", hot: true,  category: "Ludo",   image: "/ludo-card2.png"   },
  { id: "xadrez",       name: "Xadrez Rápido",    desc: "Estratégia Real • 8 Modos",    baseIdx: 2, color: "from-violet-500 to-purple-800",   initials: "XA", hot: false, category: "Xadrez", image: "/xadrez-card.jpg"  },
  { id: "ludo-classic", name: "Ludo Clássico",    desc: "Jogo de Dados • 3 Modos",      baseIdx: 3, color: "from-pink-500 to-rose-700",       initials: "LC", hot: false, category: "Ludo",   image: "/ludo-card2.png"   },
  { id: "bilhar",       name: "Bilhar Apostado",  desc: "Jogo de Mesa • 5 Modos",       baseIdx: 5, color: "from-cyan-500 to-blue-700",        initials: "BI", hot: false, category: "Xadrez", image: "/bilhar-card.webp" },
  { id: "roleta",       name: "Roleta da Sorte",  desc: "Sorte • 3 Modos",              baseIdx: 6, color: "from-pink-600 to-rose-800",        initials: "RS", hot: true,  category: "Damas",  image: "/roleta-card.jpg"  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function GameCard({ game, tick }: { game: typeof jogosCardsMeta[0]; tick: number }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const betId = game.id.split("-")[0];
  const count = getLivePlayerCount(game.baseIdx, tick);
  const handlePlay = () => {
    if (!user) { setLocation("/login"); return; }
    if (game.id === "bilhar") { setLocation("/bilhar-em-breve"); return; }
    if (game.id === "roleta") { setLocation("/roleta"); return; }
    setLocation(`/apostar/${betId}`);
  };
  return (
    <motion.div
      variants={fadeUp}
      onClick={handlePlay}
      className="flex items-center p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 group cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm flex-shrink-0">
        {game.image ? (
          <img src={game.image} alt={game.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${game.color} flex items-center justify-center text-white font-syne font-bold text-sm`}>
            {game.initials}
          </div>
        )}
      </div>
      <div className="ml-2.5 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="font-syne font-bold text-slate-900 text-[13px] truncate">{game.name}</h4>
          {game.hot && (
            <span className="bg-orange-50 text-orange-600 text-[8px] font-bold px-1 py-0.5 rounded-full border border-orange-200 flex-shrink-0 flex items-center gap-0.5">
              <Zap className="w-2 h-2" /> HOT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">{game.desc}</span>
          {game.id !== "bilhar" && (
            <span className="text-[10px] text-violet-600 font-medium flex items-center gap-0.5">
              <Users className="w-2.5 h-2.5" />{formatPlayerCount(count)} a jogar
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

/** overlay shown when user tries to watch a private match */
function PrivateMatchOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "80%", maxWidth: 290, background: "#0f0f18",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24,
          padding: "28px 22px 22px", textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(124,58,237,0.15)",
          border: "1.5px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock style={{ width: 24, height: 24, color: "#a78bfa" }} />
        </div>
        <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 18,
          color: "#E8F0FF", marginBottom: 8 }}>Partida Privada</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 22, lineHeight: 1.6 }}>
          Esta partida é privada e não pode ser assistida. Junta-te a uma partida pública no separador Jogos.
        </p>
        <button onClick={onClose}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none",
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Fechar
        </button>
      </motion.div>
    </motion.div>
  );
}

function MatchCard({ match, isAssistirTab }: { match: SimMatch; isAssistirTab?: boolean }) {
  const [showPrivate, setShowPrivate] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // ms remaining (always positive while match is alive)
  const minsLeft = Math.max(0, Math.round((match.endsAt - Date.now()) / 60_000));
  const timeLabel = minsLeft <= 1 ? "< 1 min" : `${minsLeft} min`;

  const handleWatch = () => {
    if (!user) { setLocation("/login"); return; }
    if (isAssistirTab) { setShowPrivate(true); return; }
  };

  return (
    <>
      <motion.div
        variants={fadeUp}
        onClick={handleWatch}
        className="flex items-center p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 group cursor-pointer"
      >
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
          {match.image ? (
            <img src={match.image} alt={match.gameName} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${match.color} flex items-center justify-center text-white font-syne font-bold text-xs`}>
              {match.initials}
            </div>
          )}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
        </div>
        <div className="ml-2.5 flex-1 min-w-0">
          <p className="font-syne font-semibold text-slate-900 text-[12px] truncate">{match.player1} vs {match.player2}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8.5px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200">AO VIVO</span>
            <span className="text-[10px] text-slate-400">{match.gameName}</span>
            {!isAssistirTab && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                <Clock className="w-2.5 h-2.5" />{timeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-[10px] font-bold text-violet-700">{match.bet}</span>
          {isAssistirTab ? (
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <Lock className="w-3 h-3 text-slate-400" />
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleWatch(); }}
              className="w-7 h-7 rounded-full bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center transition-colors">
              <Play className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {showPrivate && <PrivateMatchOverlay onClose={() => setShowPrivate(false)} />}
      </AnimatePresence>
    </>
  );
}

// ── Room types & helpers ─────────────────────────────────────────────────────

interface RoomRecord {
  code: string;
  gameId: string;
  gameName: string;
  betAmount: number;
  createdAt: number;
  status: "waiting" | "matched" | "expired";
}

const SALA_GAMES = [
  { id: "damas",  name: "Damas Clássico", desc: "12 modos de jogo", image: "/damas-card.jpg",   imagePos: "center" },
  { id: "ludo",   name: "Ludo Turbo",     desc: "4 modos de jogo",  image: "/ludo-card2.png",   imagePos: "center 65%" },
  { id: "xadrez", name: "Xadrez Rápido",  desc: "8 modos de jogo",  image: "/xadrez-card.jpg",  imagePos: "center 30%" },
];

const SALA_BET_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];

function genRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "WM-" + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function loadRooms(): RoomRecord[] {
  try { return JSON.parse(localStorage.getItem("wm_rooms") || "[]"); } catch { return []; }
}

function saveRooms(rooms: RoomRecord[]) {
  try { localStorage.setItem("wm_rooms", JSON.stringify(rooms)); } catch { /* ignore */ }
}

type SalaView = "main" | "entrar" | "criar" | "criar-aposta" | "room-created" | "room-waiting" | "join-loading" | "join-confirm";

function SalaTab() {
  const [view, setView] = useState<SalaView>("main");
  const [inputCode, setInputCode] = useState("");
  const [selectedGame, setSelectedGame] = useState<typeof SALA_GAMES[0] | null>(null);
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [activeCode, setActiveCode] = useState("");
  const [roomRole, setRoomRole] = useState<"creator" | "joiner">("creator");
  const [activeGameId, setActiveGameId] = useState("damas");
  const [activeBet, setActiveBet] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRooms, setMyRooms] = useState<RoomRecord[]>(() => loadRooms());
  const [tick, setTick] = useState(0);
  const [waitFound, setWaitFound] = useState(false);
  const [waitRemaining, setWaitRemaining] = useState(300);
  const matchedRef = useRef(false);
  const channelRef = useRef<any>(null);
  const { user, profile, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const onlineCount = getSalaOnlineCount(tick);
  const activeRoomCount = 358 + Math.min(myRooms.filter(r => r.status === "waiting").length, 50);

  async function deductBalance(amount: number, _desc: string, gameRoomCode?: string): Promise<boolean> {
    if (!user?.id) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      if (!token) return false;
      const roomId = gameRoomCode ?? `lobby-${Date.now()}`;
      const resp = await fetch("/api/games/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ gameId: roomId, gameType: "Ludo", betAmount: amount, opponentName: "adversário" }),
      });
      const result = await resp.json() as { ok: boolean; duplicate?: boolean; error?: string };
      if (result.ok || result.duplicate) { refreshProfile(); return true; }
      return false;
    } catch { return false; }
  }

  async function refundBalance(amount: number, code: string) {
    if (!user?.id || amount <= 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      if (!token) return;
      await fetch("/api/games/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ roomCode: code, amount, gameType: "Ludo" }),
      });
      refreshProfile();
    } catch { /* ignore */ }
  }

  function navigateToGame(gameId: string, color: string, oppName: string, bet: number, gameRoom: string) {
    const myEnc = encodeURIComponent(profile?.full_name ?? "Jogador");
    const oppEnc = encodeURIComponent(oppName);
    let dest = "/explorar";
    if (gameId === "ludo") dest = `/ludo-jogo?gameId=${gameRoom}&color=${color}&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
    else if (gameId === "xadrez") dest = `/xadrez-jogo?gameId=${gameRoom}&color=${color === "blue" ? "white" : "black"}&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
    else dest = `/damas-jogo?gameId=${gameRoom}&color=${color === "blue" ? "w" : "b"}&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
    setLocation(dest);
  }

  // Setup Supabase channel when in room-waiting
  useEffect(() => {
    if (view !== "room-waiting" || !activeCode || !user?.id) return;
    matchedRef.current = false;
    const channel = supabase.channel(`room_${activeCode}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "room_match" }, ({ payload }) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      const myColor = payload.blue === user.id ? "blue" : "green";
      const oppName = myColor === "green" ? (payload.blueName ?? "Adversário") : (payload.greenName ?? "Adversário");
      const updated = loadRooms().map(r => r.code === activeCode ? { ...r, status: "matched" as const } : r);
      saveRooms(updated); setMyRooms(updated);
      setWaitFound(true);
      setTimeout(() => { navigateToGame(activeGameId, myColor, oppName, activeBet, `${payload.blue}_${payload.green}`); supabase.removeChannel(channel); }, 1500);
    });

    const tryMatch = () => {
      if (matchedRef.current) return;
      const state = channel.presenceState<{ displayName?: string }>();
      const ids = Object.keys(state).sort();
      if (ids.length < 2 || ids[0] !== user.id) return;
      matchedRef.current = true;
      const oppId = ids[1];
      const oppName = ((state[oppId] as any)?.[0] as any)?.displayName ?? "Adversário";
      channel.send({ type: "broadcast", event: "room_match", payload: { blue: user.id, green: oppId, blueName: profile?.full_name ?? "Jogador", greenName: oppName } });
      const updated = loadRooms().map(r => r.code === activeCode ? { ...r, status: "matched" as const } : r);
      saveRooms(updated); setMyRooms(updated);
      setWaitFound(true);
      setTimeout(() => { navigateToGame(activeGameId, "blue", oppName, activeBet, `${user.id}_${oppId}`); supabase.removeChannel(channel); }, 1500);
    };

    channel.on("presence", { event: "sync" }, tryMatch);
    channel.on("presence", { event: "join" }, tryMatch);
    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") await channel.track({ userId: user.id, displayName: profile?.full_name ?? "Jogador", gameId: activeGameId, betAmount: activeBet });
    });
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeCode, user?.id]);

  // Countdown when waiting
  useEffect(() => {
    if (view !== "room-waiting" || waitFound) return;
    if (waitRemaining <= 0) { refundBalance(activeBet, activeCode); setView("main"); return; }
    const t = setInterval(() => setWaitRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [view, waitRemaining, waitFound]);

  // ── JOIN LOADING — fetch creator's game/bet from channel presence ──────────
  // MUST stay here (before any early returns) to obey React Rules of Hooks
  useEffect(() => {
    if (view !== "join-loading" || !activeCode || !user?.id) return;
    let done = false;
    const ch = supabase.channel(`room_${activeCode}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });

    const tryRead = () => {
      if (done) return;
      const state = ch.presenceState<{ gameId?: string; betAmount?: number; displayName?: string }>();
      const ids = Object.keys(state).filter(id => id !== user.id);
      if (ids.length > 0) {
        const creatorInfo = (state[ids[0]] as any)?.[0];
        if (creatorInfo?.gameId && creatorInfo?.betAmount) {
          done = true;
          setActiveGameId(creatorInfo.gameId);
          setActiveBet(creatorInfo.betAmount);
          supabase.removeChannel(ch);
          setView("join-confirm");
          return;
        }
      }
    };

    ch.on("presence", { event: "sync" }, tryRead);
    ch.on("presence", { event: "join" }, tryRead);
    ch.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await ch.track({ userId: user.id, displayName: profile?.full_name ?? "Jogador" });
        tryRead();
      }
    });

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        supabase.removeChannel(ch);
        setError("Sala não encontrada ou já encerrada. Verifica o código.");
        setView("entrar");
      }
    }, 4000);

    return () => { done = true; clearTimeout(timer); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeCode, user?.id]);

  // ── ROOM WAITING ──────────────────────────────────────────────────────────
  if (view === "room-waiting") {
    const mins = String(Math.floor(waitRemaining / 60)).padStart(2, "0");
    const secs = String(waitRemaining % 60).padStart(2, "0");
    if (waitFound) return (
      <div className="flex flex-col items-center justify-center py-16 gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
          <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <p className="font-syne font-bold text-slate-900 text-xl">Adversário Encontrado!</p>
        <p className="text-slate-400 text-sm">A iniciar o jogo…</p>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #22c55e33", borderTopColor: "#22c55e" }} className="animate-spin" />
      </div>
    );
    return (
      <motion.div key="room-waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-6">
        <div className="flex flex-col items-center pt-4 pb-6 gap-4">
          <div className="relative" style={{ width: 84, height: 84 }}>
            <svg width="84" height="84" style={{ position: "absolute", inset: 0 }}>
              <circle cx="42" cy="42" r="36" fill="none" stroke="#f1f5f9" strokeWidth="5" />
              <circle cx="42" cy="42" r="36" fill="none" stroke="#7c3aed" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={String(2 * Math.PI * 36)}
                strokeDashoffset={String(2 * Math.PI * 36 * (1 - (300 - waitRemaining) / 300))}
                transform="rotate(-90 42 42)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-syne font-bold text-slate-900 text-base">{mins}:{secs}</span>
            </div>
          </div>
          <p className="font-syne font-bold text-slate-900 text-lg">Sala {activeCode}</p>
          <p className="text-slate-400 text-sm text-center px-4">
            {roomRole === "creator" ? "Partilha o código com o teu adversário para ele entrar na sala." : "A aguardar que o adversário aceite a partida…"}
          </p>
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full">
            <div className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
            <span className="text-xs font-semibold text-violet-700">A aguardar adversário em tempo real…</span>
          </div>
          {roomRole === "creator" && (
            <button onClick={() => { navigator.clipboard.writeText(activeCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-syne font-bold text-sm transition-all"
              style={{ background: copied ? "#22c55e" : "#7c3aed", color: "#fff" }}>
              {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar Código: {activeCode}</>}
            </button>
          )}
        </div>
        <button onClick={async () => { await refundBalance(activeBet, activeCode); setView("main"); }}
          className="w-full h-12 rounded-xl font-syne font-medium text-sm flex items-center justify-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4" /> Cancelar e Receber Reembolso
        </button>
      </motion.div>
    );
  }

  // ── ROOM CREATED ──────────────────────────────────────────────────────────
  if (view === "room-created") {
    return (
      <motion.div key="room-created" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pb-6">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-violet-700" />
          </div>
          <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Sala Criada!</h2>
          <p className="text-slate-400 text-sm">Partilha este código com o teu adversário</p>
        </div>
        <div className="bg-violet-50 border-2 border-violet-300 rounded-2xl p-6 mb-4 text-center">
          <p className="text-[11px] font-bold text-violet-500 uppercase tracking-widest mb-2">Código da Sala</p>
          <p className="font-syne font-extrabold text-4xl text-violet-800 tracking-widest mb-4">{activeCode}</p>
          <button onClick={() => { navigator.clipboard.writeText(activeCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-syne font-bold text-sm transition-all"
            style={{ background: copied ? "#22c55e" : "#7c3aed", color: "#fff" }}>
            {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar Código</>}
          </button>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 mb-5 flex items-center justify-between">
          <div><p className="text-xs text-slate-400 font-medium mb-0.5">Jogo</p><p className="font-syne font-bold text-slate-900 text-sm">{selectedGame?.name}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400 font-medium mb-0.5">Aposta</p><p className="font-syne font-bold text-violet-700 text-sm">{activeBet} MT</p></div>
        </div>
        <button onClick={() => { setWaitRemaining(300); setWaitFound(false); setView("room-waiting"); }}
          className="w-full py-4 rounded-xl font-syne font-bold text-sm flex items-center justify-center gap-2 text-white mb-3"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
          <ArrowRight className="w-4 h-4" /> Entrar na Sala
        </button>
        <button onClick={() => setView("main")} className="w-full h-11 rounded-xl font-syne font-medium text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
          Voltar ao Menu
        </button>
      </motion.div>
    );
  }

  // ── CRIAR APOSTA ──────────────────────────────────────────────────────────
  if (view === "criar-aposta") {
    return (
      <motion.div key="criar-aposta" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        <button onClick={() => setView("criar")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" /></div>
          Voltar
        </button>
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Valor da Aposta</h2>
        <p className="text-slate-400 text-sm mb-1">Jogo: <span className="font-semibold text-slate-700">{selectedGame?.name}</span></p>
        <p className="text-slate-400 text-sm mb-6">Saldo: <span className="font-bold text-emerald-600">{parseFloat(String(profile?.balance ?? "0")).toLocaleString("pt-PT")} MT</span></p>
        <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-3">Selecciona o Valor</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {SALA_BET_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => setSelectedBet(amt)}
              className={`py-3 rounded-xl font-syne font-bold text-sm border-2 transition-all ${selectedBet === amt ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-100 bg-white text-slate-700 hover:border-slate-300"}`}>
              {amt >= 1000 ? `${(amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1)}K` : amt} MT
            </button>
          ))}
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>}
        <button disabled={selectedBet === null || loading}
          onClick={async () => {
            if (!selectedBet || !selectedGame) return;
            setError(""); setLoading(true);
            try {
              const ok = await deductBalance(selectedBet, `Criação de sala – ${selectedGame.name}`);
              if (!ok) { setError("Saldo insuficiente. Por favor recarregue a sua conta."); setLoading(false); return; }
              const code = genRoomCode();
              const rec: RoomRecord = { code, gameId: selectedGame.id, gameName: selectedGame.name, betAmount: selectedBet, createdAt: Date.now(), status: "waiting" };
              const updated = [rec, ...loadRooms()];
              saveRooms(updated); setMyRooms(updated);
              setActiveCode(code); setActiveGameId(selectedGame.id); setActiveBet(selectedBet);
              setLoading(false); setView("room-created");
            } catch {
              setError("Erro ao criar sala. Tenta novamente.");
              setLoading(false);
            }
          }}
          className={`w-full py-4 rounded-xl font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all ${selectedBet === null ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "text-white"}`}
          style={selectedBet !== null ? { background: "linear-gradient(135deg,#7c3aed,#6d28d9)" } : {}}>
          {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><Key className="w-4 h-4" /> CRIAR SALA</>}
        </button>
      </motion.div>
    );
  }

  // ── CRIAR (select game) ────────────────────────────────────────────────────
  if (view === "criar") {
    return (
      <motion.div key="criar" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        <button onClick={() => setView("main")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" /></div>
          Voltar
        </button>
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Criar Nova Sala</h2>
        <p className="text-slate-400 text-sm mb-6">Selecciona o jogo para a tua sala privada.</p>
        <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-3">Selecciona o Jogo</p>
        <div className="flex flex-col gap-3">
          {SALA_GAMES.map(g => (
            <button key={g.id} onClick={() => { setSelectedGame(g); setSelectedBet(null); setError(""); setView("criar-aposta"); }}
              className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-100 hover:border-violet-300 hover:shadow-sm transition-all duration-200 text-left group">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                <img src={g.image} alt={g.name} className="w-full h-full object-cover" style={{ objectPosition: g.imagePos }} />
              </div>
              <div className="flex-1">
                <p className="font-syne font-bold text-slate-900 text-sm">{g.name}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{g.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-colors" />
            </button>
          ))}
        </div>
      </motion.div>
    );
  }

  // ── JOIN LOADING UI ───────────────────────────────────────────────────────
  if (view === "join-loading") {
    return (
      <motion.div key="join-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 gap-5">
        <div style={{ width: 56, height: 56, borderRadius: "50%", border: "4px solid #7c3aed33", borderTopColor: "#7c3aed" }} className="animate-spin" />
        <p className="font-syne font-bold text-slate-900 text-lg">A verificar sala…</p>
        <p className="text-slate-400 text-sm text-center">Código: <span className="font-mono font-bold text-slate-700">{activeCode}</span></p>
      </motion.div>
    );
  }

  // ── JOIN CONFIRM — show creator's game/bet; joiner confirms ───────────────
  if (view === "join-confirm") {
    const gameInfo = SALA_GAMES.find(g => g.id === activeGameId);
    return (
      <motion.div key="join-confirm" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        <button onClick={() => setView("entrar")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" /></div>
          Voltar
        </button>
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Confirmar Entrada</h2>
        <p className="text-slate-400 text-sm mb-5">Detalhes da sala criada pelo adversário:</p>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            {gameInfo && (
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                <img src={gameInfo.image} alt={gameInfo.name} className="w-full h-full object-cover" style={{ objectPosition: gameInfo.imagePos }} />
              </div>
            )}
            <div>
              <p className="font-syne font-bold text-slate-900 text-base">{gameInfo?.name ?? activeGameId}</p>
              <p className="text-xs text-slate-400 mt-0.5">Sala: <span className="font-mono font-bold text-violet-700">{activeCode}</span></p>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-3 bg-violet-50 border border-violet-100 rounded-xl">
            <span className="text-sm text-slate-600 font-medium">Valor a apostar:</span>
            <span className="font-syne font-extrabold text-violet-700 text-lg">{activeBet} MT</span>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">O teu saldo actual: <span className="font-bold text-emerald-600">{parseFloat(String(profile?.balance ?? "0")).toLocaleString("pt-PT")} MT</span></p>
        </div>
        {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>}
        <button disabled={loading}
          onClick={async () => {
            setError(""); setLoading(true);
            const ok = await deductBalance(activeBet, `Entrada em sala ${activeCode}`);
            if (!ok) { setError("Saldo insuficiente. Por favor recarregue a sua conta."); setLoading(false); return; }
            setLoading(false); setWaitRemaining(300); setWaitFound(false); setRoomRole("joiner"); setView("room-waiting");
          }}
          className="w-full py-4 rounded-xl font-syne font-bold text-sm flex items-center justify-center gap-2 text-white"
          style={{ background: loading ? "#7c3aed99" : "linear-gradient(135deg,#7c3aed,#6d28d9)", cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Confirmar e Entrar na Sala</>}
        </button>
      </motion.div>
    );
  }

  // ── ENTRAR ────────────────────────────────────────────────────────────────
  if (view === "entrar") {
    const myActiveRooms = myRooms.filter(r => r.status === "waiting");
    return (
      <motion.div key="entrar" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        <button onClick={() => setView("main")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" /></div>
          Voltar
        </button>
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Entrar em Sala</h2>
        <p className="text-slate-400 text-sm mb-6">Introduz o código da sala para participar numa partida privada.</p>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
          <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Código da Sala</label>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus-within:border-violet-500 transition-colors mb-3.5">
            <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input type="text" placeholder="Ex: WM-4X7Y" value={inputCode}
              onChange={e => { setInputCode(e.target.value.toUpperCase()); setError(""); }} maxLength={7}
              className="flex-1 bg-transparent text-slate-900 font-syne font-bold text-base outline-none placeholder-slate-300 tracking-widest" />
            {inputCode.length > 0 && <button onClick={() => setInputCode("")}><X className="w-4 h-4 text-slate-300 hover:text-slate-500" /></button>}
          </div>
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>}
          <button disabled={inputCode.length < 6 || loading}
            onClick={() => {
              if (inputCode.length < 6) return;
              const matched = myRooms.find(r => r.code === inputCode && r.status === "matched");
              if (matched) { setError("Este código já foi utilizado. A sala expirou."); return; }
              setActiveCode(inputCode); setRoomRole("joiner"); setSelectedBet(null); setError(""); setView("join-loading");
            }}
            className={`w-full h-12 rounded-xl font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              inputCode.length >= 6 ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}>
            {inputCode.length >= 6 ? <>Continuar <ArrowRight className="w-4 h-4" /></> : "Introduz o código"}
          </button>
        </div>
        {myActiveRooms.length > 0 && (
          <>
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Minhas Salas Activas</p>
            <div className="flex flex-col gap-2">
              {myActiveRooms.slice(0, 3).map((room, idx) => (
                <motion.button key={room.code} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
                  onClick={() => setInputCode(room.code)}
                  className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left w-full group">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={SALA_GAMES.find(g => g.id === room.gameId)?.image ?? "/damas-card.jpg"} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne font-bold text-slate-900 text-sm">{room.gameName}</p>
                    <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">{room.code}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-bold text-violet-700">{room.betAmount} MT</p>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 ml-auto group-hover:text-slate-600 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </motion.div>
    );
  }

  // ── MAIN ──────────────────────────────────────────────────────────────────
  const activeRooms = myRooms.filter(r => r.status === "waiting");
  return (
    <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
      <div className="mb-5">
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Salas Privadas</h2>
        <p className="text-slate-400 text-sm">Entra num jogo com código ou cria a tua própria sala.</p>
      </div>
      <div className="flex gap-2 mb-5">
        <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
          <p className="font-syne font-bold text-slate-900 text-base leading-tight">{activeRoomCount}</p>
          <p className="text-[9.5px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Salas Activas</p>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
          <p className="font-syne font-bold text-slate-900 text-base leading-tight">{formatOnlineCount(onlineCount)}</p>
          <p className="text-[9.5px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Online Agora</p>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
          <p className="font-syne font-bold text-slate-900 text-base leading-tight">92K MZN</p>
          <p className="text-[9.5px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Apostas/Dia</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 mb-6">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setError(""); setInputCode(""); setView("entrar"); }}
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left w-full group">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md group-hover:bg-slate-800 transition-colors">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-slate-900 text-base">Entrar em Sala</p>
            <p className="text-slate-400 text-[12.5px] mt-0.5">Tens um código? Junta-te a uma partida agora.</p>
            {activeRooms.length > 0 && <p className="text-[11px] font-semibold text-violet-600 mt-1.5">{activeRooms.length} sala{activeRooms.length > 1 ? "s" : ""} activa{activeRooms.length > 1 ? "s" : ""}</p>}
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-900 transition-colors">
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
        </motion.button>
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setError(""); setSelectedGame(null); setSelectedBet(null); setView("criar"); }}
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all duration-200 text-left w-full group">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
            <Plus className="w-6 h-6 text-violet-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-slate-900 text-base">Criar Sala</p>
            <p className="text-slate-400 text-[12.5px]">Cria a tua sala e desafia os teus amigos.</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 transition-colors">
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </div>
        </motion.button>
      </div>
      {myRooms.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Minhas Salas</p>
            <button onClick={() => { const updated = myRooms.filter(r => r.status === "waiting"); saveRooms(updated); setMyRooms(updated); }}
              className="text-[10px] text-red-400 font-semibold hover:underline">Limpar expiradas</button>
          </div>
          <div className="flex flex-col gap-2">
            {myRooms.slice(0, 6).map((room, idx) => (
              <motion.div key={room.code} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={SALA_GAMES.find(g => g.id === room.gameId)?.image ?? "/damas-card.jpg"} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-syne font-semibold text-slate-900 text-sm">{room.gameName}</p>
                  <p className="text-[10.5px] text-slate-400 font-mono">{room.code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-bold text-violet-700">{room.betAmount} MT</p>
                  <span className={`text-[9px] font-bold uppercase ${room.status === "waiting" ? "text-emerald-500" : "text-slate-400"}`}>
                    {room.status === "waiting" ? "Activa" : room.status === "matched" ? "Jogada" : "Expirada"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

const CHAT_MSGS = [
  { id: "1", user: "João M.", initials: "JM", bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)", text: "Alguém quer um desafio de Damas? Aposto 500 MT! 🎯", time: "10:30", isMe: false },
  { id: "2", user: "Maria S.", initials: "MS", bg: "linear-gradient(135deg,#ec4899,#9d174d)", text: "Aceito! Mas não perco fácil 😏", time: "10:31", isMe: false },
  { id: "3", user: "Carlos F.", initials: "CF", bg: "linear-gradient(135deg,#10b981,#065f46)", text: "Eu também quero entrar! Ludo Turbo às 20h? 🚀", time: "10:33", isMe: false },
  { id: "4", user: "Tu", initials: "EU", bg: "linear-gradient(135deg,#7c3aed,#6d28d9)", text: "Estou a ver tudo! Quando começa a partida?", time: "10:35", isMe: true },
  { id: "5", user: "João M.", initials: "JM", bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)", text: "Às 20h00! Vamos todos? Pode ser torneio em grupo 🏆", time: "10:36", isMe: false },
  { id: "6", user: "Ana R.", initials: "AR", bg: "linear-gradient(135deg,#f59e0b,#b45309)", text: "Conta comigo! Já fiz a recarga 🔥", time: "10:38", isMe: false },
  { id: "7", user: "Tu", initials: "EU", bg: "linear-gradient(135deg,#7c3aed,#6d28d9)", text: "Perfeito, às 20h então. Boa sorte a todos! 🎮", time: "10:39", isMe: true },
];

type ChatMsg = { id: string; user: string; initials: string; bg: string; text: string; time: string; isMe: boolean };

function ChatTab() {
  const [msgs, setMsgs] = useState<ChatMsg[]>(CHAT_MSGS);
  const [inputVal, setInputVal] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const sendMsg = () => {
    if (!inputVal.trim()) return;
    setMsgs(prev => [...prev, {
      id: `m${Date.now()}`,
      user: "Tu", initials: "EU", bg: "linear-gradient(135deg,#7c3aed,#6d28d9)",
      text: inputVal.trim(),
      time: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    }]);
    setInputVal("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 210px)" }}>
      {/* Members strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 12, borderBottom: "1px solid #f1f5f9", marginBottom: 12 }}>
        {[
          { initials: "JM", bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
          { initials: "MS", bg: "linear-gradient(135deg,#ec4899,#9d174d)" },
          { initials: "CF", bg: "linear-gradient(135deg,#10b981,#065f46)" },
          { initials: "AR", bg: "linear-gradient(135deg,#f59e0b,#b45309)" },
          { initials: "PA", bg: "linear-gradient(135deg,#8b5cf6,#4c1d95)" },
        ].map((m, i) => (
          <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>{m.initials}</div>
        ))}
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>+120</div>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>125 membros online</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8, scrollbarWidth: "none" }}>
        {msgs.map(msg => (
          <div key={msg.id} style={{ display: "flex", gap: 7, flexDirection: msg.isMe ? "row-reverse" : "row", alignItems: "flex-end" }}>
            {!msg.isMe && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: msg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{msg.initials}</div>
            )}
            <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: msg.isMe ? "flex-end" : "flex-start", gap: 3 }}>
              {!msg.isMe && <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginLeft: 2 }}>{msg.user}</span>}
              <div style={{ background: msg.isMe ? "#7c3aed" : "#fff", color: msg.isMe ? "#fff" : "#0f172a", padding: "9px 13px", borderRadius: msg.isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", fontSize: 13, lineHeight: 1.5, border: msg.isMe ? "none" : "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>{msg.text}</div>
              <span style={{ fontSize: 9.5, color: "#cbd5e1" }}>{msg.time}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #f1f5f9", paddingBottom: 4 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 99, paddingLeft: 16, paddingRight: 12, height: 44 }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Escreve uma mensagem..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "#0f172a", fontFamily: "inherit" }}
          />
        </div>
        <button
          onClick={sendMsg}
          style={{ width: 44, height: 44, borderRadius: "50%", background: "#7c3aed", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <Send style={{ width: 16, height: 16, color: "#fff" }} />
        </button>
      </div>
    </div>
  );
}

export default function Explorar() {
  const [activeTab, setActiveTab] = useState<Tab>("Jogos");
  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState<GameFilter>("Todos");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Tick increments every 20 s to drive smooth player count drift
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  // Epoch changes every 10 min to rotate expired matches
  const [epoch, setEpoch] = useState(() => Math.floor(Date.now() / (10 * 60_000)));
  const [liveMatches, setLiveMatches] = useState<SimMatch[]>(() => generateMatchPool(5, Math.floor(Date.now() / (10 * 60_000))));
  const [assistirMatches, setAssistirMatches] = useState<SimMatch[]>(() => generateMatchPool(12, Math.floor(Date.now() / (10 * 60_000)) + 9999));

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const newEpoch = Math.floor(now / (10 * 60_000));
      if (newEpoch !== epoch) {
        setEpoch(newEpoch);
        setLiveMatches(generateMatchPool(5, newEpoch));
        setAssistirMatches(generateMatchPool(12, newEpoch + 9999));
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [epoch]);

  // Replace expired individual matches with fresh ones
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setLiveMatches(prev => {
        const anyExpired = prev.some(m => m.endsAt < now);
        if (!anyExpired) return prev;
        return generateMatchPool(5, Math.floor(now / 1000));
      });
      setAssistirMatches(prev => {
        const anyExpired = prev.some(m => m.endsAt < now);
        if (!anyExpired) return prev;
        return generateMatchPool(12, Math.floor(now / 1000) + 7777);
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (tab === "Chat") {
      if (!user) { setLocation("/login"); return; }
      setLocation("/grupo-chat");
      return;
    }
    if (tab === "Sala" && !user) { setLocation("/login"); return; }
    setActiveTab(tab);
  };

  const filteredJogos = jogosCardsMeta.filter(g => {
    const matchSearch = !query || g.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = gameFilter === "Todos" || g.category === gameFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col relative pb-24">

        {/* HEADER — hidden when Chat tab is active */}
        {activeTab !== "Chat" && (
        <div className="relative pt-6 pb-4 px-4"
          style={{ background: "linear-gradient(160deg, #5B21B6 0%, #6D28D9 45%, #7C3AED 100%)" }}>
          <h1 className="font-syne font-extrabold text-xl text-white mb-3 relative z-10">Explorar</h1>
          <div className="relative z-10">
            <div className="flex items-center bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2.5 gap-2">
              <Search className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
              <input
                type="text" placeholder="Pesquisar jogos, partidas..." value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-white/50 text-[13px] outline-none font-medium"
              />
            </div>
          </div>
        </div>
        )}

        {/* TABS — scrollable */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
          <div className="flex gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`py-3.5 px-4 text-sm font-syne font-semibold transition-all duration-200 relative border-b-2 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab ? "text-violet-700 border-violet-600" : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 px-4 pt-4">
          <AnimatePresence mode="wait">

            {activeTab === "Jogos" && (
              <motion.div key="jogos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {/* Jogos section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-violet-600" />
                    <h2 className="font-syne font-bold text-sm text-slate-900">Jogos</h2>
                    {gameFilter !== "Todos" && (
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{gameFilter}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setFilterOpen(true)}
                    className="flex items-center gap-1.5 text-violet-700 text-xs font-semibold bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl hover:bg-violet-100 transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3" /> Filtrar Jogos
                  </button>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {filteredJogos.map(game => <GameCard key={game.id} game={game} tick={tick} />)}
                  {filteredJogos.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">Nenhum jogo encontrado para "{gameFilter}"</div>
                  )}
                </motion.div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <h2 className="font-syne font-bold text-sm text-slate-900">Partidas em Tempo Real</h2>
                  </div>
                  <button className="text-violet-700 text-xs font-semibold hover:underline">Ver todas</button>
                </div>
                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {liveMatches.map(match => <MatchCard key={match.id} match={match} />)}
                </motion.div>
              </motion.div>
            )}

            {activeTab === "Assistir" && (
              <motion.div key="assistir" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="font-syne font-bold text-sm text-slate-900">Partidas ao Vivo</h2>
                  <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200">{assistirMatches.length} ativas</span>
                </div>
                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {assistirMatches
                    .filter(m => !query || m.gameName.toLowerCase().includes(query.toLowerCase()) || m.player1.toLowerCase().includes(query.toLowerCase()) || m.player2.toLowerCase().includes(query.toLowerCase()))
                    .map(match => <MatchCard key={match.id} match={match} isAssistirTab />)}
                </motion.div>
              </motion.div>
            )}

            {activeTab === "Sala" && <SalaTab />}

            {activeTab === "Novidades" && (
              <motion.div key="novidades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📢</span>
                  <h2 className="font-syne font-bold text-sm text-slate-900">Últimas Atualizações</h2>
                </div>
                <AtualizacoesCards />
              </motion.div>
            )}


          </AnimatePresence>
        </div>

        {/* FILTER SHEET */}
        <AnimatePresence>
          {filterOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50" onClick={() => setFilterOpen(false)}
              />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white rounded-t-3xl z-50 p-6 pb-10 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-syne font-bold text-lg text-slate-900">Filtrar Jogos</h3>
                  <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {GAME_FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => { setGameFilter(f); setFilterOpen(false); }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                        gameFilter === f ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-100 bg-white text-slate-700 hover:border-violet-200"
                      }`}
                    >
                      <span className="font-syne font-semibold text-sm">{f}</span>
                      {gameFilter === f && <CheckCircle2 className="w-5 h-5 text-violet-600" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </div>
  );
}
