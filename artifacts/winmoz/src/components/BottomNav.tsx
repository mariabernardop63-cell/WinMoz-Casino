import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, LayoutGrid, ScrollText, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",         icon: Home,        label: "Home" },
  { href: "/explorar", icon: LayoutGrid,  label: "Explorar" },
  { href: "/partidas", icon: ScrollText,  label: "Partidas" },
  { href: "/perfil",   icon: User,        label: "Perfil" },
];

export default function BottomNav() {
  const [location] = useLocation();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
      style={{ width: "calc(100% - 40px)", maxWidth: 390 }}
    >
      <div
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
                <Icon
                  style={{
                    width: 18,
                    height: 18,
                    color: active ? "#ffffff" : "#71717a",
                    flexShrink: 0,
                    transition: "color 0.2s ease",
                  }}
                />
                <AnimatePresence>
                  {active && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, width: "auto", marginLeft: 0 }}
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
      </div>
    </nav>
  );
}
