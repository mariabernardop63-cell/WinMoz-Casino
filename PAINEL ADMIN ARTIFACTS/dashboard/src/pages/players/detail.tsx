import { useParams, useLocation } from "wouter";
import { useGetPlayer, useSuspendPlayer, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trophy, TrendingUp, Coins, Calendar } from "lucide-react";

export default function PlayerDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const { data: player, isLoading } = useGetPlayer(id, { query: { enabled: !!id, queryKey: getGetPlayerQueryKey(id) } });
  const suspendPlayer = useSuspendPlayer();

  function handleSuspend() {
    suspendPlayer.mutate({ id, data: { reason: "Violação dos termos de uso" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(id) })
    });
  }

  if (isLoading) {
    return <div className="p-6"><div className="h-64 bg-white rounded-2xl animate-pulse" /></div>;
  }

  if (!player) return <div className="p-6 text-gray-500">Jogador não encontrado.</div>;

  const winRate = (player.wins + player.losses) > 0
    ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
    : "0.0";

  const statusMap: Record<string, string> = {
    online: "bg-green-100 text-green-700",
    in_game: "bg-blue-100 text-blue-700",
    offline: "bg-gray-100 text-gray-500",
    suspended: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6">
      <button data-testid="button-back" onClick={() => setLocation("/players")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {player.username[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{player.username}</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusMap[player.status] ?? "bg-gray-100"}`}>
                  {player.status}
                </span>
              </div>
              <div className="ml-auto">
                {player.status !== "suspended" && (
                  <button
                    data-testid="button-suspend"
                    onClick={handleSuspend}
                    disabled={suspendPlayer.isPending}
                    className="px-4 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                  >
                    {suspendPlayer.isPending ? "Suspendendo..." : "Suspender Conta"}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Vitórias", value: player.wins, icon: Trophy, color: "bg-green-100 text-green-600" },
                { label: "Derrotas", value: player.losses, icon: TrendingUp, color: "bg-red-100 text-red-500" },
                { label: "Taxa de Vitória", value: `${winRate}%`, icon: TrendingUp, color: "bg-indigo-100 text-indigo-600" },
                { label: "Total Apostado", value: `R$ ${(player.totalBets ?? 0).toFixed(2)}`, icon: Coins, color: "bg-purple-100 text-purple-600" },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-bold text-gray-800">{stat.value}</div>
                  <div className="text-xs text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-64 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="font-semibold text-gray-800 text-sm mb-3">Dados da Conta</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Saldo</span>
                <span className="font-semibold text-indigo-600">R$ {player.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Membro desde</span>
                <span className="font-medium text-gray-700">{new Date(player.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMap[player.status]}`}>{player.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
