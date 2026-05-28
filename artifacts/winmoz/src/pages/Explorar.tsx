import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Search, ChevronRight, Play, Users, Clock, Trophy, Zap, Plus, Hash, ArrowRight, Shield
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const TABS = ["Jogos", "Assistir", "Sala", "Criar Sala", "Novidades"] as const;
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

const RECENT_ROOMS = [
  { id: "WM-4821", game: "Damas Clássico", players: "2/2", bet: "500 MT", color: "from-blue-500 to-indigo-700", initials: "DA" },
  { id: "WM-3307", game: "Ludo Turbo", players: "3/4", bet: "200 MT", color: "from-emerald-500 to-teal-700", initials: "LU" },
  { id: "WM-9154", game: "Xadrez Rápido", players: "1/2", bet: "1.000 MT", color: "from-violet-500 to-purple-800", initials: "XA" },
];

function EntrarEmSalaTab() {
  const [roomId, setRoomId] = useState("");

  return (
    <motion.div
      key="entrar-sala"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="pb-4"
    >
      {/* Premium card */}
      <div className="relative rounded-3xl overflow-hidden mb-6 shadow-xl"
        style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #5B21B6 100%)" }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 p-6">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-4 shadow-inner">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-syne font-extrabold text-xl text-white mb-1">Entrar em Sala</h2>
          <p className="text-sm text-violet-200 leading-relaxed max-w-[220px]">
            Introduz o ID da sala para entrar numa partida privada.
          </p>
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-5 mb-5">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          ID da Sala
        </label>

        <div className="relative flex items-center">
          <div className="absolute left-4 flex items-center pointer-events-none">
            <Hash className="w-4 h-4 text-violet-400" />
          </div>
          <input
            type="text"
            placeholder="Ex: WM-4821"
            value={roomId}
            onChange={e => setRoomId(e.target.value.toUpperCase())}
            maxLength={10}
            className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 focus:border-violet-500 rounded-2xl text-slate-900 font-syne font-bold text-base outline-none transition-all duration-200 placeholder-slate-300 tracking-widest"
            data-testid="input-room-id"
          />
        </div>

        <button
          disabled={roomId.length < 3}
          className={`w-full mt-4 py-4 rounded-2xl font-syne font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
            roomId.length >= 3
              ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-700 hover:to-purple-800 shadow-violet-200 scale-100"
              : "bg-slate-100 text-slate-300 cursor-not-allowed scale-100"
          }`}
          data-testid="button-enter-room"
        >
          {roomId.length >= 3 ? (
            <>Entrar na Sala <ArrowRight className="w-5 h-5" /></>
          ) : (
            <>Introduz o ID da sala <Plus className="w-5 h-5 rotate-0" /></>
          )}
        </button>
      </div>

      {/* Recent rooms */}
      <div className="mb-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
          Salas Recentes
        </p>
        <div className="flex flex-col gap-2.5">
          {RECENT_ROOMS.map((room, idx) => (
            <motion.button
              key={room.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              onClick={() => setRoomId(room.id)}
              className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all duration-200 text-left w-full group"
              data-testid={`button-recent-room-${room.id}`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${room.color} flex items-center justify-center text-white font-syne font-bold text-sm shadow-md flex-shrink-0`}>
                {room.initials}
              </div>
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

            {activeTab === "Sala" && (
              <EntrarEmSalaTab />
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

            {activeTab === "Novidades" && (
              <motion.div
                key="novidades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2.5 pb-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📢</span>
                  <h2 className="font-syne font-bold text-sm text-slate-900">Últimas Atualizações</h2>
                </div>
                {[
                  { id:1, time:"2h",  likes:142, reposts:38,  content:"🎮 Nova temporada de Ludo Online começa hoje! Prémios até 50.000 $MT para os melhores jogadores." },
                  { id:2, time:"5h",  likes:97,  reposts:21,  content:"💰 Saques 24h disponíveis! Levanta os teus ganhos a qualquer hora, sem esperas e sem taxas escondidas." },
                  { id:3, time:"1d",  likes:213, reposts:64,  content:"♟ Xadrez online está de volta com novos torneios semanais. Compete por 20.000 $MT em prémios!" },
                  { id:4, time:"2d",  likes:88,  reposts:17,  content:"🏆 Resultados do torneio de Damas: parabéns aos 10 finalistas. Próxima edição em breve!" },
                  { id:5, time:"3d",  likes:176, reposts:45,  content:"📱 Novo sistema de notificações disponível. Ativa já para não perderes nenhuma partida ao vivo." },
                ].map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                    className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-syne font-bold text-xs">W</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-syne font-bold text-slate-900 text-[12px]">WinMoz Oficial</span>
                          <span className="text-slate-400 text-[11px]">@winmoz · {post.time}</span>
                        </div>
                        <p className="text-slate-700 text-[12px] leading-relaxed">{post.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-slate-400 text-[11px]">❤️ {post.likes}</span>
                          <span className="text-slate-400 text-[11px]">🔁 {post.reposts}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}

