import { useState, useEffect, useRef } from "react";
import { useListWithdrawals, useApproveWithdrawal, useRejectWithdrawal, getListWithdrawalsQueryKey } from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Landmark, Clock, TrendingUp, List } from "lucide-react";
import { toast } from "sonner";
import { playAdminNotificationSound } from "@/admin/hooks/useAdminNotificationSound";

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
  const prevPendingCount = useRef<number | null>(null);

  const [confirmModal, setConfirmModal] = useState<{ id: string; type: ConfirmType; playerName: string; amount: number } | null>(null);

  useEffect(() => {
    const pending = (withdrawals ?? []).filter(w => w.status === "pending");
    if (prevPendingCount.current !== null && pending.length > prevPendingCount.current) {
      playAdminNotificationSound("withdrawal");
    }
    prevPendingCount.current = pending.length;
  }, [withdrawals]);

  function handleApprove(id: string, playerName: string, amount: number) {
    setConfirmModal({ id, type: "approve", playerName, amount });
  }

  function handleReject(id: string, playerName: string, amount: number) {
    setConfirmModal({ id, type: "reject", playerName, amount });
  }

  function confirmAction() {
    if (!confirmModal) return;
    if (confirmModal.type === "approve") {
      approveWithdrawal.mutate({ id: confirmModal.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          setConfirmModal(null);
          toast.success("Saque aprovado com sucesso!");
        },
        onError: (err) => {
          toast.error(`Erro ao aprovar: ${err instanceof Error ? err.message : "Tenta novamente"}`);
        },
      });
    } else {
      rejectWithdrawal.mutate({ id: confirmModal.id, data: { reason: "Documentação insuficiente" } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          setConfirmModal(null);
          toast.success("Saque recusado.");
        },
        onError: (err) => {
          toast.error(`Erro ao recusar: ${err instanceof Error ? err.message : "Tenta novamente"}`);
        },
      });
    }
  }

  const pending      = (withdrawals ?? []).filter(w => w.status === "pending");
  const totalPending = pending.reduce((sum, w) => sum + w.amount, 0);
  const list         = withdrawals ?? [];

  return (
    <div className="px-4 pb-10 pt-4 max-w-5xl mx-auto">

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-[calc(100%-2rem)] max-w-sm mx-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmModal.type === "approve" ? "bg-green-50" : "bg-red-50"}`}>
              {confirmModal.type === "approve"
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <XCircle    className="w-6 h-6 text-red-500"   />
              }
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">
              {confirmModal.type === "approve" ? "Aprovar saque?" : "Recusar saque?"}
            </h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-3">
              {confirmModal.type === "approve"
                ? "Confirmas a aprovação deste pedido de saque?"
                : "Tens a certeza que queres recusar este pedido?"
              }
            </p>
            <div className="px-4 py-3 rounded-xl mb-5 text-center" style={{ background: "var(--gz-bg-subtle)", border: "1px solid rgba(108,92,231,.1)" }}>
              <div className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{confirmModal.playerName}</div>
              <div className="text-[22px] font-black mt-0.5" style={{ color: confirmModal.type === "approve" ? "#059669" : "#ef4444" }}>
                MT {confirmModal.amount.toFixed(2)}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100">
                Não, voltar
              </button>
              <button onClick={confirmAction}
                disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                className={`flex-1 py-3 rounded-xl text-[13px] font-bold text-white ${confirmModal.type === "approve" ? "bg-green-500" : "bg-red-500"}`}>
                {(approveWithdrawal.isPending || rejectWithdrawal.isPending) ? "A processar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
            <Landmark style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
          </div>
          <div>
            <h1 className="text-[20px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Saques</h1>
            <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Aprovação de solicitações de saque
            </p>
          </div>
        </div>
      </div>

      {/* Stats — responsive grid */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="gz-card p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock style={{ width: 14, height: 14, color: "#d97706", flexShrink: 0 }} />
            <div className="text-[10px] sm:text-xs uppercase font-medium tracking-wide truncate" style={{ color: "var(--gz-text-muted)" }}>Pendentes</div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600">{pending.length}</div>
        </div>
        <div className="gz-card p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp style={{ width: 14, height: 14, color: V1, flexShrink: 0 }} />
            <div className="text-[10px] sm:text-xs uppercase font-medium tracking-wide truncate" style={{ color: "var(--gz-text-muted)" }}>Volume MT</div>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-indigo-600">{totalPending.toFixed(0)}</div>
        </div>
        <div className="gz-card p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <List style={{ width: 14, height: 14, color: "#6b7280", flexShrink: 0 }} />
            <div className="text-[10px] sm:text-xs uppercase font-medium tracking-wide truncate" style={{ color: "var(--gz-text-muted)" }}>Total</div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-700">{list.length}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="gz-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2 overflow-x-auto" style={{ borderColor: "rgba(108,92,231,.06)", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors"
              style={statusFilter === s
                ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff" }
                : { background: "#f3f4f6", color: "#6b7280" }}>
              {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
            </button>
          ))}
        </div>

        {/* ── MOBILE: Card list (hidden on md+) ── */}
        <div className="md:hidden divide-y" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 rounded-lg mb-2 animate-pulse" style={{ background: "var(--gz-bg-subtle)", width: "60%" }} />
                <div className="h-3 rounded-lg animate-pulse" style={{ background: "var(--gz-bg-subtle)", width: "40%" }} />
              </div>
            ))
          ) : list.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum saque encontrado</div>
          ) : (
            list.map((w) => (
              <div key={w.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="font-bold text-[14px] truncate" style={{ color: "var(--gz-text-primary)" }}>{w.playerName}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{w.method}{(w as any).phone ? ` · ${(w as any).phone}` : ""}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                      {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-[18px] font-black" style={{ color: V1 }}>MT {w.amount.toFixed(2)}</div>
                    <StatusBadge status={w.status} />
                  </div>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleApprove(w.id as string, w.playerName, w.amount)}
                      disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold"
                      style={{ background: "rgba(16,185,129,.1)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}>
                      <CheckCircle style={{ width: 14, height: 14 }} />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleReject(w.id as string, w.playerName, w.amount)}
                      disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold"
                      style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>
                      <XCircle style={{ width: 14, height: 14 }} />
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── DESKTOP: Table (hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
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
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum saque encontrado</td></tr>
              ) : (
                list.map((w) => (
                  <tr key={w.id} className="hover:bg-indigo-50/20 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{w.playerName}</td>
                    <td className="px-5 py-3.5 font-bold" style={{ color: V1 }}>MT {w.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--gz-text-secondary)" }}>{w.method}{(w as any).phone ? <><br/><span className="text-xs">{(w as any).phone}</span></> : ""}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>{new Date(w.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      {w.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(w.id as string, w.playerName, w.amount)}
                            disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                            style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}>
                            <CheckCircle style={{ width: 12, height: 12 }} />Aprovar
                          </button>
                          <button
                            onClick={() => handleReject(w.id as string, w.playerName, w.amount)}
                            disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                            style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>
                            <XCircle style={{ width: 12, height: 12 }} />Recusar
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
