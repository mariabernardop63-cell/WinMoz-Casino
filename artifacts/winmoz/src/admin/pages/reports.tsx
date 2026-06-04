import { useState } from "react";
import { useListReports, useResolveReport, getListReportsQueryKey } from "@/admin/lib/mock-api";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    reviewed: "bg-indigo-100 text-indigo-700",
    dismissed: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = { pending: "Pendente", reviewed: "Revisado", dismissed: "Arquivado" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100"}`}>{labels[status] ?? status}</span>;
}

export default function Reports() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const params = statusFilter !== "all" ? { status: statusFilter as "pending" | "reviewed" | "dismissed" } : {};
  const { data: reports, isLoading } = useListReports(params);
  const resolveReport = useResolveReport();

  function handleAction(id: number, action: "reviewed" | "dismissed") {
    resolveReport.mutate({ id, data: { action, notes: "" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() })
    });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Denúncias</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão de reclamações entre jogadores</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          {["all", "pending", "reviewed", "dismissed"].map(s => (
            <button key={s} data-testid={`filter-report-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "all" ? "Todas" : s === "pending" ? "Pendentes" : s === "reviewed" ? "Revisadas" : "Arquivadas"}
            </button>
          ))}
        </div>

        <div className="divide-y divide-gray-50">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-5 h-20 animate-pulse bg-gray-50 m-2 rounded-xl" />)
          ) : (reports ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Nenhuma denúncia encontrada</div>
          ) : (
            (reports ?? []).map((r) => (
              <div key={r.id} data-testid={`report-row-${r.id}`} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{r.reporterName}</span>
                      <span className="text-gray-400 text-xs">denunciou</span>
                      <span className="font-semibold text-red-600 text-sm">{r.accusedName}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1.5">{r.reason}</div>
                    {r.description && <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">{r.description}</div>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">Partida #{r.matchId}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={r.status} />
                    {r.status === "pending" && (
                      <>
                        <button data-testid={`button-review-${r.id}`} onClick={() => handleAction(r.id, "reviewed")} disabled={resolveReport.isPending}
                          className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors" title="Marcar como revisado">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </button>
                        <button data-testid={`button-dismiss-${r.id}`} onClick={() => handleAction(r.id, "dismissed")} disabled={resolveReport.isPending}
                          className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors" title="Arquivar">
                          <XCircle className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
