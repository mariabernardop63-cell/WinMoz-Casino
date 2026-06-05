import { useState } from "react";
import { useListTransactions, getListTransactionsQueryKey } from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";

const V1 = "#6C5CE7";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    "bg-yellow-100 text-yellow-700",
    settled:   "bg-indigo-100 text-indigo-700",
    cancelled: "bg-gray-100 text-gray-500",
    pending:   "bg-amber-100 text-amber-700",
    approved:  "bg-green-100 text-green-700",
    rejected:  "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    active: "Activa", settled: "Concluída", cancelled: "Cancelada",
    pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "deposit")    return <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />;
  if (type === "withdrawal") return <ArrowDownLeft className="w-3.5 h-3.5 text-amber-500" />;
  return <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: V1 }} />;
}

function TypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    bet: "Aposta", win: "Ganhos", deposit: "Depósito", withdrawal: "Levantamento",
  };
  return <>{labels[type] ?? type}</>;
}

function GameBadge({ game }: { game: string }) {
  const colors: Record<string, string> = {
    dama:   "bg-indigo-100 text-indigo-700",
    ludo:   "bg-purple-100 text-purple-700",
    xadrez: "bg-emerald-100 text-emerald-700",
    roleta: "bg-amber-100 text-amber-700",
  };
  return game === "—"
    ? <span className="text-xs text-gray-400">—</span>
    : <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${colors[game] ?? "bg-gray-100 text-gray-600"}`}>{game}</span>;
}

export default function Transactions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const queryClient = useQueryClient();

  const params = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    type:   typeFilter   !== "all" ? typeFilter   : undefined,
  };
  const { data: transactions, isLoading } = useListTransactions(params);

  const allTransactions = transactions ?? [];
  const totalVolume  = allTransactions.reduce((s, t) => s + t.amount, 0);
  const totalPayout  = allTransactions.reduce((s, t) => s + (t.payout ?? 0), 0);
  const totalEntries = allTransactions.length;

  return (
    <div className="p-6">
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
          { label: "Total de Transações", value: totalEntries,                         color: "text-indigo-600" },
          { label: "Volume Total",        value: `MT ${totalVolume.toFixed(2)}`,       color: "text-purple-600" },
          { label: "Total Pago",          value: `MT ${totalPayout.toFixed(2)}`,       color: "text-green-600" },
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
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() })}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : allTransactions.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhuma transação encontrada</td></tr>
              ) : (
                allTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--gz-bg-subtle)" }}>
                          <TypeIcon type={t.type} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: "var(--gz-text-secondary)" }}>
                          <TypeLabel type={t.type} />
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--gz-text-muted)" }}>#{t.id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "var(--gz-text-primary)" }}>{t.playerName}</td>
                    <td className="px-5 py-3.5"><GameBadge game={t.game} /></td>
                    <td className="px-5 py-3.5 font-semibold" style={{ color: "var(--gz-text-primary)" }}>MT {t.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-medium" style={{ color: "#059669" }}>
                      {t.payout ? `MT ${t.payout.toFixed(2)}` : <span style={{ color: "var(--gz-text-tertiary)" }}>—</span>}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--gz-text-muted)" }}>
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
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
