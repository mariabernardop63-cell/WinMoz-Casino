import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Play, Home as HomeIcon, Gamepad2, Wallet, User, Star, ChevronRight, ArrowDownLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const SAQUES_POOL = [
  { id: "s1", name: "Isabel Martins", initials: "IM", bg: "from-violet-500 to-purple-700", amount: "3.500 MT", time: "agora mesmo" },
  { id: "s2", name: "Carlos Fonseca", initials: "CF", bg: "from-blue-500 to-indigo-700", amount: "12.000 MT", time: "há 1 min" },
  { id: "s3", name: "Ana Rodrigues", initials: "AR", bg: "from-emerald-500 to-teal-700", amount: "850 MT", time: "há 2 min" },
  { id: "s4", name: "Pedro Nhamposse", initials: "PN", bg: "from-orange-500 to-red-600", amount: "5.200 MT", time: "há 3 min" },
  { id: "s5", name: "Beatriz Silva", initials: "BS", bg: "from-pink-500 to-rose-700", amount: "1.750 MT", time: "há 4 min" },
  { id: "s6", name: "Miguel Chongo", initials: "MC", bg: "from-amber-500 to-yellow-600", amount: "22.000 MT", time: "há 5 min" },
  { id: "s7", name: "Lúcia Tembe", initials: "LT", bg: "from-cyan-500 to-blue-600", amount: "4.400 MT", time: "há 7 min" },
  { id: "s8", name: "Daniel Macuacua", initials: "DM", bg: "from-lime-500 to-green-700", amount: "9.800 MT", time: "há 8 min" },
];

