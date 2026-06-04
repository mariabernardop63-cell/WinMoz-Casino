import { useState } from "react";
import { useListMatches } from "@/admin/lib/supabase-api";
import { Link } from "wouter";
import { Gamepad2, ChevronRight, Search } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    live: "bg-green-100 text-green-700",
    finished: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}

function GameBadge({ game }: { game: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${game === "dama" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
      {game}
    </span>
  );
}

export default function Matches() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter as "live" | "finished" | "pending" } : {}),
    ...(gameFilter !== "all" ? { game: gameFilter as "dama" | "ludo" } : {}),
  };

  const { data: matches, isLoading } = useListMatches(params);

  const filtered = (matches ?? []).filter(m =>
    search === "" ||
    m.player1Name.toLowerCase().includes(search.toLowerCase()) ||
    m.player2Name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partidas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie todas as partidas da plataforma</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="input-search"
              type="search"
              placeholder="Buscar jogadores..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "live", "finished", "pending"].map(s => (
              <button
                key={s}
                data-testid={`filter-status-${s}`}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s === "all" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {["all", "dama", "ludo"].map(g => (
              <button
                key={g}
                data-testid={`filter-game-${g}`}
                onClick={() => setGameFilter(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${gameFilter === g ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {g === "all" ? "Todos" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogadores</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Aposta</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Vencedor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-5 py-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">Nenhuma partida encontrada</td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} data-testid={`match-row-${m.id}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">#{m.id}</td>
                    <td className="px-5 py-3.5"><GameBadge game={m.game} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Gamepad2 className="w-3 h-3 text-indigo-500" />
                        </div>
                        <span className="font-medium text-gray-800">{m.player1Name}</span>
                        <span className="text-gray-300">vs</span>
                        <span className="font-medium text-gray-800">{m.player2Name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">R$ {m.betAmount.toFixed(2)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3.5 text-gray-600">{m.winnerName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/matches/${m.id}`}>
                        <button data-testid={`link-match-${m.id}`} className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-indigo-50 flex items-center justify-center transition-colors">
                          <ChevronRight className="w-4 h-4 text-gray-400 hover:text-indigo-500" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
