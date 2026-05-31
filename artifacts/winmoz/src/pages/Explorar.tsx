import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, Play, Users, Clock, Trophy, Zap, Plus, Hash, ArrowRight, Shield, SlidersHorizontal, X, CheckCircle2, Key, Send
} from "lucide-react";
import { Link, useLocation } from "wouter";
import BottomNav from "@/components/BottomNav";
import { AtualizacoesCards } from "./Home";

const TABS = ["Jogos", "Assistir", "Sala", "Novidades", "Chat"] as const;
type Tab = typeof TABS[number];

const GAME_FILTERS = ["Todos", "Damas", "Ludo", "Xadrez", "Padrão"] as const;
type GameFilter = typeof GAME_FILTERS[number];

const jogosCards = [
  { id: "damas",       name: "Damas Clássico",  desc: "Jogo de Tabuleiro • 12 Modos", players: "2.4K jogadores", color: "from-blue-500 to-indigo-700",     initials: "DA", hot: true,  category: "Damas",  image: "/damas-card.jpg"   },
  { id: "ludo",        name: "Ludo Turbo",       desc: "Jogo de Dados • 6 Modos",      players: "4.1K jogadores", color: "from-emerald-500 to-teal-700",    initials: "LU", hot: true,  category: "Ludo",   image: "/ludo-card2.png"   },
  { id: "xadrez",      name: "Xadrez Rápido",    desc: "Estratégia Real • 8 Modos",    players: "1.2K jogadores", color: "from-violet-500 to-purple-800",   initials: "XA", hot: false, category: "Xadrez", image: "/xadrez-card.jpg"  },
  { id: "damas-pro",   name: "Damas Pro",        desc: "Jogo de Tabuleiro • 4 Modos",  players: "980 jogadores",  color: "from-orange-500 to-red-700",     initials: "DP", hot: false, category: "Damas",  image: "/damas-card.jpg"   },
  { id: "ludo-classic",name: "Ludo Clássico",    desc: "Jogo de Dados • 3 Modos",      players: "760 jogadores",  color: "from-pink-500 to-rose-700",      initials: "LC", hot: false, category: "Ludo",   image: "/ludo-card2.png"   },
  { id: "padrao",      name: "Jogo Padrão",      desc: "Clássico • 5 Modos",           players: "1.8K jogadores", color: "from-amber-500 to-yellow-600",   initials: "JP", hot: false, category: "Padrão", image: null                },
  { id: "bilhar",      name: "Bilhar Apostado",  desc: "Jogo de Mesa • 5 Modos",       players: "890 jogadores",  color: "from-cyan-500 to-blue-700",      initials: "BI", hot: false, category: "Padrão", image: "/bilhar-card.webp" },
  { id: "roleta",      name: "Roleta da Sorte",  desc: "Sorte • 3 Modos",              players: "1.5K jogadores", color: "from-pink-600 to-rose-800",      initials: "RS", hot: true,  category: "Padrão", image: "/roleta-card.jpg"  },
];

const partidasTempoReal = [
  { id:"p1", game:"Damas Clássico",  players:"João M. vs Carlos F.",  viewers:"142", time:"8min",  bet:"500 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA", image:"/damas-card.jpg"   },
  { id:"p2", game:"Ludo Turbo",      players:"Maria S. vs Pedro A.",  viewers:"89",  time:"12min", bet:"200 MT",   status:"AO VIVO", color:"from-emerald-500 to-teal-700",  initials:"LU", image:"/ludo-card2.png"   },
  { id:"p3", game:"Xadrez Rápido",   players:"Ana L. vs Bruno K.",    viewers:"310", time:"3min",  bet:"1.000 MT", status:"AO VIVO", color:"from-violet-500 to-purple-800", initials:"XA", image:"/xadrez-card.jpg"  },
];

