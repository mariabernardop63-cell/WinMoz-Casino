import {
  useGetDashboardStats,
  useGetMatchesOverTime,
  useGetBetsOverTime,
  useGetGameBreakdown,
  useListMatches,
} from "@workspace/api-client-react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Zap, Users, Coins, Landmark, TrendingUp, Flag,
  MoreHorizontal, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, ClipboardList,
  Gamepad2, Trophy, ArrowUpRight,
  Clock,
} from "lucide-react";
import { useState } from "react";

/* ── Design tokens ── */
const V1 = "#6C5CE7";
const V2 = "#a78bfa";
const GRAD_DAMA = "areaGradDama";
const GRAD_LUDO = "areaGradLudo";

/* ─────────────────────────────────────
   ATOMS
───────────────────────────────────── */
function LiveDot() {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0">
      <span className="animate-pulse-ring absolute inset-0 rounded-full"
        style={{ background: "rgba(16,185,129,.3)" }} />
      <span className="animate-pulse-dot relative w-2 h-2 rounded-full"
        style={{ background: "#10b981" }} />
    </span>
  );
}

function NeonBadge({
  children, variant = "live",
}: {
  children: React.ReactNode;
  variant?: "live" | "purple" | "warn" | "danger";
}) {
  const cls = { live: "neon-live", purple: "neon-purple-badge", warn: "neon-warning", danger: "neon-danger" }[variant];
  return <span className={`neon-badge ${cls}`}>{children}</span>;
}

function Avatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b", "ec4899"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return (
    <img
      src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`}
      alt={seed}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "white",
        border: "1.5px solid rgba(108,92,231,.14)",
      }}
    />
  );
}

/* ─────────────────────────────────────
   MacOS circles
───────────────────────────────────── */
function MacOSCircles({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[
        { color: "#FF5F56", title: "Fechar" },
        { color: "#FFBD2E", title: "Minimizar" },
        { color: "#27C93F", title: "Maximizar" },
      ].map((d, i) => (
        <div
          key={i}
          className="gz-macos-circle"
          title={d.title}
          style={{
            background: d.color,
            boxShadow: `0 1px 3px ${d.color}66`,
            animationDelay: `${delay + i * 70}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────
   STAT CARD — Dappr style
