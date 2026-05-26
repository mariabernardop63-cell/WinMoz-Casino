import { motion } from "framer-motion";
import { Link } from "wouter";
import { Play, Home as HomeIcon, Gamepad2, Wallet, User, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function WinMozLogo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-winmoz">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1A3A8F"/>
            <stop offset="100%" stopColor="#0F2060"/>
          </linearGradient>
          <linearGradient id="crownGrad" x1="8" y1="10" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F5C842"/>
            <stop offset="100%" stopColor="#D4940A"/>
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="9" fill="url(#bgGrad)"/>
        <path d="M18 4L32 9.5V19C32 26.5 25.5 32.5 18 34C10.5 32.5 4 26.5 4 19V9.5L18 4Z" fill="white" fillOpacity="0.06"/>
        <path
          d="M9 14 L12.5 24 L18 17.5 L23.5 24 L27 14"
          stroke="url(#crownGrad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M9 24.5 H27"
          stroke="url(#crownGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="9" cy="14" r="1.8" fill="#F5C842"/>
        <circle cx="18" cy="17.5" r="1.8" fill="#F5C842"/>
        <circle cx="27" cy="14" r="1.8" fill="#F5C842"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-syne font-extrabold text-lg tracking-tight text-slate-900 leading-none">
          Win<span className="text-blue-700">Moz</span>
        </span>
        <span className="text-[9px] tracking-[0.18em] text-slate-400 font-medium uppercase leading-none mt-0.5">
          Aposta &amp; Ganha
        </span>
      </div>
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
          <button
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-blue-200 hover:shadow-lg font-syne tracking-wide"
            data-testid="button-register"
          >
            Registar-se
          </button>
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

        {/* TOP APOSTAS */}
        <section className="px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-bold text-base text-slate-900">Top Apostas</h2>
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

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex flex-col items-center gap-1 text-blue-700 group" data-testid="nav-home">
              <HomeIcon className="w-5 h-5"/>
              <span className="text-[9px] font-semibold font-syne tracking-wide">Home</span>
            </Link>
            <Link href="/jogos" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors" data-testid="nav-jogos">
              <Gamepad2 className="w-5 h-5"/>
              <span className="text-[9px] font-medium font-syne tracking-wide">Jogos</span>
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
