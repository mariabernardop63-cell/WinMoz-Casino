import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Search, X, RefreshCw, MessageCircle, Home, Gamepad2, Compass } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ActiveGameRecord } from "@/lib/simulation";
import { useBrand } from "@/lib/brand-context";

const NAV_ITEMS = [
  { href: "/",         icon: Home,      label: "Início" },
  { href: "/explorar", icon: Compass,   label: "Explorar" },
  { href: "/partidas", icon: Gamepad2,  label: "Jogos" },
  { href: "/perfil",   icon: User,      label: "Perfil" },
];

const GAME_META: Record<string, { name: string; image: string; imagePos: string }> = {
  damas:  { name: "Damas MZ",  image: "/damas-mz.webp",    imagePos: "center" },
  chess:  { name: "Xadrez MZ", image: "/xadrez-mz.jpg",   imagePos: "center 30%" },
  ludo:   { name: "Ludo Cash", image: "/ludo-cash.jpg",   imagePos: "center" },
};

function ResumeModal({ activeGame, onClose }: { activeGame: ActiveGameRecord | null; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { whatsappUrl } = useBrand();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const go = (path: string) => { onClose(); setLocation(path); };

  const gameShortcuts = [
    { id: "damas",  name: "Damas MZ",  image: "/damas-mz.webp",    imagePos: "center" },
    { id: "ludo",   name: "Ludo Cash", image: "/ludo-cash.jpg",   imagePos: "center" },
    { id: "xadrez", name: "Xadrez MZ", image: "/xadrez-mz.jpg",   imagePos: "center 30%" },
  ];

  if (activeGame) {
    const meta  = GAME_META[activeGame.gameType] ?? GAME_META["damas"];
    const minsAgo = Math.round((Date.now() - activeGame.savedAt) / 60_000);
    const timeLabel = minsAgo <= 1 ? "Agora mesmo" : `Há ${minsAgo} min`;

    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        onClick={onClose}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }} />

        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 350, mass: 0.55 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative", width: "100%", maxWidth: 430,
            background: "#0c0c10", borderRadius: "20px 20px 0 0",
            overflow: "hidden", zIndex: 1,
            paddingBottom: "env(safe-area-inset-bottom, 20px)",
          }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 28, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 20px 16px" }}>
            <div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#fafafa", lineHeight: 1.2, marginBottom: 4 }}>Partida em Curso</p>
              <p style={{ fontSize: 12, color: "#52525b", lineHeight: 1.5 }}>Tens um jogo activo. Volta para não perderes!</p>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: 12, marginTop: 2 }}>
              <X style={{ width: 13, height: 13, color: "#52525b" }} />
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 16 }} />

          <div style={{ padding: "0 20px", marginBottom: 14 }}>
            <motion.button whileTap={{ scale: 0.98 }}
              onClick={() => {
                const _gt = activeGame.gameType === "chess" ? "xadrez" : activeGame.gameType;
                const _route = `${_gt}-jogo`;
                const colorParam = activeGame.playerColor ? `&color=${encodeURIComponent(activeGame.playerColor)}` : "";
                const nameParam  = activeGame.playerName  ? `&myname=${encodeURIComponent(activeGame.playerName)}` : "";
                go(`/${_route}?gameId=${activeGame.gameId}&bet=${activeGame.betAmount}&opp=${encodeURIComponent(activeGame.opponentName)}${colorParam}${nameParam}`);
              }}
              style={{ width: "100%", background: "#141418", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "stretch" }}>
              <div style={{ width: 84, flexShrink: 0, position: "relative", overflow: "hidden" }}>
                <img src={meta.image} alt={meta.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: meta.imagePos, minHeight: 80 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0.45))" }} />
              </div>
              <div style={{ flex: 1, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0, boxShadow: "0 0 5px rgba(34,197,94,0.5)" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: 0.8, textTransform: "uppercase" as const }}>Activo</span>
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, color: "#fafafa", marginBottom: 3 }}>{meta.name}</p>
                <p style={{ fontSize: 11, color: "#52525b", marginBottom: 1 }}>vs {activeGame.opponentName}</p>
                <p style={{ fontSize: 10, color: "#3f3f46" }}>{timeLabel} · {activeGame.betAmount > 0 ? `${activeGame.betAmount} MT` : "Demo"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingRight: 14, flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw style={{ width: 14, height: 14, color: "#a1a1aa" }} />
                </div>
              </div>
            </motion.button>
          </div>

          <div style={{ padding: "0 20px 22px" }}>
            <button
              onClick={() => { if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer"); onClose(); }}
              style={{ width: "100%", height: 44, background: "rgba(255,255,255,0.04)", color: "#a1a1aa", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <MessageCircle style={{ width: 14, height: 14 }} />
              Grupo WhatsApp
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }} />

      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 350, mass: 0.55 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 430,
          background: "#0c0c10", borderRadius: "20px 20px 0 0",
          overflow: "hidden", zIndex: 1,
          paddingBottom: "env(safe-area-inset-bottom, 20px)",
        }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 28, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 20px 16px" }}>
          <div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#fafafa", lineHeight: 1.2, marginBottom: 4 }}>Iniciar Jogo</p>
            <p style={{ fontSize: 12, color: "#52525b", lineHeight: 1.5 }}>Escolhe um jogo para começar.</p>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: 12, marginTop: 2 }}>
            <X style={{ width: 13, height: 13, color: "#52525b" }} />
          </button>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 16 }} />

        <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 16 }}>
          {gameShortcuts.map(g => (
            <motion.button key={g.id} whileTap={{ scale: 0.97 }}
              onClick={() => go(`/apostar/${g.id}`)}
              style={{ flex: 1, background: "#141418", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left" }}>
              <div style={{ height: 64, overflow: "hidden", position: "relative" }}>
                <img src={g.image} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.imagePos }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05))" }} />
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11, color: "#e4e4e7" }}>{g.name}</p>
              </div>
            </motion.button>
          ))}
        </div>

        <div style={{ padding: "0 20px 22px" }}>
          <button
            onClick={() => { if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer"); onClose(); }}
            style={{ width: "100%", height: 44, background: "rgba(255,255,255,0.04)", color: "#a1a1aa", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <MessageCircle style={{ width: 14, height: 14 }} />
            Grupo WhatsApp
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
  const [activeGame, setActiveGame] = useState<ActiveGameRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    function checkActiveGame() {
      try {
        const raw = localStorage.getItem("wm_active_game");
        if (!raw) { setActiveGame(null); return; }
        const rec = JSON.parse(raw) as ActiveGameRecord;
        if (Date.now() > rec.savedAt + rec.ttlMs) {
          localStorage.removeItem("wm_active_game");
          setActiveGame(null);
        } else {
          setActiveGame(rec);
        }
      } catch { setActiveGame(null); }
    }
    checkActiveGame();
    const id = setInterval(checkActiveGame, 5000);
    return () => clearInterval(id);
  }, []);

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

  const handleResumeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { setLocation("/login"); return; }

    let currentGame = activeGame;
    try {
      const raw = localStorage.getItem("wm_active_game");
      if (raw) {
        const rec = JSON.parse(raw) as ActiveGameRecord;
        if (Date.now() > rec.savedAt + rec.ttlMs) {
          localStorage.removeItem("wm_active_game");
          currentGame = null;
        } else {
          currentGame = rec;
          setActiveGame(rec);
        }
      } else {
        currentGame = null;
      }
    } catch { /* use existing state */ }

    const isRealMultiplayer = currentGame?.gameId
      && currentGame.gameId !== "local"
      && !currentGame.gameId.startsWith("bot_")
      && !currentGame.gameId.startsWith("wm");

    if (isRealMultiplayer) {
      try {
        const { data } = await supabase
          .from("matches")
          .select("status")
          .eq("id", currentGame!.gameId)
          .single();
        if (data && (data.status === "finished" || data.status === "cancelled")) {
          localStorage.removeItem("wm_active_game");
          setActiveGame(null);
          return;
        }
      } catch { /* network error — show resume optimistically */ }
    }

    setShowResume(true);
  };

  const handlePerfilClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { setLocation("/login"); return; }
    setLocation("/perfil");
  };

  const hasActiveGame = !!activeGame;

  return (
    <>
      <nav className="public-bottom-nav fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
        style={{ width: "calc(100% - 40px)", maxWidth: 390 }}>
        <AnimatePresence mode="wait">
          {searching ? (
            <motion.div key="search"
              initial={{ scaleX: 0.9, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "rgba(12,12,16,0.95)", backdropFilter: "blur(20px)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)" }}>
              <Search style={{ width: 16, height: 16, color: "#52525b", flexShrink: 0 }} />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar jogos..."
                className="flex-1 bg-transparent text-white text-[13px] font-medium outline-none placeholder:text-zinc-600"
                style={{ fontFamily: "'Inter', sans-serif" }} />
              <button onClick={closeSearch}
                className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors hover:bg-white/5"
                style={{ width: 26, height: 26 }}>
                <X style={{ width: 13, height: 13, color: "#71717a" }} />
              </button>
            </motion.div>
          ) : (
            <motion.div key="nav"
              initial={{ scaleX: 0.9, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between px-2 py-2"
              style={{
                background: "rgba(12,12,16,0.95)",
                backdropFilter: "blur(20px)",
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
              }}>
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);

                if (href === "/partidas") {
                  return (
                    <motion.div key={href} layout onClick={handleResumeClick}
                      className="flex items-center justify-center cursor-pointer select-none relative"
                      style={{
                        width: 42, height: 42,
                        borderRadius: 12,
                        background: hasActiveGame ? "rgba(34,197,94,0.1)" : "transparent",
                        border: hasActiveGame ? "1px solid rgba(34,197,94,0.2)" : "1px solid transparent",
                        transition: "all 0.25s ease",
                      }}>
                      <Icon style={{ width: 19, height: 19, color: hasActiveGame ? "#22c55e" : "#52525b" }} strokeWidth={active ? 2.2 : 1.8} />
                      {hasActiveGame && (
                        <span style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px rgba(34,197,94,0.6)" }} />
                      )}
                    </motion.div>
                  );
                }

                if (href === "/perfil") {
                  return (
                    <motion.div key={href} layout onClick={handlePerfilClick}
                      className="flex items-center justify-center cursor-pointer select-none"
                      style={{
                        width: 42, height: 42,
                        borderRadius: 12,
                        background: active ? "rgba(255,255,255,0.08)" : "transparent",
                        border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
                        transition: "all 0.25s ease",
                      }}>
                      <Icon style={{ width: 19, height: 19, color: active ? "#fafafa" : "#52525b" }} strokeWidth={active ? 2.2 : 1.8} />
                    </motion.div>
                  );
                }

                return (
                  <Link key={href} href={href}>
                    <motion.div layout
                      className="flex items-center justify-center cursor-pointer select-none"
                      style={{
                        width: 42, height: 42,
                        borderRadius: 12,
                        background: active ? "rgba(255,255,255,0.08)" : "transparent",
                        border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
                        transition: "all 0.25s ease",
                      }}>
                      <Icon style={{ width: 19, height: 19, color: active ? "#fafafa" : "#52525b" }} strokeWidth={active ? 2.2 : 1.8} />
                    </motion.div>
                  </Link>
                );
              })}
              <button onClick={openSearch}
                className="flex items-center justify-center cursor-pointer select-none rounded-xl transition-colors hover:bg-white/5"
                style={{ width: 42, height: 42 }}>
                <Search style={{ width: 18, height: 18, color: "#52525b" }} strokeWidth={1.8} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {showResume && <ResumeModal activeGame={activeGame} onClose={() => setShowResume(false)} />}
      </AnimatePresence>
    </>
  );
}