function SaquesSection() {
  const [visible, setVisible] = useState(SAQUES_POOL.slice(0, 4));
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = SAQUES_POOL[Math.floor(Math.random() * SAQUES_POOL.length)];
      const fresh = { ...next, id: next.id + Date.now(), time: "agora mesmo" };
      setEntering(fresh.id);
      setVisible(prev => {
        const updated = [fresh, ...prev.slice(0, 3)];
        return updated;
      });
      setTimeout(() => setEntering(null), 600);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="px-4 py-4 mb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h2 className="font-syne font-bold text-base text-slate-900">Saques 24 Horas</h2>
          <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
            AO VIVO
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((saque) => (
            <motion.div
              key={saque.id}
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"
              data-testid={`row-saque-${saque.id}`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${saque.bg} flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0 shadow-md`}>
                {saque.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-syne font-bold text-slate-900 text-sm truncate">{saque.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{saque.time}</p>
              </div>

              {/* Amount + icon */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="font-syne font-extrabold text-emerald-600 text-sm">+{saque.amount}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Saque</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function WinMozLogo() {
  return (
    <div className="flex items-center" data-testid="logo-winmoz">
      <svg viewBox="0 0 230 46" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Diagonal speed-slash */}
        <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D"/>
        <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18"/>

        {/* "Poker" wordmark */}
        <text
          x="24"
          y="40"
          fontFamily="'Syne', sans-serif"
          fontWeight="800"
          fontSize="40"
          letterSpacing="-1.5"
          fill="#0D0D0D"
        >Poker</text>

        {/* ® */}
        <circle cx="218" cy="11" r="7" stroke="#0D0D0D" strokeWidth="1.8" fill="none"/>
        <text
          x="214.5"
          y="15.5"
          fontFamily="'Syne', sans-serif"
          fontWeight="700"
          fontSize="9"
          fill="#0D0D0D"
        >R</text>
      </svg>
    </div>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const games = [
  {
    id: "damas",
    name: "DAMAS",
    sub: "Jogo de Tabuleiro",
    bet: "50–5.000 MT",
    rating: "4.8",
    players: "2.4K jogando",
    art: (
      <div className="w-full h-full bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 flex items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-20">
          {[...Array(16)].map((_, i) => (
            <div key={i} className={`${(i + Math.floor(i / 4)) % 2 === 0 ? 'bg-white' : 'bg-transparent'}`}/>
          ))}
        </div>
        <div className="relative z-10 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-400 border-4 border-amber-200 shadow-xl"/>
          <div className="w-9 h-9 rounded-full bg-slate-900 border-4 border-slate-600 shadow-xl mt-3"/>
        </div>
      </div>
    )
  },
  {
    id: "ludo",
    name: "LUDO",
    sub: "Jogo de Dados",
    bet: "20–2.000 MT",
    rating: "4.9",
    players: "4.1K jogando",
    art: (
      <div className="w-full h-full bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 flex items-center justify-center overflow-hidden">
        <div className="w-14 h-14 bg-white rounded-xl shadow-2xl flex items-center justify-center rotate-6">
          <div className="grid grid-cols-2 gap-1.5 p-1">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500"/>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-600"/>
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"/>
            <div className="w-3.5 h-3.5 rounded-full bg-amber-400"/>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "xadrez",
    name: "XADREZ",
    sub: "Estratégia Real",
    bet: "100–10.000 MT",
    rating: "4.7",
    players: "1.2K jogando",
    art: (
      <div className="w-full h-full bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 flex items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-15">
          {[...Array(16)].map((_, i) => (
            <div key={i} className={`${(i + Math.floor(i / 4)) % 2 === 0 ? 'bg-white' : 'bg-transparent'}`}/>
          ))}
        </div>
        <svg viewBox="0 0 40 44" width="38" className="relative z-10 drop-shadow-xl" fill="none">
          <rect x="10" y="34" width="20" height="4" rx="2" fill="white" fillOpacity="0.85"/>
          <rect x="14" y="28" width="12" height="7" rx="1.5" fill="white" fillOpacity="0.85"/>
          <rect x="16" y="20" width="8" height="10" rx="1.5" fill="white" fillOpacity="0.85"/>
          <rect x="17" y="12" width="6" height="10" rx="1.5" fill="white" fillOpacity="0.9"/>
          <circle cx="20" cy="8" r="4" fill="white" fillOpacity="0.9"/>
          <rect x="17" y="4" width="6" height="6" rx="1" fill="white" fillOpacity="0.8"/>
          <rect x="15" y="2" width="10" height="3" rx="1.5" fill="white"/>
        </svg>
      </div>
    )
  }
];

const topGames = [
  { id: "dc", name: "Damas Clássico", players: "4.1K apostadores ativos", rank: 1, initials: "DC", from: "#1D4ED8", to: "#1E3A8A" },
  { id: "lt", name: "Ludo Turbo", players: "3.8K apostadores ativos", rank: 2, initials: "LT", from: "#059669", to: "#064E3B" },
  { id: "xr", name: "Xadrez Rápido", players: "2.5K apostadores ativos", rank: 3, initials: "XR", from: "#7C3AED", to: "#3B0764" },
  { id: "dp", name: "Damas Pro", players: "1.9K apostadores ativos", rank: 4, initials: "DP", from: "#EA580C", to: "#7C2D12" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 w-full flex justify-center selection:bg-blue-100">
      <div className="w-full max-w-[430px] flex flex-col relative pb-24 bg-white">

        {/* TOP NAVIGATION BAR */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3.5 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
          <WinMozLogo />
          <Link href="/login">
            <button
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-blue-200 hover:shadow-lg font-syne tracking-wide"
              data-testid="button-register"
            >
              Registar-se
            </button>
          </Link>
        </header>

        {/* HERO BANNER */}
        <section className="px-4 pt-5 pb-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full rounded-2xl overflow-hidden shadow-xl"
            data-testid="hero-banner"
            style={{ background: "linear-gradient(135deg, #0F2060 0%, #1D4ED8 50%, #0369A1 100%)" }}
          >
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 70% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)"
            }}/>

            <div className="relative z-10 p-6 flex justify-between items-center min-h-[160px]">
              <div className="flex-1 pr-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest bg-white/10 border border-white/20 text-blue-100 mb-3 uppercase">
                  Anúncio Patrocinado
                </div>
                <h1 className="font-syne font-extrabold text-[1.65rem] leading-tight text-white mb-1.5 drop-shadow-md">
                  Domina o<br/>Tabuleiro.
                </h1>
                <p className="text-xs text-blue-200 mb-4 leading-relaxed max-w-[160px]">
                  Joga Damas, aposta real, ganha a sério.
                </p>
                <button
                  className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-5 py-2 rounded-xl transition-all duration-200 shadow-md font-syne"
                  data-testid="button-play-now"
                >
                  Jogar Agora →
                </button>
              </div>

              <div className="flex-shrink-0 w-28 h-28 relative">
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 rounded-lg overflow-hidden transform rotate-6 shadow-2xl border border-white/20">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className={(i + Math.floor(i / 4)) % 2 === 0 ? 'bg-white/15' : 'bg-white/5'}/>
                  ))}
                </div>
                <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-amber-400 border-4 border-amber-200 shadow-xl z-10"/>
                <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-slate-900 border-4 border-slate-600 shadow-xl z-10"/>
              </div>
            </div>
          </motion.div>
        </section>

        {/* JOGOS EM DESTAQUE */}
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-bold text-base text-slate-900">Jogos em Destaque</h2>
            <Link href="/jogos" className="text-blue-700 text-xs font-semibold hover:underline inline-flex items-center" data-testid="link-view-all-featured">
              Ver Todos <ChevronRight className="w-3 h-3 ml-0.5"/>
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex gap-3 overflow-x-auto pt-1 pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {games.map((game) => (
              <motion.div
                key={game.id}
                variants={fadeUp}
                className="min-w-[148px] flex-shrink-0 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col"
                data-testid={`card-featured-${game.id}`}
              >
                <div className="h-28 w-full relative">
                  {game.art}
                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400"/>
                    <span className="text-[10px] font-bold text-white">{game.rating}</span>
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-syne font-bold text-slate-900 text-sm tracking-wide">{game.name}</h3>
                  <p className="text-[10px] font-semibold text-blue-700 mt-0.5 uppercase tracking-wider">{game.bet}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 mb-3">{game.players}</p>
                  <div className="mt-auto">
                    <button
                      className="w-full h-8 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
                      data-testid={`button-play-${game.id}`}
                    >
                      Jogar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* DIVIDER */}
        <div className="mx-4 border-t border-slate-100 my-1"/>

        {/* POPULARES AGORA */}
        <section className="px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-bold text-base text-slate-900">Populares Agora</h2>
            <Link href="/top" className="text-blue-700 text-xs font-semibold hover:underline inline-flex items-center" data-testid="link-view-all-top">
              Ver Todos <ChevronRight className="w-3 h-3 ml-0.5"/>
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2.5"
          >
            {topGames.map((game) => (
              <motion.div
                key={game.id}
                variants={fadeUp}
                className="flex items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 group shadow-sm"
                data-testid={`row-top-${game.id}`}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-syne font-bold text-sm shadow-md flex-shrink-0 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${game.from}, ${game.to})` }}
                >
                  <div className="absolute inset-0 bg-black/10"/>
                  <span className="relative z-10">{game.initials}</span>
                </div>

                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-syne font-bold text-slate-900 text-sm truncate">{game.name}</h4>
                    {game.rank === 1 && (
                      <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center flex-shrink-0">
                        <Star className="w-2 h-2 mr-0.5 fill-amber-500 text-amber-500"/> #1
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{game.players}</p>
                </div>

                <button
                  className="w-8 h-8 rounded-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center transition-colors shadow-md flex-shrink-0"
                  data-testid={`button-play-row-${game.id}`}
                >
                  <Play className="w-3.5 h-3.5 ml-0.5"/>
                </button>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* SAQUES 24 HORAS */}
        <SaquesSection />

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex flex-col items-center gap-1 text-blue-700 group" data-testid="nav-home">
              <HomeIcon className="w-5 h-5"/>
              <span className="text-[9px] font-semibold font-syne tracking-wide">Home</span>
            </Link>
            <Link href="/explorar" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-explorar">
              <Gamepad2 className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Explorar</span>
            </Link>
            <Link href="/carteira" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-carteira">
              <Wallet className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Carteira</span>
            </Link>
            <Link href="/perfil" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-perfil">
              <User className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Perfil</span>
            </Link>
          </div>
        </nav>

      </div>
    </div>
  );
}