───────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, badge, badgeVariant = "live", actions, trend,
}: {
  label: string; value: number | string;
  icon: React.ElementType; badge?: string;
  badgeVariant?: "live" | "purple" | "warn" | "danger";
  actions?: string[]; trend?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gz-card p-5 animate-counter relative group cursor-default overflow-visible">
      <div className="flex items-center justify-between mb-4">
        {/* Icon */}
        <div
          style={{
            width: 38, height: 38, borderRadius: 13,
            background: "rgba(108,92,231,.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon style={{ width: 16, height: 16, color: V1, strokeWidth: 1.9 }} />
        </div>
        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-7 h-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-95"
            style={{ background: "rgba(108,92,231,.06)" }}
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.8} />
          </button>
          {open && (
            <div
              className="absolute right-0 top-9 z-30 py-1.5 min-w-[160px] animate-float-up"
              style={{
                background: "#ffffff",
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)",
              }}
            >
              {(actions ?? ["Ver detalhes", "Ver histórico", "Exportar"]).map(a => (
                <button key={a} onClick={() => setOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-[12.5px] font-medium text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors first:rounded-t-xl last:rounded-b-xl">
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div
        style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}
      >
        {value}
      </div>
      <div className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--gz-text-muted)" }}>
        {label}
      </div>

      {(badge || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-3">
          {badge && <NeonBadge variant={badgeVariant}>{badge}</NeonBadge>}
          {trend !== undefined && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold"
              style={{ color: trend >= 0 ? "#059669" : "#dc2626" }}>
              <ArrowUpRight style={{ width: 11, height: 11, strokeWidth: 2.5,
                transform: trend < 0 ? "rotate(90deg)" : undefined }} />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   CHART TOOLTIP
───────────────────────────────────── */
function ChartTip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="animate-float-up"
      style={{
        background: "#ffffff",
        borderRadius: 14,
        padding: "10px 14px",
        boxShadow: "0 8px 28px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)",
      }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: V1 }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--gz-text-muted)" }} className="capitalize">{p.name}</span>
          <span className="font-bold ml-4" style={{ color: "var(--gz-text-primary)" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────
   DAPPR LIST ROW — like "Recent emails"
───────────────────────────────────── */
function MatchRow({ match, isLast }: {
  match: { id: number; player1Name: string; player2Name: string; game: string; betAmount: number };
  isLast: boolean;
}) {
  return (
    <div
      className="gz-row flex items-center gap-4 px-4 py-3.5"
      style={{ marginBottom: isLast ? 0 : 8 }}
    >
      {/* Game pill */}
      <div
        style={{
          width: 36, height: 36, borderRadius: 12,
          background: match.game === "dama"
            ? `linear-gradient(135deg, ${V1}, #4f46e5)`
            : `linear-gradient(135deg, ${V2}, #8b5cf6)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 4px 12px ${match.game === "dama" ? "rgba(108,92,231,.3)" : "rgba(167,139,250,.3)"}`,
          fontSize: 11, fontWeight: 900, color: "white",
        }}
      >
        {match.game === "dama" ? "D" : "L"}
      </div>

      {/* Players */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Avatar seed={match.player1Name} size={28} />
        <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>
          {match.player1Name}
        </span>
        <span
          className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: "rgba(108,92,231,.07)",
            color: V1,
            letterSpacing: "0.06em",
          }}
        >
          VS
        </span>
        <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>
          {match.player2Name}
        </span>
        <Avatar seed={match.player2Name} size={28} />
      </div>

      {/* Bet */}
      <div className="text-[13px] font-extrabold flex-shrink-0" style={{ color: V1 }}>
        R$ {match.betAmount.toFixed(2)}
      </div>

      {/* Live */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <LiveDot />
        <span className="text-[11px] font-semibold" style={{ color: "#059669" }}>Ao vivo</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   ACTION ITEM — Dappr to-do style
───────────────────────────────────── */
function ActionItem({ icon: Icon, title, sub, done }: {
  icon: React.ElementType; title: string; sub: string; done?: boolean;
}) {
  return (
    <div
      className="gz-row flex items-center gap-3 px-4 py-3"
      style={{ marginBottom: 8 }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 11,
          background: done ? "rgba(16,185,129,.08)" : "rgba(108,92,231,.07)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 14, height: 14, strokeWidth: 1.9, color: done ? "#059669" : V1 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] font-semibold leading-tight"
          style={{ color: done ? "var(--gz-text-muted)" : "var(--gz-text-primary)", textDecoration: done ? "line-through" : undefined }}
        >
          {title}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>{sub}</div>
      </div>
      {done && <CheckCircle2 style={{ width: 15, height: 15, color: "#059669", strokeWidth: 2, flexShrink: 0 }} />}
    </div>
  );
}

/* ─────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────── */
export default function Dashboard() {
  const { data: stats, isLoading: sLoad } = useGetDashboardStats();
  const { data: mTime } = useGetMatchesOverTime();
  const { data: bTime } = useGetBetsOverTime();
  const { data: breakdown } = useGetGameBreakdown();
  const { data: live } = useListMatches({ status: "live" });

  const chartData = (mTime ?? []).map((p, i) => ({
    date: p.date.slice(5),
    dama: p.dama,
    ludo: p.ludo,
    betDama: bTime?.[i]?.dama ?? 0,
    betLudo: bTime?.[i]?.ludo ?? 0,
  }));

  return (
    <div className="flex flex-col lg:flex-row gap-5 px-5 pb-8 pt-4">

      {/* ═══════════ MAIN COLUMN ═══════════ */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* ── Header card (Dappr window chrome style) ── */}
        <div
          className="gz-card p-5 animate-float-up"
          style={{ animationDelay: "0ms" }}
        >
          <MacOSCircles delay={80} />
          <div className="flex items-end justify-between mt-4">
            <div>
              <h1 style={{
                fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em",
                lineHeight: 1.1, color: "var(--gz-text-primary)",
              }}>
                Bom dia,{" "}
                <span className="gz-gradient-text">Admin!</span>
              </h1>
              <p className="mt-1.5 text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>
                Aqui está o resumo da plataforma GameZone
              </p>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              {[ChevronLeft, ChevronRight].map((Icon, i) => (
                <button key={i}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{
                    background: "rgba(108,92,231,.07)",
                    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                  }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: V1 }} strokeWidth={2.3} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 6 Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {sLoad
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gz-card h-[136px] animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }} />
            ))
            : (<>
              <StatCard label="Partidas ao Vivo"        value={stats?.liveMatches ?? 0}        icon={Zap}       badge="ao vivo"  badgeVariant="live"   trend={12} />
              <StatCard label="Jogadores Online"        value={stats?.onlinePlayers ?? 0}      icon={Users}     badge="ativos"   badgeVariant="purple" trend={8}  />
              <StatCard label="Apostas Ativas"          value={stats?.activeBets ?? 0}         icon={Coins}     badge="pendente" badgeVariant="warn"
                actions={["Ver apostas ativas", "Cancelar todas", "Exportar"]} />
              <StatCard label="Saques Pendentes"        value={stats?.pendingWithdrawals ?? 0} icon={Landmark}  badge={`${stats?.pendingWithdrawals ?? 0} aguard.`} badgeVariant="warn"
                actions={["Aprovar todos", "Ver detalhes"]} />
              <StatCard label="Utilizadores Registados" value={(stats as { totalPlayers?: number } | undefined)?.totalPlayers ?? 0} icon={Users}     badge="total"    badgeVariant="purple" trend={((stats as { registeredToday?: number } | undefined)?.registeredToday ?? 0) > 0 ? 5 : undefined} />
              <StatCard label="Receita da Plataforma"   value={`R$ ${((stats as { platformRevenue?: number } | undefined)?.platformRevenue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} badge="5% fee"  badgeVariant="live" trend={3} />
            </>)
          }
        </div>

        {/* ── Secondary metrics ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Volume */}
          <div className="gz-card p-5 group">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10.5px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--gz-text-tertiary)" }}>
                Volume de Apostas
              </div>
              <TrendingUp
                style={{ width: 15, height: 15, color: V1, strokeWidth: 1.8 }}
                className="opacity-25 group-hover:opacity-60 transition-opacity"
              />
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}>
              R$ {(stats?.totalBetVolume ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-3.5">
              <NeonBadge variant="live">+12.4%</NeonBadge>
              <span className="text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>vs semana anterior</span>
            </div>
          </div>

          {/* Reports */}
          <div className="gz-card p-5 group">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10.5px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--gz-text-tertiary)" }}>
                Denúncias Pendentes
              </div>
              <Flag
                style={{ width: 15, height: 15, color: "#ef4444", strokeWidth: 1.8 }}
                className="opacity-25 group-hover:opacity-60 transition-opacity"
              />
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}>
              {stats?.pendingReports ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-3.5">
              <NeonBadge variant="danger">urgente</NeonBadge>
              <span className="text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>aguardando revisão</span>
            </div>
          </div>
        </div>

        {/* ── Area Chart ── */}
        <div className="gz-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Partidas por dia</div>
              <div className="text-[11.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
                Últimos 7 dias · Dama vs Ludo
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold" style={{ color: "var(--gz-text-tertiary)" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 rounded-full" style={{ background: V1 }} />Dama
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 rounded-full" style={{ background: V2, opacity: .75 }} />Ludo
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={168}>
            <AreaChart data={chartData} margin={{ top: 5, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id={GRAD_DAMA} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V1} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={V1} stopOpacity={0}    />
                </linearGradient>
                <linearGradient id={GRAD_LUDO} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V2} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={V2} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,92,231,.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(108,92,231,.1)", strokeWidth: 1 }} />
              <Area type="monotoneX" dataKey="dama" stroke={V1} strokeWidth={2.2} fill={`url(#${GRAD_DAMA})`}
                dot={{ r: 3.5, fill: V1, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 5.5, fill: V1, strokeWidth: 2.5, stroke: "#fff" }} />
              <Area type="monotoneX" dataKey="ludo" stroke={V2} strokeWidth={2.2} fill={`url(#${GRAD_LUDO})`}
                strokeDasharray="6 3"
                dot={{ r: 3.5, fill: V2, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 5.5, fill: V2, strokeWidth: 2.5, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Recent Matches (Dappr list-card style) ── */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div style={{
                width: 28, height: 28, borderRadius: 10,
                background: `linear-gradient(135deg, ${V1}, #4f46e5)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 10px rgba(108,92,231,.35)",
              }}>
                <Gamepad2 style={{ width: 13, height: 13, color: "white", strokeWidth: 2 }} />
              </div>
              <span className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
                Partidas Recentes
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <LiveDot />
              <NeonBadge variant="live">ao vivo</NeonBadge>
            </div>
          </div>

          {(live ?? []).length === 0 ? (
            <div className="gz-card px-5 py-12 text-center">
              <div style={{
                width: 44, height: 44, borderRadius: 16, margin: "0 auto 12px",
                background: "rgba(108,92,231,.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Gamepad2 style={{ width: 20, height: 20, color: V1, strokeWidth: 1.5, opacity: .4 }} />
              </div>
              <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>
                Nenhuma partida ao vivo
              </div>
            </div>
          ) : (
            <div>
              {(live ?? []).map((m, i) => (
                <MatchRow key={m.id} match={m} isLast={i === (live ?? []).length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <div className="w-full lg:w-[248px] lg:flex-shrink-0 space-y-4">

        {/* Platform Status */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Status</div>
            <span className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,.5)" }} />
          </div>
          <div className="text-[11.5px] font-bold mb-5" style={{ color: "#059669" }}>
            ● Operacional
          </div>

          {/* Capacity */}
          <div className="mb-5">
            <div className="flex justify-between text-[11px] font-semibold mb-2">
              <span style={{ color: "var(--gz-text-muted)" }}>Capacidade</span>
              <span style={{ color: V1, fontWeight: 800 }}>82%</span>
            </div>
            <div className="gz-progress-track h-2">
              <div className="gz-progress-fill h-full" style={{ width: "82%" }} />
            </div>
          </div>

          {/* Services */}
          <div className="space-y-2.5 mb-5">
            {["API", "Database", "WebSocket"].map(s => (
              <div key={s} className="flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{s}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "#059669" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
                  Online
                </span>
              </div>
            ))}
          </div>

          <button
            className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${V1}, #4f46e5)`,
              boxShadow: "0 4px 14px rgba(108,92,231,.35)",
            }}
          >
            Ver diagnóstico
          </button>
        </div>

        {/* Game breakdown */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "120ms" }}>
          <div className="text-[14px] font-bold mb-4" style={{ color: "var(--gz-text-primary)" }}>Por Jogo</div>
          {breakdown ? [
            { label: "Dama", matches: breakdown.damaMatches, vol: breakdown.damaBetVolume, color: V1 },
            { label: "Ludo", matches: breakdown.ludoMatches, vol: breakdown.ludoBetVolume, color: V2 },
          ].map(g => {
            const tot = breakdown.damaMatches + breakdown.ludoMatches;
            const pct = tot > 0 ? Math.round((g.matches / tot) * 100) : 50;
            return (
              <div key={g.label} className="mb-5 last:mb-0">
                <div className="flex justify-between text-[12px] font-semibold mb-2">
                  <span style={{ color: "var(--gz-text-secondary)" }}>{g.label}</span>
                  <span style={{ color: g.color, fontWeight: 800 }}>{g.matches} partidas</span>
                </div>
                <div className="gz-progress-track h-2">
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 100,
                    background: g.color, transition: "width 1s ease",
                  }} />
                </div>
                <div className="text-[10.5px] font-medium mt-1.5" style={{ color: "var(--gz-text-accent)" }}>
                  R$ {g.vol.toFixed(2)} · {pct}%
                </div>
              </div>
            );
          }) : (
            <div className="space-y-4">
              <div className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(108,92,231,.05)" }} />
              <div className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(108,92,231,.05)" }} />
            </div>
          )}
        </div>

        {/* Pending actions — Dappr to-do style */}
        <div className="animate-float-up" style={{ animationDelay: "180ms" }}>
          <div className="text-[14px] font-bold mb-3" style={{ color: "var(--gz-text-primary)" }}>
            Ações Pendentes
          </div>
          <ActionItem icon={Landmark}      title="Aprovar saques"    sub={`${stats?.pendingWithdrawals ?? 0} saques aguardando`} />
          <ActionItem icon={Flag}          title="Revisar denúncias" sub={`${stats?.pendingReports ?? 0} denúncias novas`} />
          <ActionItem icon={AlertTriangle} title="Alertas de fraude" sub="2 alertas críticos ativos" />
          <ActionItem icon={ClipboardList} title="Relatório semanal" sub="Gerar relatório de apostas" done />
        </div>

        {/* Board meeting card — Dappr style */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-start gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: `linear-gradient(135deg, ${V1}, #4f46e5)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 14px rgba(108,92,231,.35)",
            }}>
              <Trophy style={{ width: 15, height: 15, color: "white", strokeWidth: 1.9 }} />
            </div>
            <div>
              <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
                Torneio de Dama
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: V1 }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
                  {new Date().toLocaleDateString("pt-BR")} às 20:00
                </span>
              </div>
              <div className="text-[11.5px] mt-2 leading-relaxed" style={{ color: "var(--gz-text-secondary)" }}>
                Premiação de{" "}
                <span className="font-bold" style={{ color: V1 }}>R$ 5.000</span>.
                Inscrições abertas.
              </div>
              <div className="mt-2.5">
                <NeonBadge variant="purple">inscrições abertas</NeonBadge>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated processing card */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "300ms" }}>
          <div className="text-[13.5px] font-bold mb-0.5" style={{ color: "var(--gz-text-primary)" }}>
            Processamento
          </div>
          <div className="text-[11.5px] font-medium mb-4" style={{ color: "var(--gz-text-muted)" }}>
            Em andamento
          </div>
          <div className="gz-progress-track h-2.5 mb-4">
            <div className="gz-progress-fill h-full" style={{ width: "68%" }} />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
            <Clock style={{ width: 12, height: 12, strokeWidth: 2 }} />
            Estimativa: 4–5 dias úteis
          </div>
        </div>
      </div>
    </div>
  );
}
