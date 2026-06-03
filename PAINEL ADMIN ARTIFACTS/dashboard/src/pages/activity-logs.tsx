import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, Search, Clock, User, Globe, Filter,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { api, type ActivityLog, type PaginatedResponse } from "@/lib/api";

const V1 = "#6C5CE7";

const ACTION_COLORS: Record<string, string> = {
  login: "#10b981",
  logout: "var(--gz-text-muted)",
  profile_update: "#6C5CE7",
  password_change: "#f59e0b",
  player_suspend: "#ef4444",
  player_reactivate: "#10b981",
  match_resolve: "#3b82f6",
  withdrawal_approve: "#10b981",
  withdrawal_reject: "#ef4444",
  report_resolve: "#8b5cf6",
  balance_adjustment: "#f59e0b",
  bet_cancel: "#ef4444",
};

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  profile_update: "Perfil Actualizado",
  password_change: "Senha Alterada",
  player_suspend: "Jogador Suspenso",
  player_reactivate: "Jogador Reactivado",
  match_resolve: "Partida Resolvida",
  withdrawal_approve: "Saque Aprovado",
  withdrawal_reject: "Saque Rejeitado",
  report_resolve: "Denúncia Resolvida",
  balance_adjustment: "Ajuste de Saldo",
  bet_cancel: "Aposta Cancelada",
};

function LogRow({ log, isExpanded, onToggle }: {
  log: ActivityLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = ACTION_COLORS[log.action] ?? "#6C5CE7";
  const label = ACTION_LABELS[log.action] ?? log.action;

  return (
    <div className="border-b transition-colors hover:bg-indigo-50/30 cursor-pointer" style={{ borderColor: "rgba(108,92,231,.04)" }} onClick={onToggle}>
      <div className="flex items-center gap-4 px-5 py-3.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{label}</span>
            {log.adminUsername && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "var(--gz-bg-subtle)", color: V1 }}>
                <User style={{ width: 9, height: 9 }} />
                {log.adminUsername}
              </span>
            )}
          </div>
          {log.detail && !isExpanded && (
            <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--gz-text-muted)" }}>{log.detail}</div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {log.ip && (
            <span className="flex items-center gap-1 text-[10.5px] font-mono" style={{ color: "var(--gz-text-tertiary)" }}>
              <Globe style={{ width: 9, height: 9 }} />
              {log.ip}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--gz-text-tertiary)" }}>
            <Clock style={{ width: 9, height: 9 }} />
            {new Date(log.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </span>
          {isExpanded
            ? <ChevronUp style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
            : <ChevronDown style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
          }
        </div>
      </div>
      {isExpanded && log.detail && (
        <div className="px-5 pb-3.5">
          <div className="px-3.5 py-2.5 rounded-xl text-[12.5px] font-mono leading-relaxed"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-secondary)", border: "1px solid rgba(108,92,231,.1)" }}>
            {log.detail}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<ActivityLog>>({
    queryKey: ["activity-logs", page, search, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("q", search);
      if (actionFilter !== "all") params.set("action", actionFilter);
      return api.get<PaginatedResponse<ActivityLog>>(`/activity-logs?${params}`);
    },
    refetchInterval: 30000,
  });

  const logs = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  const uniqueActions = ["all", ...Object.keys(ACTION_LABELS)];

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      {/* Header */}
      <div className="gz-card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
            <ClipboardList style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
          </div>
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Logs de Actividade</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Registo completo de acções administrativas · {data?.total ?? 0} entradas
            </p>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="gz-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Search style={{ width: 13, height: 13, color: "var(--gz-text-tertiary)" }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (setSearch(searchInput), setPage(1))}
            placeholder="Procurar por acção, detalhe... (Enter)"
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: "var(--gz-text-primary)" }}
          />
          {search && (
            <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(239,68,68,.08)", color: "#ef4444" }}>
              Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter style={{ width: 11, height: 11, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-1.5 rounded-xl text-[12px] font-bold outline-none transition-all"
            style={{
              background: "var(--gz-bg-subtle)",
              border: "1.5px solid rgba(108,92,231,.12)",
              color: actionFilter === "all" ? "var(--gz-text-muted)" : V1,
            }}
          >
            <option value="all">Todas as acções</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <ClipboardList style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9 }} />
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
            {logs.length} de {data?.total ?? 0} registos
          </span>
          <span className="ml-auto text-[11px] font-medium" style={{ color: "var(--gz-text-tertiary)" }}>Clique para expandir</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList style={{ width: 32, height: 32, color: "var(--gz-text-tertiary)", strokeWidth: 1.3, margin: "0 auto 10px" }} />
            <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum log encontrado</div>
          </div>
        ) : (
          <div>
            {logs.map(log => (
              <LogRow key={log.id} log={log}
                isExpanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: page <= 1 ? "var(--gz-text-tertiary)" : V1 }}>
              Anterior
            </button>
            <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
              Página {page} de {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: page >= totalPages ? "var(--gz-text-tertiary)" : V1 }}>
              Seguinte
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
