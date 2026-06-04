import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Bug, CreditCard, User, HelpCircle, CheckCircle, Clock, RefreshCw, ChevronDown } from "lucide-react";
import { listReports, updateReportStatus, type AdminReport } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  technical: Bug, payment: CreditCard, user: User, content: Flag, other: HelpCircle,
};
const CATEGORY_LABELS: Record<string, string> = {
  technical: "Técnico", payment: "Pagamento", user: "Utilizador", content: "Conteúdo", other: "Outro",
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Baixa:   { bg: "bg-blue-100",   text: "text-blue-700"   },
  Média:   { bg: "bg-amber-100",  text: "text-amber-700"  },
  Alta:    { bg: "bg-orange-100", text: "text-orange-700" },
  Urgente: { bg: "bg-red-100",    text: "text-red-700"    },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open:        { bg: "bg-amber-100",  text: "text-amber-700",  label: "Aberto"       },
  in_progress: { bg: "bg-blue-100",   text: "text-blue-700",   label: "Em Análise"   },
  resolved:    { bg: "bg-green-100",  text: "text-green-700",  label: "Resolvido"    },
  closed:      { bg: "bg-gray-100",   text: "text-gray-500",   label: "Fechado"      },
};

export default function Reports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-reports", statusFilter],
    queryFn: () => listReports(statusFilter !== "all" ? { status: statusFilter } : undefined),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-reports-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const open = reports.filter(r => r.status === "open").length;
  const inProgress = reports.filter(r => r.status === "in_progress").length;
  const resolved = reports.filter(r => r.status === "resolved").length;

  async function handleStatus(id: string, status: string) {
    try {
      await updateReportStatus(id, status, adminNote.trim() || undefined);
      toast({ title: "Estado actualizado", description: STATUS_COLORS[status]?.label ?? status });
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      setExpanded(null);
      setAdminNote("");
    } catch {
      toast({ title: "Erro", description: "Falha ao actualizar estado", variant: "destructive" });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Problemas reportados pelos utilizadores</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Abertos",    value: open,       color: "text-amber-600" },
          { label: "Em Análise", value: inProgress,  color: "text-blue-600" },
          { label: "Resolvidos", value: resolved,    color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          {["all", "open", "in_progress", "resolved", "closed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${statusFilter === s ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={statusFilter === s ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
              {STATUS_COLORS[s]?.label ?? "Todos"}
            </button>
          ))}
        </div>

        <div className="divide-y" style={{ divideColor: "rgba(108,92,231,.04)" } as any}>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></div>
            ))
          ) : reports.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
              Nenhum relatório encontrado
            </div>
          ) : reports.map((r: AdminReport) => {
            const Icon = CATEGORY_ICONS[r.category] ?? HelpCircle;
            const pcolor = PRIORITY_COLORS[r.priority] ?? { bg: "bg-gray-100", text: "text-gray-500" };
            const scolor = STATUS_COLORS[r.status] ?? STATUS_COLORS.open;
            const isOpen = expanded === r.id;

            return (
              <div key={r.id}>
                <div
                  className="px-5 py-4 hover:bg-indigo-50/10 cursor-pointer transition-colors"
                  onClick={() => { setExpanded(isOpen ? null : r.id); setAdminNote(r.admin_notes ?? ""); }}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${V1}12`, color: V1 }}>
                      <Icon style={{ width: 16, height: 16 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
                          {CATEGORY_LABELS[r.category] ?? r.category}
                        </span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${pcolor.bg} ${pcolor.text}`}>{r.priority}</span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${scolor.bg} ${scolor.text}`}>{scolor.label}</span>
                      </div>
                      <p className="text-[12px] line-clamp-2 mb-1" style={{ color: "var(--gz-text-secondary)" }}>{r.description}</p>
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                        <span>{r.user_name ?? "Anónimo"}</span>
                        <span>·</span>
                        <span>{new Date(r.created_at).toLocaleDateString("pt-PT")}</span>
                      </div>
                    </div>
                    <ChevronDown style={{ width: 16, height: 16, color: "var(--gz-text-muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(108,92,231,.06)", background: "rgba(108,92,231,.02)" }}>
                    <div className="pt-4 mb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Descrição completa</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: "var(--gz-text-secondary)" }}>{r.description}</p>
                    </div>
                    <div className="mb-3">
                      <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>
                        Notas do admin
                      </label>
                      <textarea rows={2} value={adminNote} onChange={e => setAdminNote(e.target.value)}
                        placeholder="Adiciona notas internas sobre este relatório…"
                        className="w-full border rounded-xl px-3 py-2 text-[12px] resize-none outline-none focus:border-indigo-400"
                        style={{ borderColor: "rgba(108,92,231,.2)", background: "white", color: "var(--gz-text-primary)" }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["in_progress", "resolved", "closed"].map(s => (
                        <button key={s} onClick={() => handleStatus(r.id, s)}
                          className={`px-3 py-1.5 text-[11.5px] font-bold rounded-xl transition-all ${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].text} hover:opacity-80`}>
                          {STATUS_COLORS[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
