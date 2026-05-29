import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Search, X, LayoutGrid, Play, Gamepad2 } from "lucide-react";

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.8L12 4L20 10.8V20C20 20.55 19.55 21 19 21H15.5V15H8.5V21H5C4.45 21 4 20.55 4 20V10.8Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
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

/* ─── Resume Modal ─── */
function ResumeModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)" }}
      />

      {/* Card */}
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          background: "#0d0d14",
          border: "1.5px solid rgba(239,68,68,0.7)",
          borderRadius: "18px 18px 0 18px",
          boxShadow: "0 0 0 1px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.7), 0 4px 16px rgba(239,68,68,0.18)",
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        {/* Red glow bar at top */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: 3, background: "linear-gradient(90deg, transparent 0%, #ef4444 40%, #ff6b6b 100%)", transformOrigin: "left" }}
        />

        {/* X button */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#a1a1aa", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>

        {/* Content */}
        <div style={{ padding: "24px 24px 28px" }}>
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.12, type: "spring", damping: 14, stiffness: 220 }}
            style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}
          >
            <Gamepad2 style={{ width: 24, height: 24, color: "#ef4444" }} />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 10, lineHeight: 1.25 }}
          >
            Nenhuma Partida em Curso
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.27, duration: 0.35 }}
            style={{ fontSize: 13.5, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 22 }}
          >
            Ainda não iniciaste nenhuma partida ativa. Escolhe um jogo, faz a tua aposta e regressa aqui para continuar de onde paraste — a qualquer momento.
          </motion.p>

          {/* Decorative stat row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.35 }}
            style={{ display: "flex", gap: 10, marginBottom: 22 }}
          >
            {[["🎮", "6 Jogos", "disponíveis"], ["⚡", "Ao Vivo", "partidas ativas"], ["🏆", "+50K MT", "em prémios"]].map(([emoji, val, label], i) => (
              <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7", fontFamily: "'Syne', sans-serif" }}>{val}</div>
                <div style={{ fontSize: 9.5, color: "#71717a", marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.35 }}
          >
            <Link href="/explorar">
              <button
                onClick={onClose}
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13.5, border: "none", borderRadius: 10, cursor: "pointer", letterSpacing: "0.3px", boxShadow: "0 4px 20px rgba(239,68,68,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Play style={{ width: 14, height: 14, fill: "#fff" }} /> Explorar Jogos
              </button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function BottomNav() {
  const [location] = useLocation();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [showResume, setShowResume] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const activeGame = localStorage.getItem("winmoz_active_game");
    if (activeGame) {
      window.location.href = activeGame;
    } else {
      setShowResume(true);
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
        style={{ width: "calc(100% - 40px)", maxWidth: 390 }}
      >
        <AnimatePresence mode="wait">
          {searching ? (
            <motion.div
              key="search"
              initial={{ scaleX: 0.85, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0.85, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: "#18181b", borderRadius: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}
            >
              <Search style={{ width: 17, height: 17, color: "#71717a", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar jogos, partidas..."
                className="flex-1 bg-transparent text-white text-[13px] font-medium outline-none placeholder:text-zinc-600 font-syne"
              />
              <button
                onClick={closeSearch}
                className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors hover:bg-white/10"
                style={{ width: 28, height: 28 }}
              >
                <X style={{ width: 15, height: 15, color: "#a1a1aa" }} />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="nav"
              initial={{ scaleX: 0.85, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0.85, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ background: "#18181b", borderRadius: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}
            >
              {NAV_ITEMS.map(({ href, iconKey, label }) => {
                const active = isActive(href);
                if (iconKey === "partidas") {
                  return (
                    <motion.div
                      key={href}
                      layout
                      onClick={handleResumeClick}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      style={{
                        background: "transparent",
                        borderRadius: 99,
                        paddingLeft: 10,
                        paddingRight: 10,
                        paddingTop: 8,
                        paddingBottom: 8,
                      }}
                    >
                      <NavIcon iconKey={iconKey} color="#71717a" />
                    </motion.div>
                  );
                }
                return (
                  <Link key={href} href={href}>
                    <motion.div
                      layout
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      style={{
                        background: active ? "#7c3aed" : "transparent",
                        borderRadius: 99,
                        paddingLeft: active ? 14 : 10,
                        paddingRight: active ? 14 : 10,
                        paddingTop: 8,
                        paddingBottom: 8,
                        transition: "background 0.25s ease, padding 0.25s ease",
                      }}
                    >
                      <NavIcon iconKey={iconKey} color={active ? "#fff" : "#71717a"} />
                      <AnimatePresence>
                        {active && (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="text-[12px] font-semibold text-white font-syne whitespace-nowrap overflow-hidden"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
              <button
                onClick={openSearch}
                className="flex items-center justify-center cursor-pointer select-none rounded-full transition-colors hover:bg-white/8"
                style={{ width: 36, height: 36 }}
              >
                <Search style={{ width: 18, height: 18, color: "#71717a" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Resume Modal */}
      <AnimatePresence>
        {showResume && <ResumeModal onClose={() => setShowResume(false)} />}
      </AnimatePresence>
    </>
  );
}
