import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Gamepad2,
  Users,
  ArrowLeftRight,
  MessageCircle,
  Flag,
  Landmark,
  Bell,
  Settings,
  UserX,
  Wifi,
  Wallet,
  ShieldCheck,
  BarChart3,
  ChevronUp,
  ChevronDown,
  InboxIcon,
  Bot,
  Star,
  Ticket,
  LogOut,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import { useAdminTheme } from "@/admin/contexts/AdminThemeContext";
import { useAuth } from "@/contexts/AuthContext";

/* ── Navegação agrupada por secção (organização profissional) ── */
const navSections: Array<{ items: Array<{ href: string; icon: LucideIcon; label: string }> }> = [
  {
    items: [
      { href: "/",                 icon: LayoutDashboard,  label: "Dashboard"           },
      { href: "/online-users",     icon: Wifi,             label: "Online Agora"        },
      { href: "/players",          icon: Users,            label: "Jogadores"           },
      { href: "/matches",          icon: Gamepad2,         label: "Partidas"            },
    ],
  },
  {
    items: [
      { href: "/deposit-requests", icon: InboxIcon,        label: "Depósitos"           },
      { href: "/withdrawals",      icon: Landmark,         label: "Saques"              },
      { href: "/balance",          icon: Wallet,           label: "Saldos"              },
      { href: "/transactions",     icon: ArrowLeftRight,   label: "Transações"          },
      { href: "/recharge-management", icon: Ticket,        label: "Recargas"            },
      { href: "/affiliates",       icon: Star,             label: "Afiliados"           },
    ],
  },
  {
    items: [
      { href: "/game-management",  icon: Gamepad2,         label: "Gestão de Jogos"     },
      { href: "/bots",             icon: Bot,              label: "Bots"                },
      { href: "/notifications",    icon: Bell,             label: "Notificações"        },
      { href: "/messages",         icon: MessageCircle,    label: "Mensagens"           },
    ],
  },
  {
    items: [
      { href: "/reports",          icon: Flag,             label: "Denúncias"           },
      { href: "/block-users",      icon: UserX,            label: "Bloquear Usuários"   },
      { href: "/security",         icon: ShieldCheck,      label: "Segurança"           },
      { href: "/relatorios",       icon: BarChart3,        label: "Relatórios"          },
    ],
  },
];

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2
                 px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap
                 opacity-0 -translate-x-2
                 group-hover:opacity-100 group-hover:translate-x-0
                 transition-all duration-200 z-[999]"
      style={{
        background: "#18181b",
        color: "#fafafa",
        boxShadow: "0 4px 20px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08)",
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          top: "50%",
          right: "100%",
          transform: "translateY(-50%)",
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderRight: "5px solid #18181b",
          display: "block",
          width: 0,
          height: 0,
        }}
      />
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { href: string; icon: LucideIcon; label: string }; active: boolean; onClick?: () => void }) {
  return (
    <Link href={item.href} className="w-full flex-shrink-0" onClick={onClick}>
      <div
        className={cn(
          "gz-nav-item w-full h-[40px] flex items-center justify-center cursor-pointer group",
          active ? "active" : ""
        )}
        title={item.label}
      >
        {active && (
          <span
            style={{
              position: "absolute",
              left: -10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 3,
              height: 18,
              borderRadius: "0 3px 3px 0",
              background: "#fafafa",
            }}
          />
        )}
        <item.icon
          style={{
            width: 17,
            height: 17,
            strokeWidth: active ? 2 : 1.6,
            color: active ? "#0a0a0a" : "rgba(255,255,255,.55)",
            position: "relative",
            zIndex: 1,
          }}
        />
        <Tooltip label={item.label} />
      </div>
    </Link>
  );
}

interface SidebarProps {
  onItemClick?: () => void;
}

