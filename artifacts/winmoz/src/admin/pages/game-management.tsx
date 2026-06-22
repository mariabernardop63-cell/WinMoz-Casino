import { useState, useEffect, useRef } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Clock, Users, Zap, RefreshCw, Search, Wifi } from "lucide-react";

interface QueueEntry {
  id: string;
  playerId: string;
  playerName: string;
  game: string;
  bet: number;
  since: Date;
  status: string;
}

function gameLabel(g: string) {
  const m: Record<string, string> = {
    damas: "Damas", ludo: "Ludo", xadrez: "Xadrez", chess: "Xadrez",
    bilhar: "Bilhar", roleta: "Roleta",
  };
  return m[g?.toLowerCase()] ?? g ?? "—";
}

function gameColor(g: string): string {
  const m: Record<string, string> = {
    damas: "#f59e0b", ludo: "#22c55e", xadrez: "#8b5cf6",
    chess: "#8b5cf6", bilhar: "#06b6d4", roleta: "#ec4899",
  };
  return m[g?.toLowerCase()] ?? "#6366f1";
}

function elapsed(since: Date): string {
  const s = Math.floor((Date.now() - since.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtMZN(v: number) {
  return `${Number(v).toLocaleString("pt-PT")} MT`;
}

export default function GameManagement() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [tick, setTick] = useState(0);
  const channelRef = useRef<any>(null);

  async function fetchQueue() {
    setLoading(true);
    try {
      const { data } = await adminSupabase
        .from("game_rooms")
        .select("id, status, game_type, bet_amount, creator_id, created_at, creator:profiles!creator_id(full_name, phone)")
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const entries: QueueEntry[] = data.map((r: any) => ({
          id: r.id,
          playerId: r.creator_id ?? "",
          playerName: r.creator?.full_name ?? r.creator?.phone ?? "Utilizador",
          game: r.game_type ?? "damas",
          bet: parseFloat(r.bet_amount ?? 0),
          since: new Date(r.created_at),
          status: r.status,
        }));
        setQueue(entries);
      } else {
        setQueue([]);
      }
    } catch {
      setQueue([]);
    }
    setLoading(false);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    fetchQueue();

    channelRef.current = adminSupabase
      .channel("matchmaking-queue-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms" },
        () => fetchQueue()
      )
      .subscribe();

    const ticker = setInterval(() => setTick(t => t + 1), 1000);

    return () => {
      if (channelRef.current) adminSupabase.removeChannel(channelRef.current);
      clearInterval(ticker);
    };
  }, []);

  return (
    <div style={{ padding: "28px 24px", fontFamily: "inherit", minHeight: "100vh", background: "var(--gz-bg-main, #0f0f18)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,0.15)", border: "1.5px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gamepad2 style={{ width: 22, height: 22, color: "#818cf8" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--gz-text-primary, #e8f0ff)", margin: 0 }}>Gestão de Jogos</h1>
            <p style={{ fontSize: 12, color: "var(--gz-text-tertiary, rgba(255,255,255,0.35))", margin: 0, marginTop: 2 }}>
              Fila de matchmaking em tempo real
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Live</span>
          </div>
          <button
            onClick={fetchQueue}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Na fila agora", value: queue.length, icon: Search, color: "#818cf8" },
          { label: "Última actualização", value: `${lastRefresh.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, icon: Clock, color: "#06b6d4", small: true },
          { label: "Jogos activos", value: "—", icon: Zap, color: "#f59e0b" },
        ].map(({ label, value, icon: Icon, color, small }) => (
          <div key={label} style={{ padding: "16px 18px", borderRadius: 14, background: "var(--gz-bg-card, rgba(255,255,255,0.04))", border: "1px solid var(--gz-border, rgba(255,255,255,0.07))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon style={{ width: 14, height: 14, color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gz-text-tertiary, rgba(255,255,255,0.4))", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
            </div>
            <span style={{ fontSize: small ? 16 : 26, fontWeight: 800, color: "var(--gz-text-primary, #e8f0ff)" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <div style={{ borderRadius: 16, background: "var(--gz-bg-card, rgba(255,255,255,0.03))", border: "1px solid var(--gz-border, rgba(255,255,255,0.07))", overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 130px 100px 80px", gap: 0, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          {["Jogador", "Jogo", "Aposta", "À espera", "Estado"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <RefreshCw style={{ width: 24, height: 24, color: "rgba(255,255,255,0.2)", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>A carregar fila...</p>
          </div>
        ) : queue.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(99,102,241,0.08)", border: "1.5px solid rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Users style={{ width: 24, height: 24, color: "rgba(99,102,241,0.5)" }} />
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: 700, margin: 0 }}>Fila vazia</p>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 4 }}>Nenhum jogador à espera de adversário neste momento</p>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Wifi style={{ width: 13, height: 13, color: "#22c55e" }} />
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Ligação em tempo real activa</span>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {queue.map((entry, idx) => {
              const color = gameColor(entry.game);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.35, delay: idx * 0.04 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 130px 100px 80px",
                    gap: 0,
                    padding: "14px 20px",
                    borderBottom: idx < queue.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    alignItems: "center",
                    transition: "background 0.15s",
                  }}
                  whileHover={{ background: "rgba(255,255,255,0.025)" } as any}
                >
                  {/* Player */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${color}22`, border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color }}>{entry.playerName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gz-text-primary, #e8f0ff)" }}>{entry.playerName}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>#{entry.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                  </div>

                  {/* Game */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gz-text-secondary, rgba(255,255,255,0.65))" }}>
                      {gameLabel(entry.game)}
                    </span>
                  </div>

                  {/* Bet */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                    {fmtMZN(entry.bet)}
                  </div>

                  {/* Elapsed */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock style={{ width: 11, height: 11, color: "rgba(255,255,255,0.3)" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                      {elapsed(entry.since)}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      À espera
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16 }}>
        Actualização automática via Supabase Realtime · Última vez às {lastRefresh.toLocaleTimeString("pt-PT")}
      </p>
    </div>
  );
}
