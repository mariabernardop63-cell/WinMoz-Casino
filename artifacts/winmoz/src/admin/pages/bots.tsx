import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSupabase, useAdminRealtimeSync } from "@/admin/lib/supabase-api";
import { adminReEnable } from "@/lib/botBrain";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, ResponsiveContainer,
  BarChart, Bar, Cell, Tooltip as RTooltip,
} from "recharts";
import {
  Bot, Power, PowerOff, Brain, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, ShieldOff, Edit3, Check, X,
  Target, Zap, Shield, BarChart3, ArrowUpRight, ArrowDownRight,
  Gamepad2, RefreshCw, Crown, Activity,
} from "lucide-react";

let _sessionBotOverride = false;

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  teal:   "#15803d",
  green:  "#18181b",
  red:    "#b91c1c",
  amber:  "#a16207",
  blue:   "#3f3f46",
  purple: "#71717a",
};

// ── Section header (consistent with dashboard) ────────────────────────────────
function SectionHeader({
  icon: Icon, title, subtitle, action,
}: {
  icon: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          background: "var(--gz-bg-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 14, height: 14, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold leading-tight" style={{ color: "var(--gz-text-primary)" }}>{title}</div>
          {subtitle && (
            <div className="text-[11px] font-medium mt-0.5 truncate" style={{ color: "var(--gz-text-muted)" }}>{subtitle}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Animated number ───────────────────────────────────────────────────────────
function AnimNum({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const from = useRef(value);
  const start = useRef<number | null>(null);
  const DURATION = 900;

  useEffect(() => {
    const origin = from.current;
    const target = value;
    if (origin === target) return;
    start.current = null;
    const animate = (now: number) => {
      if (!start.current) start.current = now;
      const p = Math.min((now - start.current) / DURATION, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(origin + (target - origin) * ease));
      if (p < 1) raf.current = requestAnimationFrame(animate);
      else { from.current = target; setDisplay(target); }
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [value]);

  return <>{prefix}{display.toLocaleString("pt-MZ")}{suffix}</>;
}

// ── Donut gauge ───────────────────────────────────────────────────────────────
function DonutGauge({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={7} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={pts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          fill={`url(#sg-${color.replace("#", "")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBar({ wins, losses }: { wins: number; losses: number }) {
  const data = [
    { name: "Bot", v: wins, fill: T.red },
    { name: "User", v: losses, fill: T.teal },
  ];
  return (
    <ResponsiveContainer width="100%" height={46}>
      <BarChart data={data} barSize={24} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="v" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
        <RTooltip
          contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 11, color: "#fff" }}
          labelFormatter={() => ""} formatter={(v: number, n: string) => [`${v}`, n]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, icon: Icon, accent, hint, suffix }: {
  label: string; value: number; icon: React.ElementType;
  accent: string; hint?: string; suffix?: string;
}) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--gz-bg-card-btn)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0,
          background: `${accent}16`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 15, height: 15, color: accent, strokeWidth: 1.9 }} />
        </div>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] truncate" style={{ color: "var(--gz-text-muted)" }}>
          {label}
        </span>
      </div>
      <div className="text-[22px] font-black tracking-[-0.03em] tabular-nums truncate" style={{ color: "var(--gz-text-primary)" }}>
        <AnimNum value={value} />
        {suffix && <span className="text-[13px] font-bold ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[11px] font-medium mt-1" style={{ color: "var(--gz-text-muted)" }}>{hint}</div>}
    </div>
  );
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchBotData() {
  const TWO_HOURS_MS  = 2 * 60 * 60 * 1000;
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  const [betRes, winRes, profileRes, totalBetsRes] = await Promise.all([
    adminSupabase.from("transactions").select("id,user_id,amount,description,created_at")
      .eq("type", "bet").eq("status", "approved").ilike("description", "%[bot]%")
      .order("created_at", { ascending: false }).limit(500),
    adminSupabase.from("transactions").select("user_id,amount,created_at")
      .eq("type", "win").eq("status", "approved").order("created_at", { ascending: true }),
    adminSupabase.from("profiles").select("id,full_name,phone"),
    adminSupabase.from("transactions").select("id", { count: "exact", head: true })
      .eq("type", "bet").eq("status", "approved"),
  ]);

  type BetRow = { id: string; user_id: string; amount: number; description: string; created_at: string };
  type WinRow = { user_id: string; amount: number; created_at: string };

  const botBets  = (betRes.data  ?? []) as BetRow[];
  const allWins  = (winRes.data  ?? []) as WinRow[];
  const profMap  = new Map(
    ((profileRes.data ?? []) as { id: string; full_name?: string; phone?: string }[])
      .map(p => [p.id, p.full_name || p.phone || "—"])
  );

  const sortedBets = [...botBets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const now = Date.now();
  const usedWin = new Set<number>();

  const parseGame = (d: string) => {
    const l = d.toLowerCase();
    if (l.includes("xadrez")) return "xadrez";
    if (l.includes("ludo"))   return "ludo";
    return "dama";
  };
  const extractBot = (d: string) => { const m = d.match(/vs (.+)$/i); return m ? m[1].trim() : "Bot"; };

  const classified = sortedBets.map(bet => {
    const betTime = new Date(bet.created_at).getTime();
    const ageMs   = now - betTime;
    const winIdx  = allWins.findIndex((w, i) => {
      if (usedWin.has(i)) return false;
      const wt = new Date(w.created_at).getTime();
      return w.user_id === bet.user_id && wt >= betTime && wt <= betTime + FOUR_HOURS_MS;
    });
    const win = winIdx >= 0 ? allWins[winIdx] : null;
    if (winIdx >= 0) usedWin.add(winIdx);
    const gameEnded = !!win;
    const isActive  = !gameEnded && ageMs < TWO_HOURS_MS;
    const userWon   = gameEnded && (win!.amount ?? 0) > 0;
    const botWon    = (!gameEnded && !isActive) || (gameEnded && (win!.amount ?? 0) === 0);
    return { ...bet, isActive, userWon, botWon, gameType: parseGame(bet.description) };
  });

  const classifiedDesc = [...classified].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const active   = classified.filter(m => m.isActive);
  const finished = classified.filter(m => !m.isActive);
  const botWins  = finished.filter(m => m.botWon);
  const userWins = finished.filter(m => m.userWon);
  const winRate  = finished.length > 0 ? Math.round((botWins.length / finished.length) * 100) : 0;

  const totalBotGanhou = botWins.reduce((s, m)  => s + Math.abs(m.amount ?? 0), 0);
  const totalBotPerdeu = userWins.reduce((s, m) => s + Math.floor(Math.abs(m.amount) * 2 * 0.90), 0);
  const saldoLiquido   = totalBotGanhou - totalBotPerdeu;
  const surplus        = botWins.length - userWins.length;
  const autoDisable    = surplus < -3;

  const sparklDays = 14;
  const dayMs      = 86_400_000;
  const sparkline: number[] = [];
  let cumSaldo = 0;
  for (let d = sparklDays - 1; d >= 0; d--) {
    const from_ = now - (d + 1) * dayMs;
    const to_   = now - d * dayMs;
    for (const m of classified) {
      const t = new Date(m.created_at).getTime();
      if (t >= from_ && t < to_) {
        if (m.botWon)  cumSaldo += Math.abs(m.amount ?? 0);
        if (m.userWon) cumSaldo -= Math.floor(Math.abs(m.amount) * 2 * 0.90);
      }
    }
    sparkline.push(cumSaldo);
  }

  const byGame = (type: string) => {
    const g  = classified.filter(m => m.gameType === type);
    const gf = g.filter(m => !m.isActive);
    return {
      total:    g.length,
      active:   g.filter(m => m.isActive).length,
      botWins:  gf.filter(m => m.botWon).length,
      userWins: gf.filter(m => m.userWon).length,
    };
  };

  return {
    total: botBets.length,
    finished: finished.length,
    active: active.length,
    botWins: botWins.length,
    userWins: userWins.length,
    winRate, totalBotGanhou, totalBotPerdeu, saldoLiquido,
    surplus, autoDisable,
    allTotal: totalBetsRes.count ?? 0,
    allActive: active.length,
    sparkline,
    dama:   byGame("dama"),
    xadrez: byGame("xadrez"),
    ludo:   byGame("ludo"),
    recent: classifiedDesc.slice(0, 20).map(m => ({
      id:           m.id,
      game_type:    m.gameType,
      status:       m.isActive ? "active" : "finished",
      bet_amount:   Math.abs(m.amount),
      userWon:      m.userWon,
      botWon:       m.botWon,
      isActive:     m.isActive,
      player_name:  profMap.get(m.user_id) ?? "—",
      bot_name:     extractBot(m.description),
      created_at:   m.created_at,
    })),
  };
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: bg, color, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ── Loss Limit Card ───────────────────────────────────────────────────────────
function LossLimitCard({ limit, setLimit, currentLoss }: {
  limit: number; setLimit: (v: number) => void; currentLoss: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(limit));
  const pct = limit > 0 ? Math.min(100, Math.round((currentLoss / limit) * 100)) : 0;

  useEffect(() => { if (!editing) setDraft(String(limit)); }, [limit, editing]);
  const danger = pct >= 80;
  const color  = pct >= 100 ? T.red : pct >= 80 ? T.amber : T.teal;

  function save() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) { setLimit(v); setEditing(false); }
    else setDraft("");
  }

  return (
    <div className="gz-card overflow-hidden" style={{ border: danger ? `1px solid ${T.red}44` : undefined }}>
      <SectionHeader
        icon={Target}
        title="Limite de Perda"
        subtitle="Bots desligam automaticamente ao atingir"
        action={!editing ? (
          <button onClick={() => { setDraft(String(limit)); setEditing(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-secondary)" }}>
            <Edit3 style={{ width: 11, height: 11 }} /> Editar
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="w-[72px] px-2 py-1 rounded-lg outline-none text-[13px] font-bold"
              style={{ border: "1.5px solid var(--gz-text-tertiary)", background: "var(--gz-bg-subtle)", color: "var(--gz-text-primary)" }} />
            <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>MT</span>
            <button onClick={save} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${T.teal}22`, color: T.teal, border: "none" }}>
              <Check style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={() => setEditing(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${T.red}20`, color: T.red, border: "none" }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}
      />
      <div className="p-5 flex items-center gap-5">
        <div style={{ position: "relative", flexShrink: 0 }}>
          <DonutGauge pct={pct} color={color} size={84} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color }}>{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>Perda acumulada</span>
            <span className="text-[12.5px] font-bold tabular-nums" style={{ color }}>{currentLoss.toLocaleString()} MT</span>
          </div>
          <div className="gz-progress-track h-1.5">
            <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
              style={{ height: "100%", borderRadius: 100, background: color }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9.5px]" style={{ color: "var(--gz-text-tertiary)" }}>0 MT</span>
            <span className="text-[9.5px]" style={{ color: "var(--gz-text-tertiary)" }}>Limite: {limit.toLocaleString()} MT</span>
          </div>
          {pct >= 100 && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
              style={{ background: `${T.red}12`, border: `1px solid ${T.red}30` }}>
              <AlertTriangle style={{ width: 12, height: 12, color: T.red, flexShrink: 0 }} />
              <span className="text-[11px] font-semibold" style={{ color: T.red }}>Limite atingido — bots desligados</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BotManagement() {
  useAdminRealtimeSync();
  const qc = useQueryClient();

  const [botsEnabled, setBotsEnabled] = useState(() =>
    localStorage.getItem("wm_bots_disabled") !== "true"
  );
  const [autoDisabledFlag] = useState(() =>
    localStorage.getItem("wm_bots_autodisabled") === "true"
  );
  const [lossLimit, setLossLimitState] = useState(() => {
    const v = parseInt(localStorage.getItem("wm_bot_loss_limit") ?? "500", 10);
    return isNaN(v) ? 500 : v;
  });
  const [toggling,       setToggling]       = useState(false);
  const [showRecent,     setShowRecent]     = useState(true);
  const [limitTriggered, setLimitTriggered] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["bot-stats-v4"],
    queryFn:  fetchBotData,
    refetchInterval: 15_000,
    staleTime:       10_000,
  });

  const currentLoss = data ? Math.max(0, data.totalBotPerdeu - data.totalBotGanhou) : 0;

  function setLossLimit(v: number) {
    setLossLimitState(v);
    localStorage.setItem("wm_bot_loss_limit", String(v));
  }

  useEffect(() => {
    if (!data) return;
    if (_sessionBotOverride) return;
    if (data.autoDisable && localStorage.getItem("wm_bots_autodisabled") !== "true") {
      localStorage.setItem("wm_bots_disabled", "true");
      localStorage.setItem("wm_bots_autodisabled", "true");
      setBotsEnabled(false);
    }
  }, [data]);

  function handleLossLimitTrigger() {
    if (!botsEnabled) return;
    localStorage.setItem("wm_bots_disabled", "true");
    localStorage.setItem("wm_bots_autodisabled", "true");
    setBotsEnabled(false);
    setLimitTriggered(true);
    qc.invalidateQueries({ queryKey: ["bot-stats-v4"] });
  }

  const limitTriggeredRef = React.useRef(false);
  useEffect(() => {
    if (!botsEnabled) { limitTriggeredRef.current = false; return; }
    if (lossLimit <= 0) return;
    if (currentLoss >= lossLimit && !limitTriggeredRef.current) {
      limitTriggeredRef.current = true;
      handleLossLimitTrigger();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLoss, lossLimit, botsEnabled]);

  function handleToggle() {
    if (toggling) return;
    const next = !botsEnabled;
    setToggling(true);
    if (next) {
      _sessionBotOverride = true;
      adminReEnable();
      localStorage.removeItem("wm_bots_autodisabled");
      setLimitTriggered(false);
    } else {
      localStorage.setItem("wm_bots_disabled", "true");
    }
    setBotsEnabled(next);
    qc.invalidateQueries({ queryKey: ["bot-stats-v4"] });
    setTimeout(() => setToggling(false), 700);
  }

  const isAutoDisabled = !botsEnabled && (data?.autoDisable || autoDisabledFlag || limitTriggered);
  const positive       = (data?.saldoLiquido ?? 0) >= 0;
  const saldoColor     = positive ? T.teal : T.red;
  const winRatePct     = data?.winRate ?? 0;
  const winRateColor   = winRatePct >= 60 ? T.teal : winRatePct >= 40 ? T.amber : T.red;

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1600px] mx-auto">

      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.035em] leading-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
            <Brain style={{ width: 22, height: 22, strokeWidth: 2 }} />
            Gestão de <span className="gz-gradient-text">Bots</span>
          </h1>
          <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
            Motor inteligente · actualiza a cada 15 segundos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl"
            style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)" }}>
            <span className="w-2 h-2 rounded-full" style={{
              background: botsEnabled ? T.teal : T.red,
              boxShadow: botsEnabled ? `0 0 8px ${T.teal}` : `0 0 8px ${T.red}`,
              animation: botsEnabled ? "pulse-dot 2s ease-in-out infinite" : "none",
            }} />
            <span className="text-[11.5px] font-bold" style={{ color: botsEnabled ? T.teal : T.red }}>
              {botsEnabled ? "Online" : "Offline"}
            </span>
          </div>
          <button onClick={() => refetch()} disabled={isFetching} title="Actualizar"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)" }}>
            <RefreshCw style={{ width: 14, height: 14, color: isFetching ? T.blue : "var(--gz-text-muted)",
              animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
          <motion.button onClick={handleToggle} disabled={toggling} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-[12.5px] font-bold text-white transition-all"
            style={{
              border: "none",
              background: botsEnabled ? "#18181b" : T.red,
              boxShadow: botsEnabled ? "0 6px 20px rgba(0,0,0,.25)" : `0 6px 20px ${T.red}40`,
            }}>
            {botsEnabled
              ? <><Power style={{ width: 13, height: 13 }} />Desligar Bots</>
              : <><PowerOff style={{ width: 13, height: 13 }} />Ligar Bots</>}
          </motion.button>
        </div>
      </div>

      {/* ═══ ALERT BANNER ═══ */}
      <AnimatePresence>
        {(!botsEnabled || isAutoDisabled) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl px-4 py-3.5 mb-5 flex items-start gap-3"
            style={{
              border: `1px solid ${isAutoDisabled ? `${T.amber}44` : `${T.red}44`}`,
              background: isAutoDisabled ? `${T.amber}0d` : `${T.red}0d`,
            }}>
            {isAutoDisabled
              ? <AlertTriangle style={{ width: 16, height: 16, color: T.amber, flexShrink: 0, marginTop: 1 }} />
              : <ShieldOff style={{ width: 16, height: 16, color: T.red, flexShrink: 0, marginTop: 1 }} />}
            <div>
              <p className="text-[12.5px] font-bold" style={{ color: isAutoDisabled ? T.amber : T.red }}>
                {limitTriggered
                  ? "Auto-desactivado — limite de perda financeira atingido"
                  : isAutoDisabled
                    ? "Auto-desactivado — utilizadores estão a ganhar demasiado ao bot"
                    : "Bots desactivados manualmente"}
              </p>
              {data && (
                <p className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                  {limitTriggered
                    ? `Perda acumulada ultrapassou ${lossLimit.toLocaleString()} MT. Reactiva e revê os dados.`
                    : `Utilizadores ganharam ${Math.abs(data.surplus)} jogos a mais do que o bot. Reactiva manualmente.`}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ LOADING ═══ */}
      {isLoading ? (
        <div className="gz-card flex flex-col items-center gap-3 py-20">
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${T.blue}25`, borderTopColor: T.blue, animation: "spin 1s linear infinite" }} />
          <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>A carregar dados dos bots...</p>
        </div>
      ) : data ? (
        <div className="space-y-5">

          {/* ═══ KPI PANEL ═══ */}
          <section className="gz-card overflow-hidden animate-float-up">
            <SectionHeader
              icon={Activity}
              title="Resumo do Motor"
              subtitle="Desempenho global dos bots"
              action={
                <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
                  {data.finished} jogos finais
                </span>
              }
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "var(--gz-border-subtle)" }}>
              <KpiTile label="Saldo Líquido"  value={data.saldoLiquido}   icon={positive ? TrendingUp : TrendingDown} accent={saldoColor} suffix="MT" hint={positive ? "Lucro da plataforma" : "Prejuízo actual"} />
              <KpiTile label="Bot Ganhou"     value={data.totalBotGanhou} icon={TrendingUp}   accent={T.teal}  suffix="MT" hint={`${data.botWins} vitórias`} />
              <KpiTile label="Bot Perdeu"     value={data.totalBotPerdeu} icon={TrendingDown} accent={T.red}   suffix="MT" hint={`${data.userWins} vitórias user`} />
              <KpiTile label="Total Apostas"  value={data.allTotal}       icon={BarChart3}    accent={T.purple} hint={`${data.total} com bot`} />
            </div>
          </section>

          {/* ═══ ANALYTICS ROW ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Saldo hero + sparkline */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              className="gz-card overflow-hidden lg:col-span-2">
              <SectionHeader icon={TrendingUp} title="Saldo Líquido do Bot" subtitle="Evolução nos últimos 14 dias"
                action={
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{ background: `${saldoColor}16`, color: saldoColor }}>
                    {positive ? <ArrowUpRight style={{ width: 11, height: 11 }} /> : <ArrowDownRight style={{ width: 11, height: 11 }} />}
                    {positive ? "Lucro" : "Prejuízo"}
                  </span>
                }
              />
              <div className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[36px] font-black tracking-[-0.04em] leading-none tabular-nums" style={{ color: saldoColor }}>
                    <AnimNum value={data.saldoLiquido} prefix={positive ? "+" : ""} />
                  </span>
                  <span className="text-[14px] font-bold" style={{ color: saldoColor }}>MT</span>
                </div>
                <p className="text-[11.5px] mt-1.5" style={{ color: "var(--gz-text-muted)" }}>
                  {positive ? "A plataforma está a lucrar com os bots" : "A plataforma está a pagar mais do que recolhe"}
                </p>
                <div className="mt-4">
                  <Sparkline data={data.sparkline} color={saldoColor} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9.5px]" style={{ color: "var(--gz-text-tertiary)" }}>14 dias atrás</span>
                  <span className="text-[9.5px]" style={{ color: "var(--gz-text-tertiary)" }}>hoje</span>
                </div>
              </div>
            </motion.section>

            {/* Win rate + Guardian */}
            <div className="space-y-5">
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="gz-card overflow-hidden">
                <SectionHeader icon={Target} title="Taxa de Vitória" subtitle="Desempenho do bot nos jogos" />
                <div className="p-5 flex flex-col items-center">
                  <div style={{ position: "relative" }}>
                    <DonutGauge pct={winRatePct} color={winRateColor} size={96} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="text-[20px] font-black tabular-nums" style={{ color: winRateColor }}>{winRatePct}%</span>
                    </div>
                  </div>
                  <p className="text-[12px] font-bold mt-3" style={{ color: winRateColor }}>
                    {winRatePct >= 60 ? "Bot dominante" : winRatePct >= 40 ? "Equilibrado" : "Bot em risco"}
                  </p>
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="gz-card overflow-hidden">
                <SectionHeader icon={Shield} title="Guardião" subtitle="Protecção automática"
                  action={
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: data.autoDisable ? `${T.red}16` : `${T.teal}16`,
                        color: data.autoDisable ? T.red : T.teal,
                      }}>
                      {data.autoDisable ? "DESLIGADO" : data.surplus < -2 ? "ATENÇÃO" : "SEGURO"}
                    </span>
                  }
                />
                <div className="p-5 flex items-center gap-3">
                  {data.autoDisable
                    ? <AlertTriangle style={{ width: 20, height: 20, color: T.red, flexShrink: 0 }} />
                    : data.surplus < -2
                      ? <Zap style={{ width: 20, height: 20, color: T.amber, flexShrink: 0 }} />
                      : <CheckCircle2 style={{ width: 20, height: 20, color: T.teal, flexShrink: 0 }} />}
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>
                      {data.surplus >= 0
                        ? <>Bot lidera: <strong style={{ color: T.teal }}>+{data.surplus}</strong> vitórias</>
                        : <>Users lideram: <strong style={{ color: T.red }}>{data.surplus}</strong> vitórias</>}
                    </p>
                    <p className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                      desliga quando users ganham +3 jogos a mais
                    </p>
                  </div>
                </div>
              </motion.section>
            </div>
          </div>

          {/* ═══ LOSS LIMIT ═══ */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <LossLimitCard limit={lossLimit} setLimit={setLossLimit} currentLoss={currentLoss} />
          </motion.div>

          {/* ═══ PER GAME ═══ */}
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "180ms" }}>
            <SectionHeader icon={Gamepad2} title="Desempenho por Jogo" subtitle="Vitórias e derrotas em cada modalidade" />
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--gz-bg-subtle)" }}>
                  {["Jogo", "Total", "Ao Vivo", "Bot", "User", "Taxa", ""].map((h, i) => (
                    <th key={h || i}
                      className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${i >= 1 ? "text-right" : "text-left"}`}
                      style={{ color: "var(--gz-text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { icon: "🎮", label: "Damas",  data: data.dama,   color: T.blue },
                  { icon: "♟",  label: "Xadrez", data: data.xadrez, color: T.purple },
                  { icon: "🎲", label: "Ludo",   data: data.ludo,   color: T.amber },
                ].map(g => {
                  const fin  = g.data.botWins + g.data.userWins;
                  const rate = fin > 0 ? Math.round((g.data.botWins / fin) * 100) : 0;
                  return (
                    <tr key={g.label} className="gz-tr" style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[18px]">{g.icon}</span>
                          <span className="text-[12.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{g.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--gz-text-primary)" }}>{g.data.total}</td>
                      <td className="px-5 py-3 text-right">
                        {g.data.active > 0
                          ? <Pill label={`${g.data.active} ao vivo`} color={T.teal} bg={`${T.teal}16`} />
                          : <span className="text-[12px]" style={{ color: "var(--gz-text-tertiary)" }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: T.red }}>{g.data.botWins}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: T.teal }}>{g.data.userWins}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="gz-progress-track h-1.5 w-14">
                            <div style={{ width: `${rate}%`, height: "100%", borderRadius: 100, background: g.color }} />
                          </div>
                          <span className="text-[11.5px] font-bold tabular-nums w-9 text-right" style={{ color: "var(--gz-text-muted)" }}>{rate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 w-[120px]">
                        <div className="w-[80px] ml-auto"><MiniBar wins={g.data.botWins} losses={g.data.userWins} /></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* ═══ RECENT MATCHES ═══ */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="gz-card overflow-hidden">
            <SectionHeader
              icon={Crown}
              title="Últimas Partidas"
              subtitle={`${data.recent.length} partidas recentes`}
              action={
                <button onClick={() => setShowRecent(s => !s)}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                  style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-secondary)" }}>
                  {showRecent ? "Recolher" : "Expandir"}
                </button>
              }
            />
            <AnimatePresence>
              {showRecent && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr style={{ background: "var(--gz-bg-subtle)" }}>
                          {["Jogo", "Jogador", "Bot Adversário", "Aposta", "Resultado", "Data"].map((h, i) => (
                            <th key={h}
                              className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${i === 3 ? "text-right" : i >= 4 ? "text-right" : "text-left"}`}
                              style={{ color: "var(--gz-text-muted)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map(m => {
                          const gameIcon = m.game_type === "xadrez" ? "♟" : m.game_type === "ludo" ? "🎲" : "🎮";
                          const statusColor = m.isActive ? T.blue : m.botWon ? T.red : T.teal;
                          const statusBg    = `${statusColor}16`;
                          const statusLabel = m.isActive ? "Ao vivo" : m.botWon ? "Bot ganhou" : "User ganhou";
                          const date = new Date(m.created_at);
                          const dateStr = `${date.getDate()} ${date.toLocaleDateString("pt-MZ", { month: "short" })}`;
                          return (
                            <tr key={m.id} className="gz-tr" style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                              <td className="px-5 py-3 text-[17px]">{gameIcon}</td>
                              <td className="px-5 py-3 text-[12.5px] font-semibold truncate max-w-[160px]" style={{ color: "var(--gz-text-primary)" }}>{m.player_name}</td>
                              <td className="px-5 py-3 text-[12.5px] truncate max-w-[160px]" style={{ color: "var(--gz-text-muted)" }}>{m.bot_name}</td>
                              <td className="px-5 py-3 text-right text-[12.5px] font-bold tabular-nums" style={{ color: T.amber }}>{m.bet_amount} MT</td>
                              <td className="px-5 py-3 text-right"><Pill label={statusLabel} color={statusColor} bg={statusBg} /></td>
                              <td className="px-5 py-3 text-right text-[11px]" style={{ color: "var(--gz-text-tertiary)" }}>{dateStr}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      ) : (
        <div className="gz-card flex flex-col items-center py-16">
          <Bot style={{ width: 44, height: 44, marginBottom: 14, color: "var(--gz-text-tertiary)", opacity: 0.4 }} />
          <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>Sem dados disponíveis</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.65; transform:scale(1.35); } }
      `}</style>
    </div>
  );
}