export default function Sidebar({ onItemClick }: SidebarProps) {
  const [location] = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  function checkScroll() {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  function scrollNav(dir: "up" | "down") {
    const el = navRef.current;
    if (!el) return;
    el.scrollBy({ top: dir === "up" ? -80 : 80, behavior: "smooth" });
  }

  const isActive = (href: string) =>
    location === href ||
    (href !== "/" && location.startsWith(href));

  return (
    <aside
      className="gz-sidebar admin-sidebar flex flex-col items-center"
      style={{
        width: 64,
        height: "100%",
        borderRadius: 22,
        padding: "12px 0 12px",
      }}
    >
      {/* ── Scroll Up ── */}
      <button
        onClick={() => scrollNav("up")}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg mb-1 transition-all"
        style={{
          opacity: canScrollUp ? 0.8 : 0.18,
          cursor: canScrollUp ? "pointer" : "default",
          background: "rgba(255,255,255,.07)",
        }}
        title="Deslizar para cima"
        disabled={!canScrollUp}
      >
        <ChevronUp style={{ width: 14, height: 14, color: "#fff" }} />
      </button>

      {/* ── Nav (agrupada) ── */}
      <nav
        ref={navRef}
        className="flex-1 flex flex-col items-center gap-1 w-full px-2.5 z-10 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
        onScroll={checkScroll}
      >
        {navSections.map((section, si) => (
          <div key={si} className="w-full flex flex-col items-center gap-1">
            {si > 0 && (
              <div
                className="my-1 flex-shrink-0"
                style={{
                  width: 24,
                  height: 1,
                  background: "rgba(255,255,255,.1)",
                }}
              />
            )}
            {section.items.map((item) => (
              <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={onItemClick} />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Scroll Down ── */}
      <button
        onClick={() => scrollNav("down")}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg mt-1 transition-all"
        style={{
          opacity: canScrollDown ? 0.8 : 0.18,
          cursor: canScrollDown ? "pointer" : "default",
          background: "rgba(255,255,255,.07)",
        }}
        title="Deslizar para baixo"
        disabled={!canScrollDown}
      >
        <ChevronDown style={{ width: 14, height: 14, color: "#fff" }} />
      </button>

      {/* ── Bottom ── */}
      <div className="flex flex-col items-center gap-1 w-full px-2.5 flex-shrink-0 z-10 mt-2">
        <div
          className="mb-1"
          style={{
            width: 24,
            height: 1,
            background: "rgba(255,255,255,.1)",
          }}
        />

        <Link href="/settings" className="w-full" onClick={onItemClick}>
          <div
            className={cn(
              "gz-nav-item w-full h-10 flex items-center justify-center cursor-pointer group",
              location === "/settings" ? "active" : ""
            )}
          >
            {location === "/settings" && (
              <span
                style={{
                  position: "absolute",
                  left: -10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 18,
                  borderRadius: "0 3px 3px 0",
                  background: "#fafafa",
                }}
              />
            )}
            <Settings
              style={{
                width: 16,
                height: 16,
                strokeWidth: 1.6,
                color: location === "/settings" ? "#0a0a0a" : "rgba(255,255,255,.45)",
                position: "relative",
                zIndex: 1,
              }}
            />
            <Tooltip label="Configurações" />
          </div>
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="gz-nav-item w-full h-10 flex items-center justify-center cursor-pointer group"
          title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        >
          {theme === "dark"
            ? <Sun style={{ width: 16, height: 16, strokeWidth: 1.6, color: "rgba(255,255,255,.55)", position: "relative", zIndex: 1 }} />
            : <Moon style={{ width: 16, height: 16, strokeWidth: 1.6, color: "rgba(255,255,255,.55)", position: "relative", zIndex: 1 }} />}
          <Tooltip label={theme === "dark" ? "Modo Claro" : "Modo Escuro"} />
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="gz-nav-item w-full h-10 flex items-center justify-center cursor-pointer group"
          title="Terminar Sessão"
        >
          <LogOut style={{ width: 16, height: 16, strokeWidth: 1.6, color: "rgba(248,113,113,.75)", position: "relative", zIndex: 1 }} />
          <Tooltip label="Terminar Sessão" />
        </button>
      </div>
    </aside>
  );
}
