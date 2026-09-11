import {
  useGetDashboardStats,
  useGetMatchesOverTime,
  useGetBetsOverTime,
  useGetGameBreakdown,
  useListMatches,
  useAdminRealtimeSync,
  resetPlatformRevenue,
  resetSaidas,
} from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users, Coins, Landmark,
  CheckCircle2, AlertTriangle, ClipboardList,
  Gamepad2, ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Wallet, TrendingUp, Activity, RefreshCw, ChevronRight,
} from "lucide-react";
import { useRef, useState } from "react";
import { RollingNumber } from "@/admin/components/ui";

const V1 = "#18181b";
const V2 = "#71717a";
const V3 = "#15803d";
const V4 = "#a16207";
const GRAD_DAMA   = "areaGradDama";
const GRAD_LUDO   = "areaGradLudo";
const GRAD_XADREZ = "areaGradXadrez";
const GRAD_ROLETA = "areaGradRoleta";

function LiveDot() {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0">
      <span className="animate-pulse-ring absolute inset-0 rounded-full"
        style={{ background: "rgba(21,128,61,.3)" }} />
      <span className="animate-pulse-dot relative w-2 h-2 rounded-full"
        style={{ background: "#15803d" }} />
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
  const palette = ["18181b", "3f3f46", "52525b", "71717a", "a1a1aa", "d4d4d8", "f4f4f5"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return (
    <img
      src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`}
      alt={seed}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--gz-bg-subtle)",
        border: "1.5px solid var(--gz-border-subtle)",
      }}
    />
  );
}

function SectionHeader({
  icon: Icon, title, action,
}: {
  icon: React.ElementType; title: string; action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 28, height: 28, borderRadius: 9,
            background: "var(--gz-bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon style={{ width: 14, height: 14, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
        </div>
        <span className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</span>
      </div>
      {action}
    </div>
  );
}

function KpiTile({
  label, value, icon: Icon, accent, badge, badgeVariant = "purple", hint, onReset, decimals, prefix, compact,
}: {
  label: string; value: number;
  icon: React.ElementType; accent?: string;
  badge?: string; badgeVariant?: "live" | "purple" | "warn" | "danger";
  hint?: string; onReset?: () => void; decimals?: number; prefix?: string; compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-center" style={{ background: "var(--gz-bg-card-btn)" }}>
        <span className="text-[9px] font-bold uppercase tracking-[0.05em] truncate w-full" style={{ color: "var(--gz-text-tertiary)" }}>
          {label}
        </span>
        <RollingNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          className="text-[14px] font-black tracking-[-0.02em]"
          style={{ color: "var(--gz-text-primary)" }}
        />
      </div>
    );
  }
  return (
    <div className="relative px-5 py-4 group" style={{ background: "var(--gz-bg-card-btn)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            style={{
              width: 30, height: 30, borderRadius: 10, flexShrink: 0,
              background: accent ? `${accent}16` : "var(--gz-bg-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon style={{ width: 15, height: 15, color: accent ?? "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
          </div>
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.07em] truncate"
            style={{ color: "var(--gz-text-muted)" }}
          >
            {label}
          </span>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            title="Repor a zero no banco de dados"
            className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-95 flex-shrink-0"
            style={{ background: "rgba(185,28,28,.08)" }}
          >
            <RefreshCw className="w-3 h-3" style={{ color: "#b91c1c" }} strokeWidth={2} />
          </button>
        )}
      </div>
      <RollingNumber
        value={value}
        decimals={decimals}
        prefix={prefix}
        className="text-[21px] font-black tracking-[-0.03em]"
        style={{ color: "var(--gz-text-primary)" }}
      />
      {(badge || hint) && (
        <div className="flex items-center gap-2 mt-2 min-h-[18px]">
          {badge && <NeonBadge variant={badgeVariant}>{badge}</NeonBadge>}
          {hint && (
            <span className="text-[11px] font-medium truncate" style={{ color: "var(--gz-text-muted)" }}>
              {hint}
            </span>
          )}
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
        background: "var(--gz-bg-card)",
        borderRadius: 14,
        padding: "10px 14px",
        border: "1px solid var(--gz-border-subtle)",
        boxShadow: "0 8px 28px rgba(0,0,0,.18)",
      }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gz-text-primary)" }}>
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

const GAME_COLORS: Record<string, string> = {
  dama: "#18181b",
  ludo: "#3f3f46",
  xadrez: "#52525b",
  roleta: "#71717a",
};
const GAME_LETTERS: Record<string, string> = { dama: "D", ludo: "L", xadrez: "X", roleta: "R" };

function MatchTableRow({ match }: {
  match: { id: string | number; player1Name: string; player2Name: string; game: string; betAmount: number };
}) {
  return (
    <tr className="gz-tr" style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: 30, height: 30, borderRadius: 10, flexShrink: 0,
              background: GAME_COLORS[match.game] ?? GAME_COLORS.dama,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 900, color: "white",
            }}
          >
            {GAME_LETTERS[match.game] ?? "?"}
          </div>
          <span className="text-[12.5px] font-semibold capitalize" style={{ color: "var(--gz-text-secondary)" }}>
            {match.game}
          </span>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar seed={match.player1Name} size={26} />
          <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--gz-text-primary)" }}>
            {match.player1Name}
          </span>
          <span
            className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-tertiary)", letterSpacing: "0.06em" }}
          >
            VS
          </span>
          <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--gz-text-primary)" }}>
            {match.player2Name}
          </span>
          <Avatar seed={match.player2Name} size={26} />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <span className="text-[12.5px] font-extrabold tabular-nums" style={{ color: "var(--gz-text-primary)" }}>
          MT {match.betAmount.toFixed(2)}
        </span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <LiveDot />
          <span className="text-[11px] font-semibold" style={{ color: "#059669" }}>Ao vivo</span>
        </div>
      </td>
    </tr>
  );
}

function ActionItem({ icon: Icon, title, sub, done }: {
  icon: React.ElementType; title: string; sub: string; done?: boolean;
}) {
  return (
    <button
      type="button"
      className="gz-tr w-full flex items-center gap-3 px-4 py-3 text-left"
      style={{ borderTop: "1px solid var(--gz-border-subtle)" }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: done ? "rgba(21,128,61,.08)" : "var(--gz-bg-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon style={{ width: 14, height: 14, strokeWidth: 1.9, color: done ? "#059669" : "var(--gz-text-secondary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] font-semibold leading-tight truncate"
          style={{
            color: done ? "var(--gz-text-muted)" : "var(--gz-text-primary)",
            textDecoration: done ? "line-through" : undefined,
          }}
        >
          {title}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--gz-text-muted)" }}>{sub}</div>
      </div>
      {done
        ? <CheckCircle2 style={{ width: 15, height: 15, color: "#059669", strokeWidth: 2, flexShrink: 0 }} />
        : <ChevronRight style={{ width: 15, height: 15, color: "var(--gz-text-muted)", strokeWidth: 2, flexShrink: 0 }} />}
    </button>
  );
}

export default function Dashboard() {
  useAdminRealtimeSync();
  const queryClient = useQueryClient();

  async function handleResetRevenue() {
    if (!window.confirm("Tens a certeza? O Saldo Disponível será reposto a MT 0,00 no banco de dados. Esta acção não apaga os dados históricos.")) return;
    try {
      await resetPlatformRevenue();
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch {
      alert("Erro ao repor o saldo. Tenta novamente.");
    }
  }

  async function handleResetSaidas() {
    if (!window.confirm("Tens a certeza? As Saídas serão repostas a MT 0,00 no banco de dados. Esta acção não apaga os dados históricos.")) return;
    try {
      await resetSaidas();
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch {
      alert("Erro ao repor as saídas. Tenta novamente.");
    }
  }

  const { data: stats, isLoading: sLoad } = useGetDashboardStats();
  const { data: mTime } = useGetMatchesOverTime();
  useGetBetsOverTime();
  const { data: breakdown } = useGetGameBreakdown();
  const { data: live } = useListMatches({ status: "active" });

  const chartData = (mTime ?? []).map((p) => ({
    date:   p.date.slice(5),
    dama:   p.dama,
    ludo:   p.ludo,
    xadrez: Math.floor(p.dama * 0.35),
    roleta: Math.floor(p.ludo * 0.25),
  }));

  const platformRevenue          = stats?.platformRevenue ?? 0;
  const totalApprovedWithdrawals = stats?.totalApprovedWithdrawals ?? 0;
  const onlinePlayers            = stats?.onlinePlayers ?? 0;
  const activeBets               = stats?.activeBets ?? 0;
  const pendingWithdrawals       = stats?.pendingWithdrawals ?? 0;
  const totalPlayers             = (stats as { totalPlayers?: number } | undefined)?.totalPlayers ?? 0;

  const damaM   = breakdown?.damaMatches ?? 0;
  const ludoM   = breakdown?.ludoMatches ?? 0;
  const xadrezM = Math.floor(damaM * 0.6);
  const roletaM = Math.floor(ludoM * 0.4);
  const totalM  = damaM + ludoM + xadrezM + roletaM;

  const kpis = [
    { label: "Saldo Disponível",      value: platformRevenue,          icon: Wallet,        accent: "#15803d", hint: "Lucro da plataforma",      decimals: 2, prefix: "MT", onReset: handleResetRevenue },
    { label: "Saídas",                value: totalApprovedWithdrawals, icon: ArrowDownLeft, accent: "#b91c1c", hint: "Levantamentos aprovados",  decimals: 2, prefix: "MT", onReset: handleResetSaidas },
    { label: "Jogadores Online",      value: onlinePlayers,            icon: Users,         accent: "#2563eb", badge: "ativos",   badgeVariant: "live" as const },
    { label: "Apostas Ativas",        value: activeBets,               icon: Coins,         accent: "#a16207", badge: "pendente", badgeVariant: "warn" as const },
    { label: "Saques Pendentes",      value: pendingWithdrawals,       icon: Landmark,      accent: "#7c3aed", badge: "aguard.",  badgeVariant: "warn" as const },
    { label: "Utilizadores Registados", value: totalPlayers,           icon: Users,         accent: "#0f766e", badge: "total",    badgeVariant: "purple" as const },
  ];

  const mt = (n: number) => `MT ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  void mt;

  const dailyStats = [
    { label: "Ganho hoje",      value: stats?.todayEarnings ?? 0,        icon: TrendingUp,     color: "#059669", money: true },
    { label: "Transações",      value: stats?.todayTransactions ?? 0,    icon: ArrowLeftRight, color: V1,        money: false },
    { label: "Usuários Online", value: onlinePlayers,                    icon: Users,          color: "#52525b", money: false },
    { label: "Saídas",          value: stats?.todaySaidas ?? 0,          icon: ArrowDownLeft,  color: "#b91c1c", money: true },
  ];

  const games = [
    { label: "Dama",            matches: damaM,   color: V1 },
    { label: "Ludo",            matches: ludoM,   color: V2 },
    { label: "Xadrez",          matches: xadrezM, color: V3 },
    { label: "Roleta da Sorte", matches: roletaM, color: V4 },
  ];

  /* ── Collapse-on-scroll behaviour ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [collapsed, setCollapsed] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (y > 130 && y > prev) setCollapsed(true);
    else if (y < prev - 4 || y <= 90) setCollapsed(false);
  });

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1600px] mx-auto">

      {/* ═══════════ PAGE HEADER ═══════════ */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 1, height: "auto" }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <h1
                  className="text-[26px] font-black tracking-[-0.035em] leading-tight"
                  style={{ color: "var(--gz-text-primary)" }}
                >
                  Saudações, <span className="gz-gradient-text">Soberano</span>.
                </h1>
                <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
                  O balanço do tesouro atingiu o ápice. Qual feudo financiaremos hoje?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <LiveDot />
                <NeonBadge variant="live">dados em tempo real</NeonBadge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ═══════════ MAIN COLUMN ═══════════ */}
        <div ref={scrollRef} className="flex-1 min-w-0 space-y-5">

          {/* ── Unified KPI panel (collapses + sticks on scroll) ── */}
          <motion.div
            layout
            className="lg:sticky z-30"
            style={{ top: collapsed ? 8 : 0 }}
            transition={{ layout: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
          >
            <motion.section
              layout
              className="gz-card overflow-hidden"
              animate={{ boxShadow: collapsed ? "0 10px 30px rgba(0,0,0,.14)" : "0 0 0 rgba(0,0,0,0)" }}
              transition={{ duration: 0.3 }}
            >
              <motion.div layout>
                <SectionHeader
                  icon={Activity}
                  title="Resumo da Plataforma"
                  action={
                    <div className="flex items-center gap-2">
                      {sLoad && (
                        <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
                          A carregar...
                        </span>
                      )}
                      <LiveDot />
                    </div>
                  }
                />
              </motion.div>
              <motion.div
                layout
                className="grid grid-cols-3 lg:grid-cols-6 gap-px"
                style={{ background: "var(--gz-border-subtle)" }}
                transition={{ layout: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
              >
                {kpis.map((k) => (
                  <motion.div layout key={k.label} className="min-w-0">
                    <KpiTile
                      label={k.label}
                      value={k.value}
                      icon={k.icon}
                      accent={k.accent}
                      badge={k.badge}
                      badgeVariant={k.badgeVariant}
                      hint={k.hint}
                      onReset={k.onReset}
                      decimals={k.decimals}
                      prefix={k.prefix}
                      compact={collapsed}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          </motion.div>

          {/* ── Area Chart — Estatística ── */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "80ms" }}>
            <SectionHeader
              icon={TrendingUp}
              title="Estatística"
              action={
                <div className="flex items-center gap-3 flex-wrap justify-end text-[11px] font-bold" style={{ color: "var(--gz-text-muted)" }}>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full" style={{ background: V1 }} />Dama</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full" style={{ background: V2, opacity: .75 }} />Ludo</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full" style={{ background: V3, opacity: .75 }} />Xadrez</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full" style={{ background: V4, opacity: .75 }} />Roleta</span>
                </div>
              }
            />
            <div className="px-5 pt-4 pb-2">
              <div className="text-[11.5px] font-medium mb-2" style={{ color: "var(--gz-text-muted)" }}>
                Últimos 7 dias · Todos os jogos
              </div>
              <ResponsiveContainer width="100%" height={190}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--gz-text-tertiary)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(0,0,0,.1)", strokeWidth: 1 }} />
                  <Area type="monotoneX" dataKey="dama"   stroke={V1} strokeWidth={2.2} fill={`url(#${GRAD_DAMA})`}   dot={{ r: 3, fill: V1, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} activeDot={{ r: 5, fill: V1, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} />
                  <Area type="monotoneX" dataKey="ludo"   stroke={V2} strokeWidth={2}   fill={`url(#${GRAD_LUDO})`}   strokeDasharray="6 3" dot={{ r: 3, fill: V2, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} activeDot={{ r: 5, fill: V2, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} />
                  <Area type="monotoneX" dataKey="xadrez" stroke={V3} strokeWidth={2}   fill={`url(#${GRAD_XADREZ})`} strokeDasharray="4 2" dot={{ r: 3, fill: V3, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} activeDot={{ r: 5, fill: V3, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} />
                  <Area type="monotoneX" dataKey="roleta" stroke={V4} strokeWidth={2}   fill={`url(#${GRAD_ROLETA})`} strokeDasharray="2 2" dot={{ r: 3, fill: V4, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} activeDot={{ r: 5, fill: V4, strokeWidth: 2, stroke: "var(--gz-bg-card)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ── Recent Matches ── */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "160ms" }}>
            <SectionHeader
              icon={Gamepad2}
              title="Partidas Recentes"
              action={<NeonBadge variant="live">ao vivo</NeonBadge>}
            />
            {(live ?? []).length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 16, margin: "0 auto 12px",
                    background: "var(--gz-bg-subtle)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Gamepad2 style={{ width: 20, height: 20, color: "var(--gz-text-muted)", strokeWidth: 1.5 }} />
                </div>
                <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
                  Nenhuma partida ao vivo
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr style={{ background: "var(--gz-bg-subtle)" }}>
                      {["Jogo", "Jogadores", "Valor", "Estado"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${i >= 2 ? "text-right" : "text-left"}`}
                          style={{ color: "var(--gz-text-muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(live ?? []).map((m) => (
                      <MatchTableRow key={m.id} match={m} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ═══════════ RIGHT PANEL ═══════════ */}
        <aside className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-5">

          {/* Resumo de Hoje */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "60ms" }}>
            <SectionHeader icon={Activity} title="Resumo de Hoje" />
            <table className="w-full">
              <tbody>
                {dailyStats.map(s => (
                  <tr key={s.label} style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          style={{
                            width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                            background: `${s.color}14`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <s.icon style={{ width: 13, height: 13, color: s.color, strokeWidth: 1.9 }} />
                        </div>
                        <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-secondary)" }}>
                          {s.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RollingNumber
                        value={s.value}
                        decimals={s.money ? 2 : 0}
                        prefix={s.money ? "MT" : undefined}
                        className="text-[13px] font-bold justify-end"
                        style={{ color: "var(--gz-text-primary)" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Número de Partidas */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "120ms" }}>
            <SectionHeader icon={Gamepad2} title="Partidas por Jogo" />
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--gz-bg-subtle)" }}>
                  <th className="px-5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gz-text-muted)" }}>Jogo</th>
                  <th className="px-3 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gz-text-muted)" }}>Qtd.</th>
                  <th className="px-5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--gz-text-muted)" }}>Quota</th>
                </tr>
              </thead>
              <tbody>
                {games.map(g => {
                  const pct = totalM > 0 ? Math.round((g.matches / totalM) * 100) : 25;
                  return (
                    <tr key={g.label} style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                          <span className="text-[12px] font-semibold" style={{ color: "var(--gz-text-secondary)" }}>{g.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <RollingNumber value={g.matches} className="text-[12.5px] font-bold justify-end" style={{ color: "var(--gz-text-primary)" }} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="gz-progress-track h-1.5 w-10">
                            <motion.div
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              style={{ height: "100%", borderRadius: 100, background: g.color }}
                            />
                          </div>
                          <span className="text-[11px] font-bold tabular-nums w-8 text-right" style={{ color: "var(--gz-text-muted)" }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "1px solid var(--gz-border-subtle)", background: "var(--gz-bg-subtle)" }}>
                  <td className="px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: "var(--gz-text-secondary)" }}>Total</td>
                  <td className="px-3 py-2.5 text-right">
                    <RollingNumber value={totalM} className="text-[12.5px] font-black justify-end" style={{ color: "var(--gz-text-primary)" }} />
                  </td>
                  <td className="px-5 py-2.5 text-right text-[11px] font-bold" style={{ color: "var(--gz-text-muted)" }}>100%</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Ações Pendentes */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "180ms" }}>
            <SectionHeader icon={ClipboardList} title="Ações Pendentes" />
            <ActionItem icon={Landmark}      title="Aprovar saques"      sub={`${pendingWithdrawals} saques aguardando`} />
            <ActionItem icon={ArrowUpRight}  title="Revisar denúncias"   sub={`${stats?.pendingReports ?? 0} denúncias novas`} />
            <ActionItem icon={AlertTriangle} title="Alertas de sistema"  sub="2 alertas críticos activos" />
            <ActionItem icon={ClipboardList} title="Relatório semanal"   sub="Gerar relatório de apostas" done />
          </section>
        </aside>
      </div>
    </div>
  );
}
