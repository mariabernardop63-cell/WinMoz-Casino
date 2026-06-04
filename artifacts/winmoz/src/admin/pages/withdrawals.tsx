import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Landmark, RefreshCw } from "lucide-react";
import {
  listWithdrawals, approveWithdrawal, rejectWithdrawal,
  type AdminWithdrawal,
} from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
interface ConfirmState { w: AdminWithdrawal; type: ConfirmType; rejectReason: string }

export default function Withdrawals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [processing, setProcessing] = useState(false);

  const { data: withdrawals = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-withdrawals", statusFilter],
    queryFn: () => listWithdrawals(statusFilter !== "all" ? { status: statusFilter } : undefined),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-withdrawals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const pending = withdrawals.filter(w => w.status === "pending");
  const totalPending = pending.reduce((s, w) => s + Number(w.amount), 0);

  async function confirmAction() {
    if (!confirm || !user) return;
    setProcessing(true);
    try {
      if (confirm.type === "approve") {
        await approveWithdrawal(confirm.w.id, user.id);
        toast({ title: "Saque aprovado", description: `MT ${Number(confirm.w.amount).toFixed(2)} para ${confirm.w.user_name}` });
      } else {
        const reason = confirm.rejectReason.trim() || "Pedido não aprovado";
        await rejectWithdrawal(confirm.w.id, user.id, reason);
        toast({ title: "Saque recusado", description: `Saldo restituído a ${confirm.w.user_name}` });
      }
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      setConfirm(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao processar", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="px-5 pb-10 pt-4">
      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirm.type === "approve" ? "bg-green-50" : "bg-red-50"}`}>
              {confirm.type === "approve"
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <XCircle className="w-6 h-6 text-red-500" />
              }
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">
              {confirm.type === "approve" ? "Aprovar saque?" : "Recusar saque?"}
            </h3>
            <div className="px-4 py-3 rounded-xl mb-4 text-center" style={{ background: "var(--gz-bg-subtle)" }}>
              <div className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{confirm.w.user_name}</div>
              <div className="text-[22px] font-black mt-0.5" style={{ color: confirm.type === "approve" ? "#059669" : "#ef4444" }}>
                MT {Number(confirm.w.amount).toFixed(2)}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                Taxa: MT {Number(confirm.w.fee).toFixed(2)} · Método: {confirm.w.method}
              </div>
            </div>
            {confirm.type === "reject" && (
              <div className="mb-4">
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Motivo da recusa</label>
                <textarea
                  value={confirm.rejectReason}
                  onChange={e => setConfirm(c => c ? { ...c, rejectReason: e.target.value } : c)}
                  rows={3}
                  placeholder="Ex: Documentação insuficiente, saldo incorreto…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] resize-none outline-none focus:border-indigo-400"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmAction} disabled={processing}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors ${confirm.type === "approve" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                {processing ? "A processar…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
              <Landmark style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
            </div>
            <div>
              <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Saques</h1>
              <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
                Aprovação de levantamentos em tempo real
              </p>
            </div>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Pendentes",            value: pending.length,                  color: "text-amber-600" },
          { label: "Volume Pendente (MT)", value: `MT ${totalPending.toFixed(2)}`, color: "text-indigo-600" },
          { label: "Total",                value: withdrawals.length,              color: "text-gray-700" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
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
                {["Jogador", "Valor (MT)", "Taxa", "Método", "Status", "Data", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum saque encontrado</td></tr>
              ) : withdrawals.map(w => (
                <tr key={w.id} className="hover:bg-indigo-50/20 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{w.user_name ?? "—"}</td>
                  <td className="px-5 py-3.5 font-bold" style={{ color: V1 }}>MT {Number(w.amount).toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>MT {Number(w.fee).toFixed(2)}</td>
                  <td className="px-5 py-3.5" style={{ color: "var(--gz-text-secondary)" }}>{w.method}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={w.status} /></td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>
                    {new Date(w.created_at).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-5 py-3.5">
                    {w.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirm({ w, type: "approve", rejectReason: "" })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                          style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}>
                          <CheckCircle style={{ width: 12, height: 12 }} /> Aprovar
                        </button>
                        <button onClick={() => setConfirm({ w, type: "reject", rejectReason: "" })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:shadow-md"
                          style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>
                          <XCircle style={{ width: 12, height: 12 }} /> Recusar
                        </button>
                      </div>
                    )}
                    {w.status === "rejected" && w.rejection_reason && (
                      <span className="text-[11px] text-red-500 italic">{w.rejection_reason}</span>
                    )}
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
