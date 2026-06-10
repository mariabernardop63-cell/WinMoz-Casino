import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import Sidebar from "./Sidebar";
import {
  Search, X, Moon, Sun, Menu, LogOut,
  LayoutDashboard, Landmark, InboxIcon, Bell, Settings,
} from "lucide-react";
import { useAdminTheme } from "@/admin/contexts/AdminThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/* Warm up the Web Audio API context on first interaction so notification
   sounds are never blocked by the browser's autoplay policy. */
function useAudioWarmup() {
  useEffect(() => {
    let done = false;
    const warmup = () => {
      if (done) return;
      done = true;
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        // Create and immediately stop a silent buffer to unlock the context
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        src.stop(0.001);
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        // Store globally so the notification hook reuses this context
        (window as any).__adminAudioCtx = ctx;
      } catch { /* noop */ }
    };
    document.addEventListener("click",      warmup, { once: true, passive: true });
    document.addEventListener("touchstart",  warmup, { once: true, passive: true });
    document.addEventListener("keydown",     warmup, { once: true, passive: true });
    return () => {
      document.removeEventListener("click",     warmup);
      document.removeEventListener("touchstart", warmup);
      document.removeEventListener("keydown",    warmup);
    };
  }, []);
}

const MOBILE_NAV = [
  { href: "/",                  icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/withdrawals",       icon: Landmark,        label: "Saques"     },
  { href: "/deposit-requests",  icon: InboxIcon,       label: "Depósitos"  },
  { href: "/notifications",     icon: Bell,            label: "Alertas"    },
  { href: "/settings",          icon: Settings,        label: "Config"     },
];

function MobileBottomNav() {
  const [location] = useLocation();
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
      style={{
        background: "linear-gradient(175deg, #7166ee 0%, #6C5CE7 45%, #5e4fdb 100%)",
        boxShadow: "0 -4px 24px rgba(108,92,231,.35)",
        height: 60,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {MOBILE_NAV.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
                isActive ? "bg-white/20" : "bg-transparent"
              )}
              style={{ minWidth: 52 }}
            >
              <item.icon
                style={{
                  width: 20,
                  height: 20,
                  strokeWidth: isActive ? 2.2 : 1.6,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,.55)",
                  filter: isActive ? "drop-shadow(0 0 5px rgba(255,255,255,.5))" : "none",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,.55)",
                  letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

interface TopBarProps {
  onMenuClick: () => void;
}

function TopBar({ onMenuClick }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="gz-topbar h-[56px] flex items-center justify-between px-4 gap-3 flex-shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
          style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
          title="Menu"
        >
          <Menu className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
        </button>

        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-2xl"
              style={{
                background: "var(--gz-bg-card-btn)",
                border: "1.5px solid rgba(108,92,231,.2)",
              }}
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" strokeWidth={2} />
              <input
                autoFocus
                placeholder="Buscar..."
                className="bg-transparent outline-none text-[13px] w-32 sm:w-48"
                style={{ color: "var(--gz-text-primary)" }}
              />
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl text-[12.5px] font-medium transition-all active:scale-95"
            style={{
              background: "var(--gz-bg-card-btn)",
              color: "#9ca3af",
              boxShadow: "0 1px 3px rgba(0,0,0,.05)",
            }}
          >
            <Search className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Buscar...</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95"
          style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
          title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        >
          {theme === "dark"
            ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
            : <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
          }
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 h-9 px-3 rounded-2xl transition-all active:scale-95"
          style={{
            background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.15)",
            color: "#ef4444",
          }}
          title="Terminar Sessão"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.8} />
          <span className="text-[12.5px] font-bold hidden sm:inline">Terminar sessão</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAudioWarmup();

  return (
    <div style={{ minHeight: "100vh" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`lg:block transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}
      >
        <div className="h-full" style={{ paddingTop: 12, paddingLeft: 12, paddingBottom: 12 }}>
          <Sidebar onItemClick={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div
        className="lg:ml-[92px]"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <TopBar onMenuClick={() => setSidebarOpen(o => !o)} />
        <div style={{ flex: 1, overflowX: "hidden", paddingBottom: 70 }} className="lg:pb-0">
          {children}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
