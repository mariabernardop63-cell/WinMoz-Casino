import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, RefreshCw, Ban } from "lucide-react";
import { listAllUsersWithStatus, blockUser, type AdminProfile } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const V1 = "#6C5CE7";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  online:   { label: "Online",     color: "#10b981", bg: "rgba(16,185,129,.08)"  },
  offline:  { label: "Offline",    color: "#9ca3af", bg: "rgba(156,163,175,.08)" },
  blocked:  { label: "Bloqueado",  color: "#ef4444", bg: "rgba(239,68,68,.08)"   },
};

function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(seed?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`} alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.12)" }} />
  );
}

function StatusBadge({ s }: { s: typeof STATUS_MAP[string] }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

type Filter = "all" | "online" | "offline" | "blocked";

export default function OnlineUsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const { data: allUsers = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-online-users"],
    queryFn: listAllUsersWithStatus,
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-online-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const getStatus = (u: AdminProfile & { isOnline?: boolean }) => {
    if (u.is_blocked) return "blocked";
    if (u.isOnline) return "online";
    return "offline";
  };

  const filtered = allUsers
    .filter(u => {
      const st = getStatus(u as any);
      if (filter !== "all" && st !== filter) return false;
      if (search && !(u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
        && !(u.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const sa = getStatus(a as any) === "online" ? 0 : 1;
      const sb = getStatus(b as any) === "online" ? 0 : 1;
      return sa - sb;
    });

  const onlineCount = allUsers.filter(u => (u as any).isOnline && !u.is_blocked).length;
  const offlineCount = allUsers.filter(u => !(u as any).isOnline && !u.is_blocked).length;
  const blockedCount = allUsers.filter(u => u.is_blocked).length;

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: "all",     label: "Todos",      count: allUsers.length },
    { key: "online",  label: "Online",     count: onlineCount },
    { key: "offline", label: "Offline",    count: offlineCount },
    { key: "blocked", label: "Bloqueados", count: blockedCount },
  ];

  async function handleBlock(u: AdminProfile) {
    if (!user) return;
    try {
      await blockUser({ userId: u.id, userName: u.full_name ?? u.email ?? "Usuário", blockType: "account", reason: "Bloqueado pelo admin", adminId: user.id });
      toast({ title: "Conta bloqueada" });
      qc.invalidateQueries({ queryKey: ["admin-online-users"] });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilizadores Online</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitorização em tempo real de quem está activo</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Online",     value: onlineCount,  color: "#10b981" },
          { label: "Offline",    value: offlineCount, color: "#9ca3af" },
          { label: "Bloqueados", value: blockedCount, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex gap-2">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${filter === t.key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={filter === t.key ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
                {t.label}
                <span className="bg-white/20 text-current px-1.5 rounded-full text-[10px] font-bold">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--gz-text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: "var(--gz-bg-subtle)", borderColor: "rgba(108,92,231,.1)", color: "var(--gz-text-primary)" }} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Jogador", "Email", "Saldo", "Estado", "Última actividade", "Acções"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum utilizador encontrado</td></tr>
              ) : filtered.map(u => {
                const status = getStatus(u as any);
                const smap = STATUS_MAP[status];
                return (
                  <tr key={u.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <Avatar seed={u.full_name ?? u.email ?? u.id} />
                          {status === "online" && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                          )}
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{u.full_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--gz-text-secondary)" }}>{u.email ?? "—"}</td>
                    <td className="px-5 py-3.5 font-bold text-[12px]" style={{ color: V1 }}>MT {Number(u.balance).toFixed(2)}</td>
                    <td className="px-5 py-3.5"><StatusBadge s={smap} /></td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString("pt-PT") : "Nunca"}
                    </td>
                    <td className="px-5 py-3.5">
                      {!u.is_blocked && (
                        <button onClick={() => handleBlock(u)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                          style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>
                          <Ban style={{ width: 11, height: 11 }} /> Bloquear
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
