import { motion } from "framer-motion";
import { Link } from "wouter";
import { Zap, Play, Home as HomeIcon, Gamepad2, Wallet, User, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground w-full flex justify-center selection:bg-primary/30">
      <div className="w-full max-w-[430px] flex flex-col relative pb-20 border-x border-border shadow-2xl bg-[#0A0A0F]">
        
        {/* TOP NAVIGATION BAR */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-4 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center gap-1.5" data-testid="logo-winmoz">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              <Zap className="w-4 h-4 text-white absolute" />
            </div>
            <span className="font-syne font-bold text-xl tracking-tight text-white">
              Win<span className="text-primary">Moz</span>
            </span>
          </div>

          <Button 
            className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/30 font-semibold px-4 transition-all duration-300 shadow-[0_0_10px_rgba(37,99,235,0.2)] hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] relative overflow-hidden group"
            data-testid="button-register"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-accent group-hover:text-white transition-colors" />
            Registar-se
            <Zap className="w-3.5 h-3.5 ml-1 text-accent group-hover:text-white transition-colors" />
          </Button>
        </header>

        {/* HERO BANNER */}
        <section className="px-4 py-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A1A2E] to-[#0D0D14] border border-border p-6 shadow-xl"
            data-testid="hero-banner"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 pointer-events-none"></div>
            
            <div className="relative z-10 w-[60%]">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-white/5 border border-white/10 text-muted-foreground mb-3 uppercase">
                Anúncio Patrocinado
              </div>
              
              <h1 className="font-syne font-extrabold text-3xl leading-none mb-2 text-white drop-shadow-md">
                Domina o <br /> Tabuleiro.
              </h1>
              
              <p className="text-sm text-muted-foreground mb-5 max-w-[200px] leading-relaxed">
                Joga Damas, aposta real, ganha a sério.
              </p>
              
              <Button className="rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-[0_4px_14px_rgba(37,99,235,0.4)]" data-testid="button-play-now">
                Jogar Agora <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Abstract Art Right Side */}
            <div className="absolute -right-4 -bottom-4 w-40 h-40 transform rotate-12 opacity-80 pointer-events-none">
              <div className="grid grid-cols-4 grid-rows-4 w-full h-full border border-primary/20 bg-[#0A0A0F] shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className={`w-full h-full ${(i + Math.floor(i / 4)) % 2 === 0 ? 'bg-primary/10' : 'bg-transparent'} flex items-center justify-center`}>
                    {i === 5 && <div className="w-6 h-6 rounded-full bg-accent shadow-[0_0_15px_rgba(212,175,55,0.8)] border-2 border-white/20"></div>}
                    {i === 10 && <div className="w-6 h-6 rounded-full bg-primary shadow-[0_0_15px_rgba(37,99,235,0.8)] border-2 border-white/20"></div>}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* JOGOS EM DESTAQUE */}
        <section className="px-4 py-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-lg text-white">Jogos em Destaque</h2>
            <Link href="/jogos" className="text-primary text-sm font-medium hover:underline inline-flex items-center" data-testid="link-view-all-featured">
              Ver Todos <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-hide -mx-4 px-4">
            {[
              {
                id: "damas",
                name: "DAMAS",
                bet: "50-5.000 MT",
                rating: "4.8",
                players: "2.4K jogando",
                art: (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-[#12121A] flex items-center justify-center overflow-hidden">
                     <div className="grid grid-cols-3 grid-rows-3 w-[120%] h-[120%] transform rotate-12 opacity-40">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className={`w-full h-full ${(i + Math.floor(i / 3)) % 2 === 0 ? 'bg-black/50' : 'bg-white/10'}`}></div>
                        ))}
                     </div>
                     <div className="absolute z-10 w-12 h-12 rounded-full bg-accent border-4 border-[#12121A] shadow-lg"></div>
                     <div className="absolute z-10 w-10 h-10 rounded-full border-2 border-black/20"></div>
                  </div>
                )
              },
              {
                id: "ludo",
                name: "LUDO",
                bet: "20-2.000 MT",
                rating: "4.9",
                players: "4.1K jogando",
                art: (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-[#12121A] flex items-center justify-center overflow-hidden">
                     <div className="w-16 h-16 bg-white rounded-xl transform -rotate-12 flex items-center justify-center p-2 shadow-lg border-b-4 border-emerald-900">
                        <div className="grid grid-cols-2 gap-2 w-full h-full">
                          <div className="w-3 h-3 rounded-full bg-red-500 m-auto"></div>
                          <div className="w-3 h-3 rounded-full bg-blue-500 m-auto"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500 m-auto"></div>
                          <div className="w-3 h-3 rounded-full bg-accent m-auto"></div>
                        </div>
                     </div>
                  </div>
                )
              },
              {
                id: "xadrez",
                name: "XADREZ",
                bet: "100-10.000 MT",
                rating: "4.7",
                players: "1.2K jogando",
                art: (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-[#12121A] flex items-center justify-center overflow-hidden">
                     <div className="w-12 h-16 bg-gradient-to-t from-white/90 to-white/60 transform rotate-12 shadow-lg rounded-t-full rounded-b-sm border-b-8 border-purple-950 flex flex-col items-center">
                        <div className="w-6 h-2 bg-white/40 mt-3 rounded-full"></div>
                        <div className="w-8 h-2 bg-white/40 mt-1 rounded-full"></div>
                     </div>
                  </div>
                )
              }
            ].map((game, idx) => (
              <motion.div 
                key={game.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="min-w-[160px] flex-shrink-0 snap-start bg-card rounded-2xl border border-border overflow-hidden group hover:border-primary/50 transition-colors shadow-sm hover:shadow-[0_0_15px_rgba(37,99,235,0.15)] flex flex-col"
                data-testid={`card-featured-${game.id}`}
              >
                <div className="h-28 w-full relative">
                  {game.art}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Star className="w-3 h-3 text-accent fill-accent" />
                    <span className="text-xs font-bold text-white">{game.rating}</span>
                  </div>
                </div>
                
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-syne font-bold text-white mb-1 tracking-wide">{game.name}</h3>
                  <p className="text-[10px] font-medium text-primary mb-1 uppercase tracking-wider">{game.bet}</p>
                  <p className="text-xs text-muted-foreground mb-3">{game.players}</p>
                  
                  <div className="mt-auto">
                    <Button className="w-full h-8 text-xs font-bold bg-white/5 hover:bg-primary text-white border border-white/10 hover:border-primary transition-all rounded-lg" data-testid={`button-play-${game.id}`}>
                      Jogar
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* TOP APOSTAS */}
        <section className="px-4 py-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-lg text-white">Top Apostas</h2>
            <Link href="/top" className="text-primary text-sm font-medium hover:underline inline-flex items-center" data-testid="link-view-all-top">
              Ver Todos <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { id: "dc", name: "Damas Clássico", players: "4.1K apostadores ativos", rank: 1, initials: "DC", color: "from-blue-600 to-indigo-900" },
              { id: "lt", name: "Ludo Turbo", players: "3.8K apostadores ativos", rank: 2, initials: "LT", color: "from-emerald-500 to-green-900" },
              { id: "xr", name: "Xadrez Rápido", players: "2.5K apostadores ativos", rank: 3, initials: "XR", color: "from-purple-500 to-violet-900" },
              { id: "dp", name: "Damas Pro", players: "1.9K apostadores ativos", rank: 4, initials: "DP", color: "from-orange-500 to-red-900" },
            ].map((game, idx) => (
              <motion.div 
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + (idx * 0.1) }}
                className="flex items-center p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
                data-testid={`row-top-${game.id}`}
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${game.color} flex items-center justify-center text-white font-syne font-bold text-lg shadow-inner relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <span className="relative z-10">{game.initials}</span>
                </div>
                
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-syne font-bold text-white text-sm">{game.name}</h4>
                    {game.rank === 1 && (
                      <span className="bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded border border-accent/30 flex items-center">
                        <Star className="w-2.5 h-2.5 mr-0.5 fill-accent" /> #1
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{game.players}</p>
                </div>
                
                <Button size="icon" variant="ghost" className="rounded-full w-8 h-8 text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors" data-testid={`button-play-row-${game.id}`}>
                  <Play className="w-4 h-4 ml-0.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 w-full max-w-[430px] bg-[#0A0A0F]/95 backdrop-blur-lg border-t border-border px-6 py-3 z-50 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex flex-col items-center gap-1 text-primary group" data-testid="nav-home">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full"></div>
                <HomeIcon className="w-6 h-6 relative z-10" />
              </div>
              <span className="text-[10px] font-medium font-syne">Home</span>
            </Link>
            
            <Link href="/jogos" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors" data-testid="nav-jogos">
              <Gamepad2 className="w-6 h-6" />
              <span className="text-[10px] font-medium font-syne">Jogos</span>
            </Link>
            
            <Link href="/carteira" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors" data-testid="nav-carteira">
              <Wallet className="w-6 h-6" />
              <span className="text-[10px] font-medium font-syne">Carteira</span>
            </Link>
            
            <Link href="/perfil" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors" data-testid="nav-perfil">
              <User className="w-6 h-6" />
              <span className="text-[10px] font-medium font-syne">Perfil</span>
            </Link>
          </div>
        </nav>

      </div>
    </div>
  );
}