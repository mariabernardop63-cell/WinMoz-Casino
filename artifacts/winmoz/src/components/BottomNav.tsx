import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Search, X, LayoutGrid, Play, Gamepad2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 10.8L12 4L20 10.8V20C20 20.55 19.55 21 19 21H15.5V15H8.5V21H5C4.45 21 4 20.55 4 20V10.8Z"
        stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function PartidaIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <polygon points="7,4 20,12 7,20" fill={color} />
      <line x1="3" y1="4" x2="3" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",         iconKey: "home",     label: "Home" },
  { href: "/explorar", iconKey: "explorar", label: "Explorar" },
  { href: "/partidas", iconKey: "partidas", label: "Retomar" },
  { href: "/perfil",   iconKey: "perfil",   label: "Perfil" },
];

function NavIcon({ iconKey, color }: { iconKey: string; color: string }) {
  if (iconKey === "home") return <HomeIcon color={color} />;
  if (iconKey === "explorar") return <LayoutGrid style={{ width: 18, height: 18, color }} />;
  if (iconKey === "partidas") return <PartidaIcon color={color} />;
  if (iconKey === "perfil") return <User style={{ width: 18, height: 18, color }} />;
  return null;
}

function ResumeModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const gameShortcuts = [
    { id: "damas",  name: "Damas",  players: "2.4K", image: "/damas-card.jpg",  imagePos: "center" },
    { id: "ludo",   name: "Ludo",   players: "4.1K", image: "/ludo-card2.png",  imagePos: "center" },
    { id: "xadrez", name: "Xadrez", players: "1.2K", image: "/xadrez-card.jpg", imagePos: "center 30%" },
  ];

  const go = (path: string) => { onClose(); setLocation(path); };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }} />

      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 350, mass: 0.55 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 430,
          background: "#0a0a0f", borderRadius: "24px 24px 0 0",
          overflow: "hidden", zIndex: 1,
          paddingBottom: "env(safe-area-inset-bottom, 20px)",
        }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 6 }}>
          <div style={{ width: 32, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "6px 22px 18px" }}>
          <div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", lineHeight: 1.15, marginBottom: 5 }}>Iniciar Jogo</p>
            <p style={{ fontSize: 12.5, color: "#52525b", lineHeight: 1.5 }}>Nenhuma partida activa. Escolhe um jogo para começar.</p>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: 14, marginTop: 2 }}>
            <X style={{ width: 14, height: 14, color: "#71717a" }} />
          </button>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 20 }} />

        <div style={{ display: "flex", gap: 10, padding: "0 22px", marginBottom: 20 }}>
          {gameShortcuts.map(g => (
            <motion.button key={g.id} whileTap={{ scale: 0.96 }}
              onClick={() => go(`/apostar/${g.id}`)}
              style={{ flex: 1, background: "#141418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", cursor: "pointer", textAlign: "left" }}>
              <div style={{ height: 70, overflow: "hidden", position: "relative" }}>
                <img src={g.image} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.imagePos }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.08))" }} />
              </div>
              <div style={{ padding: "9px 10px 11px" }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, color: "#fff", marginBottom: 2 }}>{g.name}</p>
                <p style={{ fontSize: 10, color: "#52525b" }}>{g.players}K a jogar</p>
              </div>
            </motion.button>
          ))}
        </div>

        <div style={{ padding: "0 22px 24px" }}>
          <button onClick={() => go("/explorar")}
            style={{ width: "100%", height: 52, background: "#fff", color: "#0a0a0f", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: "0.2px" }}>
            <Play style={{ width: 13, height: 13, fill: "#0a0a0f" }} />
            Ver Todos os Jogos
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [showResume, setShowResume] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const openSearch = () => {
    setSearching(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
  };

  const handleResumeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation("/login");
      return;
    }
    setShowResume(true);
  };

  const handlePerfilClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation("/login");
      return;
    }
    setLocation("/perfil");
  };

  return (
    <>
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
        style={{ width: "calc(100% - 40px)", maxWidth: 390 }}>
        <AnimatePresence mode="wait">
          {searching ? (
            <motion.div key="search"
              initial={{ scaleX: 0.85, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0.85, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: "#18181b", borderRadius: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
              <Search style={{ width: 17, height: 17, color: "#71717a", flexShrink: 0 }} />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar jogos, partidas..."
                className="flex-1 bg-transparent text-white text-[13px] font-medium outline-none placeholder:text-zinc-600 font-syne" />
              <button onClick={closeSearch}
                className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors hover:bg-white/10"
                style={{ width: 28, height: 28 }}>
                <X style={{ width: 15, height: 15, color: "#a1a1aa" }} />
              </button>
            </motion.div>
          ) : (
            <motion.div key="nav"
              initial={{ scaleX: 0.85, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0.85, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ background: "#18181b", borderRadius: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
              {NAV_ITEMS.map(({ href, iconKey, label }) => {
                const active = isActive(href);

                if (iconKey === "partidas") {
                  return (
                    <motion.div key={href} layout onClick={handleResumeClick}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      style={{ background: "transparent", borderRadius: 99, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}>
                      <NavIcon iconKey={iconKey} color="#71717a" />
                    </motion.div>
                  );
                }

                if (iconKey === "perfil") {
                  return (
                    <motion.div key={href} layout onClick={handlePerfilClick}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      style={{
                        background: active ? "#7c3aed" : "transparent",
                        borderRadius: 99,
                        paddingLeft: active ? 14 : 10, paddingRight: active ? 14 : 10,
                        paddingTop: 8, paddingBottom: 8,
                        transition: "background 0.25s ease, padding 0.25s ease",
                      }}>
                      <NavIcon iconKey={iconKey} color={active ? "#fff" : "#71717a"} />
                      <AnimatePresence>
                        {active && (
                          <motion.span key="label"
                            initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="text-[12px] font-semibold text-white font-syne whitespace-nowrap overflow-hidden">
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                }

                return (
                  <Link key={href} href={href}>
                    <motion.div layout
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      style={{
                        background: active ? "#7c3aed" : "transparent",
                        borderRadius: 99,
                        paddingLeft: active ? 14 : 10, paddingRight: active ? 14 : 10,
                        paddingTop: 8, paddingBottom: 8,
                        transition: "background 0.25s ease, padding 0.25s ease",
                      }}>
                      <NavIcon iconKey={iconKey} color={active ? "#fff" : "#71717a"} />
                      <AnimatePresence>
                        {active && (
                          <motion.span key="label"
                            initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="text-[12px] font-semibold text-white font-syne whitespace-nowrap overflow-hidden">
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
              <button onClick={openSearch}
                className="flex items-center justify-center cursor-pointer select-none rounded-full transition-colors hover:bg-white/8"
                style={{ width: 36, height: 36 }}>
                <Search style={{ width: 18, height: 18, color: "#71717a" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {showResume && <ResumeModal onClose={() => setShowResume(false)} />}
      </AnimatePresence>
    </>
  );
}
