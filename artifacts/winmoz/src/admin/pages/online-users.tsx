import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Wifi, WifiOff, Gamepad2, Clock, Ban } from "lucide-react";
import { supabase } from "@/lib/supabase";

const V1 = "#6C5CE7";

export interface RealOnlinePlayer {
  id: string;
  username: string;
  avatarUrl: string | null;
  status: "online" | "in_game" | "idle" | "offline" | "suspended";
  balance: number;
  updatedAt: string;
}

function getStatus(p: Record<string, unknown>): RealOnlinePlayer["status"] {
  if ((p.is_blocked as boolean)) return "suspended";
  if (!p.last_seen_at) return "offline";
  const diffMs = Date.now() - new Date(p.last_seen_at as string).getTime();
  if (diffMs < 2 * 60 * 1000) return "online";
  if (diffMs < 5 * 60 * 1000) return "idle";
  return "offline";
}

function mapProfile(p: Record<string, unknown>): RealOnlinePlayer {
  return {
    id: p.id as string,
    username: (p.username as string) || (p.full_name as string) || "utilizador",
    avatarUrl: (p.avatar_url as string) ?? null,
    status: getStatus(p),
    balance: Number(p.balance ?? 0),
    updatedAt: (p.last_seen_at as string) ?? (p.updated_at as string) ?? (p.created_at as string),
  };
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  online:    { label: "Online",    color: "#10b981", bg: "rgba(16,185,129,.08)" },
  in_game:   { label: "Em Jogo",  color: "#6C5CE7", bg: "rgba(108,92,231,.08)" },
  idle:      { label: "Inactivo", color: "#f59e0b", bg: "rgba(245,158,11,.08)" },
  offline:   { label: "Offline",  color: "var(--gz-text-muted)", bg: "rgba(156,163,175,.08)" },
  suspended: { label: "Bloqueado",color: "#ef4444", bg: "rgba(239,68,68,.08)"  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.offline;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function Avatar({ seed, avatarUrl, size = 36 }: { seed: string; avatarUrl?: string | null; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(seed || "?").charCodeAt(0) % palette.length];
  const initials = ((seed || "?")[0] ?? "?").toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={seed}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute("hidden"); }}
        style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1.5px solid rgba(108,92,231,.12)" }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: `#${color}`, border: "1.5px solid rgba(108,92,231,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="gz-card p-4 flex-1">
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color }}>{value}</div>
      <div className="text-[11.5px] font-semibold mt-1" style={{ color: "var(--gz-text-muted)" }}>{label}</div>
    </div>
  );
}

const FILTER_TABS = [
  { key: "all",      label: "Todos"      },
  { key: "online",   label: "Online"     },
  { key: "offline",  label: "Offline"    },
  { key: "blocked",  label: "Bloqueados" },
] as const;

async function fetchOnlinePlayers(): Promise<RealOnlinePlayer[]> {
  // Try with last_seen_at ordering first; fall back to updated_at if column missing
  let result = await supabase
    .from("profiles")
    .select("*")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (result.error) {
    // last_seen_at may not exist — retry with updated_at ordering
    result = await supabase
      .from("profiles")
      .select("*")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(300);
  }
  if (result.error) return [];
  return (result.data ?? []).map(p => mapProfile(p as Record<string, unknown>));
}

export default function OnlineUsersPage() {
  const [filter, setFilter] = useState<"all" | "online" | "offline" | "blocked">("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: allPlayers = [], isLoading, refetch } = useQuery<RealOnlinePlayer[]>({
    queryKey: ["online-players-real"],
    queryFn: fetchOnlinePlayers,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-online-users-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["online-players-real"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["online-players-real"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const players = allPlayers.filter(p => {
    if (filter === "online")  return p.status === "online" || p.status === "in_game" || p.status === "idle";
    if (filter === "offline") return p.status === "offline";
    if (filter === "blocked") return p.status === "suspended";
    return true;
  }).filter(p =>
    search === "" || p.username.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total:   allPlayers.length,
    online:  allPlayers.filter(p => p.status === "online" || p.status === "in_game").length,
    offline: allPlayers.filter(p => p.status === "offline").length,
    blocked: allPlayers.filter(p => p.status === "suspended").length,
  };

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      <div className="gz-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Utilizadores Online</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Monitorização em tempo real · Actualiza de 15 em 15 s
            </p>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.3)" }}>
            <Wifi style={{ width: 13, height: 13 }} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <StatCard label="Total" value={counts.total} color={V1} />
        <StatCard label="Online / Em Jogo" value={counts.online} color="#10b981" />
        <StatCard label="Offline" value={counts.offline} color="var(--gz-text-muted)" />
        <StatCard label="Bloqueados" value={counts.blocked} color="#ef4444" />
      </div>

      <div className="gz-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search style={{ width: 13, height: 13, color: "var(--gz-text-tertiary)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Procurar utilizador..."
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: "var(--gz-text-primary)" }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_TABS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: filter === f.key ? V1 : "rgba(108,92,231,.07)",
                color: filter === f.key ? "white" : "var(--gz-text-muted)",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <Users style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9 }} />
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
            {players.length} utilizador{players.length !== 1 ? "es" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="py-16 text-center">
            <WifiOff style={{ width: 32, height: 32, color: "var(--gz-text-tertiary)", strokeWidth: 1.3, margin: "0 auto 10px" }} />
            <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum utilizador encontrado</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.04)" }}>
            {players.map(player => (
              <div key={player.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors group">
                <Avatar seed={player.username} avatarUrl={player.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{player.username}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock style={{ width: 10, height: 10, color: "var(--gz-text-tertiary)" }} />
                    <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      {player.updatedAt
                        ? new Date(player.updatedAt).toLocaleString("pt-BR", { timeStyle: "short", dateStyle: "short" })
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[13px] font-bold" style={{ color: V1 }}>
                    MT {player.balance.toFixed(2)}
                  </div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>saldo</div>
                </div>
                <StatusBadge status={player.status} />
                {player.status === "in_game" && (
                  <Gamepad2 style={{ width: 14, height: 14, color: V1, strokeWidth: 1.8, opacity: 0.6 }} />
                )}
                {player.status === "suspended" && (
                  <Ban style={{ width: 14, height: 14, color: "#ef4444", strokeWidth: 1.8, opacity: 0.7 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
