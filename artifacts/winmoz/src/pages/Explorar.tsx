import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Home as HomeIcon, Gamepad2, Wallet, User,
  Search, ChevronRight, Play, Users, Clock, Trophy, Zap, Plus
} from "lucide-react";

function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-home">
          <HomeIcon className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Home</span>
        </Link>
        <Link href="/explorar" className="flex flex-col items-center gap-1 text-violet-700 group" data-testid="nav-explorar">
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[9px] font-semibold font-syne tracking-wide">Explorar</span>
        </Link>
        <Link href="/carteira" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-carteira">
          <Wallet className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Carteira</span>
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-perfil">
          <User className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Perfil</span>
        </Link>
      </div>
    </nav>
  );
}

const TABS = ["Jogos", "Assistir", "Criar Sala"] as const;
type Tab = typeof TABS[number];

const jogosCards = [
  {
    id: "damas",
    name: "Damas Clássico",
    desc: "Jogo de Tabuleiro • 12 Modos",
    players: "2.4K jogadores",
    color: "from-blue-500 to-indigo-700",
    initials: "DA",
    hot: true,
  },
  {
    id: "ludo",
    name: "Ludo Turbo",
    desc: "Jogo de Dados • 6 Modos",
    players: "4.1K jogadores",
    color: "from-emerald-500 to-teal-700",
    initials: "LU",
    hot: true,
  },
  {
    id: "xadrez",
    name: "Xadrez Rápido",
    desc: "Estratégia Real • 8 Modos",
    players: "1.2K jogadores",
    color: "from-violet-500 to-purple-800",
    initials: "XA",
    hot: false,
  },
  {
    id: "damas-pro",
    name: "Damas Pro",
    desc: "Jogo de Tabuleiro • 4 Modos",
    players: "980 jogadores",
    color: "from-orange-500 to-red-700",
    initials: "DP",
    hot: false,
  },
  {
    id: "ludo-classic",
    name: "Ludo Clássico",
    desc: "Jogo de Dados • 3 Modos",
    players: "760 jogadores",
    color: "from-pink-500 to-rose-700",
    initials: "LC",
    hot: false,
  },
];

const partidasTempoReal = [
  {
    id: "p1",
    game: "Damas Clássico",
    players: "João M. vs Carlos F.",
    viewers: "142",
    time: "8min",
    bet: "500 MT",
    status: "AO VIVO",
    color: "from-blue-500 to-indigo-700",
    initials: "DA",
  },
  {
    id: "p2",
    game: "Ludo Turbo",
    players: "Maria S. vs Pedro A.",
    viewers: "89",
    time: "12min",
    bet: "200 MT",
    status: "AO VIVO",
    color: "from-emerald-500 to-teal-700",
    initials: "LU",
  },
  {
    id: "p3",
    game: "Xadrez Rápido",
    players: "Ana L. vs Bruno K.",
    viewers: "310",
    time: "3min",
    bet: "1.000 MT",
    status: "AO VIVO",
    color: "from-violet-500 to-purple-800",
    initials: "XA",
  },
];

