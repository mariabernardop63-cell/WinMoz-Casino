import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminSupabase, useAdminRealtimeSync } from "@/admin/lib/supabase-api";
import {
  Bot, Trophy, TrendingDown, Gamepad2, Activity,
  Power, PowerOff, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const VIOLET = "#6C5CE7";
const GREEN  = "#10b981";
const RED    = "#ef4444";
const GOLD   = "#f59e0b";

function StatCard({
  icon: Icon, label, value, sub, color = VIOLET,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.03)", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${color}18`, border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1, fontFamily: "'Syne', sans-serif" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{sub}</p>}
    </motion.div>
  );
}

async function fetchBotStats() {
  const [botMatchesRes, activeRes, totalRes] = await Promise.all([
    adminSupabase.from("matches").select("*").like("id", "bot_%"),
    adminSupabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "active"),
    adminSupabase.from("matches").select("*", { count: "exact", head: true }),
  ]);

  const all = (botMatchesRes.data ?? []) as Array<{
    id: string; game_type: string; status: string;
    bet_amount: number; winner_payout: number;
    winner_id: string | null; winner_name: string | null;
    player1_id: string; player1_name: string; player2_name: string;
    created_at: string;
  }>;

  const finished = all.filter(m => m.status === "finished");
  const botWins  = finished.filter(m => m.winner_id === null || m.winner_id !== m.player1_id);
  const userWins = finished.filter(m => m.winner_id !== null && m.winner_id === m.player1_id);

  const damasAll   = all.filter(m => m.game_type === "dama");
  const xadrezAll  = all.filter(m => m.game_type === "xadrez");
  const damasFin   = damasAll.filter(m => m.status === "finished");
  const xadrezFin  = xadrezAll.filter(m => m.status === "finished");
  const damasBotW  = damasFin.filter(m => m.winner_id === null || m.winner_id !== m.player1_id);
  const damasUserW = damasFin.filter(m => m.winner_id !== null && m.winner_id === m.player1_id);
  const xadrezBotW = xadrezFin.filter(m => m.winner_id === null || m.winner_id !== m.player1_id);
  const xadrezUserW= xadrezFin.filter(m => m.winner_id !== null && m.winner_id === m.player1_id);

  const totalBotBet  = botWins.reduce((s, m) => s + (m.bet_amount ?? 0), 0);
  const totalUserWon = userWins.reduce((s, m) => s + (m.winner_payout ?? 0), 0);

  return {
    total: all.length,
    finished: finished.length,
    botWins: botWins.length,
    userWins: userWins.length,
    totalBotBet,
    totalUserWon,
    activeNow: activeRes.count ?? 0,
    totalAllMatches: totalRes.count ?? 0,
    damas: { total: damasAll.length, botWins: damasBotW.length, userWins: damasUserW.length },
    xadrez: { total: xadrezAll.length, botWins: xadrezBotW.length, userWins: xadrezUserW.length },
    recent: [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
  };
}

