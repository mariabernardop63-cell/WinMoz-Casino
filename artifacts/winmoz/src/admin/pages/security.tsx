import { useState } from "react";
import {
  ShieldCheck, AlertOctagon, AlertTriangle, Info,
  Wifi, Server, Database, Lock, Globe, Eye,
  CheckCircle2, XCircle, Clock, BarChart3, Zap,
  RefreshCw,
} from "lucide-react";

const V1 = "#6C5CE7";

const THREATS = [
  { id: 1, type: "Tentativa de acesso não autorizado", source: "196.53.22.100", severity: "high",   time: "Hoje 14:32", status: "blocked"  },
  { id: 2, type: "Múltiplos logins falhados",          source: "41.215.8.44",   severity: "medium", time: "Hoje 11:15", status: "monitored"},
  { id: 3, type: "Padrão de bot detectado",            source: "102.130.5.9",   severity: "medium", time: "Hoje 09:00", status: "blocked"  },
  { id: 4, type: "Token JWT inválido (tentativa)",     source: "197.220.12.33", severity: "low",    time: "Ontem",      status: "dismissed"},
];

const SECURITY_EVENTS = [
  { id: 1, event: "Firewall actualizado",         time: "Hoje 10:00", type: "info"    },
  { id: 2, event: "Certificado SSL renovado",     time: "Hoje 08:30", type: "success" },
  { id: 3, event: "IP bloqueado: 196.53.22.100", time: "Hoje 14:32", type: "warning" },
  { id: 4, event: "Backup automático concluído", time: "Ontem 03:00", type: "success" },
  { id: 5, event: "2 logins admin detectados",   time: "Ontem 16:45", type: "info"    },
];

