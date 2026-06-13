import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSupabase, useAdminRealtimeSync } from "@/admin/lib/supabase-api";
import { adminReEnable } from "@/lib/botBrain";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Trophy, TrendingDown, Gamepad2, Activity,
  Power, PowerOff, RefreshCw, ChevronDown, ChevronUp,
  Zap, ShieldOff, AlertTriangle, Shield, CheckCircle2,
  Crown, Swords, Brain,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:     "#07080f",
  card:   "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)",
  purple: "#7c3aed",
  green:  "#10b981",
  red:    "#ef4444",
  gold:   "#f59e0b",
  blue:   "#3b82f6",
  text:   "#e2e8f0",
  muted:  "rgba(255,255,255,0.38)",
};

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchBotData() {
  const [botRes, activeRes, totalRes] = await Promise.all([
    adminSupabase
      .from("matches")
      .select("id,game_type,status,bet_amount,winner_payout,winner_id,player1_id,player1_name,player2_name,created_at")
      .like("id", "bot_%"),
    adminSupabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "active"),
    adminSupabase.from("matches").select("id", { count: "exact", head: true }),
  ]);

  const all = (botRes.data ?? []) as Array<{
    id: string; game_type: string; status: string;
    bet_amount: number; winner_payout: number;
    winner_id: string | null; player1_id: string;
    player1_name: string; player2_name: string; created_at: string;
  }>;

  const finished = all.filter(m => m.status === "finished");
  const botWins  = finished.filter(m => !m.winner_id || m.winner_id !== m.player1_id);
  const userWins = finished.filter(m =>  m.winner_id && m.winner_id === m.player1_id);

  const byGame = (type: string) => {
    const g = all.filter(m => m.game_type === type);
    const gf = g.filter(m => m.status === "finished");
    return {
      total: g.length,
      active: g.filter(m => m.status === "active").length,
      botWins:  gf.filter(m => !m.winner_id || m.winner_id !== m.player1_id).length,
      userWins: gf.filter(m =>  m.winner_id && m.winner_id === m.player1_id).length,
    };
  };

  const totalBotCollected = botWins.reduce((s, m)  => s + (m.bet_amount ?? 0), 0);
  const totalUserPaid      = userWins.reduce((s, m) => s + (m.winner_payout ?? 0), 0);
  const winRate = finished.length > 0 ? Math.round((botWins.length / finished.length) * 100) : 0;

  const surplus = botWins.length - userWins.length;
  const autoDisable = surplus > 3;

  return {
    total: all.length,
    finished: finished.length,
    active: all.filter(m => m.status === "active").length,
    botWins: botWins.length,
    userWins: userWins.length,
    winRate,
    totalBotCollected,
    totalUserPaid,
    surplus,
    autoDisable,
    allActive: activeRes.count ?? 0,
    allTotal:  totalRes.count  ?? 0,
    dama:   byGame("dama"),
    xadrez: byGame("xadrez"),
    ludo:   byGame("ludo"),
    recent: [...all]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 20,
      padding: "20px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatRow({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0",
      borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function GameBlock({ icon, title, data }: {
  icon: string; title: string;
  data: { total: number; active: number; botWins: number; userWins: number };
}) {
  const fin = data.botWins + data.userWins;
  const rate = fin > 0 ? Math.round((data.botWins / fin) * 100) : 0;
  return (
    <GlassCard style={{ flex: 1, minWidth: 0 }}>
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
      <StatRow label="Total jogos"   value={data.total} />
      <StatRow label="Bot venceu"    value={data.botWins}  color={C.red}   />
      <StatRow label="User venceu"   value={data.userWins} color={C.green} />
      <div style={{ marginTop: 12, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${rate}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.purple})`, borderRadius: 4 }}
        />
      </div>
      <p style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>Taxa bot: {rate}%</p>
    </GlassCard>
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
  const [toggling, setToggling] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["bot-stats-v2"],
    queryFn: fetchBotData,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  // Real-time auto-disable detection
  useEffect(() => {
    if (!data) return;
    if (data.autoDisable && localStorage.getItem("wm_bots_autodisabled") !== "true") {
      localStorage.setItem("wm_bots_disabled", "true");
      localStorage.setItem("wm_bots_autodisabled", "true");
      setBotsEnabled(false);
    }
  }, [data]);

  function handleToggle() {
    if (toggling) return;
    const next = !botsEnabled;
    setToggling(true);
    if (next) {
      adminReEnable();
      localStorage.removeItem("wm_bots_autodisabled");
    } else {
      localStorage.setItem("wm_bots_disabled", "true");
    }
    setBotsEnabled(next);
    qc.invalidateQueries({ queryKey: ["bot-stats-v2"] });
    setTimeout(() => setToggling(false), 700);
  }

  const isAutoDisabled = !botsEnabled && (data?.autoDisable || autoDisabledFlag);

  return (
    <div style={{
      minHeight: "100%", padding: "24px 20px 40px",
      background: C.bg, color: C.text,
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.purple}33, ${C.blue}22)`,
            border: `1.5px solid ${C.purple}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px ${C.purple}22`,
          }}>
            <Brain style={{ width: 20, height: 20, color: C.purple }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Syne', sans-serif",
              background: `linear-gradient(135deg, ${C.text}, ${C.muted})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Gestão de Bots
            </h1>
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

          <motion.button onClick={handleToggle} disabled={toggling} whileTap={{ scale: 0.96 }}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
              fontFamily: "'Inter', sans-serif",
              background: botsEnabled
                ? `linear-gradient(135deg, ${C.green}, #059669)`
                : `linear-gradient(135deg, ${C.red}, #b91c1c)`,
              color: "#fff",
              boxShadow: botsEnabled
                ? `0 4px 20px ${C.green}40`
                : `0 4px 20px ${C.red}40`,
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
      <motion.div layout
        style={{
          borderRadius: 14, padding: "13px 16px", marginBottom: 20,
          border: `1px solid ${botsEnabled ? C.green : isAutoDisabled ? C.gold : C.red}30`,
          background: botsEnabled
            ? `rgba(16,185,129,0.06)`
            : isAutoDisabled
              ? `rgba(245,158,11,0.06)`
              : `rgba(239,68,68,0.06)`,
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
              ? "Bots activos — adversário automático disponível após 18-45 s de espera"
              : isAutoDisabled
                ? "Auto-desactivado pelo sistema — excesso de vitórias de bots detectado"
                : "Bots desactivados manualmente — nenhum adversário automático disponível"
            }
          </p>
          {isAutoDisabled && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>
              {data ? `Bot ganhou ${data.surplus} jogos a mais que os users.` : ""}
              {" "}Reativa manualmente após rever os dados.
            </p>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%",
            border: `3px solid ${C.purple}33`, borderTopColor: C.purple,
            animation: "spin 1s linear infinite" }} />
        </div>
      ) : data ? (
        <>
          {/* ── Intelligence System Section ── */}
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
                  icon={<Zap style={{ width: 14, height: 14, color: C.gold }} />}
                  label="Taxa vitória bot"
                  value={`${data.winRate}%`}
                  color={data.winRate > 68 ? C.red : data.winRate > 50 ? C.gold : C.green}
                  sub={`${data.finished} jogos terminados`}
                />
                <MiniStat
                  icon={<Shield style={{ width: 14, height: 14, color: C.blue }} />}
                  label="Auto-disable"
                  value={data.autoDisable ? "ACTIVO" : data.surplus > 2 ? "RISCO" : "SEGURO"}
                  color={data.autoDisable ? C.red : data.surplus > 2 ? C.gold : C.green}
                  sub={`gatilho: +3 vitórias`}
                />
              </div>

              {/* Progress bar showing bot win rate */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>EQUILÍBRIO BOT/USER</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{data.botWins}b / {data.userWins}u</span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${data.winRate}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{
                      height: "100%", borderRadius: 8,
                      background: data.winRate > 68
                        ? `linear-gradient(90deg, ${C.red}, #dc2626)`
                        : data.winRate > 50
                          ? `linear-gradient(90deg, ${C.gold}, #d97706)`
                          : `linear-gradient(90deg, ${C.green}, #059669)`,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: C.muted }}>0%</span>
                  <span style={{ fontSize: 9, color: C.gold }}>68% — limiar auto-disable</span>
                  <span style={{ fontSize: 9, color: C.muted }}>100%</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ── Platform Totals ── */}
          <SectionLabel icon={<Gamepad2 style={{ width: 12, height: 12 }} />} label="Plataforma" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <BigStat icon={<Gamepad2 />} label="Total de partidas" value={data.allTotal} color={C.purple} />
            <BigStat icon={<Activity />} label="A decorrer agora" value={data.allActive} color={C.green}
              pulse={data.allActive > 0} />
          </div>

          {/* ── Bot Stats ── */}
          <SectionLabel icon={<Bot style={{ width: 12, height: 12 }} />} label="Estatísticas dos Bots" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <BigStat icon={<Bot />} label="Jogos com bot" value={data.total} color={C.blue} />
            <BigStat icon={<Activity />} label="Bots ao vivo" value={data.active} color={C.green}
              pulse={data.active > 0} />
            <BigStat icon={<Trophy />} label="Bot venceu" value={data.botWins} color={C.red}
              sub={`≈ ${data.totalBotCollected} MT`} />
            <BigStat icon={<TrendingDown />} label="User venceu" value={data.userWins} color={C.green}
              sub={`≈ ${data.totalUserPaid} MT pago`} />
          </div>

          {/* ── By Game ── */}
          <SectionLabel icon={<Crown style={{ width: 12, height: 12 }} />} label="Por Jogo" />
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <GameBlock icon="🎮" title="Damas"  data={data.dama}   />
            <GameBlock icon="♟"  title="Xadrez" data={data.xadrez} />
            <GameBlock icon="🎲" title="Ludo"   data={data.ludo}   />
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
                <Gamepad2 style={{ width: 14, height: 14, color: C.purple }} />
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
                      {data.recent.map(m => {
                        const botWon = !m.winner_id || m.winner_id !== m.player1_id;
                        const active = m.status === "active";
                        const gameIcon = m.game_type === "xadrez" ? "♟" : m.game_type === "ludo" ? "🎲" : "🎮";
                        return (
                          <div key={m.id} style={{
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
                              <p style={{ margin: 0, fontSize: 10, color: C.muted }}>
                                {m.bet_amount} MT · {new Date(m.created_at).toLocaleDateString("pt-MZ", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                })}
                              </p>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7,
                              background: active ? `${C.blue}18` : botWon ? `${C.red}18` : `${C.green}18`,
                              color: active ? C.blue : botWon ? C.red : C.green,
                              border: `1px solid ${active ? C.blue : botWon ? C.red : C.green}28`,
                              flexShrink: 0,
                            }}>
                              {active ? "Ao vivo" : botWon ? "Bot ganhou" : "User ganhou"}
                            </span>
                          </div>
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
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
          <Bot style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.3 }} />
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

// ── Helper mini-components ───────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span style={{ color: C.muted }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        color: C.muted, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function BigStat({ icon, label, value, color, sub, pulse }:{
  icon: React.ReactNode; label: string; value: number | string;
  color: string; sub?: string; pulse?: boolean;
}) {
  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "18px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `${color}15`, border: `1px solid ${color}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color, position: "relative",
        }}>
          {React.cloneElement(icon as React.ReactElement, { style:{ width:14, height:14 } })}
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
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color, fontFamily: "'Syne', sans-serif",
        lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 10, color: C.muted }}>{sub}</p>}
    </motion.div>
  );
}

function MiniStat({ icon, label, value, color, sub }:{
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color, fontFamily:"'Syne',sans-serif" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>{sub}</p>}
    </div>
  );
}

import React from "react";
