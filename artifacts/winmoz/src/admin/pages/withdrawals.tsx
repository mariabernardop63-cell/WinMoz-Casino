import { useState } from "react";
import { useListWithdrawals, useApproveWithdrawal, useRejectWithdrawal, getListWithdrawalsQueryKey } from "@/admin/lib/mock-api";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Landmark } from "lucide-react";

const V1 = "#6C5CE7";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

type ConfirmType = "approve" | "reject";

export default function Withdrawals() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "pending" | "approved" | "rejected" } : {};
  const { data: withdrawals, isLoading } = useListWithdrawals(params);
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal  = useRejectWithdrawal();

  const [confirmModal, setConfirmModal] = useState<{ id: number; type: ConfirmType; playerName: string; amount: number } | null>(null);

  function handleApprove(id: number, playerName: string, amount: number) {
    setConfirmModal({ id, type: "approve", playerName, amount });
  }

  function handleReject(id: number, playerName: string, amount: number) {
    setConfirmModal({ id, type: "reject", playerName, amount });
  }

  function confirmAction() {
    if (!confirmModal) return;
    if (confirmModal.type === "approve") {
      approveWithdrawal.mutate({ id: confirmModal.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          setConfirmModal(null);
        }
      });
    } else {
      rejectWithdrawal.mutate({ id: confirmModal.id, data: { reason: "Documentação insuficiente" } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          setConfirmModal(null);
        }
      });
    }
  }

  const pending      = (withdrawals ?? []).filter(w => w.status === "pending");
  const totalPending = pending.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="px-5 pb-10 pt-4">

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmModal.type === "approve" ? "bg-green-50" : "bg-red-50"}`}>
              {confirmModal.type === "approve"
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <XCircle    className="w-6 h-6 text-red-500"   />
              }
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">
              {confirmModal.type === "approve" ? "Aprovar saque?" : "Recusar saque?"}
            </h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-2">
              {confirmModal.type === "approve"
                ? "Confirmas a aprovação deste pedido de saque?"
                : "Tens a certeza que queres recusar este pedido de saque?"
              }
            </p>
            <div className="px-4 py-3 rounded-xl mb-5 text-center" style={{ background: "var(--gz-bg-subtle)", border: "1px solid rgba(108,92,231,.1)" }}>
              <div className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{confirmModal.playerName}</div>
              <div className="text-[20px] font-black mt-0.5" style={{ color: confirmModal.type === "approve" ? "#059669" : "#ef4444" }}>
                MT {confirmModal.amount.toFixed(2)}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Não, voltar
              </button>
              <button onClick={confirmAction}
                disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors ${confirmModal.type === "approve" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                {(approveWithdrawal.isPending || rejectWithdrawal.isPending) ? "A processar..." : "Sim, confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
            <Landmark style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
          </div>
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Saques</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Aprovação de solicitações de saque
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Pendentes",             value: pending.length,                                             color: "text-amber-600" },
          { label: "Volume Pendente (MT)",  value: `MT ${totalPending.toFixed(2)}`,                            color: "text-indigo-600" },
          { label: "Total de Solicitações", value: (withdrawals ?? []).length,                                  color: "text-gray-700"  },
        ].map((s) => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} data-testid={`filter-withdrawal-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={statusFilter === s ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
              {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Jogador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Valor (MT)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Método</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : (withdrawals ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum saque encontrado</td></tr>
              ) : (
                (withdrawals ?? []).map((w) => (
                  <tr key={w.id} data-testid={`withdrawal-row-${w.id}`} className="hover:bg-indigo-50/20 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{w.playerName}</td>
                    <td className="px-5 py-3.5 font-bold" style={{ color: V1 }}>MT {w.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--gz-text-secondary)" }}>{w.method}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>{new Date(w.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      {w.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button data-testid={`button-approve-${w.id}`}
                            onClick={() => handleApprove(w.id, w.playerName, w.amount)}
                            disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                            style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}
                            title="Aprovar saque">
                            <CheckCircle style={{ width: 12, height: 12 }} />
                            Aprovar
                          </button>
                          <button data-testid={`button-reject-${w.id}`}
                            onClick={() => handleReject(w.id, w.playerName, w.amount)}
                            disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                            style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}
                            title="Recusar saque">
                            <XCircle style={{ width: 12, height: 12 }} />
                            Recusar
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
