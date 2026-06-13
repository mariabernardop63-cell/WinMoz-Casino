import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSupabase, useAdminRealtimeSync } from "@/admin/lib/supabase-api";
import { adminReEnable } from "@/lib/botBrain";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  Bot, Trophy, TrendingDown, Gamepad2, Activity,
  Power, PowerOff, RefreshCw, ChevronDown, ChevronUp,
  Zap, ShieldOff, AlertTriangle, Shield, CheckCircle2,
  Crown, Swords, Brain, TrendingUp, Wallet, Edit3,
  Check, X, DollarSign, BarChart3, Flame, Target,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#060810",
  card:    "rgba(255,255,255,0.034)",
  border:  "rgba(255,255,255,0.075)",
  purple:  "#7c3aed",
  green:   "#10b981",
  red:     "#ef4444",
  gold:    "#f59e0b",
  blue:    "#3b82f6",
  cyan:    "#06b6d4",
  text:    "#e2e8f0",
  muted:   "rgba(255,255,255,0.38)",
  card2:   "rgba(255,255,255,0.055)",
};

// ── Animated counter hook ─────────────────────────────────────────────────────
function useAnimatedNumber(value: number, decimals = 0) {
  const prev = useRef(value);
  const mv = useMotionValue(prev.current);
  const spring = useSpring(mv, { stiffness: 90, damping: 18 });
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    mv.set(value);
    prev.current = value;
  }, [value, mv]);
  useEffect(() => {
    return spring.on("change", v => {
      setDisplay(parseFloat(v.toFixed(decimals)));
    });
  }, [spring, decimals]);
  return display;
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchBotData() {
  const TWO_HOURS_MS  = 2 * 60 * 60 * 1000;
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  const [betRes, winRes, profileRes, totalBetsRes] = await Promise.all([
    adminSupabase
      .from("transactions")
      .select("id,user_id,amount,description,created_at")
      .eq("type", "bet")
      .eq("status", "approved")
      .ilike("description", "%[bot]%")
      .order("created_at", { ascending: false })
      .limit(500),
    adminSupabase
      .from("transactions")
      .select("user_id,amount,created_at")
      .eq("type", "win")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    adminSupabase.from("profiles").select("id,full_name,phone"),
    adminSupabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", "bet")
      .eq("status", "approved"),
  ]);

  type BetRow = { id: string; user_id: string; amount: number; description: string; created_at: string };
  type WinRow = { user_id: string; amount: number; created_at: string };

  const botBets   = (betRes.data  ?? []) as BetRow[];
  const allWins   = (winRes.data  ?? []) as WinRow[];
  const profileMap = new Map(
    ((profileRes.data ?? []) as Array<{ id: string; full_name?: string; phone?: string }>)
      .map(p => [p.id, p.full_name || p.phone || "—"])
  );

  const sortedBets = [...botBets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const now = Date.now();
  const usedWinIndices = new Set<number>();

  const parseGame = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes("xadrez")) return "xadrez";
    if (d.includes("ludo"))   return "ludo";
    return "dama";
  };
  const extractBot = (desc: string) => {
    const m = desc.match(/vs (.+)$/i);
    return m ? m[1].trim() : "Bot";
  };

  const classified = sortedBets.map(bet => {
    const betTime = new Date(bet.created_at).getTime();
    const ageMs   = now - betTime;

    const winIdx = allWins.findIndex((w, i) => {
      if (usedWinIndices.has(i)) return false;
      const wt = new Date(w.created_at).getTime();
      return w.user_id === bet.user_id && wt >= betTime && wt <= betTime + FOUR_HOURS_MS;
    });

    const win = winIdx >= 0 ? allWins[winIdx] : null;
    if (winIdx >= 0) usedWinIndices.add(winIdx);

    const gameEnded = !!win;
    const isActive  = !gameEnded && ageMs < TWO_HOURS_MS;
    const userWon   = gameEnded && (win!.amount ?? 0) > 0;
    const botWon    = (!gameEnded && !isActive) || (gameEnded && (win!.amount ?? 0) === 0);
    const gameType  = parseGame(bet.description);

    return { ...bet, isActive, userWon, botWon, gameType };
  });

  const classifiedDesc = [...classified].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const active   = classified.filter(m => m.isActive);
  const finished = classified.filter(m => !m.isActive);
  const botWins  = finished.filter(m => m.botWon);
  const userWins = finished.filter(m => m.userWon);

  const winRate = finished.length > 0
    ? Math.round((botWins.length / finished.length) * 100) : 0;

  // Bot ganhou = ficou com o dinheiro da aposta
  const totalBotGanhou = botWins.reduce((s, m)  => s + Math.abs(m.amount ?? 0), 0);
  // Bot perdeu = pagou ao user (90% × 2 × aposta)
  const totalBotPerdeu = userWins.reduce((s, m) => s + Math.floor(Math.abs(m.amount) * 2 * 0.90), 0);
  // Saldo líquido do bot (positivo = lucro para a plataforma)
  const saldoLiquido = totalBotGanhou - totalBotPerdeu;

  const surplus    = botWins.length - userWins.length;
  const autoDisable = surplus > 3;

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
    total:    botBets.length,
    finished: finished.length,
    active:   active.length,
    botWins:  botWins.length,
    userWins: userWins.length,
    winRate,
    totalBotGanhou,
    totalBotPerdeu,
    saldoLiquido,
    surplus,
    autoDisable,
    allActive: active.length,
    allTotal:  totalBetsRes.count ?? 0,
    dama:   byGame("dama"),
    xadrez: byGame("xadrez"),
    ludo:   byGame("ludo"),
    recent: classifiedDesc.slice(0, 15).map(m => ({
      id:            m.id,
      game_type:     m.gameType,
      status:        m.isActive ? "active" : "finished",
      bet_amount:    Math.abs(m.amount),
      userWon:       m.userWon,
      botWon:        m.botWon,
      player1_name:  profileMap.get(m.user_id) ?? "—",
      player2_name:  extractBot(m.description),
      created_at:    m.created_at,
    })),
  };
}

