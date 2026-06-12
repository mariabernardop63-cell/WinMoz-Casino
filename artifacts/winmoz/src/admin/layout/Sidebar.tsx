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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";

const navItems = [
  { href: "/",              icon: LayoutDashboard,  label: "Dashboard"          },
  { href: "/matches",       icon: Gamepad2,          label: "Partidas"           },
  { href: "/players",       icon: Users,             label: "Jogadores"          },
  { href: "/transactions",  icon: ArrowLeftRight,    label: "Transação"          },
  { href: "/messages",      icon: MessageCircle,     label: "Mensagem"           },
  { href: "/reports",       icon: Flag,              label: "Denúncias"          },
  { href: "/withdrawals",   icon: Landmark,          label: "Saques"             },
  { href: "/deposit-requests", icon: InboxIcon,      label: "Gestão de Depósitos" },
  { href: "/notifications", icon: Bell,              label: "Notificações"       },
  { href: "/online-users",  icon: Wifi,              label: "Online Agora"       },
  { href: "/balance",       icon: Wallet,            label: "Gestão de Saldos"   },
  { href: "/block-users",   icon: UserX,             label: "Bloquear Usuários"  },
  { href: "/security",      icon: ShieldCheck,       label: "Segurança"          },
  { href: "/relatorios",    icon: BarChart3,         label: "Relatórios"         },
  { href: "/bots",          icon: Bot,               label: "Gestão de Bots"     },
];

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2
                 px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap
                 opacity-0 -translate-x-2
                 group-hover:opacity-100 group-hover:translate-x-0
                 transition-all duration-200 z-[999]"
      style={{
        background: "rgba(15,12,32,.93)",
        color: "#ede9fe",
        boxShadow: "0 4px 20px rgba(0,0,0,.25), 0 0 0 1px rgba(108,92,231,.2)",
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
          borderRight: "5px solid rgba(15,12,32,.93)",
          display: "block",
          width: 0,
          height: 0,
        }}
      />
    </div>
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

  return (
    <aside
      className="gz-sidebar flex flex-col items-center"
      style={{
        width: 66,
        height: "100%",
        borderRadius: 28,
        padding: "14px 0 14px",
      }}
    >
      {/* ── Scroll Up ── */}
      <button
        onClick={() => scrollNav("up")}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl mb-1 transition-all"
        style={{
          opacity: canScrollUp ? 0.85 : 0.2,
          cursor: canScrollUp ? "pointer" : "default",
          background: "rgba(255,255,255,.12)",
        }}
        title="Deslizar para cima"
        disabled={!canScrollUp}
      >
        <ChevronUp style={{ width: 14, height: 14, color: "#fff" }} />
      </button>

      {/* ── Nav ── */}
      <nav
        ref={navRef}
        className="flex-1 flex flex-col items-center gap-0.5 w-full px-2.5 z-10 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
        onScroll={checkScroll}
      >
        {navItems.map((item, i) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));

          return (
            <Link key={`${item.href}-${i}`} href={item.href} className="w-full flex-shrink-0" onClick={onItemClick}>
              <div
                className={cn(
                  "gz-nav-item w-full h-[42px] flex items-center justify-center cursor-pointer group",
                  isActive ? "active" : ""
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: 20,
                      borderRadius: "0 3px 3px 0",
                      background: "rgba(255,255,255,.95)",
                      boxShadow: "0 0 8px rgba(255,255,255,.6)",
                    }}
                  />
                )}

                <item.icon
                  style={{
                    width: 17,
                    height: 17,
                    strokeWidth: isActive ? 2.2 : 1.65,
                    color: isActive ? "#ffffff" : "rgba(255,255,255,.5)",
                    position: "relative",
                    zIndex: 1,
                    filter: isActive ? "drop-shadow(0 0 6px rgba(255,255,255,.5))" : "none",
                  }}
                />

                <Tooltip label={item.label} />
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Scroll Down ── */}
      <button
        onClick={() => scrollNav("down")}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl mt-1 transition-all"
        style={{
          opacity: canScrollDown ? 0.85 : 0.2,
          cursor: canScrollDown ? "pointer" : "default",
          background: "rgba(255,255,255,.12)",
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
            width: 28,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent)",
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
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 18,
                  borderRadius: "0 3px 3px 0",
                  background: "rgba(255,255,255,.95)",
                }}
              />
            )}
            <Settings
              style={{
                width: 16,
                height: 16,
                strokeWidth: 1.65,
                color: location === "/settings" ? "#ffffff" : "rgba(255,255,255,.4)",
                position: "relative",
                zIndex: 1,
              }}
            />
            <Tooltip label="Configurações" />
          </div>
        </Link>
      </div>
    </aside>
  );
}
