import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, LayoutGrid, ScrollText, User, Search, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",         icon: Home,        label: "Home" },
  { href: "/explorar", icon: LayoutGrid,  label: "Explorar" },
  { href: "/partidas", icon: ScrollText,  label: "Partidas" },
  { href: "/perfil",   icon: User,        label: "Perfil" },
];

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
          /* ── SEARCH MODE ── */
          <motion.div
            key="search"
            initial={{ scaleX: 0.85, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0.85, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2 px-4 py-3"
            style={{
              background: "#18181b",
              borderRadius: 32,
              boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            }}
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
          /* ── NORMAL NAV MODE ── */
          <motion.div
            key="nav"
            initial={{ scaleX: 0.85, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0.85, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between px-3 py-2.5"
            style={{
              background: "#18181b",
              borderRadius: 32,
              boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            }}
          >
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
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
                    <Icon style={{ width: 18, height: 18, color: active ? "#fff" : "#71717a", flexShrink: 0 }} />
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

            {/* Search button */}
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
