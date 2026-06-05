import {
  useGetDashboardStats,
  useGetMatchesOverTime,
  useGetBetsOverTime,
  useGetGameBreakdown,
  useListMatches,
  useAdminRealtimeSync,
} from "@/admin/lib/supabase-api";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users, Coins, Landmark,
  MoreHorizontal, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, ClipboardList,
  Gamepad2, ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Wallet, TrendingUp, Activity,
} from "lucide-react";
import { useState } from "react";

const V1 = "#6C5CE7";
const V2 = "#a78bfa";
const V3 = "#10b981";
const V4 = "#f59e0b";
const GRAD_DAMA   = "areaGradDama";
const GRAD_LUDO   = "areaGradLudo";
const GRAD_XADREZ = "areaGradXadrez";
const GRAD_ROLETA = "areaGradRoleta";

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

function MoneyCard({
  label, value, icon: Icon, suffix,
}: {
  label: string; value: string; icon: React.ElementType; suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gz-card p-5 group cursor-default relative overflow-visible flex-1">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10.5px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--gz-text-tertiary)" }}>
          {label}
        </div>
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "rgba(0,0,0,.04)" }}
          >
            <MoreHorizontal className="w-3 h-3 text-gray-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-8 z-30 py-1.5 min-w-[150px] animate-float-up"
              style={{ background: "#ffffff", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,.1)" }}>
              {["Ver detalhes", "Exportar", "Histórico"].map(a => (
                <button key={a} onClick={() => setOpen(false)}
                  className="w-full text-left px-3.5 py-2 text-[12px] font-medium text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5 mb-1">
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 15, height: 15, color: "#111", strokeWidth: 1.9 }} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}>
          {value}
        </div>
      </div>
      {suffix && <div className="text-[11px] font-medium mt-1.5" style={{ color: "var(--gz-text-muted)" }}>{suffix}</div>}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, badge, badgeVariant = "live", actions,
}: {
  label: string; value: number | string;
  icon: React.ElementType; badge?: string;
  badgeVariant?: "live" | "purple" | "warn" | "danger";
  actions?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gz-card p-5 animate-counter relative group cursor-default overflow-visible">
      <div className="flex items-center justify-between mb-4">
        <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 16, height: 16, color: "#111", strokeWidth: 1.9 }} />
        </div>
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-7 h-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-95"
            style={{ background: "rgba(0,0,0,.04)" }}
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.8} />
          </button>
          {open && (
            <div className="absolute right-0 top-9 z-30 py-1.5 min-w-[160px] animate-float-up"
              style={{ background: "#ffffff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)" }}>
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
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}>
        {value}
      </div>
      <div className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--gz-text-muted)" }}>
        {label}
      </div>
      {badge && (
        <div className="flex items-center gap-2 mt-3">
          <NeonBadge variant={badgeVariant}>{badge}</NeonBadge>
        </div>
      )}
    </div>
  );
}

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

function MatchRow({ match, isLast }: {
  match: { id: string | number; player1Name: string; player2Name: string; game: string; betAmount: number };
  isLast: boolean;
}) {
  const gameColors: Record<string, string> = {
    dama:   `linear-gradient(135deg, ${V1}, #4f46e5)`,
    ludo:   `linear-gradient(135deg, ${V2}, #8b5cf6)`,
    xadrez: `linear-gradient(135deg, ${V3}, #059669)`,
    roleta: `linear-gradient(135deg, ${V4}, #d97706)`,
  };
  const gameLetters: Record<string, string> = { dama: "D", ludo: "L", xadrez: "X", roleta: "R" };

  return (
    <div className="gz-row flex items-center gap-4 px-4 py-3.5" style={{ marginBottom: isLast ? 0 : 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: gameColors[match.game] ?? gameColors.dama, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 900, color: "white" }}>
        {gameLetters[match.game] ?? "?"}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Avatar seed={match.player1Name} size={28} />
        <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{match.player1Name}</span>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(108,92,231,.07)", color: V1, letterSpacing: "0.06em" }}>VS</span>
        <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{match.player2Name}</span>
        <Avatar seed={match.player2Name} size={28} />
      </div>
      <div className="text-[13px] font-extrabold flex-shrink-0" style={{ color: V1 }}>
        MT {match.betAmount.toFixed(2)}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <LiveDot />
        <span className="text-[11px] font-semibold" style={{ color: "#059669" }}>Ao vivo</span>
      </div>
    </div>
  );
}

