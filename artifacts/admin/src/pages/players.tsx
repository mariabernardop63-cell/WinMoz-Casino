import { useState } from "react";
import { useListPlayers, useSuspendPlayer, getListPlayersQueryKey } from "@/lib/admin-hooks";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ChevronRight, UserX } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    online: "bg-green-100 text-green-700",
    in_game: "bg-blue-100 text-blue-700",
    offline: "bg-gray-100 text-gray-500",
    suspended: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    online: "Online", in_game: "Em jogo", offline: "Offline", suspended: "Suspenso"
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {(status === "online" || status === "in_game") && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />}
      {labels[status] ?? status}
    </span>
  );
}

export default function Players() {
  const [search, setSearch] = useState("");
  const { data: players, isLoading } = useListPlayers();
  const suspendPlayer = useSuspendPlayer();
  const queryClient = useQueryClient();

  const filtered = (players ?? []).filter(p =>
    search === "" || p.username.toLowerCase().includes(search.toLowerCase())
  );

  function handleSuspend(id: number) {
    suspendPlayer.mutate({ id, data: { reason: "Violação dos termos de uso" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
    });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jogadores</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie os jogadores da plataforma</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="input-search-players"
              type="search"
              placeholder="Buscar jogador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="ml-auto text-sm text-gray-400">{filtered.length} jogadores</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Saldo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Vitórias</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Derrotas</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Apostado</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Membro desde</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-5 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">Nenhum jogador encontrado</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} data-testid={`player-row-${p.id}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {p.username[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{p.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">R$ {p.balance.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-green-600 font-medium">{p.wins}</td>
                    <td className="px-5 py-3.5 text-red-500 font-medium">{p.losses}</td>
                    <td className="px-5 py-3.5 text-gray-600">R$ {(p.totalBets ?? 0).toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {p.status !== "suspended" && (
                          <button
                            data-testid={`button-suspend-${p.id}`}
                            onClick={() => handleSuspend(p.id)}
                            disabled={suspendPlayer.isPending}
                            title="Suspender jogador"
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                        <Link href={`/players/${p.id}`}>
                          <button data-testid={`link-player-${p.id}`} className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-indigo-50 flex items-center justify-center transition-colors">
                            <ChevronRight className="w-4 h-4 text-gray-400 hover:text-indigo-500" />
                          </button>
                        </Link>
                      </div>
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
