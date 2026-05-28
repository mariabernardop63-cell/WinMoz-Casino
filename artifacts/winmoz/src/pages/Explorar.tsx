import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, Play, Users, Clock, Trophy, Zap, Plus, Hash, ArrowRight, Shield, SlidersHorizontal, X, CheckCircle2, Key
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { AtualizacoesCards } from "./Home";

const TABS = ["Jogos", "Assistir", "Sala", "Novidades"] as const;
type Tab = typeof TABS[number];

const GAME_FILTERS = ["Todos", "Damas", "Ludo", "Xadrez", "Padrão"] as const;
type GameFilter = typeof GAME_FILTERS[number];

const jogosCards = [
  { id: "damas",       name: "Damas Clássico",  desc: "Jogo de Tabuleiro • 12 Modos", players: "2.4K jogadores", color: "from-blue-500 to-indigo-700",     initials: "DA", hot: true,  category: "Damas" },
  { id: "ludo",        name: "Ludo Turbo",       desc: "Jogo de Dados • 6 Modos",      players: "4.1K jogadores", color: "from-emerald-500 to-teal-700",    initials: "LU", hot: true,  category: "Ludo"  },
  { id: "xadrez",      name: "Xadrez Rápido",    desc: "Estratégia Real • 8 Modos",    players: "1.2K jogadores", color: "from-violet-500 to-purple-800",   initials: "XA", hot: false, category: "Xadrez"},
  { id: "damas-pro",   name: "Damas Pro",        desc: "Jogo de Tabuleiro • 4 Modos",  players: "980 jogadores",  color: "from-orange-500 to-red-700",     initials: "DP", hot: false, category: "Damas" },
  { id: "ludo-classic",name: "Ludo Clássico",    desc: "Jogo de Dados • 3 Modos",      players: "760 jogadores",  color: "from-pink-500 to-rose-700",      initials: "LC", hot: false, category: "Ludo"  },
  { id: "padrao",      name: "Jogo Padrão",      desc: "Clássico • 5 Modos",           players: "1.8K jogadores", color: "from-amber-500 to-yellow-600",   initials: "JP", hot: false, category: "Padrão"},
];

const partidasTempoReal = [
  { id:"p1", game:"Damas Clássico",  players:"João M. vs Carlos F.",  viewers:"142", time:"8min",  bet:"500 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA" },
  { id:"p2", game:"Ludo Turbo",      players:"Maria S. vs Pedro A.",  viewers:"89",  time:"12min", bet:"200 MT",   status:"AO VIVO", color:"from-emerald-500 to-teal-700",  initials:"LU" },
  { id:"p3", game:"Xadrez Rápido",   players:"Ana L. vs Bruno K.",    viewers:"310", time:"3min",  bet:"1.000 MT", status:"AO VIVO", color:"from-violet-500 to-purple-800", initials:"XA" },
];

