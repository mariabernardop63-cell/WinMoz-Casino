import { useGetAntiFraudAlerts } from "@/admin/lib/supabase-api";
import { ShieldAlert, AlertTriangle, AlertOctagon, Info } from "lucide-react";

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ElementType }> = {
    high: { cls: "bg-red-100 text-red-700", label: "Alto", icon: AlertOctagon },
    medium: { cls: "bg-amber-100 text-amber-700", label: "Médio", icon: AlertTriangle },
    low: { cls: "bg-blue-100 text-blue-700", label: "Baixo", icon: Info },
  };
  const item = map[severity] ?? map.low;
  const Icon = item.icon;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${item.cls}`}>
      <Icon className="w-3 h-3" /> {item.label}
    </span>
  );
}

export default function AntiFraud() {
  const { data: antiFraud, isLoading } = useGetAntiFraudAlerts();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Anti-Fraude</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitoramento de atividades suspeitas</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Contas Sinalizadas", value: antiFraud?.flaggedAccounts ?? 0, color: "text-red-600", bg: "bg-red-50", icon: AlertOctagon },
          { label: "Apostas Suspeitas", value: antiFraud?.suspiciousBets ?? 0, color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle },
          { label: "Padrões Incomuns", value: antiFraud?.unusualPatterns ?? 0, color: "text-blue-600", bg: "bg-blue-50", icon: Info },
          { label: "Resolvidos Hoje", value: antiFraud?.resolvedToday ?? 0, color: "text-green-600", bg: "bg-green-50", icon: ShieldAlert },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{isLoading ? "—" : stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="font-semibold text-gray-800 text-sm">Alertas de Fraude</div>
          <span className="text-xs text-gray-400">{(antiFraud?.alerts ?? []).length} alertas</span>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-5 h-20 animate-pulse bg-gray-50 m-2 rounded-xl" />)
          ) : (antiFraud?.alerts ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-green-400" />
              Nenhum alerta ativo
            </div>
          ) : (
            (antiFraud?.alerts ?? []).map((alert) => (
              <div key={alert.id} data-testid={`alert-row-${alert.id}`} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{alert.playerName}</span>
                      <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded-full">{alert.type.replace("_", " ")}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{alert.description}</div>
                    <div className="text-xs text-gray-400">{new Date(alert.createdAt).toLocaleString("pt-BR")}</div>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
