import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import Sidebar from "./Sidebar";
import {
  Search, X, Moon, Sun, Menu, LogOut,
  LayoutDashboard, Landmark, InboxIcon, Bell, Settings,
  PanelLeft, PanelBottom, PanelTop,
  Gamepad2, Users, ArrowLeftRight, MessageCircle, Flag,
  Wifi, Wallet, UserX, ShieldCheck, BarChart3, Bot, Star,
} from "lucide-react";
import { useAdminTheme } from "@/admin/contexts/AdminThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { playAdminNotificationSound } from "@/admin/hooks/useAdminNotificationSound";

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
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        src.stop(0.001);
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
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

/* Listen for new pending withdrawal transactions via Supabase Realtime.
   Fires in every open admin session, not just the withdrawals page. */
function useWithdrawalNotification() {
  useEffect(() => {
    const channel = adminSupabase
      .channel("admin-layout-wd-watcher-v1")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "transactions" }, (payload: any) => {
        if (payload.new?.type === "withdrawal" && payload.new?.status === "pending") {
          playAdminNotificationSound("withdrawal");
        }
      })
      .subscribe();
    return () => { adminSupabase.removeChannel(channel); };
  }, []);
}

type NavPos = "left" | "bottom" | "top";

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

const ALL_NAV_ITEMS = [
  { href: "/",                 icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/matches",          icon: Gamepad2,        label: "Partidas"     },
  { href: "/players",          icon: Users,           label: "Jogadores"    },
  { href: "/transactions",     icon: ArrowLeftRight,  label: "Transações"   },
  { href: "/messages",         icon: MessageCircle,   label: "Mensagens"    },
  { href: "/reports",          icon: Flag,            label: "Denúncias"    },
  { href: "/withdrawals",      icon: Landmark,        label: "Saques"       },
  { href: "/deposit-requests", icon: InboxIcon,       label: "Depósitos"    },
  { href: "/notifications",    icon: Bell,            label: "Alertas"      },
  { href: "/online-users",     icon: Wifi,            label: "Online"       },
  { href: "/balance",          icon: Wallet,          label: "Saldos"       },
  { href: "/block-users",      icon: UserX,           label: "Bloqueios"    },
  { href: "/security",         icon: ShieldCheck,     label: "Segurança"    },
  { href: "/relatorios",       icon: BarChart3,       label: "Relatórios"   },
  { href: "/bots",             icon: Bot,             label: "Bots"         },
  { href: "/affiliates",       icon: Star,            label: "Afiliados"    },
  { href: "/game-management",  icon: Gamepad2,        label: "Jogos"        },
  { href: "/settings",         icon: Settings,        label: "Config"       },
];

/* Horizontal nav bar (for top/bottom desktop positions) */
function HorizontalSidebar({ onItemClick }: { onItemClick?: () => void }) {
  const [location] = useLocation();
  return (
    <aside
      className="gz-sidebar flex flex-row items-center w-full overflow-x-auto"
      style={{
        height: 58,
        borderRadius: 0,
        padding: "0 12px",
        gap: 2,
        scrollbarWidth: "none",
      }}
    >
      {ALL_NAV_ITEMS.map((item, i) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={`${item.href}-${i}`} href={item.href} onClick={onItemClick}>
            <div
              className={cn(
                "gz-nav-item flex flex-col items-center justify-center gap-0.5 h-full px-3 py-1 cursor-pointer flex-shrink-0 rounded-xl",
                isActive ? "active" : ""
              )}
              style={{ minWidth: 52, height: 46 }}
            >
              <item.icon
                style={{
                  width: 16,
                  height: 16,
                  strokeWidth: isActive ? 2.2 : 1.65,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,.5)",
                  filter: isActive ? "drop-shadow(0 0 5px rgba(255,255,255,.5))" : "none",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,.45)",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </aside>
  );
}

interface TopBarProps {
  onMenuClick: () => void;
  navPos: NavPos;
  onNavPosChange: (pos: NavPos) => void;
}

function TopBar({ onMenuClick, navPos, onNavPosChange }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  const navOptions: { pos: NavPos; icon: typeof PanelLeft; title: string }[] = [
    { pos: "left",   icon: PanelLeft,   title: "Barra Lateral Esquerda" },
    { pos: "top",    icon: PanelTop,    title: "Barra Superior"         },
    { pos: "bottom", icon: PanelBottom, title: "Barra Inferior"         },
  ];

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
        {/* Nav position toggle (desktop only) */}
        <div className="hidden lg:flex items-center gap-0.5 rounded-xl p-1" style={{ background: "var(--gz-bg-card-btn)" }}>
          {navOptions.map(({ pos, icon: Icon, title }) => (
            <button
              key={pos}
              onClick={() => onNavPosChange(pos)}
              title={title}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
              style={{
                background: navPos === pos ? "rgba(108,92,231,0.18)" : "transparent",
                border: navPos === pos ? "1px solid rgba(108,92,231,0.3)" : "1px solid transparent",
              }}
            >
              <Icon
                className="w-3.5 h-3.5"
                style={{ color: navPos === pos ? "#6C5CE7" : "#9ca3af" }}
                strokeWidth={1.8}
              />
            </button>
          ))}
        </div>

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
  const [navPos, setNavPos] = useState<NavPos>(() => {
    try {
      return (localStorage.getItem("adminNavPos") as NavPos) || "left";
    } catch {
      return "left";
    }
  });
  useAudioWarmup();
  useWithdrawalNotification();

  const handleNavPosChange = (pos: NavPos) => {
    setNavPos(pos);
    try { localStorage.setItem("adminNavPos", pos); } catch { /* noop */ }
  };

  /* ── LEFT sidebar layout ── */
  if (navPos === "left") {
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
          <TopBar onMenuClick={() => setSidebarOpen(o => !o)} navPos={navPos} onNavPosChange={handleNavPosChange} />
          <div style={{ flex: 1, overflowX: "hidden", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }} className="lg:pb-0">
            {children}
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  /* ── TOP sidebar layout ── */
  if (navPos === "top") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBar onMenuClick={() => setSidebarOpen(o => !o)} navPos={navPos} onNavPosChange={handleNavPosChange} />
        <div className="hidden lg:block w-full" style={{ zIndex: 30, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <HorizontalSidebar />
        </div>
        <div style={{ flex: 1, overflowX: "hidden", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }} className="lg:pb-0">
          {children}
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  /* ── BOTTOM sidebar layout ── */
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar onMenuClick={() => setSidebarOpen(o => !o)} navPos={navPos} onNavPosChange={handleNavPosChange} />
      <div style={{ flex: 1, overflowX: "hidden", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }} className="lg:pb-16">
        {children}
      </div>
      {/* Desktop bottom bar */}
      <div
        className="hidden lg:block fixed bottom-0 left-0 right-0 z-50"
        style={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <HorizontalSidebar />
      </div>
      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
