import { useEffect, useRef, useState } from "react";
import { User, Settings, Lock, ClipboardList, LogOut, ChevronDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, type AdminProfile } from "@/admin/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  financial: "Financeiro",
  moderator: "Moderador",
  support: "Suporte",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "#6C5CE7",
  admin: "#3b82f6",
  financial: "#10b981",
  moderator: "#f59e0b",
  support: "#8b5cf6",
};

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile } = useQuery<AdminProfile>({
    queryKey: ["admin-profile"],
    queryFn: () => api.get<AdminProfile>("/admin/profile"),
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const roleLabel = ROLE_LABELS[profile?.role ?? ""] ?? "Super Admin";
  const roleColor = ROLE_COLORS[profile?.role ?? ""] ?? "#6C5CE7";

  const displayName = profile?.name ?? user?.email ?? "Admin";
  const displayEmail = user?.email ?? profile?.email ?? "";
  const displayUsername = user?.email?.split("@")[0] ?? profile?.username ?? "admin";

  const menuItems = [
    { href: "/profile", icon: User, label: "Meu Perfil" },
    { href: "/settings", icon: Settings, label: "Configurações" },
    { href: "/activity-logs", icon: ClipboardList, label: "Logs de Atividade" },
  ];

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    toast({ title: "Sessão terminada", description: "Até logo!" });
    setLocation("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95"
        style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.06)" }}
      >
        <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(108,92,231,.18)" }}>
          <img
            src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${displayUsername}&backgroundColor=6C5CE7`}
            alt="Admin"
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "white" }}
          />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[12px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{displayName}</span>
          <span className="text-[10px] font-semibold mt-0.5" style={{ color: roleColor }}>{roleLabel}</span>
        </div>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0, boxShadow: "0 0 5px rgba(16,185,129,.5)" }} />
        <ChevronDown className="w-3 h-3 text-gray-400" strokeWidth={2} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-[220px] py-2 animate-float-up overflow-hidden"
          style={{
            background: "var(--gz-bg-card-btn)",
            borderRadius: 18,
            boxShadow: "0 20px 60px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.08)",
            border: "1px solid rgba(108,92,231,.08)",
          }}
        >
          <div className="px-4 py-3 border-b mb-1" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{displayName}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{displayEmail}</div>
            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: `${roleColor}14`, color: roleColor }}>
              {roleLabel}
            </span>
          </div>

          {menuItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors mx-1 rounded-xl">
                <item.icon style={{ width: 14, height: 14, color: "#6C5CE7", strokeWidth: 1.9 }} />
                <span className="text-[13px] font-medium" style={{ color: "var(--gz-text-secondary)" }}>{item.label}</span>
              </div>
            </Link>
          ))}

          <div className="border-t mx-2 my-1" style={{ borderColor: "rgba(108,92,231,.06)" }} />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-red-50 transition-colors mx-auto rounded-xl"
            style={{ width: "calc(100% - 8px)", marginLeft: 4 }}
          >
            <LogOut style={{ width: 14, height: 14, color: "#ef4444", strokeWidth: 1.9 }} />
            <span className="text-[13px] font-medium" style={{ color: "#ef4444" }}>Terminar Sessão</span>
          </button>
        </div>
      )}
    </div>
  );
}