const SERVICES = [
  { name: "Servidor Web",    icon: Server,   status: "online",  uptime: "99.9%", color: "#059669" },
  { name: "Base de Dados",   icon: Database, status: "online",  uptime: "99.8%", color: "#059669" },
  { name: "Firewall",        icon: ShieldCheck, status: "online", uptime: "100%", color: "#059669" },
  { name: "CDN / Rede",      icon: Globe,    status: "online",  uptime: "99.7%", color: "#059669" },
  { name: "Encriptação SSL", icon: Lock,     status: "online",  uptime: "100%",  color: "#059669" },
  { name: "WebSocket",       icon: Wifi,     status: "online",  uptime: "98.5%", color: "#059669" },
];

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "high")   return <AlertOctagon  style={{ width: 15, height: 15, color: "#dc2626" }} />;
  if (severity === "medium") return <AlertTriangle style={{ width: 15, height: 15, color: "#d97706" }} />;
  return <Info style={{ width: 15, height: 15, color: "#3b82f6" }} />;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    blocked:   { cls: "bg-red-100 text-red-700",    label: "Bloqueado"    },
    monitored: { cls: "bg-amber-100 text-amber-700", label: "Monitorado"  },
    dismissed: { cls: "bg-gray-100 text-gray-500",   label: "Arquivado"   },
  };
  const item = map[status] ?? map.dismissed;
  return <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${item.cls}`}>{item.label}</span>;
}

export default function Security() {
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1800);
  }

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      {/* Header */}
      <div className="gz-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
              <ShieldCheck style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
            </div>
            <div>
              <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Segurança</h1>
              <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
                Monitoramento do sistema operacional e ameaças
              </p>
            </div>
          </div>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12.5px] font-bold transition-all hover:-translate-y-0.5 active:scale-95"
            style={{ background: "var(--gz-bg-subtle)", color: V1, border: "1.5px solid rgba(108,92,231,.12)" }}>
            <RefreshCw style={{ width: 13, height: 13, animation: refreshing ? "spin 1s linear infinite" : undefined }} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Security score */}
      <div className="gz-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Pontuação de Segurança</div>
          <div className="text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(16,185,129,.1)", color: "#059669" }}>● Operacional</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(108,92,231,.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={V1} strokeWidth="3" strokeLinecap="round"
                strokeDasharray="87 100" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-black" style={{ color: V1 }}>87</span>
              <span className="text-[9px] font-bold" style={{ color: "var(--gz-text-muted)" }}>/100</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            {[
              { label: "Protecção de rede",    pct: 95, color: "#059669" },
              { label: "Autenticação",          pct: 88, color: V1       },
              { label: "Encriptação de dados",  pct: 92, color: "#059669" },
              { label: "Controlo de acesso",    pct: 75, color: "#d97706" },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-[11.5px] font-semibold mb-1">
                  <span style={{ color: "var(--gz-text-secondary)" }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 800 }}>{item.pct}%</span>
                </div>
                <div className="gz-progress-track h-1.5">
                  <div style={{ width: `${item.pct}%`, height: "100%", borderRadius: 100, background: item.color, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services status */}
      <div className="gz-card p-5">
        <div className="text-[15px] font-bold mb-4" style={{ color: "var(--gz-text-primary)" }}>Estado dos Serviços</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SERVICES.map(s => (
            <div key={s.name} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "var(--gz-bg-subtle)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}12` }}>
                <s.icon style={{ width: 15, height: 15, color: s.color, strokeWidth: 1.8 }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{s.name}</div>
                <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  Online · {s.uptime}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Threats */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex items-center gap-2.5">
            <AlertOctagon style={{ width: 16, height: 16, color: "#dc2626" }} />
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Ameaças Detectadas</span>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>
            {THREATS.filter(t => t.status !== "dismissed").length} activas
          </span>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
          {THREATS.map(t => (
            <div key={t.id} className="px-5 py-4 flex items-center gap-4 hover:bg-red-50/20 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: t.severity === "high" ? "rgba(220,38,38,.08)" : t.severity === "medium" ? "rgba(217,119,6,.08)" : "rgba(59,130,246,.08)" }}>
                <SeverityIcon severity={t.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{t.type}</div>
                <div className="flex items-center gap-2.5 mt-0.5 text-[11.5px]" style={{ color: "var(--gz-text-muted)" }}>
                  <span className="flex items-center gap-1"><Globe style={{ width: 9, height: 9 }} />{t.source}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock style={{ width: 9, height: 9 }} />{t.time}</span>
                </div>
              </div>
              <StatusChip status={t.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Security events log */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <BarChart3 style={{ width: 16, height: 16, color: V1 }} />
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Registo de Eventos</span>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
          {SECURITY_EVENTS.map(e => {
            const iconMap = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
            const colorMap = { info: "#3b82f6", success: "#059669", warning: "#d97706", error: "#dc2626" };
            const Icon  = iconMap[e.type as keyof typeof iconMap] ?? Info;
            const color = colorMap[e.type as keyof typeof colorMap] ?? "#3b82f6";
            return (
              <div key={e.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-indigo-50/20 transition-colors">
                <Icon style={{ width: 15, height: 15, color, flexShrink: 0 }} />
                <div className="flex-1 text-[13px] font-medium" style={{ color: "var(--gz-text-primary)" }}>{e.event}</div>
                <div className="text-[11px] flex-shrink-0" style={{ color: "var(--gz-text-tertiary)" }}>{e.time}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced settings */}
      <div className="gz-card p-5">
        <div className="text-[15px] font-bold mb-4" style={{ color: "var(--gz-text-primary)" }}>Configurações Avançadas</div>
        <div className="space-y-3">
          {[
            { label: "Autenticação de 2 factores (2FA)",       desc: "Obrigatório para todos os admins",    icon: Lock,       active: true  },
            { label: "Bloqueio automático de IPs suspeitos",    desc: "Após 5 tentativas falhadas",          icon: Globe,      active: true  },
            { label: "Alertas de segurança por email",          desc: "Notificação imediata de ameaças",     icon: Zap,        active: true  },
            { label: "Monitoramento em tempo real",             desc: "Análise contínua de tráfego",         icon: Eye,        active: true  },
            { label: "Logs de sessão prolongados",              desc: "Guardar logs por 90 dias",            icon: Clock,      active: false },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: "var(--gz-bg-subtle)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.active ? "rgba(108,92,231,.1)" : "rgba(0,0,0,.04)" }}>
                <s.icon style={{ width: 16, height: 16, color: s.active ? V1 : "#9ca3af", strokeWidth: 1.8 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{s.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{s.desc}</div>
              </div>
              <div className="flex-shrink-0">
                {s.active
                  ? <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#059669" }}><CheckCircle2 style={{ width: 13, height: 13 }} />Activo</span>
                  : <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#9ca3af" }}><XCircle style={{ width: 13, height: 13 }} />Inactivo</span>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
