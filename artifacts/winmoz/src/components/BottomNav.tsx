import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Search, X, LayoutGrid, Play, Gamepad2, Zap } from "lucide-react";

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

/* ─── Resume Modal (bottom sheet) ─── */
function ResumeModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const stats = [
    { icon: <Gamepad2 style={{ width: 16, height: 16, color: "#7c3aed" }} />, value: "5 Jogos", label: "Disponíveis", accent: "#7c3aed" },
    { icon: <Zap style={{ width: 16, height: 16, color: "#f59e0b", fill: "#f59e0b" }} />, value: "Ao Vivo", label: "Partidas ativas", accent: "#f59e0b" },
    { icon: <Search style={{ width: 16, height: 16, color: "#00D4B4" }} />, value: "+50K MT", label: "Em prémios", accent: "#00D4B4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />

      {/* Sheet */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 320, mass: 0.7 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          background: "#0f0f18",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(124,58,237,0.3)",
          borderBottom: "none",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.12)",
          overflow: "hidden",
          zIndex: 1,
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        {/* Top accent bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: 3, background: "linear-gradient(90deg, #7c3aed, #a855f7, #7c3aed)", transformOrigin: "left" }}
        />

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <div style={{ padding: "12px 22px 24px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Gamepad2 style={{ width: 20, height: 20, color: "#7c3aed" }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", lineHeight: 1.2 }}>Nenhuma Partida Ativa</p>
                <p style={{ fontSize: 11.5, color: "#71717a", marginTop: 2 }}>Inicia um jogo para retomar aqui</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X style={{ width: 14, height: 14, color: "#71717a" }} />
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "11px 8px", textAlign: "center" }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e4e4e7", fontFamily: "'Syne', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 9.5, color: "#52525b", marginTop: 2 }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/explorar">
              <button
                onClick={onClose}
                style={{ width: "100%", height: 50, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 14, cursor: "pointer", letterSpacing: "0.3px", boxShadow: "0 4px 20px rgba(124,58,237,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Play style={{ width: 14, height: 14, fill: "#fff" }} /> Explorar Jogos
              </button>
            </Link>
          </div>
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