const partidasAssistir = [
  { id:"a1", game:"Damas Pro",       players:"Ricardo M. vs Filipe O.", viewers:"528", time:"22min", bet:"2.500 MT", status:"AO VIVO", color:"from-orange-500 to-red-700",    initials:"DP", image:"/damas-card.jpg"   },
  { id:"a2", game:"Damas Clássico",  players:"Tomás V. vs Nuno B.",     viewers:"201", time:"17min", bet:"750 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA", image:"/damas-card.jpg"   },
  { id:"a3", game:"Ludo Turbo",      players:"Celina R. vs Amina D.",   viewers:"134", time:"5min",  bet:"300 MT",   status:"AO VIVO", color:"from-emerald-500 to-teal-700",  initials:"LU", image:"/ludo-card2.png"   },
  { id:"a4", game:"Xadrez Rápido",   players:"Hugo F. vs Paulo C.",     viewers:"440", time:"31min", bet:"3.000 MT", status:"AO VIVO", color:"from-violet-500 to-purple-800", initials:"XA", image:"/xadrez-card.jpg"  },
  { id:"a5", game:"Damas Clássico",  players:"Lúcia M. vs Beatriz S.",  viewers:"97",  time:"9min",  bet:"400 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA", image:"/damas-card.jpg"   },
  { id:"a6", game:"Ludo Clássico",   players:"Marco T. vs Sandro P.",   viewers:"63",  time:"14min", bet:"150 MT",   status:"AO VIVO", color:"from-pink-500 to-rose-700",     initials:"LC", image:"/ludo-card2.png"   },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function GameCard({ game }: { game: typeof jogosCards[0] }) {
  const [, setLocation] = useLocation();
  const betId = game.id.split("-")[0];
  const handlePlay = () => {
    if (!localStorage.getItem("winmoz_logged_in")) { setLocation("/login"); return; }
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
          <span className="text-[10px] text-violet-600 font-medium flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5" />{game.players}
          </span>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

function MatchCard({ match }: { match: typeof partidasTempoReal[0] }) {
  const [, setLocation] = useLocation();
  const handleWatch = () => {
    if (!localStorage.getItem("winmoz_logged_in")) { setLocation("/login"); return; }
  };
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 group cursor-pointer"
    >
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative">
        {match.image ? (
          <img src={match.image} alt={match.game} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${match.color} flex items-center justify-center text-white font-syne font-bold text-xs`}>
            {match.initials}
          </div>
        )}
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
      </div>
      <div className="ml-2.5 flex-1 min-w-0">
        <p className="font-syne font-semibold text-slate-900 text-[12px] truncate">{match.players}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[8.5px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200">{match.status}</span>
          <span className="text-[10px] text-slate-400">{match.game}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400"><Users className="w-2.5 h-2.5" />{match.viewers}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className="text-[10px] font-bold text-violet-700">{match.bet}</span>
        <button
          onClick={(e) => { e.stopPropagation(); handleWatch(); }}
          className="w-7 h-7 rounded-full bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center transition-colors">
          <Play className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </motion.div>
  );
}

const RECENT_ROOMS = [
  { id: "WM-4821", game: "Damas Clássico", players: "2/2", bet: "500 MT",   color: "from-blue-500 to-indigo-700",   initials: "DA" },
  { id: "WM-3307", game: "Ludo Turbo",     players: "3/4", bet: "200 MT",   color: "from-emerald-500 to-teal-700",  initials: "LU" },
  { id: "WM-9154", game: "Xadrez Rápido",  players: "1/2", bet: "1.000 MT", color: "from-violet-500 to-purple-800", initials: "XA" },
];

function SalaTab() {
  const [roomId, setRoomId] = useState("");
  const [view, setView] = useState<"main" | "entrar" | "criar">("main");

  /* ── ENTRAR EM SALA ── */
  if (view === "entrar") {
    return (
      <motion.div key="entrar" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        {/* Back */}
        <button onClick={() => setView("main")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" />
          </div>
          Voltar
        </button>

        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Entrar em Sala</h2>
        <p className="text-slate-400 text-sm mb-6">Introduz o código da sala para participar numa partida privada.</p>

        {/* Input */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
          <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Código da Sala</label>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus-within:border-violet-500 transition-colors">
            <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text" placeholder="Ex: WM-4821" value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              maxLength={10}
              className="flex-1 bg-transparent text-slate-900 font-syne font-bold text-base outline-none placeholder-slate-300 tracking-widest"
            />
            {roomId.length > 0 && (
              <button onClick={() => setRoomId("")} className="text-slate-300 hover:text-slate-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            disabled={roomId.length < 3}
            className={`w-full mt-3.5 h-12 rounded-xl font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              roomId.length >= 3
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {roomId.length >= 3 ? <>Entrar na Sala <ArrowRight className="w-4 h-4" /></> : "Introduz o código"}
          </button>
        </div>

        {/* Recent rooms */}
        <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Salas Recentes</p>
        <div className="flex flex-col gap-2">
          {RECENT_ROOMS.map((room, idx) => (
            <motion.button key={room.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
              onClick={() => setRoomId(room.id)}
              className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left w-full group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${room.color} flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0`}>
                {room.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-syne font-bold text-slate-900 text-sm">{room.game}</p>
                <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">{room.id} · {room.players} jogadores</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-bold text-slate-700">{room.bet}</p>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 ml-auto group-hover:text-slate-600 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  /* ── CRIAR SALA ── */
  if (view === "criar") {
    const games = [
      { name: "Damas Clássico", desc: "12 modos de jogo", color: "from-blue-500 to-indigo-700",  initials: "DA" },
      { name: "Ludo Turbo",     desc: "6 modos de jogo",  color: "from-emerald-500 to-teal-700", initials: "LU" },
      { name: "Xadrez Rápido",  desc: "8 modos de jogo",  color: "from-violet-500 to-purple-800",initials: "XA" },
    ];
    return (
      <motion.div key="criar" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">
        <button onClick={() => setView("main")} className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-6 hover:text-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" />
          </div>
          Voltar
        </button>

        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Criar Nova Sala</h2>
        <p className="text-slate-400 text-sm mb-6">Escolhe o jogo e convida os teus amigos para uma partida privada.</p>

        <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Selecciona o Jogo</p>
        <div className="flex flex-col gap-2 mb-5">
          {games.map(g => (
            <button key={g.name} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left group">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0`}>
                {g.initials}
              </div>
              <div className="flex-1">
                <p className="font-syne font-bold text-slate-900 text-sm">{g.name}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{g.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 mb-5">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">⚡</span>
          <p className="text-sm text-amber-700 leading-relaxed font-medium">
            Criação de salas estará disponível em breve. Estamos a finalizar os últimos detalhes!
          </p>
        </div>

        <button disabled className="w-full h-12 rounded-xl font-syne font-bold text-sm bg-slate-100 text-slate-300 cursor-not-allowed flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Criar Sala — Em Breve
        </button>
      </motion.div>
    );
  }

  /* ── MAIN VIEW ── */
  return (
    <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pb-6">

      {/* Title */}
      <div className="mb-5">
        <h2 className="font-syne font-bold text-slate-900 text-xl mb-1">Salas Privadas</h2>
        <p className="text-slate-400 text-sm">Entra num jogo com código ou cria a tua própria sala.</p>
      </div>

      {/* Stats strip */}
      <div className="flex gap-2 mb-5">
        {[
          { label: "Salas Activas",   value: "247" },
          { label: "Online Agora",    value: "1.8K" },
          { label: "Apostas/Dia",     value: "92K MZN" },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="font-syne font-bold text-slate-900 text-base leading-tight">{s.value}</p>
            <p className="text-[9.5px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="flex flex-col gap-3">
        {/* Entrar */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("entrar")}
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left w-full group"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md group-hover:bg-slate-800 transition-colors">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-slate-900 text-base">Entrar em Sala</p>
            <p className="text-slate-400 text-[12.5px] mt-0.5">Tens um código? Junta-te a uma partida agora.</p>
            <p className="text-[11px] font-semibold text-violet-600 mt-1.5">{RECENT_ROOMS.length} salas visitadas recentemente</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-900 transition-colors">
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
        </motion.button>

        {/* Criar */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("criar")}
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left w-full group"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
            <Plus className="w-6 h-6 text-slate-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-syne font-bold text-slate-900 text-base">Criar Sala</p>
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Em breve</span>
            </div>
            <p className="text-slate-400 text-[12.5px]">Cria a tua sala e desafia os teus amigos.</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
        </motion.button>
      </div>

      {/* Recent rooms preview */}
      <div className="mt-6">
        <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Salas Recentes</p>
        <div className="flex flex-col gap-2">
          {RECENT_ROOMS.map((room, idx) => (
            <motion.div key={room.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.06 }}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${room.color} flex items-center justify-center text-white font-syne font-bold text-xs flex-shrink-0`}>
                {room.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-syne font-semibold text-slate-900 text-sm">{room.game}</p>
                <p className="text-[10.5px] text-slate-400 font-mono">{room.id}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-bold text-slate-700">{room.bet}</p>
                <p className="text-[9.5px] text-slate-400">{room.players} jogadores</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 136px)" }}>
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

  const handleTabChange = (tab: Tab) => {
    const protectedTabs: Tab[] = ["Sala", "Chat"];
    if (protectedTabs.includes(tab) && !localStorage.getItem("winmoz_logged_in")) {
      setLocation("/login");
      return;
    }
    setActiveTab(tab);
  };

  const filteredJogos = jogosCards.filter(g => {
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
                  {filteredJogos.map(game => <GameCard key={game.id} game={game} />)}
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
                  {partidasTempoReal.map(match => <MatchCard key={match.id} match={match} />)}
                </motion.div>
              </motion.div>
            )}

            {activeTab === "Assistir" && (
              <motion.div key="assistir" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="font-syne font-bold text-sm text-slate-900">Partidas ao Vivo</h2>
                  <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200">{partidasAssistir.length} ativas</span>
                </div>
                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {partidasAssistir.filter(m => !query || m.game.toLowerCase().includes(query.toLowerCase()) || m.players.toLowerCase().includes(query.toLowerCase())).map(match => <MatchCard key={match.id} match={match} />)}
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

            {activeTab === "Chat" && (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <ChatTab />
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