// ── Animated saldo card ───────────────────────────────────────────────────────
function SaldoCard({ saldo, perdeu, ganhou }: { saldo: number; perdeu: number; ganhou: number }) {
  const animSaldo  = useAnimatedNumber(saldo,  0);
  const animGanhou = useAnimatedNumber(ganhou, 0);
  const animPerdeu = useAnimatedNumber(perdeu, 0);
  const positive   = saldo >= 0;
  const accent     = positive ? C.green : C.red;
  const prevSaldo  = useRef(saldo);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (saldo === prevSaldo.current) return;
    setFlash(saldo > prevSaldo.current ? "up" : "down");
    prevSaldo.current = saldo;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [saldo]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        borderRadius: 24,
        padding: "28px 24px",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
        background: positive
          ? "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.07) 100%)"
          : "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(245,158,11,0.07) 100%)",
        border: `1.5px solid ${accent}35`,
        boxShadow: `0 0 60px ${accent}15, 0 8px 40px rgba(0,0,0,0.4)`,
      }}>
      {/* glow blob */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: `${accent}18`, filter: "blur(40px)", pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `${accent}20`, border: `1px solid ${accent}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Wallet style={{ width: 15, height: 15, color: accent }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: C.muted, textTransform: "uppercase" }}>
              Saldo Líquido do Bot • Tempo Real
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={flash ?? "idle"}
              initial={{ opacity: 0, y: flash === "up" ? 10 : flash === "down" ? -10 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{
                fontSize: 48, fontWeight: 900, lineHeight: 1,
                fontFamily: "'Syne', sans-serif",
                color: accent,
                textShadow: `0 0 30px ${accent}50`,
              }}>
                {positive ? "+" : ""}{animSaldo.toLocaleString()}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: `${accent}cc` }}>MT</span>
            </motion.div>
          </AnimatePresence>

          <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted }}>
            {positive
              ? "A plataforma está a lucrar com os bots"
              : "A plataforma está a pagar mais do que recolhe"}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {flash === "up" && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ fontSize: 11, fontWeight: 700, color: C.green, textAlign: "right" }}>
              ▲ Bot ganhou
            </motion.div>
          )}
          {flash === "down" && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ fontSize: 11, fontWeight: 700, color: C.red, textAlign: "right" }}>
              ▼ User ganhou
            </motion.div>
          )}
        </div>
      </div>

      {/* Mini breakdown */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 12, marginTop: 20,
      }}>
        <div style={{
          borderRadius: 14, padding: "14px 16px",
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <TrendingUp style={{ width: 12, height: 12, color: C.green }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Bot Ganhou
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "'Syne',sans-serif" }}>
            +{animGanhou.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600 }}>MT</span>
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 10, color: C.muted }}>recolhido das apostas perdidas</p>
        </div>
        <div style={{
          borderRadius: 14, padding: "14px 16px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <TrendingDown style={{ width: 12, height: 12, color: C.red }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Bot Perdeu
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.red, fontFamily: "'Syne',sans-serif" }}>
            -{animPerdeu.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600 }}>MT</span>
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 10, color: C.muted }}>pago aos utilizadores vencedores</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Loss limit editor ─────────────────────────────────────────────────────────
function LossLimitCard({
  limit, setLimit, currentLoss, botsEnabled, onTrigger,
}: {
  limit: number; setLimit: (v: number) => void;
  currentLoss: number; botsEnabled: boolean; onTrigger: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(limit));
  const pct = limit > 0 ? Math.min(100, Math.round((currentLoss / limit) * 100)) : 0;
  const danger = pct >= 80;
  const color  = pct >= 100 ? C.red : pct >= 80 ? C.gold : C.green;

  // Auto-trigger when limit breached
  useEffect(() => {
    if (limit > 0 && currentLoss >= limit && botsEnabled) {
      onTrigger();
    }
  }, [currentLoss, limit, botsEnabled, onTrigger]);

  function save() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v > 0) { setLimit(v); }
    setEditing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      style={{
        borderRadius: 20, padding: "20px 20px", marginBottom: 24,
        background: danger
          ? "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.06))"
          : "rgba(255,255,255,0.034)",
        border: `1.5px solid ${danger ? C.red : C.border}33`,
        boxShadow: danger ? `0 0 30px ${C.red}15` : "none",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${danger ? C.red : C.gold}18`, border: `1px solid ${danger ? C.red : C.gold}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Target style={{ width: 14, height: 14, color: danger ? C.red : C.gold }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>Limite de Perda</p>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>Bot desliga automaticamente ao atingir</p>
          </div>
        </div>

        {!editing ? (
          <button onClick={() => { setDraft(String(limit)); setEditing(true); }} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            borderRadius: 8, border: `1px solid ${C.border}`, background: C.card,
            cursor: "pointer", color: C.muted, fontSize: 11, fontWeight: 600,
          }}>
            <Edit3 style={{ width: 11, height: 11 }} />Editar
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              style={{
                width: 80, padding: "5px 8px", borderRadius: 8,
                border: `1.5px solid ${C.purple}`, background: "rgba(255,255,255,0.06)",
                color: C.text, fontSize: 13, fontWeight: 700,
                outline: "none", fontFamily: "'Inter',sans-serif",
              }}
            />
            <span style={{ fontSize: 11, color: C.muted }}>MT</span>
            <button onClick={save} style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: `${C.green}25`, cursor: "pointer", color: C.green,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Check style={{ width: 12, height: 12 }} /></button>
            <button onClick={() => setEditing(false)} style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: `${C.red}20`, cursor: "pointer", color: C.red,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><X style={{ width: 12, height: 12 }} /></button>
          </div>
        )}
      </div>

      {/* Current vs limit */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: C.muted }}>Perda actual do bot</span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>
          {currentLoss.toLocaleString()} MT <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>/ {limit.toLocaleString()} MT</span>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            height: "100%", borderRadius: 8,
            background: pct >= 100
              ? `linear-gradient(90deg, ${C.red}, #dc2626)`
              : pct >= 80
                ? `linear-gradient(90deg, ${C.gold}, ${C.red})`
                : `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 9, color: C.muted }}>0 MT</span>
        <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pct}% do limite</span>
        <span style={{ fontSize: 9, color: C.muted }}>{limit.toLocaleString()} MT</span>
      </div>

      {pct >= 100 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 10,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
          <AlertTriangle style={{ width: 12, height: 12, color: C.red, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>
            Limite atingido — Bots desligados automaticamente
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Glass card wrapper ────────────────────────────────────────────────────────
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 20, padding: "20px", ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span style={{ color: C.muted }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
        color: C.muted, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub, pulse, delay = 0 }: {
  icon: React.ReactNode; label: string; value: number | string;
  color: string; sub?: string; pulse?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "18px",
        position: "relative", overflow: "hidden",
      }}>
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        borderRadius: "50%", background: `${color}0a`, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `${color}15`, border: `1px solid ${color}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color, position: "relative",
        }}>
          {React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties }>, { style: { width: 14, height: 14 } })}
          {pulse && (
            <span style={{
              position: "absolute", top: -2, right: -2, width: 7, height: 7,
              borderRadius: "50%", background: color,
              animation: "pulse-dot 1.8s ease-in-out infinite",
            }} />
          )}
        </div>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{
        margin: 0, fontSize: 28, fontWeight: 800, color,
        fontFamily: "'Syne', sans-serif", lineHeight: 1,
      }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 10, color: C.muted }}>{sub}</p>}
    </motion.div>
  );
}

