import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, Coins, Landmark, Gamepad2, ArrowUpRight, ArrowDownLeft,
  Wallet, TrendingUp, Activity, RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats, getRecentMatches, getEarningsChartData,
  type AdminMatch,
} from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const V1 = "#6C5CE7";
const V2 = "#a78bfa";
const V3 = "#10b981";
const V4 = "#f59e0b";

function LiveDot() {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0">
      <span className="animate-pulse-ring absolute inset-0 rounded-full" style={{ background: "rgba(16,185,129,.3)" }} />
      <span className="animate-pulse-dot relative w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
    </span>
  );
}

function NeonBadge({ children, variant = "live" }: { children: React.ReactNode; variant?: "live" | "purple" | "warn" | "danger" }) {
  const cls = { live: "neon-live", purple: "neon-purple-badge", warn: "neon-warning", danger: "neon-danger" }[variant];
  return <span className={`neon-badge ${cls}`}>{children}</span>;
}

function Avatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b", "ec4899"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return (
    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`} alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.14)" }} />
  );
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

function GameTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    damas:  { bg: "rgba(14,165,233,.1)",  text: "#0ea5e9" },
    ludo:   { bg: "rgba(16,185,129,.1)",  text: "#10b981" },
    xadrez: { bg: "rgba(108,92,231,.1)",  text: V1 },
    roleta: { bg: "rgba(245,158,11,.1)",  text: V4 },
  };
  const c = colors[type] ?? { bg: "rgba(156,163,175,.1)", text: "#9ca3af" };
  return (
    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function Dashboard() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
  });

  const { data: recentMatches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ["admin-recent-matches"],
    queryFn: () => getRecentMatches(8),
    refetchInterval: 15000,
  });

  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey: ["admin-earnings-chart"],
    queryFn: getEarningsChartData,
    refetchInterval: 60000,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchStats(), refetchMatches()]);
    setLastRefresh(new Date());
  }, [refetchStats, refetchMatches]);

  useEffect(() => {
    const ch = supabase.channel("admin-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () => refetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => { refetchStats(); refetchMatches(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => refetchStats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetchStats, refetchMatches]);

  const platformBalance = stats?.platformBalance ?? 0;
  const todayWithdrawals = stats?.todayWithdrawals ?? 0;
  const todayEarnings = stats?.todayEarnings ?? 0;
  const onlineNow = stats?.onlineNow ?? 0;
  const activeMatches = stats?.activeMatches ?? 0;
  const totalRegistered = stats?.totalRegistered ?? 0;
  const pendingCount = stats?.pendingWithdrawalsCount ?? 0;
  const todayTx = stats?.todayTransactions ?? 0;
  const gameCounts = stats?.gameCounts ?? {};

  const GAMES = [
    { key: "damas",  label: "Damas",         color: "#0ea5e9" },
    { key: "ludo",   label: "Ludo",          color: "#10b981" },
    { key: "xadrez", label: "Xadrez",        color: V1 },
    { key: "roleta", label: "Roleta da Sorte", color: V4 },
  ];

  const totalGames = GAMES.reduce((s, g) => s + (gameCounts[g.key] ?? 0), 0);

  const Skeleton = () => <div className="h-6 w-24 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />;

  return (
    <div className="p-5 pb-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <LiveDot />
            <span className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>
              POKER WINNER · Actualizado {lastRefresh.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Actualizar
        </button>
      </div>

      {/* Top row: Saldo + Saídas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="gz-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(108,92,231,.1)" }}>
              <Wallet style={{ width: 15, height: 15, color: "#111", strokeWidth: 1.8 }} />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Saldo Disponível</span>
          </div>
          {statsLoading ? <Skeleton /> : (
            <div className="text-[26px] font-black leading-none" style={{ color: "var(--gz-text-primary)", letterSpacing: "-0.04em" }}>
              MT {fmt(platformBalance)}
            </div>
          )}
          <p className="text-[10.5px] mt-1" style={{ color: "var(--gz-text-muted)" }}>10% das apostas + taxas</p>
          <div className="flex items-center gap-1.5 mt-2">
            <ArrowUpRight style={{ width: 12, height: 12, color: V3 }} />
            <span className="text-[11px] font-semibold" style={{ color: V3 }}>+MT {fmt(todayEarnings)} hoje</span>
          </div>
        </div>

        <div className="gz-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)" }}>
              <ArrowDownLeft style={{ width: 15, height: 15, color: "#111", strokeWidth: 1.8 }} />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Saídas</span>
          </div>
          {statsLoading ? <Skeleton /> : (
            <div className="text-[26px] font-black leading-none" style={{ color: "var(--gz-text-primary)", letterSpacing: "-0.04em" }}>
              MT {fmt(todayWithdrawals)}
            </div>
          )}
          <p className="text-[10.5px] mt-1" style={{ color: "var(--gz-text-muted)" }}>Levantamentos aprovados hoje</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] font-semibold" style={{ color: V4 }}>{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Jogadores Online",  val: onlineNow,        color: V3,  icon: Users,    badge: <NeonBadge variant="live">LIVE</NeonBadge> },
          { label: "Apostas Activas",   val: activeMatches,    color: V1,  icon: Gamepad2, badge: <NeonBadge variant="purple">EM JOGO</NeonBadge> },
          { label: "Saques Pendentes",  val: pendingCount,     color: V4,  icon: Landmark, badge: null },
          { label: "Utilizadores Reg.", val: totalRegistered,  color: V2,  icon: Users,    badge: null },
        ].map(s => (
          <div key={s.label} className="gz-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + "15" }}>
                <s.icon style={{ width: 13, height: 13, color: "#111", strokeWidth: 1.9 }} />
              </div>
              {s.badge}
            </div>
            {statsLoading
              ? <div className="h-7 w-16 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
              : <div className="text-[24px] font-black leading-none" style={{ color: "var(--gz-text-primary)", letterSpacing: "-0.04em" }}>{s.val}</div>
            }
            <div className="text-[10.5px] font-semibold mt-1" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Chart — spans 2 columns */}
        <div className="gz-card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-black" style={{ color: "var(--gz-text-primary)" }}>Estatística de Receita</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>Ganhos da plataforma nos últimos 30 dias</div>
            </div>
            <NeonBadge variant="live">REALTIME</NeonBadge>
          </div>
          {chartLoading ? (
            <div className="h-56 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V1} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={V1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,92,231,.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--gz-text-muted)" }}
                  tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "var(--gz-text-muted)" }} tickFormatter={v => `MT ${fmt(v)}`} width={55} />
                <Tooltip
                  contentStyle={{ background: "var(--gz-card-bg)", border: "1px solid rgba(108,92,231,.12)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [`MT ${v.toFixed(2)}`, "Receita"]}
                  labelFormatter={l => `Data: ${l}`} />
                <Area type="monotone" dataKey="valor" stroke={V1} strokeWidth={2} fill="url(#chartGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Today summary */}
          <div className="gz-card p-4">
            <div className="text-[12px] font-bold mb-3" style={{ color: "var(--gz-text-primary)" }}>Hoje</div>
            {[
              { label: "Ganho",        val: `MT ${fmt(todayEarnings)}`,  color: V3 },
              { label: "Transacções",  val: todayTx,                     color: V1 },
              { label: "Online",       val: onlineNow,                   color: V3 },
              { label: "Saídas",       val: `MT ${fmt(todayWithdrawals)}`, color: "#ef4444" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "rgba(108,92,231,.06)" }}>
                <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{r.label}</span>
                {statsLoading
                  ? <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
                  : <span className="text-[12px] font-bold" style={{ color: r.color }}>{r.val}</span>
                }
              </div>
            ))}
          </div>

          {/* Game counts */}
          <div className="gz-card p-4">
            <div className="text-[12px] font-bold mb-3" style={{ color: "var(--gz-text-primary)" }}>Partidas por Jogo</div>
            {GAMES.map(g => {
              const count = gameCounts[g.key] ?? 0;
              const pct = totalGames > 0 ? (count / totalGames) * 100 : 0;
              return (
                <div key={g.key} className="mb-3 last:mb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-secondary)" }}>{g.label}</span>
                    {statsLoading
                      ? <div className="h-3 w-8 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
                      : <span className="text-[11px] font-bold" style={{ color: g.color }}>{count}</span>
                    }
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gz-bg-subtle)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t mt-2 flex justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
              <span className="text-[10.5px]" style={{ color: "var(--gz-text-muted)" }}>Total</span>
              <span className="text-[12px] font-black" style={{ color: "var(--gz-text-primary)" }}>{totalGames}</span>
            </div>
          </div>

          {/* Pending actions */}
          <div className="gz-card p-4">
            <div className="text-[12px] font-bold mb-3" style={{ color: "var(--gz-text-primary)" }}>Acções Pendentes</div>
            {statsLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-8 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)" }}>
                    <Landmark style={{ width: 13, height: 13, color: V4, flexShrink: 0 }} />
                    <span className="text-[11px]" style={{ color: V4 }}>{pendingCount} saque{pendingCount !== 1 ? "s" : ""} para aprovar</span>
                  </div>
                )}
                {activeMatches > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "rgba(108,92,231,.08)", border: "1px solid rgba(108,92,231,.2)" }}>
                    <Activity style={{ width: 13, height: 13, color: V1, flexShrink: 0 }} />
                    <span className="text-[11px]" style={{ color: V1 }}>{activeMatches} partida{activeMatches !== 1 ? "s" : ""} em curso</span>
                  </div>
                )}
                {pendingCount === 0 && activeMatches === 0 && (
                  <p className="text-[11px] text-center py-2" style={{ color: "var(--gz-text-muted)" }}>Nenhuma acção pendente ✓</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent matches */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex items-center gap-2">
            <Gamepad2 style={{ width: 16, height: 16, color: V1 }} />
            <span className="text-[14px] font-black" style={{ color: "var(--gz-text-primary)" }}>Partidas Recentes</span>
          </div>
          <LiveDot />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Jogo", "Jogadores", "Aposta", "Status", "Data"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-4 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : recentMatches.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhuma partida registada ainda</td></tr>
              ) : recentMatches.map((m: AdminMatch) => (
                <tr key={m.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                  <td className="px-5 py-3"><GameTypeBadge type={m.game_type} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar seed={m.player1_name ?? "P1"} size={24} />
                      <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-primary)" }}>
                        {m.player1_name ?? "—"} vs {m.player2_name ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-bold" style={{ color: V1 }}>MT {Number(m.bet_amount).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-green-100 text-green-700" : m.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>
                      {m.status === "active" ? "● Em Jogo" : m.status === "completed" ? "Concluída" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                    {new Date(m.created_at).toLocaleDateString("pt-PT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