const partidasAssistir = [
  { id:"a1", game:"Damas Pro",       players:"Ricardo M. vs Filipe O.", viewers:"528", time:"22min", bet:"2.500 MT", status:"AO VIVO", color:"from-orange-500 to-red-700",    initials:"DP" },
  { id:"a2", game:"Damas Clássico",  players:"Tomás V. vs Nuno B.",     viewers:"201", time:"17min", bet:"750 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA" },
  { id:"a3", game:"Ludo Turbo",      players:"Celina R. vs Amina D.",   viewers:"134", time:"5min",  bet:"300 MT",   status:"AO VIVO", color:"from-emerald-500 to-teal-700",  initials:"LU" },
  { id:"a4", game:"Xadrez Rápido",   players:"Hugo F. vs Paulo C.",     viewers:"440", time:"31min", bet:"3.000 MT", status:"AO VIVO", color:"from-violet-500 to-purple-800", initials:"XA" },
  { id:"a5", game:"Damas Clássico",  players:"Lúcia M. vs Beatriz S.",  viewers:"97",  time:"9min",  bet:"400 MT",   status:"AO VIVO", color:"from-blue-500 to-indigo-700",   initials:"DA" },
  { id:"a6", game:"Ludo Clássico",   players:"Marco T. vs Sandro P.",   viewers:"63",  time:"14min", bet:"150 MT",   status:"AO VIVO", color:"from-pink-500 to-rose-700",     initials:"LC" },
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
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 group cursor-pointer"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center text-white font-syne font-bold text-base shadow-md flex-shrink-0`}>
        {game.initials}
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-syne font-bold text-slate-900 text-sm truncate">{game.name}</h4>
          {game.hot && (
            <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-orange-200 flex-shrink-0 flex items-center gap-0.5">
              <Zap className="w-2 h-2" /> QUENTE
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{game.desc}</p>
        <div className="flex items-center gap-1 mt-1">
          <Users className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-violet-600 font-medium">{game.players}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

function MatchCard({ match }: { match: typeof partidasTempoReal[0] }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 group cursor-pointer"
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${match.color} flex items-center justify-center text-white font-syne font-bold text-sm shadow-md flex-shrink-0 relative`}>
        {match.initials}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <p className="font-syne font-bold text-slate-900 text-sm truncate">{match.players}</p>
        <p className="text-[10px] text-slate-400 truncate">{match.game}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">{match.status}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400"><Users className="w-2.5 h-2.5" /> {match.viewers}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400"><Clock className="w-2.5 h-2.5" /> {match.time}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{match.bet}</span>
        <button className="w-8 h-8 rounded-full bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center transition-colors shadow-md">
          <Play className="w-3.5 h-3.5 ml-0.5" />
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

  if (view === "entrar") {
    return (
      <motion.div key="entrar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="pb-4">
        <button onClick={() => setView("main")} className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mb-5 hover:text-slate-700 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
        </button>
        <div className="relative rounded-3xl overflow-hidden mb-6 shadow-xl"
          style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #5B21B6 100%)" }}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 p-6">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-4 shadow-inner">
              <Key className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-syne font-extrabold text-xl text-white mb-1">Entrar em Sala</h2>
            <p className="text-sm text-violet-200 leading-relaxed">Introduz o ID da sala para entrar numa partida privada.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-5 mb-5">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">ID da Sala</label>
          <div className="relative flex items-center">
            <div className="absolute left-4 pointer-events-none"><Hash className="w-4 h-4 text-violet-400" /></div>
            <input
              type="text" placeholder="Ex: WM-4821" value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 focus:border-violet-500 rounded-2xl text-slate-900 font-syne font-bold text-base outline-none transition-all duration-200 placeholder-slate-300 tracking-widest"
            />
          </div>
          <button
            disabled={roomId.length < 3}
            className={`w-full mt-4 py-4 rounded-2xl font-syne font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
              roomId.length >= 3 ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-700 hover:to-purple-800" : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {roomId.length >= 3 ? (<>Entrar na Sala <ArrowRight className="w-5 h-5" /></>) : (<>Introduz o ID da sala</>)}
          </button>
        </div>

        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Salas Recentes</p>
        <div className="flex flex-col gap-2.5">
          {RECENT_ROOMS.map((room, idx) => (
            <motion.button key={room.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}
              onClick={() => setRoomId(room.id)}
              className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all duration-200 text-left w-full group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${room.color} flex items-center justify-center text-white font-syne font-bold text-sm shadow-md flex-shrink-0`}>{room.initials}</div>
              <div className="flex-1 min-w-0">
                <p className="font-syne font-bold text-slate-900 text-sm">{room.game}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-mono tracking-widest">{room.id}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <span className="text-[10px] text-slate-400">{room.players} jogadores</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[11px] font-bold text-violet-700">{room.bet}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  if (view === "criar") {
    return (
      <motion.div key="criar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="pb-4">
        <button onClick={() => setView("main")} className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mb-5 hover:text-slate-700 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
        </button>
        <div className="relative rounded-3xl overflow-hidden mb-6 shadow-xl"
          style={{ background: "linear-gradient(135deg, #065f46 0%, #059669 50%, #047857 100%)" }}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 p-6">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-4">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-syne font-extrabold text-xl text-white mb-1">Criar Nova Sala</h2>
            <p className="text-sm text-emerald-100 leading-relaxed">Cria uma sala privada e convida os teus amigos para jogar.</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-5 mb-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Seleccionar Jogo</p>
          <div className="flex flex-col gap-2">
            {[{name:"Damas Clássico",color:"from-blue-500 to-indigo-700",initials:"DA"},{name:"Ludo Turbo",color:"from-emerald-500 to-teal-700",initials:"LU"},{name:"Xadrez Rápido",color:"from-violet-500 to-purple-800",initials:"XA"}].map(g => (
              <button key={g.name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 text-left group">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${g.color} flex items-center justify-center text-white font-bold text-xs shadow-md`}>{g.initials}</div>
                <span className="font-syne font-semibold text-slate-800 text-sm">{g.name}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors ml-auto" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
          <span className="text-amber-500 text-lg">🚧</span>
          <p className="text-[12px] text-amber-700 font-medium">Criação de salas em fase final de desenvolvimento. Disponível em breve!</p>
        </div>
        <button className="w-full py-4 rounded-2xl font-syne font-bold text-base bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-center gap-2 shadow-lg opacity-60 cursor-not-allowed">
          <Plus className="w-5 h-5" /> Criar Sala
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div key="main" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="pb-4">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-6 shadow-2xl"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)", minHeight: 160 }}>
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-300 text-[10px] font-bold tracking-widest uppercase">Sistema Activo</span>
          </div>
          <h2 className="font-syne font-extrabold text-2xl text-white mb-1">Salas Privadas</h2>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-[220px]">Entra numa sala com código ou cria uma nova partida para os teus amigos.</p>
        </div>
      </div>

      {/* Two action cards */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Entrar em Sala */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("entrar")}
          className="relative flex items-center gap-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:border-violet-200 transition-all duration-300 text-left w-full group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-50/0 to-violet-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>
            <Key className="w-7 h-7 text-white" />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="font-syne font-extrabold text-slate-900 text-base mb-0.5">Entrar em Sala</p>
            <p className="text-slate-500 text-[12px] leading-relaxed">Tens um código? Entra numa partida privada agora.</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                {RECENT_ROOMS.length} salas recentes
              </span>
            </div>
          </div>
          <div className="relative w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 transition-colors duration-300">
            <ArrowRight className="w-4 h-4 text-violet-600 group-hover:text-white transition-colors duration-300" />
          </div>
        </motion.button>

        {/* Criar Sala */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("criar")}
          className="relative flex items-center gap-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:border-emerald-200 transition-all duration-300 text-left w-full group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/0 to-emerald-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #059669, #065f46)" }}>
            <Plus className="w-7 h-7 text-white" />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="font-syne font-extrabold text-slate-900 text-base mb-0.5">Criar Sala</p>
            <p className="text-slate-500 text-[12px] leading-relaxed">Cria a tua sala privada e desafia quem queres.</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Em breve</span>
            </div>
          </div>
          <div className="relative w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors duration-300">
            <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:text-white transition-colors duration-300" />
          </div>
        </motion.button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2">
        {[{label:"Salas Activas", value:"247", color:"text-violet-700 bg-violet-50 border-violet-200"},{label:"Jogadores Online", value:"1.8K", color:"text-emerald-700 bg-emerald-50 border-emerald-200"},{label:"Apostas Hoje", value:"92K MT", color:"text-amber-700 bg-amber-50 border-amber-200"}].map(s => (
          <div key={s.label} className={`flex-1 rounded-2xl border p-3 text-center ${s.color}`}>
            <p className="font-syne font-extrabold text-base">{s.value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Explorar() {
  const [activeTab, setActiveTab] = useState<Tab>("Jogos");
  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState<GameFilter>("Todos");
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredJogos = jogosCards.filter(g => {
    const matchSearch = !query || g.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = gameFilter === "Todos" || g.category === gameFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col relative pb-24">

        {/* HEADER */}
        <div className="relative pt-10 pb-6 px-5"
          style={{ background: "linear-gradient(160deg, #5B21B6 0%, #6D28D9 45%, #7C3AED 100%)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <h1 className="font-syne font-extrabold text-2xl text-white mb-5 relative z-10">Explorar</h1>
          <div className="relative z-10">
            <div className="flex items-center bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 gap-3">
              <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
              <input
                type="text" placeholder="Pesquisar jogos, partidas..." value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none font-medium"
              />
            </div>
          </div>
        </div>

        {/* TABS — scrollable */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
          <div className="flex gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