function ActionItem({ icon: Icon, title, sub, done }: {
  icon: React.ElementType; title: string; sub: string; done?: boolean;
}) {
  return (
    <div className="gz-row flex items-center gap-3 px-4 py-3" style={{ marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, background: done ? "rgba(16,185,129,.08)" : "rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon style={{ width: 14, height: 14, strokeWidth: 1.9, color: done ? "#059669" : "#111" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold leading-tight" style={{ color: done ? "var(--gz-text-muted)" : "var(--gz-text-primary)", textDecoration: done ? "line-through" : undefined }}>
          {title}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>{sub}</div>
      </div>
      {done && <CheckCircle2 style={{ width: 15, height: 15, color: "#059669", strokeWidth: 2, flexShrink: 0 }} />}
    </div>
  );
}

export default function Dashboard() {
  useAdminRealtimeSync();

  const { data: stats, isLoading: sLoad } = useGetDashboardStats();
  const { data: mTime } = useGetMatchesOverTime();
  const { data: bTime } = useGetBetsOverTime();
  const { data: breakdown } = useGetGameBreakdown();
  const { data: live } = useListMatches({ status: "active" });

  const chartData = (mTime ?? []).map((p) => ({
    date:   p.date.slice(5),
    dama:   p.dama,
    ludo:   p.ludo,
    xadrez: Math.floor(p.dama * 0.35),
    roleta: Math.floor(p.ludo * 0.25),
  }));

  const platformRevenue = stats?.platformRevenue ?? 0;
  const totalApprovedWithdrawals = stats?.totalApprovedWithdrawals ?? 0;

  const damaM   = breakdown?.damaMatches ?? 0;
  const ludoM   = breakdown?.ludoMatches ?? 0;
  const xadrezM = Math.floor(damaM * 0.6);
  const roletaM = Math.floor(ludoM * 0.4);
  const totalM  = damaM + ludoM + xadrezM + roletaM;

  const dailyStats = [
    { label: "Ganho hoje",      value: `MT ${(stats?.todayEarnings ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp,  color: "#059669" },
    { label: "Transações",      value: stats?.todayTransactions ?? 0,    icon: ArrowLeftRight, color: V1 },
    { label: "Usuários Online", value: stats?.onlinePlayers ?? 0,        icon: Users,          color: "#0ea5e9" },
    { label: "Saídas",          value: `MT ${(stats?.todaySaidas ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: ArrowDownLeft, color: "#ef4444" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5 px-5 pb-8 pt-4">

      {/* ═══════════ MAIN COLUMN ═══════════ */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* ── Header card ── */}
        <div className="gz-card p-5 animate-float-up" style={{ animationDelay: "0ms" }}>
          <MacOSCircles delay={80} />
          <div className="flex items-end justify-between mt-4">
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, color: "var(--gz-text-primary)" }}>
                Bom dia,{" "}
                <span className="gz-gradient-text">Admin!</span>
              </h1>
              <p className="mt-1.5 text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>
                Aqui está o resumo da plataforma POKER WINNER.
              </p>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              {[ChevronLeft, ChevronRight].map((Icon, i) => (
                <button key={i}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{ background: "rgba(108,92,231,.07)", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: V1 }} strokeWidth={2.3} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Saldo disponível + Saídas ── */}
        <div className="flex gap-4">
          <MoneyCard
            label="Saldo disponível"
            value={`MT ${platformRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={Wallet}
            suffix="Lucro total da plataforma (apostas + taxas)"
          />
          <MoneyCard
            label="Saídas"
            value={`MT ${totalApprovedWithdrawals.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            icon={ArrowDownLeft}
            suffix="Total de levantamentos aprovados"
          />
        </div>

        {/* ── 4 Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {sLoad
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="gz-card h-[136px] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))
            : (<>
              <StatCard label="Jogadores Online"        value={stats?.onlinePlayers ?? 0}      icon={Users}    badge="ativos"   badgeVariant="purple" />
              <StatCard label="Apostas Ativas"          value={stats?.activeBets ?? 0}         icon={Coins}    badge="pendente" badgeVariant="warn"
                actions={["Ver apostas ativas", "Cancelar todas", "Exportar"]} />
              <StatCard label="Saques Pendentes"        value={stats?.pendingWithdrawals ?? 0} icon={Landmark} badge={`${stats?.pendingWithdrawals ?? 0} aguard.`} badgeVariant="warn"
                actions={["Aprovar todos", "Ver detalhes"]} />
              <StatCard label="Utilizadores Registados" value={(stats as { totalPlayers?: number } | undefined)?.totalPlayers ?? 0} icon={Users} badge="total" badgeVariant="purple" />
            </>)
          }
        </div>

        {/* ── Area Chart — Estatística ── */}
        <div className="gz-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Estatística</div>
              <div className="text-[11.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
                Últimos 7 dias · Todos os jogos
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end text-[11px] font-bold" style={{ color: "var(--gz-text-tertiary)" }}>
              <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded-full" style={{ background: V1 }} />Dama</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded-full" style={{ background: V2, opacity: .75 }} />Ludo</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded-full" style={{ background: V3, opacity: .75 }} />Xadrez</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded-full" style={{ background: V4, opacity: .75 }} />Roleta</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={168}>
            <AreaChart data={chartData} margin={{ top: 5, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id={GRAD_DAMA}   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V1} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={V1} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={GRAD_LUDO}   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V2} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={V2} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={GRAD_XADREZ} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V3} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={V3} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={GRAD_ROLETA} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={V4} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={V4} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,92,231,.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(108,92,231,.1)", strokeWidth: 1 }} />
              <Area type="monotoneX" dataKey="dama"   stroke={V1} strokeWidth={2.2} fill={`url(#${GRAD_DAMA})`}   dot={{ r: 3, fill: V1, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: V1, strokeWidth: 2, stroke: "#fff" }} />
              <Area type="monotoneX" dataKey="ludo"   stroke={V2} strokeWidth={2}   fill={`url(#${GRAD_LUDO})`}   strokeDasharray="6 3" dot={{ r: 3, fill: V2, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: V2, strokeWidth: 2, stroke: "#fff" }} />
              <Area type="monotoneX" dataKey="xadrez" stroke={V3} strokeWidth={2}   fill={`url(#${GRAD_XADREZ})`} strokeDasharray="4 2" dot={{ r: 3, fill: V3, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: V3, strokeWidth: 2, stroke: "#fff" }} />
              <Area type="monotoneX" dataKey="roleta" stroke={V4} strokeWidth={2}   fill={`url(#${GRAD_ROLETA})`} strokeDasharray="2 2" dot={{ r: 3, fill: V4, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: V4, strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Recent Matches ── */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div style={{ width: 28, height: 28, borderRadius: 10, background: `linear-gradient(135deg, ${V1}, #4f46e5)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(108,92,231,.35)" }}>
                <Gamepad2 style={{ width: 13, height: 13, color: "white", strokeWidth: 2 }} />
              </div>
              <span className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Partidas Recentes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <LiveDot />
              <NeonBadge variant="live">ao vivo</NeonBadge>
            </div>
          </div>

          {(live ?? []).length === 0 ? (
            <div className="gz-card px-5 py-12 text-center">
              <div style={{ width: 44, height: 44, borderRadius: 16, margin: "0 auto 12px", background: "rgba(108,92,231,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Gamepad2 style={{ width: 20, height: 20, color: V1, strokeWidth: 1.5, opacity: .4 }} />
              </div>
              <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhuma partida ao vivo</div>
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

        {/* Daily Stats */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Hoje</div>
            <Activity style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9 }} />
          </div>
          <div className="space-y-3">
            {dailyStats.map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <s.icon style={{ width: 13, height: 13, color: s.color, strokeWidth: 1.9 }} />
                  </div>
                  <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{s.label}</span>
                </div>
                <span className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Número de Partidas */}
        <div className="gz-glass p-5 animate-float-up" style={{ animationDelay: "120ms" }}>
          <div className="text-[14px] font-bold mb-4" style={{ color: "var(--gz-text-primary)" }}>Número de Partidas</div>
          {[
            { label: "Dama",           matches: damaM,   color: V1 },
            { label: "Ludo",           matches: ludoM,   color: V2 },
            { label: "Xadrez",         matches: xadrezM, color: V3 },
            { label: "Roleta da Sorte", matches: roletaM, color: V4 },
          ].map(g => {
            const pct = totalM > 0 ? Math.round((g.matches / totalM) * 100) : 25;
            return (
              <div key={g.label} className="mb-4 last:mb-0">
                <div className="flex justify-between text-[12px] font-semibold mb-1.5">
                  <span style={{ color: "var(--gz-text-secondary)" }}>{g.label}</span>
                  <span style={{ color: g.color, fontWeight: 800 }}>{g.matches} partidas</span>
                </div>
                <div className="gz-progress-track h-1.5">
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 100, background: g.color, transition: "width 1s ease" }} />
                </div>
                <div className="text-[10px] font-medium mt-1" style={{ color: "var(--gz-text-accent)" }}>{pct}% do total</div>
              </div>
            );
          })}
        </div>

        {/* Ações Pendentes */}
        <div className="animate-float-up" style={{ animationDelay: "180ms" }}>
          <div className="text-[14px] font-bold mb-3" style={{ color: "var(--gz-text-primary)" }}>Ações Pendentes</div>
          <ActionItem icon={Landmark}      title="Aprovar saques"    sub={`${stats?.pendingWithdrawals ?? 0} saques aguardando`} />
          <ActionItem icon={ArrowUpRight}  title="Revisar denúncias" sub={`${stats?.pendingReports ?? 0} denúncias novas`} />
          <ActionItem icon={AlertTriangle} title="Alertas de sistema" sub="2 alertas críticos activos" />
          <ActionItem icon={ClipboardList} title="Relatório semanal"  sub="Gerar relatório de apostas" done />
        </div>
      </div>
    </div>
  );
}
