import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Gamepad2,
  Users,
  Coins,
  Trophy,
  Flag,
  Landmark,
  ShieldCheck,
  Settings,
  UserCircle,
  Wifi,
  Wallet,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",              icon: LayoutDashboard, label: "Dashboard"          },
  { href: "/matches",       icon: Gamepad2,         label: "Partidas"           },
  { href: "/players",       icon: Users,            label: "Jogadores"          },
  { href: "/bets",          icon: Coins,            label: "Apostas"            },
  { href: "/ranking",       icon: Trophy,           label: "Ranking"            },
  { href: "/reports",       icon: Flag,             label: "Denúncias"          },
  { href: "/withdrawals",   icon: Landmark,         label: "Saques"             },
  { href: "/antifraud",     icon: ShieldCheck,      label: "Anti-Fraude"        },
  { href: "/online-users",  icon: Wifi,             label: "Online Agora"       },
  { href: "/balance",       icon: Wallet,           label: "Gestão de Saldos"   },
  { href: "/activity-logs", icon: ClipboardList,    label: "Logs de Actividade" },
  { href: "/profile",        icon: UserCircle,       label: "Meu Perfil"         },
  { href: "/relatorios",    icon: BarChart3,        label: "Relatórios"         },
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

  return (
    <aside
      className="gz-sidebar flex flex-col items-center"
      style={{
        width: 66,
        height: "100%",
        borderRadius: 28,
        padding: "18px 0 14px",
      }}
    >
      {/* ── Logo ── */}
      <div className="relative mb-1 flex-shrink-0 z-10">
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            background: "rgba(255,255,255,.18)",
            border: "1px solid rgba(255,255,255,.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)",
          }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.03em",
              userSelect: "none",
            }}
          >
            GZ
          </span>
        </div>
        <div className="absolute inset-0 animate-glow pointer-events-none" style={{ borderRadius: 13 }} />
      </div>

      {/* ── Divider ── */}
      <div
        className="my-3 flex-shrink-0"
        style={{
          width: 28,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent)",
        }}
      />

      {/* ── Nav ── */}
      <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-2.5 overflow-y-auto z-10" style={{ scrollbarWidth: "none" }}>
        {navItems.map((item, i) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));

          return (
            <Link key={`${item.href}-${i}`} href={item.href} className="w-full" onClick={onItemClick}>
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

      {/* ── Bottom ── */}
      <div className="flex flex-col items-center gap-1 w-full px-2.5 flex-shrink-0 z-10">
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
