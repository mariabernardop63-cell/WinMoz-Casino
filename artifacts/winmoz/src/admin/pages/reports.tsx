import { useState } from "react";
import { useListReports, useResolveReport, getListReportsQueryKey } from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Flag, Bug, CreditCard, User, HelpCircle, AlertTriangle } from "lucide-react";

const V1 = "#6C5CE7";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Problema técnico":      Bug,
  "Problema de pagamento": CreditCard,
  "Utilizador":            User,
  "Conteúdo impróprio":    Flag,
  "Outro":                 HelpCircle,
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "Baixa":   { bg: "bg-blue-100",   text: "text-blue-700",   label: "Baixa"   },
  "Média":   { bg: "bg-amber-100",  text: "text-amber-700",  label: "Média"   },
  "Alta":    { bg: "bg-orange-100", text: "text-orange-700", label: "Alta"    },
  "Urgente": { bg: "bg-red-100",    text: "text-red-700",    label: "Urgente" },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    reviewed:  "bg-indigo-100 text-indigo-700",
    dismissed: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = { pending: "Pendente", reviewed: "Revisado", dismissed: "Arquivado" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

function CategoryIcon({ category }: { category?: string }) {
  const Icon = (category && CATEGORY_ICONS[category]) ? CATEGORY_ICONS[category] : Flag;
  return <Icon style={{ width: 15, height: 15, color: V1, strokeWidth: 1.9 }} />;
}

export default function Reports() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "reviewed" | "dismissed" } | null>(null);
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "pending" | "reviewed" | "dismissed" } : {};
  const { data: reports, isLoading } = useListReports(params);
  const resolveReport = useResolveReport();

  function handleAction(id: string, action: "reviewed" | "dismissed") {
    setConfirmAction({ id, action });
  }

  function confirmAndResolve() {
    if (!confirmAction) return;
    resolveReport.mutate({ id: confirmAction.id, data: { action: confirmAction.action, notes: "" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setConfirmAction(null);
      }
    });
  }

  const pendingCount   = (reports ?? []).filter(r => r.status === "pending").length;
  const reviewedCount  = (reports ?? []).filter(r => r.status === "reviewed").length;
  const dismissedCount = (reports ?? []).filter(r => r.status === "dismissed").length;

  return (
    <div className="px-5 pb-10 pt-4">

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmAction.action === "reviewed" ? "bg-green-50" : "bg-gray-50"}`}>
              {confirmAction.action === "reviewed"
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <XCircle    className="w-6 h-6 text-gray-400"  />
              }
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">
              {confirmAction.action === "reviewed" ? "Marcar como revisado?" : "Arquivar denúncia?"}
            </h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-6">
              {confirmAction.action === "reviewed"
                ? "Confirmas que analisaste esta denúncia e tomaste as medidas necessárias?"
                : "Tens a certeza que queres arquivar esta denúncia? Ela ficará marcada como inválida."
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Não, voltar
              </button>
              <button onClick={confirmAndResolve} disabled={resolveReport.isPending}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors ${confirmAction.action === "reviewed" ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"}`}>
                {resolveReport.isPending ? "A processar..." : "Sim, confirmar"}
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
            <Flag style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
          </div>
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Denúncias</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Gestão de relatórios enviados pelos utilizadores
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Pendentes",  value: pendingCount,   color: "#d97706", bg: "rgba(217,119,6,.08)",  icon: AlertTriangle },
          { label: "Revisadas",  value: reviewedCount,  color: "#059669", bg: "rgba(16,185,129,.08)", icon: CheckCircle   },
          { label: "Arquivadas", value: dismissedCount, color: "#9ca3af", bg: "rgba(0,0,0,.04)",       icon: XCircle       },
        ].map(s => (
          <div key={s.label} className="gz-card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: s.bg }}>
              <s.icon style={{ width: 16, height: 16, color: s.color, strokeWidth: 1.8 }} />
            </div>
            <div className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {["all", "pending", "reviewed", "dismissed"].map(s => (
            <button key={s} data-testid={`filter-report-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={statusFilter === s ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
              {s === "all" ? "Todas" : s === "pending" ? "Pendentes" : s === "reviewed" ? "Revisadas" : "Arquivadas"}
            </button>
          ))}
        </div>

        <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 h-24 animate-pulse m-2 rounded-2xl" style={{ background: "var(--gz-bg-subtle)" }} />
            ))
          ) : (reports ?? []).length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Flag style={{ width: 28, height: 28, color: "var(--gz-text-tertiary)", margin: "0 auto 8px", strokeWidth: 1.3 }} />
              <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhuma denúncia encontrada</div>
            </div>
          ) : (
            (reports ?? []).map((r) => {
              const categoryLabel = (r as { category?: string }).category ?? "Outro";
              const priority      = (r as { priority?: string }).priority ?? "Média";
              const priorityInfo  = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS["Média"];

              return (
                <div key={r.id} data-testid={`report-row-${r.id}`}
                  className="px-5 py-4 hover:bg-indigo-50/20 transition-colors">
                  <div className="flex items-start gap-4">

                    {/* Category icon */}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(108,92,231,.07)" }}>
                      <CategoryIcon category={categoryLabel} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[12.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg" style={{ background: "rgba(108,92,231,.08)", color: V1 }}>
                          {categoryLabel}
                        </span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${priorityInfo.bg} ${priorityInfo.text}`}>
                          {priorityInfo.label}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>

                      {/* Reporter info */}
                      <div className="flex items-center gap-1.5 mb-1.5 text-[12.5px]">
                        <span className="font-bold" style={{ color: "var(--gz-text-primary)" }}>{r.reporterName}</span>
                        <span style={{ color: "var(--gz-text-muted)" }}>denunciou</span>
                        <span className="font-bold" style={{ color: "#ef4444" }}>{r.accusedName}</span>
                      </div>

                      {/* Description */}
                      {r.description && (
                        <div className="text-[12.5px] leading-relaxed px-3.5 py-2.5 rounded-xl mb-2"
                          style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-secondary)", border: "1px solid rgba(108,92,231,.08)" }}>
                          "{r.description}"
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                        <span>Partida #{r.matchId}</span>
                        <span>·</span>
                        <span>{new Date(r.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {r.status === "pending" && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button data-testid={`button-review-${r.id}`}
                          onClick={() => handleAction(r.id as string, "reviewed")}
                          disabled={resolveReport.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:shadow-md"
                          style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}
                          title="Marcar como revisado">
                          <CheckCircle style={{ width: 13, height: 13 }} />
                          Aprovar
                        </button>
                        <button data-testid={`button-dismiss-${r.id}`}
                          onClick={() => handleAction(r.id as string, "dismissed")}
                          disabled={resolveReport.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:shadow-md"
                          style={{ background: "rgba(0,0,0,.04)", color: "#6b7280", border: "1px solid rgba(0,0,0,.08)" }}
                          title="Arquivar">
                          <XCircle style={{ width: 13, height: 13 }} />
                          Arquivar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
