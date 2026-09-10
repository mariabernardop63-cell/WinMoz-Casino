import { useState } from "react";
import { useListReports, useResolveReport, getListReportsQueryKey } from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Flag, Bug, CreditCard, User, HelpCircle, AlertTriangle, Hash } from "lucide-react";
import {
  PageHeader, Card, SectionHeader, KpiTile, KpiGrid, EmptyState, Modal, StatusPill, ToolbarButton,
} from "@/admin/components/ui";

const V1 = "#18181b";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Problema técnico":      Bug,
  "Problema de pagamento": CreditCard,
  "Utilizador":            User,
  "Conteúdo impróprio":   Flag,
  "Outro":                 HelpCircle,
};

const PRIORITY_COLORS: Record<string, { color: string; label: string }> = {
  "Baixa":   { color: "#2563eb", label: "Baixa"   },
  "Média":   { color: "#a16207", label: "Média"   },
  "Alta":    { color: "#c2410c", label: "Alta"    },
  "Urgente": { color: "#b91c1c", label: "Urgente" },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending:   { color: "#a16207", label: "Pendente" },
    reviewed:  { color: "#059669", label: "Revisado" },
    dismissed: { color: "#71717a", label: "Arquivado" },
  };
  const s = map[status] ?? map.dismissed;
  return <StatusPill label={s.label} color={s.color} />;
}

function CategoryIcon({ category }: { category?: string }) {
  const Icon = (category && CATEGORY_ICONS[category]) ? CATEGORY_ICONS[category] : Flag;
  return <Icon style={{ width: 15, height: 15, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />;
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
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">

      <PageHeader
        icon={Flag}
        title="Denúncias"
        subtitle={'Relatórios enviados pelos utilizadores via "Reportar Problema"'}
      />

      <div className="space-y-5">
        {/* KPIs */}
        <Card>
          <SectionHeader icon={AlertTriangle} title="Resumo de Denúncias" />
          <KpiGrid>
            <KpiTile label="Pendentes"  value={pendingCount}   icon={AlertTriangle} accent="#a16207" hint="a aguardar análise" />
            <KpiTile label="Revisadas"  value={reviewedCount}  icon={CheckCircle}   accent="#059669" hint="já tratadas" />
            <KpiTile label="Arquivadas" value={dismissedCount} icon={XCircle}       accent="#71717a" hint="marcadas inválidas" />
          </KpiGrid>
        </Card>

        {/* Filter + list */}
        <Card>
          <SectionHeader
            icon={Flag}
            title="Lista de Denúncias"
            action={
              <div className="flex items-center gap-1.5 flex-wrap">
                {["all", "pending", "reviewed", "dismissed"].map(s => (
                  <ToolbarButton
                    key={s}
                    label={s === "all" ? "Todas" : s === "pending" ? "Pendentes" : s === "reviewed" ? "Revisadas" : "Arquivadas"}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                  />
                ))}
              </div>
            }
          />

          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
              ))}
            </div>
          ) : (reports ?? []).length === 0 ? (
            <EmptyState icon={Flag} title="Nenhuma denúncia encontrada" subtitle="Os relatórios enviados pelos utilizadores aparecerão aqui" />
          ) : (
            <div>
              {(reports ?? []).map((r, idx) => {
                const categoryLabel = (r as { category?: string }).category ?? "Outro";
                const priority      = (r as { priority?: string }).priority ?? "Média";
                const priorityInfo  = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS["Média"];
                const ticketId      = (r as { matchId?: string | null }).matchId;
                const isTicket      = ticketId && ticketId.startsWith("WM-");

                return (
                  <div key={r.id} className="px-5 py-4 gz-tr"
                    style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gz-border-subtle)" }}>
                    <div className="flex items-start gap-4">

                      {/* Category icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--gz-bg-subtle)" }}>
                        <CategoryIcon category={categoryLabel} />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg"
                            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-secondary)" }}>
                            {categoryLabel}
                          </span>
                          <StatusPill label={priorityInfo.label} color={priorityInfo.color} />
                          <StatusBadge status={r.status} />
                        </div>

                        {/* Reporter */}
                        <div className="flex items-center gap-1.5 mb-1.5 text-[12.5px]">
                          <User style={{ width: 11, height: 11, color: "var(--gz-text-muted)" }} />
                          <span style={{ color: "var(--gz-text-muted)" }}>Enviado por</span>
                          <span className="font-bold" style={{ color: "var(--gz-text-primary)" }}>{r.reporterName}</span>
                        </div>

                        {/* Description */}
                        {r.description && (
                          <div className="text-[12.5px] leading-relaxed px-3.5 py-2.5 rounded-xl mb-2"
                            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-secondary)", border: "1px solid var(--gz-border-subtle)" }}>
                            {r.description}
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                          {isTicket && (
                            <>
                              <span className="flex items-center gap-1">
                                <Hash style={{ width: 9, height: 9 }} />
                                {ticketId}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span>{new Date(r.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {r.status === "pending" && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleAction(r.id as string, "reviewed")}
                            disabled={resolveReport.isPending}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                            style={{ background: "rgba(21,128,61,.1)", color: "#059669", border: "1px solid rgba(21,128,61,.2)" }}>
                            <CheckCircle style={{ width: 13, height: 13 }} />
                            Resolver
                          </button>
                          <button onClick={() => handleAction(r.id as string, "dismissed")}
                            disabled={resolveReport.isPending}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)", border: "1px solid var(--gz-border-subtle)" }}>
                            <XCircle style={{ width: 13, height: 13 }} />
                            Arquivar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Confirm modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === "reviewed" ? "Marcar como revisado?" : "Arquivar denúncia?"}
        icon={confirmAction?.action === "reviewed" ? CheckCircle : XCircle}
        maxWidth={420}
      >
        <p className="text-[12.5px] leading-relaxed mb-6" style={{ color: "var(--gz-text-muted)" }}>
          {confirmAction?.action === "reviewed"
            ? "Confirmas que analisaste esta denúncia e tomaste as medidas necessárias?"
            : "Tens a certeza que queres arquivar esta denúncia? Ela ficará marcada como inválida."}
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmAction(null)}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
            Não, voltar
          </button>
          <button onClick={confirmAndResolve} disabled={resolveReport.isPending}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors disabled:opacity-60"
            style={{ background: confirmAction?.action === "reviewed" ? "#059669" : "#71717a" }}>
            {resolveReport.isPending ? "A processar..." : "Sim, confirmar"}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
