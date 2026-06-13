import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSupabase, useAdminRealtimeSync } from "@/admin/lib/supabase-api";
import { adminReEnable } from "@/lib/botBrain";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, Tooltip as RTooltip, XAxis,
} from "recharts";
import {
  Bot, Power, PowerOff, RefreshCw, Brain, TrendingUp, TrendingDown,
  Activity, Shield, AlertTriangle, CheckCircle2, ShieldOff,
  Edit3, Check, X, Target, Zap, Flame, Crown, BarChart3,
  ArrowUpRight, ArrowDownRight, Gamepad2,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      "#0b0d14",
  surface: "rgba(255,255,255,0.042)",
  surf2:   "rgba(255,255,255,0.07)",
  border:  "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)",
  text:    "#f1f5f9",
  sub:     "#94a3b8",
  muted:   "rgba(255,255,255,0.3)",
  teal:    "#14b8a6",
  green:   "#22c55e",
  red:     "#f43f5e",
  amber:   "#f59e0b",
  blue:    "#6366f1",
  purple:  "#a855f7",
  sky:     "#38bdf8",
};

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

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutGauge({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
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
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={pts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          fill={`url(#sg-${color.replace("#","")})`} dot={false} />
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
    <ResponsiveContainer width="100%" height={40}>
      <BarChart data={data} barSize={22} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="v" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
        <RTooltip
          contentStyle={{ background: "#1e2235", border: "none", borderRadius: 8, fontSize: 11 }}
          labelFormatter={() => ""} formatter={(v: number, n: string) => [`${v}`, n]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: bg, color, whiteSpace: "nowrap",
    }}>{label}</span>
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
  const autoDisable    = surplus > 3;

  // Build 7-day sparkline for saldo
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

// ── Loss Limit Card ───────────────────────────────────────────────────────────
function LossLimitCard({
  limit, setLimit, currentLoss, botsEnabled, onTrigger,
}: {
  limit: number; setLimit: (v: number) => void;
  currentLoss: number; botsEnabled: boolean; onTrigger: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(limit));
  const pct    = limit > 0 ? Math.min(100, Math.round((currentLoss / limit) * 100)) : 0;
  const danger = pct >= 80;
  const color  = pct >= 100 ? T.red : pct >= 80 ? T.amber : T.teal;

  useEffect(() => {
    if (limit > 0 && currentLoss >= limit && botsEnabled) onTrigger();
  }, [currentLoss, limit, botsEnabled, onTrigger]);

  function save() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) setLimit(v);
    setEditing(false);
  }

  return (
    <div style={{
      background: T.surface, border: `1px solid ${danger ? T.red + "44" : T.border}`,
      borderRadius: 20, padding: "22px 22px",
      boxShadow: danger ? `0 0 28px ${T.red}18` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Target style={{ width: 16, height: 16, color }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>Limite de Perda</p>
            <p style={{ margin: 0, fontSize: 11, color: T.sub }}>Bot desliga ao atingir</p>
          </div>
        </div>
        {!editing ? (
          <button onClick={() => { setDraft(String(limit)); setEditing(true); }} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            borderRadius: 8, border: `1px solid ${T.border2}`,
            background: T.surf2, cursor: "pointer", color: T.sub, fontSize: 11, fontWeight: 600,
          }}>
            <Edit3 style={{ width: 11, height: 11 }} /> Editar
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              style={{
                width: 80, padding: "5px 8px", borderRadius: 8,
                border: `1.5px solid ${T.blue}`, background: "rgba(99,102,241,0.12)",
                color: T.text, fontSize: 13, fontWeight: 700, outline: "none",
              }} />
            <span style={{ fontSize: 11, color: T.sub }}>MT</span>
            <button onClick={save} style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: `${T.teal}25`, cursor: "pointer", color: T.teal,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Check style={{ width: 12, height: 12 }} /></button>
            <button onClick={() => setEditing(false)} style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: `${T.red}20`, cursor: "pointer", color: T.red,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><X style={{ width: 12, height: 12 }} /></button>
          </div>
        )}
      </div>

      {/* Ring + numbers */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <DonutGauge pct={pct} color={color} size={80} />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color, transform: "rotate(0deg)" }}>
              {pct}%
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.sub }}>Perda acumulada</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{currentLoss.toLocaleString()} MT</span>
          </div>
          <div style={{ height: 5, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
              style={{
                height: "100%", borderRadius: 5,
                background: pct >= 100
                  ? `linear-gradient(90deg, ${T.red}, #e11d48)`
                  : pct >= 80
                    ? `linear-gradient(90deg, ${T.amber}, ${T.red})`
                    : `linear-gradient(90deg, ${T.teal}, ${T.sky})`,
              }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: T.muted }}>0 MT</span>
            <span style={{ fontSize: 9, color: T.muted }}>Limite: {limit.toLocaleString()} MT</span>
          </div>
        </div>
      </div>

      {pct >= 100 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 14, padding: "9px 12px", borderRadius: 10,
            background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.28)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
          <AlertTriangle style={{ width: 12, height: 12, color: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>
            Limite atingido — Bots desligados automaticamente
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  function setLossLimit(v: number) {
    setLossLimitState(v);
    localStorage.setItem("wm_bot_loss_limit", String(v));
  }

  useEffect(() => {
    if (!data) return;
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

  function handleToggle() {
    if (toggling) return;
    const next = !botsEnabled;
    setToggling(true);
    if (next) {
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
  const currentLoss    = data ? Math.max(0, data.totalBotPerdeu - data.totalBotGanhou) : 0;
  const positive       = (data?.saldoLiquido ?? 0) >= 0;
  const saldoColor     = positive ? T.teal : T.red;

  // ── Derived display values ────────────────────────────────────────────────
  const winRatePct = data?.winRate ?? 0;
  const winRateColor = winRatePct > 68 ? T.red : winRatePct > 50 ? T.amber : T.teal;

  return (
    <div style={{
      minHeight: "100%",
      padding: "28px 24px 56px",
      background: T.bg,
      color: T.text,
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ═══ HEADER ═════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <motion.div
            animate={{ boxShadow: [`0 0 18px ${T.blue}28`, `0 0 36px ${T.blue}48`, `0 0 18px ${T.blue}28`] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              width: 48, height: 48, borderRadius: 16,
              background: `linear-gradient(135deg, ${T.blue}28, ${T.purple}18)`,
              border: `1.5px solid ${T.blue}38`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Brain style={{ width: 22, height: 22, color: T.blue }} />
          </motion.div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5,
              fontFamily: "'Syne', sans-serif", color: T.text,
            }}>
              Gestão de Bots
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: T.sub }}>
              Motor inteligente · actualiza a cada 15 s
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Status dot */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 10,
            background: T.surface, border: `1px solid ${T.border}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: botsEnabled ? T.teal : T.red,
              boxShadow: botsEnabled ? `0 0 8px ${T.teal}` : `0 0 8px ${T.red}`,
              animation: botsEnabled ? "pulse-dot 2s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: botsEnabled ? T.teal : T.red }}>
              {botsEnabled ? "Online" : "Offline"}
            </span>
          </div>

          <button onClick={() => refetch()} disabled={isFetching} title="Actualizar" style={{
            width: 38, height: 38, borderRadius: 10, border: `1px solid ${T.border}`,
            background: T.surface, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RefreshCw style={{ width: 14, height: 14, color: isFetching ? T.blue : T.sub,
              animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>

          <motion.button onClick={handleToggle} disabled={toggling} whileTap={{ scale: 0.94 }} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
            borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
            fontFamily: "'Inter', sans-serif",
            background: botsEnabled
              ? `linear-gradient(135deg, ${T.teal}, #0f766e)`
              : `linear-gradient(135deg, ${T.red}, #be123c)`,
            color: "#fff",
            boxShadow: botsEnabled ? `0 6px 24px ${T.teal}38` : `0 6px 24px ${T.red}38`,
            transition: "all 0.3s",
          }}>
            {botsEnabled
              ? <><Power style={{ width: 13, height: 13 }} />Desligar Bots</>
              : <><PowerOff style={{ width: 13, height: 13 }} />Ligar Bots</>
            }
          </motion.button>
        </div>
      </div>

      {/* ═══ ALERT BANNER ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(!botsEnabled || isAutoDisabled) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              borderRadius: 14, padding: "13px 18px", marginBottom: 24,
              border: `1px solid ${isAutoDisabled ? T.amber + "44" : T.red + "44"}`,
              background: isAutoDisabled ? "rgba(245,158,11,0.07)" : "rgba(244,63,94,0.07)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
            {isAutoDisabled
              ? <AlertTriangle style={{ width: 16, height: 16, color: T.amber, flexShrink: 0 }} />
              : <ShieldOff     style={{ width: 16, height: 16, color: T.red,   flexShrink: 0 }} />
            }
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700,
                color: isAutoDisabled ? T.amber : T.red }}>
                {limitTriggered
                  ? "Auto-desactivado — limite de perda atingido"
                  : isAutoDisabled
                    ? "Auto-desactivado — excesso de vitórias de bots detectado"
                    : "Bots desactivados manualmente"
                }
              </p>
              {data && (
                <p style={{ margin: "3px 0 0", fontSize: 11, color: T.sub }}>
                  {limitTriggered
                    ? `Perda acumulada ultrapassou ${lossLimit.toLocaleString()} MT. Reativa e revê os dados.`
                    : `Excedente: bot ganhou ${data.surplus} jogos a mais.`
                  }
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ LOADING ════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "80px 0" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: `3px solid ${T.blue}25`, borderTopColor: T.blue,
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: T.sub, fontSize: 13 }}>A carregar dados dos bots…</p>
        </div>
      ) : data ? (
        <>

          {/* ═══ ROW 1 · Hero + Ganhou + Perdeu ════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Hero: Saldo Líquido */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: 22, padding: "26px 26px 18px",
                background: positive
                  ? `linear-gradient(145deg, rgba(20,184,166,0.16) 0%, rgba(56,189,248,0.08) 100%)`
                  : `linear-gradient(145deg, rgba(244,63,94,0.16) 0%, rgba(245,158,11,0.08) 100%)`,
                border: `1.5px solid ${saldoColor}28`,
                position: "relative", overflow: "hidden",
                boxShadow: `0 8px 48px ${saldoColor}14`,
              }}>
              {/* glow */}
              <div style={{
                position: "absolute", top: -30, right: -30, width: 140, height: 140,
                borderRadius: "50%", background: `${saldoColor}12`, filter: "blur(40px)", pointerEvents: "none",
              }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
                      textTransform: "uppercase", color: T.sub }}>Saldo Líquido do Bot</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                      background: `${saldoColor}20`, color: saldoColor,
                    }}>TEMPO REAL</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{
                      fontSize: 44, fontWeight: 900, lineHeight: 1, color: saldoColor,
                      fontFamily: "'Syne', sans-serif", textShadow: `0 0 28px ${saldoColor}40`,
                    }}>
                      <AnimNum value={data.saldoLiquido} prefix={positive ? "+" : ""} />
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: `${saldoColor}cc` }}>MT</span>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "3px 8px", borderRadius: 8, marginLeft: 4,
                      background: `${saldoColor}18`, border: `1px solid ${saldoColor}28`,
                    }}>
                      {positive
                        ? <ArrowUpRight style={{ width: 12, height: 12, color: saldoColor }} />
                        : <ArrowDownRight style={{ width: 12, height: 12, color: saldoColor }} />
                      }
                      <span style={{ fontSize: 10, fontWeight: 700, color: saldoColor }}>
                        {positive ? "Lucro" : "Prejuízo"}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: T.sub }}>
                    {positive
                      ? "A plataforma está a lucrar com os bots"
                      : "A plataforma está a pagar mais do que recolhe"}
                  </p>
                </div>
              </div>
              {/* Sparkline */}
              <div style={{ marginTop: 14, marginLeft: -6, marginRight: -6 }}>
                <Sparkline data={data.sparkline} color={saldoColor} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: T.muted }}>14 dias atrás</span>
                <span style={{ fontSize: 9, color: T.muted }}>hoje</span>
              </div>
            </motion.div>

            {/* Bot Ganhou */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              style={{
                borderRadius: 22, padding: "26px 22px",
                background: T.surface, border: `1px solid ${T.border}`,
                position: "relative", overflow: "hidden",
              }}>
              <div style={{
                position: "absolute", top: -20, right: -20, width: 90, height: 90,
                borderRadius: "50%", background: `${T.teal}09`, pointerEvents: "none",
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: T.sub }}>
                  Bot Ganhou
                </span>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${T.teal}18`, border: `1px solid ${T.teal}28`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrendingUp style={{ width: 14, height: 14, color: T.teal }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: T.teal,
                fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                <AnimNum value={data.totalBotGanhou} />
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>MT</span>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: T.sub }}>recolhido das apostas</p>
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 14,
                padding: "6px 10px", borderRadius: 8, background: `${T.teal}12`,
              }}>
                <ArrowUpRight style={{ width: 11, height: 11, color: T.teal }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.teal }}>{data.botWins} vitórias</span>
              </div>
            </motion.div>

            {/* Bot Perdeu */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              style={{
                borderRadius: 22, padding: "26px 22px",
                background: T.surface, border: `1px solid ${T.border}`,
                position: "relative", overflow: "hidden",
              }}>
              <div style={{
                position: "absolute", top: -20, right: -20, width: 90, height: 90,
                borderRadius: "50%", background: `${T.red}08`, pointerEvents: "none",
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: T.sub }}>
                  Bot Perdeu
                </span>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${T.red}18`, border: `1px solid ${T.red}28`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrendingDown style={{ width: 14, height: 14, color: T.red }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: T.red,
                fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                <AnimNum value={data.totalBotPerdeu} />
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>MT</span>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: T.sub }}>pago aos utilizadores</p>
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 14,
                padding: "6px 10px", borderRadius: 8, background: `${T.red}12`,
              }}>
                <ArrowDownRight style={{ width: 11, height: 11, color: T.red }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>{data.userWins} vitórias user</span>
              </div>
            </motion.div>
          </div>

          {/* ═══ ROW 2 · Win rate + Limit + Platform ════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Win rate donut */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              style={{
                borderRadius: 22, padding: "22px",
                background: T.surface, border: `1px solid ${T.border}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
                color: T.sub, marginBottom: 14 }}>Taxa Vitória Bot</span>
              <div style={{ position: "relative" }}>
                <DonutGauge pct={winRatePct} color={winRateColor} size={90} />
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: winRateColor,
                    fontFamily: "'Syne', sans-serif" }}>{winRatePct}%</span>
                </div>
              </div>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 11, color: winRateColor, fontWeight: 700 }}>
                  {winRatePct > 68 ? "⚠ Alto risco" : winRatePct > 50 ? "Equilibrado" : "Favorável ao user"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted }}>
                  {data.finished} jogos finais
                </p>
              </div>
            </motion.div>

            {/* Loss limit */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <LossLimitCard
                limit={lossLimit} setLimit={setLossLimit}
                currentLoss={currentLoss} botsEnabled={botsEnabled}
                onTrigger={handleLossLimitTrigger}
              />
            </motion.div>

            {/* Total partidas */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
              style={{
                borderRadius: 22, padding: "22px",
                background: T.surface, border: `1px solid ${T.border}`,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: T.sub }}>
                  Total Geral
                </span>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${T.purple}18`, border: `1px solid ${T.purple}28`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BarChart3 style={{ width: 13, height: 13, color: T.purple }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 34, fontWeight: 900, color: T.purple,
                fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                {data.allTotal}
              </p>
              <p style={{ margin: "5px 0 12px", fontSize: 11, color: T.sub }}>apostas na plataforma</p>
              <div style={{ height: 1, background: T.border, marginBottom: 12 }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: T.sub }}>com bot</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.blue }}>{data.total}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 10, color: T.sub }}>ao vivo</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.teal }}>{data.allActive}</p>
                </div>
              </div>
            </motion.div>

            {/* Auto-disable status */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{
                borderRadius: 22, padding: "22px",
                background: data.autoDisable
                  ? "rgba(244,63,94,0.08)"
                  : data.surplus > 2
                    ? "rgba(245,158,11,0.08)"
                    : T.surface,
                border: `1px solid ${data.autoDisable ? T.red + "44" : data.surplus > 2 ? T.amber + "44" : T.border}`,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: T.sub }}>
                  Guardião
                </span>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${data.autoDisable ? T.red : T.teal}18`,
                  border: `1px solid ${data.autoDisable ? T.red : T.teal}28`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Shield style={{ width: 13, height: 13, color: data.autoDisable ? T.red : T.teal }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {data.autoDisable
                  ? <AlertTriangle style={{ width: 18, height: 18, color: T.red }} />
                  : data.surplus > 2
                    ? <Zap style={{ width: 18, height: 18, color: T.amber }} />
                    : <CheckCircle2 style={{ width: 18, height: 18, color: T.teal }} />
                }
                <span style={{
                  fontSize: 14, fontWeight: 800,
                  color: data.autoDisable ? T.red : data.surplus > 2 ? T.amber : T.teal,
                  fontFamily: "'Syne', sans-serif",
                }}>
                  {data.autoDisable ? "ACTIVO" : data.surplus > 2 ? "RISCO" : "SEGURO"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: T.sub }}>
                Excedente: <strong style={{ color: data.surplus > 0 ? T.red : T.teal }}>
                  {data.surplus > 0 ? "+" : ""}{data.surplus}
                </strong> jogos
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: T.muted }}>gatilho: +3 vitórias bot</p>
            </motion.div>
          </div>

          {/* ═══ ROW 3 · Por jogo ═══════════════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[
              { icon: "🎮", label: "Damas",  data: data.dama,   color: T.blue,   delay: 0.34 },
              { icon: "♟",  label: "Xadrez", data: data.xadrez, color: T.purple, delay: 0.38 },
              { icon: "🎲", label: "Ludo",   data: data.ludo,   color: T.amber,  delay: 0.42 },
            ].map(g => {
              const fin  = g.data.botWins + g.data.userWins;
              const rate = fin > 0 ? Math.round((g.data.botWins / fin) * 100) : 0;
              return (
                <motion.div key={g.label}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: g.delay }}
                  style={{
                    borderRadius: 22, padding: "22px",
                    background: T.surface, border: `1px solid ${T.border}`,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{g.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text }}>{g.label}</p>
                        <p style={{ margin: 0, fontSize: 10, color: T.sub }}>{g.data.total} jogos totais</p>
                      </div>
                    </div>
                    {g.data.active > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                        background: `${T.teal}18`, color: T.teal, border: `1px solid ${T.teal}28`,
                      }}>{g.data.active} ao vivo</span>
                    )}
                  </div>
                  {/* Mini bar */}
                  <MiniBar wins={g.data.botWins} losses={g.data.userWins} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: T.red, fontWeight: 600 }}>Bot: {g.data.botWins}</span>
                    <span style={{ fontSize: 10, color: T.sub }}>Taxa: {rate}%</span>
                    <span style={{ fontSize: 10, color: T.teal, fontWeight: 600 }}>User: {g.data.userWins}</span>
                  </div>
                  {/* Progress */}
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden", marginTop: 10 }}>
                    <motion.div
                      animate={{ width: `${rate}%` }} transition={{ duration: 1, delay: g.delay + 0.3 }}
                      style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${T.red}, ${g.color})` }} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ═══ ROW 4 · Tabela de partidas ═════════════════════════════════ */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
            style={{
              borderRadius: 22, overflow: "hidden",
              background: T.surface, border: `1px solid ${T.border}`,
            }}>
            {/* Table header row */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 24px 14px",
              borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Crown style={{ width: 15, height: 15, color: T.amber }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Últimas Partidas</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                  background: `${T.blue}18`, color: T.blue,
                }}>{data.recent.length}</span>
              </div>
              <button onClick={() => setShowRecent(s => !s)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surf2,
                cursor: "pointer", color: T.sub, fontSize: 11, fontWeight: 600,
              }}>
                {showRecent ? <><ChevronUp style={{ width: 11, height: 11 }} />Recolher</> : <><ChevronDown style={{ width: 11, height: 11 }} />Expandir</>}
              </button>
            </div>

            <AnimatePresence>
              {showRecent && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  style={{ overflow: "hidden" }}>
                  {/* Column headers */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr 1fr 90px 80px 80px",
                    gap: 8, padding: "10px 24px",
                    background: "rgba(255,255,255,0.025)",
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    {["", "Jogador", "Bot Adversário", "Aposta", "Resultado", "Data"].map((h, i) => (
                      <span key={i} style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase",
                        color: T.muted,
                      }}>{h}</span>
                    ))}
                  </div>
                  {/* Rows */}
                  {data.recent.map((m, i) => {
                    const gameIcon = m.game_type === "xadrez" ? "♟" : m.game_type === "ludo" ? "🎲" : "🎮";
                    const statusColor = m.isActive ? T.sky : m.botWon ? T.red : T.teal;
                    const statusBg    = m.isActive ? `${T.sky}18` : m.botWon ? `${T.red}18` : `${T.teal}18`;
                    const statusLabel = m.isActive ? "Ao vivo" : m.botWon ? "Bot ganhou" : "User ganhou";
                    const date = new Date(m.created_at);
                    const dateStr = `${date.getDate()} ${date.toLocaleDateString("pt-MZ",{month:"short"})}`;
                    return (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "36px 1fr 1fr 90px 80px 80px",
                          gap: 8, padding: "12px 24px",
                          borderBottom: i < data.recent.length - 1 ? `1px solid ${T.border}` : "none",
                          alignItems: "center",
                          transition: "background 0.15s",
                        }}
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.028)" }}>
                        <span style={{ fontSize: 17 }}>{gameIcon}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 600, color: T.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.player_name}</span>
                        <span style={{
                          fontSize: 12, color: T.sub,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.bot_name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>
                          {m.bet_amount} MT
                        </span>
                        <Pill label={statusLabel} color={statusColor} bg={statusBg} />
                        <span style={{ fontSize: 11, color: T.muted }}>{dateStr}</span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: T.muted }}>
          <Bot style={{ width: 44, height: 44, margin: "0 auto 14px", opacity: 0.25 }} />
          <p style={{ fontSize: 13 }}>Sem dados disponíveis</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.65; transform:scale(1.35); } }
      `}</style>
    </div>
  );
}

// Needed for AnimatePresence toggle button
function ChevronUp({ style }: { style?: React.CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 11, height: 11, ...style }}><polyline points="18 15 12 9 6 15"/></svg>;
}
function ChevronDown({ style }: { style?: React.CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 11, height: 11, ...style }}><polyline points="6 9 12 15 18 9"/></svg>;
}
