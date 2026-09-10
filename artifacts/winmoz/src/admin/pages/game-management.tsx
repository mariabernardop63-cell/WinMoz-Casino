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
  source?: "public" | "private";
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
    damas: "#a16207", ludo: "#15803d", xadrez: "#3f3f46",
    chess: "#3f3f46", bilhar: "#52525b", roleta: "#71717a",
  };
  return m[g?.toLowerCase()] ?? "#3f3f46";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  async function fetchQueue() {
    setLoading(true);
    try {
      const [{ data: publicQueue }, { data: privateRooms }] = await Promise.all([
        adminSupabase
          .from("matchmaking_queue")
          .select("id, user_id, display_name, game_type, bet_amount, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        adminSupabase
          .from("game_rooms")
          .select("id, status, game_type, bet_amount, creator_id, created_at")
          .eq("status", "waiting")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const entries: QueueEntry[] = [];

      if (publicQueue && publicQueue.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicQueue.forEach((r: any) => {
          entries.push({
            id: `mq_${r.id}`,
            playerId: r.user_id ?? "",
            playerName: r.display_name ?? "Utilizador",
            game: r.game_type ?? "damas",
            bet: parseFloat(r.bet_amount ?? 0),
            since: new Date(r.created_at),
            status: "waiting",
            source: "public",
          });
        });
      }

      if (privateRooms && privateRooms.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const creatorIds = [...new Set(privateRooms.map((r: any) => r.creator_id).filter(Boolean))];
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", creatorIds);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profileMap: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        privateRooms.forEach((r: any) => {
          const profile = profileMap[r.creator_id] ?? {};
          entries.push({
            id: `gr_${r.id}`,
            playerId: r.creator_id ?? "",
            playerName: profile.full_name ?? profile.phone ?? "Utilizador",
            game: r.game_type ?? "damas",
            bet: parseFloat(r.bet_amount ?? 0),
            since: new Date(r.created_at),
            status: r.status,
            source: "private",
          });
        });
      }

      entries.sort((a, b) => b.since.getTime() - a.since.getTime());
      setQueue(entries);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms" }, () => fetchQueue())
      .on("postgres_changes", { event: "*", schema: "public", table: "matchmaking_queue" }, () => fetchQueue())
      .subscribe();

    const ticker = setInterval(() => setTick(t => t + 1), 1000);

    return () => {
      if (channelRef.current) adminSupabase.removeChannel(channelRef.current);
      clearInterval(ticker);
    };
  }, []);

  const stats = [
    { label: "Na fila agora", value: queue.length, icon: Search, color: "#52525b" },
    { label: "Última actualização", value: lastRefresh.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), icon: Clock, color: "#52525b", small: true },
    { label: "Jogos activos", value: "—", icon: Zap, color: "#a16207" },
  ];

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.035em] leading-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
            <Gamepad2 style={{ width: 22, height: 22, strokeWidth: 2 }} />
            Gestão de <span className="gz-gradient-text">Jogos</span>
          </h1>
          <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
            Fila de matchmaking em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl"
            style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)" }}>
            <span className="w-2 h-2 rounded-full" style={{
              background: "#15803d",
              boxShadow: "0 0 8px #15803d",
              animation: "pulse-dot 2s ease-in-out infinite",
            }} />
            <span className="text-[11.5px] font-bold" style={{ color: "#15803d" }}>Live</span>
          </div>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all active:scale-95"
            style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-secondary)" }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Stats panel ── */}
        <section className="gz-card overflow-hidden animate-float-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: "var(--gz-border-subtle)" }}>
            {stats.map(({ label, value, icon: Icon, color, small }) => (
              <div key={label} className="px-5 py-4" style={{ background: "var(--gz-bg-card-btn)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: `${color}16`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: 15, height: 15, color }} strokeWidth={1.9} />
                  </div>
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] truncate" style={{ color: "var(--gz-text-muted)" }}>
                    {label}
                  </span>
                </div>
                <div className={small ? "text-[18px] font-black tabular-nums" : "text-[24px] font-black tabular-nums"} style={{ color: "var(--gz-text-primary)" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Queue table ── */}
        <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
            <div className="flex items-center gap-2.5">
              <Users style={{ width: 15, height: 15, color: "var(--gz-text-secondary)" }} />
              <span className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Fila de Espera</span>
            </div>
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
              {queue.length} jogador{queue.length !== 1 ? "es" : ""}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <RefreshCw style={{ width: 24, height: 24, color: "var(--gz-text-tertiary)", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
              <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>A carregar fila...</p>
            </div>
          ) : queue.length === 0 ? (
            <div className="py-14 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--gz-bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Users style={{ width: 24, height: 24, color: "var(--gz-text-tertiary)" }} />
              </div>
              <p className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Fila vazia</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--gz-text-muted)" }}>Nenhum jogador à espera de adversário neste momento</p>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <Wifi style={{ width: 13, height: 13, color: "#15803d" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#15803d" }}>Ligação em tempo real activa</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr style={{ background: "var(--gz-bg-subtle)" }}>
                    {["Jogador", "Jogo", "Aposta", "À espera", "Estado"].map((h, i) => (
                      <th key={h}
                        className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${i >= 2 ? "text-right" : "text-left"}`}
                        style={{ color: "var(--gz-text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {queue.map((entry) => {
                      const color = gameColor(entry.game);
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 16, transition: { duration: 0.25 } }}
                          transition={{ duration: 0.35 }}
                          className="gz-tr"
                          style={{ borderTop: "1px solid var(--gz-border-subtle)" }}
                        >
                          {/* Player */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${color}22`, border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color }}>{entry.playerName.charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{entry.playerName}</div>
                                <div className="text-[10px]" style={{ color: "var(--gz-text-tertiary)" }}>#{entry.id.slice(0, 8).toUpperCase()}</div>
                              </div>
                            </div>
                          </td>

                          {/* Game */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                              <span className="text-[12.5px] font-semibold" style={{ color: "var(--gz-text-secondary)" }}>
                                {gameLabel(entry.game)}
                              </span>
                            </div>
                          </td>

                          {/* Bet */}
                          <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: "#15803d" }}>
                            {fmtMZN(entry.bet)}
                          </td>

                          {/* Elapsed */}
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Clock style={{ width: 11, height: 11, color: "var(--gz-text-tertiary)" }} />
                              <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--gz-text-muted)" }}>
                                {elapsed(entry.since)}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(161,98,7,.12)", color: "#a16207", border: "1px solid rgba(161,98,7,.25)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                                À espera
                              </span>
                              {entry.source === "private" && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "var(--gz-bg-subtle)", color: "var(--gz-text-secondary)", border: "1px solid var(--gz-border-subtle)", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                                  Sala
                                </span>
                              )}
                              {entry.source === "public" && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(21,128,61,.12)", color: "#15803d", border: "1px solid rgba(21,128,61,.2)", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                                  Público
                                </span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-[11px] text-center" style={{ color: "var(--gz-text-tertiary)" }}>
          Actualização automática via Supabase Realtime · Última vez às {lastRefresh.toLocaleTimeString("pt-PT")}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.65; transform:scale(1.35); } }
      `}</style>
    </div>
  );
}
