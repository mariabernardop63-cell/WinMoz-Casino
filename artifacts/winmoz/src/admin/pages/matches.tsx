import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Search, RefreshCw } from "lucide-react";
import { listMatches, type AdminMatch } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const V1 = "#6C5CE7";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; dot: boolean }> = {
    active:    { cls: "bg-green-100 text-green-700",  label: "Em Jogo",  dot: true  },
    completed: { cls: "bg-gray-100 text-gray-600",    label: "Concluída", dot: false },
    cancelled: { cls: "bg-red-100 text-red-600",      label: "Cancelada", dot: false },
  };
  const s = map[status] ?? map.completed;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${s.cls}`}>
      {s.dot && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
      {s.label}
    </span>
  );
}

function GameBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    damas:  { bg: "rgba(14,165,233,.1)",  text: "#0ea5e9" },
    ludo:   { bg: "rgba(16,185,129,.1)",  text: "#10b981" },
    xadrez: { bg: "rgba(108,92,231,.1)",  text: V1 },
    roleta: { bg: "rgba(245,158,11,.1)",  text: "#f59e0b" },
  };
  const c = colors[type] ?? { bg: "rgba(156,163,175,.1)", text: "#9ca3af" };
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: c.bg, color: c.text }}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function Matches() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-matches", statusFilter, gameFilter],
    queryFn: () => listMatches({
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(gameFilter !== "all" ? { game_type: gameFilter } : {}),
    }),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-matches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const filtered = matches.filter(m =>
    search === "" ||
    (m.player1_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.player2_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const active = matches.filter(m => m.status === "active").length;
  const completed = matches.filter(m => m.status === "completed").length;
  const totalVol = matches.reduce((s, m) => s + Number(m.bet_amount) * 2, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Todas as partidas da plataforma em tempo real</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Em Jogo",   value: active,                               color: "text-green-600" },
          { label: "Concluídas", value: completed,                           color: "text-gray-700" },
          { label: "Volume (MT)", value: `MT ${totalVol.toFixed(2)}`,        color: "text-indigo-600" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="relative flex-1 min-w-[180px]">
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gz-text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar jogador…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: "var(--gz-bg-subtle)", borderColor: "rgba(108,92,231,.1)", color: "var(--gz-text-primary)" }} />
          </div>
          <div className="flex gap-2">
            {["all", "active", "completed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={statusFilter === s ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
                {s === "all" ? "Todos" : s === "active" ? "Em Jogo" : "Concluídas"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {["all", "damas", "ludo", "xadrez", "roleta"].map(g => (
              <button key={g} onClick={() => setGameFilter(g)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${gameFilter === g ? "text-white bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {g === "all" ? "Todos" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Jogo", "Jogador 1", "Jogador 2", "Vencedor", "Aposta", "Status", "Data"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
                  {matches.length === 0 ? "Nenhuma partida registada. Começa um jogo para veres dados reais aqui." : "Nenhuma partida encontrada"}
                </td></tr>
              ) : filtered.map((m: AdminMatch) => (
                <tr key={m.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                  <td className="px-5 py-3.5"><GameBadge type={m.game_type} /></td>
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{m.player1_name ?? "—"}</td>
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{m.player2_name ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    {m.winner_name
                      ? <span className="text-xs font-bold text-green-600">🏆 {m.winner_name}</span>
                      : <span className="text-xs" style={{ color: "var(--gz-text-muted)" }}>—</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 font-bold text-xs" style={{ color: V1 }}>MT {Number(m.bet_amount).toFixed(2)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={m.status} /></td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>
                    {new Date(m.created_at).toLocaleDateString("pt-PT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