const partidasAssistir = [
  {
    id: "a1",
    game: "Damas Pro",
    players: "Ricardo M. vs Filipe O.",
    viewers: "528",
    time: "22min",
    bet: "2.500 MT",
    status: "AO VIVO",
    color: "from-orange-500 to-red-700",
    initials: "DP",
  },
  {
    id: "a2",
    game: "Damas Clássico",
    players: "Tomás V. vs Nuno B.",
    viewers: "201",
    time: "17min",
    bet: "750 MT",
    status: "AO VIVO",
    color: "from-blue-500 to-indigo-700",
    initials: "DA",
  },
  {
    id: "a3",
    game: "Ludo Turbo",
    players: "Celina R. vs Amina D.",
    viewers: "134",
    time: "5min",
    bet: "300 MT",
    status: "AO VIVO",
    color: "from-emerald-500 to-teal-700",
    initials: "LU",
  },
  {
    id: "a4",
    game: "Xadrez Rápido",
    players: "Hugo F. vs Paulo C.",
    viewers: "440",
    time: "31min",
    bet: "3.000 MT",
    status: "AO VIVO",
    color: "from-violet-500 to-purple-800",
    initials: "XA",
  },
  {
    id: "a5",
    game: "Damas Clássico",
    players: "Lúcia M. vs Beatriz S.",
    viewers: "97",
    time: "9min",
    bet: "400 MT",
    status: "AO VIVO",
    color: "from-blue-500 to-indigo-700",
    initials: "DA",
  },
  {
    id: "a6",
    game: "Ludo Clássico",
    players: "Marco T. vs Sandro P.",
    viewers: "63",
    time: "14min",
    bet: "150 MT",
    status: "AO VIVO",
    color: "from-pink-500 to-rose-700",
    initials: "LC",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
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
      data-testid={`card-game-${game.id}`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-syne font-bold text-base shadow-md flex-shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.color.replace("from-", "").replace(" to-", ", ")})` }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-syne font-bold text-base shadow-md"
          style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
        >
          <div className={`w-full h-full rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
            <span>{game.initials}</span>
          </div>
        </div>
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
      data-testid={`card-match-${match.id}`}
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
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <Users className="w-2.5 h-2.5" /> {match.viewers}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <Clock className="w-2.5 h-2.5" /> {match.time}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{match.bet}</span>
        <button
          className="w-8 h-8 rounded-full bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center transition-colors shadow-md"
          data-testid={`button-watch-${match.id}`}
        >
          <Play className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function Explorar() {
  const [activeTab, setActiveTab] = useState<Tab>("Jogos");
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col relative pb-24">

        {/* HEADER — purple gradient like reference */}
        <div
          className="relative pt-10 pb-6 px-5"
          style={{ background: "linear-gradient(160deg, #5B21B6 0%, #6D28D9 45%, #7C3AED 100%)" }}
        >
          {/* Decorative circle */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <h1 className="font-syne font-extrabold text-2xl text-white mb-5 relative z-10">Explorar</h1>

          {/* Search bar */}
          <div className="relative z-10">
            <div className="flex items-center bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 gap-3">
              <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar jogos, partidas..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none font-medium"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white border-b border-slate-100 px-5 sticky top-0 z-40 shadow-sm">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 px-4 text-sm font-syne font-semibold transition-all duration-200 relative border-b-2 ${
                  activeTab === tab
                    ? "text-violet-700 border-violet-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
                data-testid={`tab-${tab.toLowerCase().replace(" ", "-")}`}
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
              <motion.div
                key="jogos"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Jogos section */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-violet-600" />
                    <h2 className="font-syne font-bold text-sm text-slate-900">Jogos</h2>
                  </div>
                  <button className="text-violet-700 text-xs font-semibold hover:underline" data-testid="link-see-all-games">
                    Ver todos
                  </button>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {jogosCards
                    .filter(g => !query || g.name.toLowerCase().includes(query.toLowerCase()))
                    .map(game => <GameCard key={game.id} game={game} />)}
                </motion.div>

                {/* Partidas em Tempo Real */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <h2 className="font-syne font-bold text-sm text-slate-900">Partidas em Tempo Real</h2>
                  </div>
                  <button className="text-violet-700 text-xs font-semibold hover:underline" data-testid="link-see-all-matches">
                    Ver todas
                  </button>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {partidasTempoReal
                    .filter(m => !query || m.game.toLowerCase().includes(query.toLowerCase()) || m.players.toLowerCase().includes(query.toLowerCase()))
                    .map(match => <MatchCard key={match.id} match={match} />)}
                </motion.div>
              </motion.div>
            )}

            {activeTab === "Assistir" && (
              <motion.div
                key="assistir"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="font-syne font-bold text-sm text-slate-900">
                    Partidas ao Vivo
                  </h2>
                  <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                    {partidasAssistir.length} ativas
                  </span>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5 mb-6">
                  {partidasAssistir
                    .filter(m => !query || m.game.toLowerCase().includes(query.toLowerCase()) || m.players.toLowerCase().includes(query.toLowerCase()))
                    .map(match => <MatchCard key={match.id} match={match} />)}
                </motion.div>
              </motion.div>
            )}

            {activeTab === "Criar Sala" && (
              <motion.div
                key="criar-sala"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 rounded-3xl bg-violet-100 flex items-center justify-center mb-5 shadow-inner">
                  <Plus className="w-9 h-9 text-violet-600" />
                </div>
                <h3 className="font-syne font-bold text-xl text-slate-800 mb-2">Em Breve</h3>
                <p className="text-sm text-slate-400 max-w-[220px] leading-relaxed">
                  A funcionalidade de criar sala estará disponível em breve. Fica atento.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
