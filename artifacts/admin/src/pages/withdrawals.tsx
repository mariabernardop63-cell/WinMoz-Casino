import { useState } from "react";
import { useListWithdrawals, useApproveWithdrawal, useRejectWithdrawal, getListWithdrawalsQueryKey } from "@/lib/admin-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

export default function Withdrawals() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "pending" | "approved" | "rejected" } : {};
  const { data: withdrawals, isLoading } = useListWithdrawals(params);
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal = useRejectWithdrawal();

  function handleApprove(id: number) {
    approveWithdrawal.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() })
    });
  }

  function handleReject(id: number) {
    rejectWithdrawal.mutate({ id, data: { reason: "Documentação insuficiente" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() })
    });
  }

  const pending = (withdrawals ?? []).filter(w => w.status === "pending");
  const totalPending = pending.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saques</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aprovação de solicitações de saque</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pendentes", value: pending.length, color: "text-amber-600" },
          { label: "Volume Pendente", value: `R$ ${totalPending.toFixed(2)}`, color: "text-indigo-600" },
          { label: "Total de Solicitações", value: (withdrawals ?? []).length, color: "text-gray-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} data-testid={`filter-withdrawal-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jogador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Método</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>)
              ) : (withdrawals ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">Nenhum saque encontrado</td></tr>
              ) : (
                (withdrawals ?? []).map((w) => (
                  <tr key={w.id} data-testid={`withdrawal-row-${w.id}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{w.playerName}</td>
                    <td className="px-5 py-3.5 font-bold text-indigo-600">R$ {w.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{w.method}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(w.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      {w.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button data-testid={`button-approve-${w.id}`} onClick={() => handleApprove(w.id)} disabled={approveWithdrawal.isPending}
                            className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors" title="Aprovar">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </button>
                          <button data-testid={`button-reject-${w.id}`} onClick={() => handleReject(w.id)} disabled={rejectWithdrawal.isPending}
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors" title="Rejeitar">
                            <XCircle className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
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
