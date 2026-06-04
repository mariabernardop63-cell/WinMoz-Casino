import { useState } from "react";
import { useListBets, useCancelBet, getListBetsQueryKey } from "@/admin/lib/mock-api";
import { useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    settled: "bg-indigo-100 text-indigo-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = { active: "Ativa", settled: "Liquidada", cancelled: "Cancelada" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

function GameBadge({ game }: { game: string }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${game === "dama" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>{game}</span>;
}

export default function Bets() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "active" | "settled" | "cancelled" } : {};
  const { data: bets, isLoading } = useListBets(params);
  const cancelBet = useCancelBet();

  function handleCancel(id: number) {
    cancelBet.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() })
    });
  }

  const totalVolume = (bets ?? []).reduce((sum, b) => sum + b.amount, 0);
  const totalPayout = (bets ?? []).reduce((sum, b) => sum + (b.payout ?? 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Apostas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitore todas as apostas da plataforma</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total de Apostas", value: (bets ?? []).length, color: "text-indigo-600" },
          { label: "Volume Total", value: `R$ ${totalVolume.toFixed(2)}`, color: "text-purple-600" },
          { label: "Total Pago", value: `R$ ${totalPayout.toFixed(2)}`, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          {["all", "active", "settled", "cancelled"].map(s => (
            <button
              key={s}
              data-testid={`filter-bet-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s === "all" ? "Todas" : s === "active" ? "Ativas" : s === "settled" ? "Liquidadas" : "Canceladas"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Partida</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ganho</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-5 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>)
              ) : (bets ?? []).length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">Nenhuma aposta encontrada</td></tr>
              ) : (
                (bets ?? []).map((b) => (
                  <tr key={b.id} data-testid={`bet-row-${b.id}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">#{b.id}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{b.playerName}</td>
                    <td className="px-5 py-3.5"><GameBadge game={b.game} /></td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">#{b.matchId}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">R$ {b.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-green-600 font-medium">{b.payout ? `R$ ${b.payout.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(b.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      {b.status === "active" && (
                        <button data-testid={`button-cancel-bet-${b.id}`} onClick={() => handleCancel(b.id)} disabled={cancelBet.isPending} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors" title="Cancelar aposta">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
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