// ── Mini stat ─────────────────────────────────────────────────────────────────
function MiniStat({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color, fontFamily: "'Syne',sans-serif" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>{sub}</p>}
    </div>
  );
}

// ── Game block ────────────────────────────────────────────────────────────────
function GameBlock({ icon, title, data, delay = 0 }: {
  icon: string; title: string;
  data: { total: number; active: number; botWins: number; userWins: number };
  delay?: number;
}) {
  const fin  = data.botWins + data.userWins;
  const rate = fin > 0 ? Math.round((data.botWins / fin) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        flex: 1, minWidth: 0,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "18px",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        {data.active > 0 && (
          <span style={{
            marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px",
            borderRadius: 6, background: "rgba(16,185,129,0.15)", color: C.green,
            border: `1px solid ${C.green}30`,
          }}>{data.active} ao vivo</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { label: "Total jogos", val: data.total, color: C.text },
          { label: "Bot venceu",  val: data.botWins, color: C.red },
          { label: "User venceu", val: data.userWins, color: C.green },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.muted }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.val}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${rate}%` }} transition={{ duration: 0.8, delay: delay + 0.3 }}
          style={{ height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.purple})`, borderRadius: 4 }}
        />
      </div>
      <p style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>Taxa bot: {rate}%</p>
    </motion.div>
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
  const [toggling,    setToggling]   = useState(false);
  const [showRecent,  setShowRecent] = useState(false);
  const [limitTriggered, setLimitTriggered] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["bot-stats-v3"],
    queryFn:  fetchBotData,
    refetchInterval: 15_000,
    staleTime:       10_000,
  });

  function setLossLimit(v: number) {
    setLossLimitState(v);
    localStorage.setItem("wm_bot_loss_limit", String(v));
  }

  // Auto-disable by surplus
  useEffect(() => {
    if (!data) return;
    if (data.autoDisable && localStorage.getItem("wm_bots_autodisabled") !== "true") {
      localStorage.setItem("wm_bots_disabled", "true");
      localStorage.setItem("wm_bots_autodisabled", "true");
      setBotsEnabled(false);
    }
  }, [data]);

  // Auto-disable by loss limit
  function handleLossLimitTrigger() {
    if (!botsEnabled) return;
    localStorage.setItem("wm_bots_disabled", "true");
    localStorage.setItem("wm_bots_autodisabled", "true");
    setBotsEnabled(false);
    setLimitTriggered(true);
    qc.invalidateQueries({ queryKey: ["bot-stats-v3"] });
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
    qc.invalidateQueries({ queryKey: ["bot-stats-v3"] });
    setTimeout(() => setToggling(false), 700);
  }

  const isAutoDisabled = !botsEnabled && (data?.autoDisable || autoDisabledFlag || limitTriggered);
  const currentLoss    = data ? Math.max(0, data.totalBotPerdeu - data.totalBotGanhou) : 0;

  return (
    <div style={{
      minHeight: "100%", padding: "24px 20px 48px",
      background: C.bg, color: C.text,
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <motion.div
            animate={{ boxShadow: [`0 0 20px ${C.purple}30`, `0 0 40px ${C.purple}50`, `0 0 20px ${C.purple}30`] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{
              width: 46, height: 46, borderRadius: 14,
              background: `linear-gradient(135deg, ${C.purple}30, ${C.blue}20)`,
              border: `1.5px solid ${C.purple}45`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Brain style={{ width: 21, height: 21, color: C.purple }} />
          </motion.div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 19, fontWeight: 800, fontFamily: "'Syne', sans-serif",
              background: `linear-gradient(135deg, ${C.text}, ${C.muted})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Gestão de Bots</h1>
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Sistema inteligente adaptativo</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => refetch()} disabled={isFetching} title="Actualizar"
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.card, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw style={{ width: 14, height: 14, color: isFetching ? C.purple : C.muted,
              animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>

          <motion.button onClick={handleToggle} disabled={toggling} whileTap={{ scale: 0.95 }}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
              borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
              fontFamily: "'Inter', sans-serif",
              background: botsEnabled
                ? `linear-gradient(135deg, ${C.green}, #059669)`
                : `linear-gradient(135deg, ${C.red}, #b91c1c)`,
              color: "#fff",
              boxShadow: botsEnabled ? `0 4px 20px ${C.green}40` : `0 4px 20px ${C.red}40`,
              transition: "all 0.3s",
            }}>
            {botsEnabled
              ? <><Power style={{ width: 13, height: 13 }} />Bots Activos</>
              : <><PowerOff style={{ width: 13, height: 13 }} />Desactivados</>
            }
          </motion.button>
        </div>
      </div>

      {/* ── Status Banner ── */}
      <motion.div layout style={{
        borderRadius: 14, padding: "13px 16px", marginBottom: 20,
        border: `1px solid ${botsEnabled ? C.green : isAutoDisabled ? C.gold : C.red}30`,
        background: botsEnabled
          ? "rgba(16,185,129,0.06)"
          : isAutoDisabled ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        {botsEnabled
          ? <CheckCircle2 style={{ width: 16, height: 16, color: C.green, flexShrink: 0, marginTop: 1 }} />
          : isAutoDisabled
            ? <AlertTriangle style={{ width: 16, height: 16, color: C.gold, flexShrink: 0, marginTop: 1 }} />
            : <ShieldOff style={{ width: 16, height: 16, color: C.red, flexShrink: 0, marginTop: 1 }} />
        }
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700,
            color: botsEnabled ? C.green : isAutoDisabled ? C.gold : C.red }}>
            {botsEnabled
              ? "Bots activos — adversário automático disponível após 18–45 s de espera"
              : limitTriggered
                ? "Auto-desactivado — limite de perda atingido"
                : isAutoDisabled
                  ? "Auto-desactivado — excesso de vitórias de bots detectado"
                  : "Bots desactivados manualmente"
            }
          </p>
          {isAutoDisabled && data && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>
              {limitTriggered
                ? `Perda acumulada ultrapassou ${lossLimit} MT. Reativa manualmente após rever os dados.`
                : `Bot ganhou ${data.surplus} jogos a mais que os users. Reativa manualmente.`
              }
            </p>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%",
            border: `3px solid ${C.purple}33`, borderTopColor: C.purple,
            animation: "spin 1s linear infinite" }} />
        </div>
      ) : data ? (
        <>
          {/* ── Saldo líquido em tempo real ── */}
          <SaldoCard
            saldo={data.saldoLiquido}
            ganhou={data.totalBotGanhou}
            perdeu={data.totalBotPerdeu}
          />

          {/* ── Loss limit ── */}
          <LossLimitCard
            limit={lossLimit}
            setLimit={setLossLimit}
            currentLoss={currentLoss}
            botsEnabled={botsEnabled}
            onTrigger={handleLossLimitTrigger}
          />

          {/* ── Intelligence System ── */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel icon={<Brain style={{ width: 12, height: 12 }} />} label="Sistema Inteligente" />
            <GlassCard>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <MiniStat
                  icon={<Swords style={{ width: 14, height: 14, color: C.purple }} />}
                  label="Excedente bots"
                  value={data.surplus > 0 ? `+${data.surplus}` : String(data.surplus)}
                  color={data.surplus > 3 ? C.red : data.surplus > 1 ? C.gold : C.green}
                  sub="vitórias a mais"
                />
                <MiniStat
                  icon={<Flame style={{ width: 14, height: 14, color: C.gold }} />}
                  label="Taxa vitória bot"
                  value={`${data.winRate}%`}
                  color={data.winRate > 68 ? C.red : data.winRate > 50 ? C.gold : C.green}
                  sub={`${data.finished} finalizados`}
                />
                <MiniStat
                  icon={<Shield style={{ width: 14, height: 14, color: C.blue }} />}
                  label="Auto-disable"
                  value={data.autoDisable ? "ACTIVO" : data.surplus > 2 ? "RISCO" : "SEGURO"}
                  color={data.autoDisable ? C.red : data.surplus > 2 ? C.gold : C.green}
                  sub="gatilho: +3 vitórias"
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: 0.8 }}>
                    EQUILÍBRIO BOT / USER
                  </span>
                  <span style={{ fontSize: 10, color: C.muted }}>
                    {data.botWins} bot / {data.userWins} user
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${data.winRate}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{
                      height: "100%", borderRadius: 8,
                      background: data.winRate > 68
                        ? `linear-gradient(90deg, ${C.red}, #dc2626)`
                        : data.winRate > 50
                          ? `linear-gradient(90deg, ${C.gold}, #d97706)`
                          : `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: C.muted }}>0%</span>
                  <span style={{ fontSize: 9, color: C.gold }}>68% — limiar</span>
                  <span style={{ fontSize: 9, color: C.muted }}>100%</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ── Platform Totals ── */}
          <SectionLabel icon={<Gamepad2 style={{ width: 12, height: 12 }} />} label="Plataforma" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <StatCard icon={<Gamepad2 />}  label="Total apostas"  value={data.allTotal} color={C.purple} delay={0} />
            <StatCard icon={<Activity />}  label="A decorrer"     value={data.allActive} color={C.green}
              pulse={data.allActive > 0} delay={0.05} />
          </div>

          {/* ── Bot Stats ── */}
          <SectionLabel icon={<Bot style={{ width: 12, height: 12 }} />} label="Estatísticas dos Bots" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <StatCard icon={<Bot />}         label="Jogos com bot"  value={data.total}    color={C.blue}  delay={0}    />
            <StatCard icon={<Activity />}    label="Bots ao vivo"   value={data.active}   color={C.green} pulse={data.active > 0} delay={0.05} />
            <StatCard icon={<Trophy />}      label="Bot venceu"     value={data.botWins}  color={C.red}
              sub={`${data.totalBotGanhou.toLocaleString()} MT recolhidos`} delay={0.1} />
            <StatCard icon={<TrendingDown />} label="User venceu"   value={data.userWins} color={C.green}
              sub={`${data.totalBotPerdeu.toLocaleString()} MT pagos`} delay={0.15} />
          </div>

          {/* ── By Game ── */}
          <SectionLabel icon={<Crown style={{ width: 12, height: 12 }} />} label="Por Jogo" />
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <GameBlock icon="🎮" title="Damas"  data={data.dama}   delay={0}    />
            <GameBlock icon="♟"  title="Xadrez" data={data.xadrez} delay={0.07} />
            <GameBlock icon="🎲" title="Ludo"   data={data.ludo}   delay={0.14} />
          </div>

          {/* ── Recent Matches ── */}
          {data.recent.length > 0 && (
            <>
              <button onClick={() => setShowRecent(s => !s)} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: "12px 16px", cursor: "pointer", color: C.text,
                marginBottom: showRecent ? 12 : 0,
              }}>
                <BarChart3 style={{ width: 14, height: 14, color: C.purple }} />
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: "left" }}>
                  Últimas partidas com bot ({data.recent.length})
                </span>
                {showRecent
                  ? <ChevronUp style={{ width: 14, height: 14, color: C.muted }} />
                  : <ChevronDown style={{ width: 14, height: 14, color: C.muted }} />
                }
              </button>

              <AnimatePresence>
                {showRecent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.recent.map((m, i) => {
                        const active   = m.status === "active";
                        const gameIcon = m.game_type === "xadrez" ? "♟" : m.game_type === "ludo" ? "🎲" : "🎮";
                        const accentC  = active ? C.blue : m.botWon ? C.red : C.green;
                        const label    = active ? "Ao vivo" : m.botWon ? "Bot ganhou" : "User ganhou";
                        return (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              background: C.card, border: `1px solid ${C.border}`,
                              borderRadius: 12, padding: "10px 14px",
                            }}>
                            <span style={{ fontSize: 16 }}>{gameIcon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.text,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.player1_name} vs {m.player2_name}
                              </p>
                              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>
                                Aposta: {m.bet_amount} MT • {new Date(m.created_at).toLocaleDateString("pt-MZ")}
                              </p>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "3px 10px",
                              borderRadius: 8, whiteSpace: "nowrap",
                              background: `${accentC}18`, color: accentC,
                              border: `1px solid ${accentC}30`, flexShrink: 0,
                            }}>{label}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 48, color: C.muted }}>
          <Bot style={{ width: 42, height: 42, margin: "0 auto 14px", opacity: 0.3 }} />
          <p>Sem dados disponíveis</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.6; transform:scale(1.3); } }
      `}</style>
    </div>
  );
}
