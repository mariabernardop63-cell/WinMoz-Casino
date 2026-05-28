import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Search, X, LayoutGrid } from "lucide-react";

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5L12 3L21 11.5" stroke={color} strokeWidth="2.1" />
      <rect x="5" y="11" width="14" height="10" rx="1.5" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
}

function PartidaIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <line x1="3" y1="6" x2="14" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="12" x2="11" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="18" x2="11" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <polygon points="16,9 16,19 23,14" fill={color} />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",         iconKey: "home",     label: "Home" },
  { href: "/explorar", iconKey: "explorar", label: "Explorar" },
  { href: "/partidas", iconKey: "partidas", label: "Partidas" },
  { href: "/perfil",   iconKey: "perfil",   label: "Perfil" },
];

function NavIcon({ iconKey, color }: { iconKey: string; color: string }) {
  if (iconKey === "home") return <HomeIcon color={color} />;
  if (iconKey === "explorar") return <LayoutGrid style={{ width: 18, height: 18, color }} />;
  if (iconKey === "partidas") return <PartidaIcon color={color} />;
  if (iconKey === "perfil") return <User style={{ width: 18, height: 18, color }} />;
  return null;
}

export default function BottomNav() {
  const [location] = useLocation();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
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

  return (
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
  );
}
