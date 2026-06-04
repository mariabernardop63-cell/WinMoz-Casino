import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft, RefreshCw, Trophy } from "lucide-react";
import { listTransactions, type AdminTransaction } from "@/lib/supabase-admin";

const V1 = "#6C5CE7";

type TxType = "all" | "deposit" | "withdrawal" | "win" | "loss" | "credit" | "debit" | "refund";

const TX_CONFIG: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  deposit:    { bg: "bg-green-100",  text: "text-green-700",  label: "Depósito",      icon: ArrowDownLeft  },
  withdrawal: { bg: "bg-amber-100",  text: "text-amber-700",  label: "Levantamento",  icon: ArrowUpRight   },
  win:        { bg: "bg-indigo-100", text: "text-indigo-700", label: "Vitória",        icon: Trophy         },
  loss:       { bg: "bg-red-100",    text: "text-red-600",    label: "Derrota",        icon: ArrowUpRight   },
  credit:     { bg: "bg-blue-100",   text: "text-blue-700",   label: "Crédito",       icon: ArrowDownLeft  },
  debit:      { bg: "bg-orange-100", text: "text-orange-700", label: "Débito",        icon: ArrowUpRight   },
  refund:     { bg: "bg-teal-100",   text: "text-teal-700",   label: "Reembolso",     icon: ArrowDownLeft  },
};

function TxBadge({ type }: { type: string }) {
  const cfg = TX_CONFIG[type] ?? { bg: "bg-gray-100", text: "text-gray-500", label: type, icon: ArrowLeftRight };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <Icon style={{ width: 10, height: 10 }} />
      {cfg.label}
    </span>
  );
}

function fmt(n: number) { return n.toFixed(2); }

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-transactions", typeFilter],
    queryFn: () => listTransactions(typeFilter !== "all" ? { type: typeFilter, limit: 200 } : { limit: 200 }),
    refetchInterval: 20000,
  });

  const totalDeposits = transactions.filter(t => t.type === "deposit").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalWithdrawals = transactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalWins = transactions.filter(t => t.type === "win").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const FILTERS: { key: string; label: string }[] = [
    { key: "all",        label: "Todos" },
    { key: "deposit",    label: "Depósitos" },
    { key: "withdrawal", label: "Levantamentos" },
    { key: "win",        label: "Vitórias" },
    { key: "credit",     label: "Créditos" },
    { key: "refund",     label: "Reembolsos" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transacções</h1>
          <p className="text-sm text-gray-500 mt-0.5">Histórico de movimentos financeiros da plataforma</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Depósitos",     value: `MT ${fmt(totalDeposits)}`,     color: "text-green-600" },
          { label: "Total Levantamentos", value: `MT ${fmt(totalWithdrawals)}`,  color: "text-amber-600" },
          { label: "Total Vitórias",      value: `MT ${fmt(totalWins)}`,         color: "text-indigo-600" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${typeFilter === f.key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={typeFilter === f.key ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Utilizador", "Tipo", "Valor (MT)", "Descrição", "Data"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
                  Nenhuma transacção encontrada
                </td></tr>
              ) : transactions.map((t: AdminTransaction) => {
                const amount = Number(t.amount);
                const isIncoming = ["deposit", "win", "credit", "refund"].includes(t.type);
                const user = (t as any).profiles;
                return (
                  <tr key={t.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5">
                      <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-primary)" }}>
                        {user?.full_name ?? user?.email ?? "—"}
                      </div>
                      {user?.email && <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{user.email}</div>}
                    </td>
                    <td className="px-5 py-3.5"><TxBadge type={t.type} /></td>
                    <td className="px-5 py-3.5 font-bold text-[13px]" style={{ color: isIncoming ? "#10b981" : "#ef4444" }}>
                      {isIncoming ? "+" : "−"}MT {fmt(Math.abs(amount))}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] max-w-[200px]" style={{ color: "var(--gz-text-secondary)" }}>
                      <span className="line-clamp-1">{t.description ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      {new Date(t.created_at).toLocaleDateString("pt-PT")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
