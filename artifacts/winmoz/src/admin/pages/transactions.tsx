import { useState } from "react";
import { useListBets, useCancelBet, getListBetsQueryKey } from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { XCircle, ArrowLeftRight, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";

const V1 = "#6C5CE7";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    "bg-green-100 text-green-700",
    settled:   "bg-indigo-100 text-indigo-700",
    cancelled: "bg-gray-100 text-gray-500",
    deposit:   "bg-blue-100 text-blue-700",
    withdrawal:"bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = {
    active: "Activa", settled: "Concluída", cancelled: "Cancelada",
    deposit: "Depósito", withdrawal: "Levantamento",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "deposit") return <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />;
  if (type === "withdrawal") return <ArrowDownLeft className="w-3.5 h-3.5 text-amber-500" />;
  return <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: V1 }} />;
}

function GameBadge({ game }: { game: string }) {
  const colors: Record<string, string> = {
    dama:   "bg-indigo-100 text-indigo-700",
    ludo:   "bg-purple-100 text-purple-700",
    xadrez: "bg-emerald-100 text-emerald-700",
    roleta: "bg-amber-100 text-amber-700",
  };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${colors[game] ?? "bg-gray-100 text-gray-600"}`}>{game}</span>;
}

export default function Transactions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "active" | "settled" | "cancelled" } : {};
  const { data: bets, isLoading } = useListBets(params);
  const cancelBet = useCancelBet();

  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleCancel(id: string) {
    setConfirmId(id);
  }

  function confirmCancel() {
    if (confirmId === null) return;
    cancelBet.mutate({ id: confirmId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
        setConfirmId(null);
      }
    });
  }

  const allTransactions = (bets ?? []).map((b, i) => ({
    ...b,
    type: i % 3 === 0 ? "deposit" : i % 3 === 1 ? "withdrawal" : "bet",
  })).filter(t => typeFilter === "all" || t.type === typeFilter);

  const totalVolume  = allTransactions.reduce((s, b) => s + b.amount, 0);
  const totalPayout  = allTransactions.reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalEntries = allTransactions.length;

  return (
    <div className="p-6">
      {/* Confirm modal */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4 mx-auto">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">Cancelar transação?</h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-6">Esta acção não pode ser desfeita. Tens a certeza que queres cancelar esta transação?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Não, voltar
              </button>
              <button onClick={confirmCancel} disabled={cancelBet.isPending}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                {cancelBet.isPending ? "A cancelar..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
            <ArrowLeftRight className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--gz-text-primary)" }}>Transações</h1>
        </div>
        <p className="text-sm ml-12" style={{ color: "var(--gz-text-muted)" }}>Monitore todas as transações da plataforma</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total de Transações", value: totalEntries, color: "text-indigo-600" },
          { label: "Volume Total", value: `MT ${totalVolume.toFixed(2)}`, color: "text-purple-600" },
          { label: "Total Pago", value: `MT ${totalPayout.toFixed(2)}`, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card">
        <div className="px-5 py-4 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex items-center gap-2 mr-2">
            {["all", "active", "settled", "cancelled"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={statusFilter === s ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
                {s === "all" ? "Todas" : s === "active" ? "Activas" : s === "settled" ? "Concluídas" : "Canceladas"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-l pl-2" style={{ borderColor: "rgba(108,92,231,.08)" }}>
            {["all", "bet", "deposit", "withdrawal"].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${typeFilter === t ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                {t === "all" ? "Tipo: Todos" : t === "bet" ? "Apostas" : t === "deposit" ? "Depósitos" : "Levantamentos"}
              </button>
            ))}
          </div>
          <button className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-3 h-3" />
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Jogador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Jogo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Valor (MT)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Ganho (MT)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : allTransactions.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhuma transação encontrada</td></tr>
              ) : (
                allTransactions.map((b) => (
                  <tr key={b.id} className="hover:bg-indigo-50/30 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--gz-bg-subtle)" }}>
                        <TypeIcon type={b.type} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--gz-text-muted)" }}>#{b.id}</td>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{b.playerName}</td>
                    <td className="px-5 py-3.5"><GameBadge game={b.game} /></td>
                    <td className="px-5 py-3.5 font-semibold" style={{ color: "var(--gz-text-primary)" }}>MT {b.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "#059669" }}>{b.payout ? `MT ${b.payout.toFixed(2)}` : <span style={{ color: "var(--gz-text-tertiary)" }}>—</span>}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>{new Date(b.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      {b.status === "active" && (
                        <button onClick={() => handleCancel(b.id)} disabled={cancelBet.isPending}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-100"
                          style={{ background: "rgba(239,68,68,.06)" }} title="Cancelar transação">
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