export default function BotManagement() {
  useAdminRealtimeSync();

  const [botsEnabled, setBotsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("wm_bots_disabled") !== "true";
  });
  const [showRecent, setShowRecent] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bot-stats"],
    queryFn: fetchBotStats,
    refetchInterval: 30_000,
  });

  function handleToggle() {
    setToggling(true);
    const newVal = !botsEnabled;
    setBotsEnabled(newVal);
    localStorage.setItem("wm_bots_disabled", newVal ? "false" : "true");
    setTimeout(() => setToggling(false), 600);
  }

  const winRate = data && data.finished > 0
    ? Math.round((data.botWins / data.finished) * 100)
    : 0;

  return (
    <div style={{
      minHeight: "100%", padding: "28px 24px",
      background: "#0b0b18", color: "#fff",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: `${VIOLET}22`, border: `1.5px solid ${VIOLET}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot style={{ width: 20, height: 20, color: VIOLET }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", margin: 0 }}>
              Gestão de Bots
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
              Damas · Xadrez
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Actualizar dados"
          >
            <RefreshCw style={{ width: 14, height: 14, color: isFetching ? VIOLET : "rgba(255,255,255,0.5)",
              animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>

          {/* Toggle Bots */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 16px", borderRadius: 12, border: "none", cursor: "pointer",
              background: botsEnabled
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              boxShadow: botsEnabled
                ? "0 0 20px rgba(16,185,129,0.3)"
                : "0 0 20px rgba(239,68,68,0.3)",
              transition: "all 0.3s",
            }}
          >
            {botsEnabled
              ? <><Power style={{ width: 14, height: 14 }} /> Bots Activos</>
              : <><PowerOff style={{ width: 14, height: 14 }} /> Bots Desactivados</>
            }
          </button>
        </div>
      </div>

      {/* Bot status banner */}
      <motion.div
        animate={{ opacity: 1 }} initial={{ opacity: 0 }}
        style={{
          padding: "12px 16px", borderRadius: 14, marginBottom: 24,
          background: botsEnabled ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${botsEnabled ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: botsEnabled ? GREEN : RED,
          boxShadow: `0 0 8px ${botsEnabled ? GREEN : RED}`,
          animation: botsEnabled ? "pulse 2s infinite" : "none",
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: botsEnabled ? GREEN : RED }}>
          {botsEnabled
            ? "Bots activados — jogadores sem adversário após 45s encontram um adversário automático (Damas e Xadrez)"
            : "Bots desactivados — a opção de adversário automático está desligada em toda a plataforma"
          }
        </span>
      </motion.div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%",
            border: "3px solid rgba(108,92,231,0.2)", borderTopColor: VIOLET,
            animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* Global platform stats */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", marginBottom: 12 }}>
            Partidas na Plataforma
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <StatCard icon={Gamepad2} label="Total de partidas" value={data?.totalAllMatches ?? 0} color={VIOLET} />
            <StatCard icon={Activity} label="A decorrer agora" value={data?.activeNow ?? 0}
              sub="status: active" color={GREEN} />
          </div>

          {/* Bot stats */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", marginBottom: 12 }}>
            Estatísticas dos Bots
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <StatCard icon={Gamepad2} label="Partidas c/ bot" value={data?.total ?? 0} color={VIOLET} />
            <StatCard icon={Activity} label="Taxa de vitória bot" value={`${winRate}%`}
              sub={`${data?.finished ?? 0} jogos terminados`} color={GOLD} />
            <StatCard icon={Trophy} label="Bot ganhou" value={data?.botWins ?? 0}
              sub={`≈ ${data?.totalBotBet ?? 0} MT arrecadados`} color={RED} />
            <StatCard icon={TrendingDown} label="User ganhou" value={data?.userWins ?? 0}
              sub={`≈ ${data?.totalUserWon ?? 0} MT pagos`} color={GREEN} />
          </div>

          {/* By game type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)", padding: "16px 18px",
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
                🎮 Damas
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Total", data?.damas.total ?? 0, "rgba(255,255,255,0.6)"],
                  ["Bot ganhou", data?.damas.botWins ?? 0, RED],
                  ["User ganhou", data?.damas.userWins ?? 0, GREEN],
                ].map(([label, val, color]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: color as string }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)", padding: "16px 18px",
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
                ♟ Xadrez
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Total", data?.xadrez.total ?? 0, "rgba(255,255,255,0.6)"],
                  ["Bot ganhou", data?.xadrez.botWins ?? 0, RED],
                  ["User ganhou", data?.xadrez.userWins ?? 0, GREEN],
                ].map(([label, val, color]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: color as string }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent bot matches */}
          {data && data.recent.length > 0 && (
            <>
              <button
                onClick={() => setShowRecent(s => !s)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: "13px 16px", cursor: "pointer", color: "#fff",
                  marginBottom: showRecent ? 12 : 0,
                }}
              >
                <Gamepad2 style={{ width: 15, height: 15, color: VIOLET }} />
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: "left" }}>
                  Últimas partidas com bot ({data.recent.length})
                </span>
                {showRecent ? <ChevronUp style={{ width: 15, height: 15 }} /> : <ChevronDown style={{ width: 15, height: 15 }} />}
              </button>

              <AnimatePresence>
                {showRecent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.recent.map(m => {
                        const botWon = m.winner_id === null || m.winner_id !== m.player1_id;
                        const isActive = m.status === "active";
                        return (
                          <div key={m.id} style={{
                            background: "rgba(255,255,255,0.02)", borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.06)",
                            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <span style={{ fontSize: 18 }}>{m.game_type === "xadrez" ? "♟" : "🎮"}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.player1_name} vs {m.player2_name}
                              </p>
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                                {m.bet_amount} MT · {new Date(m.created_at).toLocaleDateString("pt-MZ")}
                              </p>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                              background: isActive
                                ? "rgba(16,185,129,0.15)"
                                : botWon ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                              color: isActive ? GREEN : botWon ? RED : GREEN,
                              border: `1px solid ${isActive ? GREEN : botWon ? RED : GREEN}30`,
                              flexShrink: 0,
                            }}>
                              {isActive ? "A decorrer" : botWon ? "Bot ganhou" : "User ganhou"}
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
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
