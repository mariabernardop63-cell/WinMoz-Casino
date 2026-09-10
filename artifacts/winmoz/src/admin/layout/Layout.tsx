import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import Sidebar from "./Sidebar";
import {
  LayoutDashboard, Landmark, InboxIcon, Bell, Settings,
  LogOut, Moon, Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { playAdminNotificationSound } from "@/admin/hooks/useAdminNotificationSound";
import { useAdminTheme } from "@/admin/contexts/AdminThemeContext";
import { useAuth } from "@/contexts/AuthContext";

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
        background: "#0a0a0a",
        boxShadow: "0 -4px 24px rgba(0,0,0,.35)",
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
                isActive ? "bg-white/15" : "bg-transparent"
              )}
              style={{ minWidth: 52 }}
            >
              <item.icon
                style={{
                  width: 20,
                  height: 20,
                  strokeWidth: isActive ? 2.2 : 1.6,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,.5)",
                  filter: "none",
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

function MobileTopBar() {
  const { theme, toggleTheme } = useAdminTheme();
  const { signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };
  return (
    <div className="lg:hidden sticky top-0 z-40 flex items-center justify-end gap-2 px-4 h-14 gz-topbar">
      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95"
        style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
        title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
      >
        {theme === "dark"
          ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
          : <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.8} />}
      </button>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 h-9 px-3 rounded-2xl transition-all active:scale-95"
        style={{ background: "rgba(185,28,28,.1)", border: "1px solid rgba(185,28,28,.2)", color: "#b91c1c" }}
        title="Terminar Sessão"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useAudioWarmup();
  useWithdrawalNotification();

  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        className="hidden lg:block"
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}
      >
        <div className="h-full" style={{ paddingTop: 12, paddingLeft: 12, paddingBottom: 12 }}>
          <Sidebar />
        </div>
      </div>
      <div
        className="lg:ml-[92px]"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <MobileTopBar />
        <div
          style={{ flex: 1, overflowX: "hidden", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }}
          className="lg:pb-0"
        >
          {children}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
