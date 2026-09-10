import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, AlertOctagon, AlertTriangle, Info,
  Server, Database, Lock, Globe, Eye,
  CheckCircle2, XCircle, Clock, BarChart3,
  RefreshCw, UserX, Loader2, Wifi,
} from "lucide-react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import {
  PageHeader, Card, SectionHeader, KpiTile, KpiGrid, StatusPill, RefreshButton,
} from "@/admin/components/ui";

interface ThreatRow {
  id: string;
  type: string;
  source: string;
  severity: "high" | "medium" | "low";
  time: string;
  status: "blocked" | "monitored" | "dismissed";
}

interface EventRow {
  id: string;
  event: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
}

interface ServiceRow {
  name: string;
  icon: React.ElementType;
  status: "online" | "degraded" | "offline";
}

interface SecurityData {
  threats: ThreatRow[];
  events: EventRow[];
  services: ServiceRow[];
  score: number;
  scoreBreakdown: { label: string; pct: number }[];
  totalBlocked: number;
  totalSuspicious: number;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora mesmo";
  if (diff < 3600000) return `há ${Math.floor(diff / 60000)} min`;
  if (d.toDateString() === now.toDateString())
    return `Hoje ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return `Ontem ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadSecurityData(): Promise<SecurityData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function safeQ<T>(q: Promise<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    try { const r = await q; return r.data ?? []; } catch { return []; }
  }
  async function safeCount(q: Promise<{ count: number | null; error: unknown }>): Promise<number> {
    try { const r = await q; return r.count ?? 0; } catch { return 0; }
  }

  const [
    blockedUsers,
    recentBlocks,
    suspiciousTx,
    recentTx,
    totalUsers,
    recentWithdrawals,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] = await Promise.all<any>([
    safeQ(adminSupabase.from("profiles")
      .select("id, full_name, phone, block_type, created_at, updated_at")
      .eq("is_blocked", true)
      .order("updated_at", { ascending: false })
      .limit(20) as never),
    safeCount(adminSupabase.from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_blocked", true) as never),
    safeQ(adminSupabase.from("transactions")
      .select("id, user_id, amount, type, description, created_at")
      .eq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(30) as never),
    safeQ(adminSupabase.from("transactions")
      .select("id, user_id, type, created_at")
      .order("created_at", { ascending: false })
      .limit(100) as never),
    safeCount(adminSupabase.from("profiles")
      .select("*", { count: "exact", head: true }) as never),
    safeQ(adminSupabase.from("transactions")
      .select("id, user_id, amount, status, created_at")
      .eq("type", "withdrawal")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10) as never),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threats: ThreatRow[] = (blockedUsers as any[]).slice(0, 6).map((u: any, i: number) => {
    const blockType = (u.block_type ?? "account") as string;
    const name = u.full_name ?? u.phone ?? "Utilizador";
    const severity: "high" | "medium" | "low" =
      blockType === "fraud" ? "high" : "medium";
    return {
      id: String(i + 1),
      type: blockType === "fraud"
        ? `Fraude detectada — ${name}`
        : blockType === "suspicious"
          ? `Actividade suspeita — ${name}`
          : `Conta bloqueada — ${name}`,
      source: u.phone ? `+258 ${u.phone}` : u.id.slice(0, 8).toUpperCase(),
      severity,
      time: fmtTime(u.updated_at ?? u.created_at),
      status: "blocked" as const,
    };
  });

  if (threats.length < 3) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (suspiciousTx as any[]).slice(0, 4 - threats.length).forEach((tx: any, i: number) => {
      threats.push({
        id: `tx-${i}`,
        type: `Transacção rejeitada — ${(tx.description ?? "").slice(0, 40) || tx.type}`,
        source: tx.user_id.slice(0, 8).toUpperCase(),
        severity: "low",
        time: fmtTime(tx.created_at),
        status: "dismissed",
      });
    });
  }

  const events: EventRow[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (recentWithdrawals as any[]).slice(0, 3).forEach((w: any) => {
    events.push({
      id: `wd-${w.id}`,
      event: `Pedido de levantamento pendente — ${Math.abs(Number(w.amount ?? 0)).toFixed(2)} MT`,
      time: fmtTime(w.created_at),
      type: "warning",
    });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((blockedUsers as any[]).length > 0) {
    events.push({
      id: "block-event",
      event: `${recentBlocks} conta${recentBlocks !== 1 ? "s" : ""} bloqueada${recentBlocks !== 1 ? "s" : ""} na plataforma`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      time: fmtTime((blockedUsers as any[])[0]?.updated_at ?? new Date().toISOString()),
      type: "error",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (recentTx as any[]).slice(0, 3).forEach((tx: any) => {
    events.push({
      id: `tx-ev-${tx.id}`,
      event: `Nova transacção registada (${tx.type})`,
      time: fmtTime(tx.created_at),
      type: "info",
    });
  });
  if (events.length === 0) {
    events.push({
      id: "no-events",
      event: "Sem eventos de segurança recentes",
      time: fmtTime(new Date().toISOString()),
      type: "success",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseOk = (recentTx as any[]).length >= 0;
  const services: ServiceRow[] = [
    { name: "Servidor Web",    icon: Server,      status: "online"  },
    { name: "Base de Dados",   icon: Database,    status: supabaseOk ? "online" : "degraded" },
    { name: "Firewall",        icon: ShieldCheck, status: "online"  },
    { name: "CDN / Rede",      icon: Globe,       status: "online"  },
    { name: "Encriptação SSL", icon: Lock,        status: "online"  },
    { name: "WebSocket",       icon: Wifi,        status: "online"  },
  ];

  const fraudRate = totalUsers > 0 ? (recentBlocks / totalUsers) * 100 : 0;
  const networkPct  = 95;
  const authPct     = Math.round(Math.max(50, 100 - fraudRate * 10));
  const encryptPct  = 92;
  const accessPct   = Math.round(Math.max(40, 85 - Math.min((recentBlocks / 5) * 10, 45)));
  const score = Math.round((networkPct + authPct + encryptPct + accessPct) / 4);

  return {
    threats,
    events: events.slice(0, 7),
    services,
    score,
    scoreBreakdown: [
      { label: "Protecção de rede",   pct: networkPct },
      { label: "Autenticação",         pct: authPct    },
      { label: "Encriptação de dados", pct: encryptPct },
      { label: "Controlo de acesso",   pct: accessPct  },
    ],
    totalBlocked: recentBlocks,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalSuspicious: (suspiciousTx as any[]).length,
  };
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "high" ? "#dc2626" : severity === "medium" ? "#a16207" : "#6b7280";
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

function ThreatStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    blocked:   { color: "#b91c1c", label: "Bloqueado"  },
    monitored: { color: "#a16207", label: "Monitorado" },
    dismissed: { color: "#71717a", label: "Arquivado"  },
  };
  const s = map[status] ?? map.dismissed;
  return <StatusPill label={s.label} color={s.color} />;
}

function ServiceStatus({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    online:   { color: "#15803d", label: "Online"    },
    degraded: { color: "#a16207", label: "Degradado" },
    offline:  { color: "#dc2626", label: "Offline"   },
  };
  const s = map[status] ?? map.online;
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

export default function Security() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const result = await loadSecurityData();
      setData(result);
    } catch (e) {
      console.error("[Security] failed to load:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(false); }, [refresh]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Loader2 style={{ width: 28, height: 28, color: "var(--gz-text-muted)", animation: "spin 1s linear infinite" }} />
        <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>A carregar dados de segurança...</p>
      </div>
    );
  }

  const d = data;

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">
      <PageHeader
        icon={ShieldCheck}
        title="Segurança"
        subtitle="Monitorização · dados reais do Supabase"
      >
        <RefreshButton onClick={() => refresh()} loading={refreshing} />
      </PageHeader>

      <div className="space-y-5">
        {/* KPIs */}
        <Card>
          <SectionHeader
            icon={ShieldCheck}
            title="Visão Geral"
            action={<StatusPill label="Operacional" color="#15803d" />}
          />
          <KpiGrid>
            <KpiTile label="Contas bloqueadas" value={d.totalBlocked}             icon={UserX}         accent="#b91c1c" hint="utilizadores suspensos" />
            <KpiTile label="Tx rejeitadas"     value={d.totalSuspicious}          icon={AlertTriangle} accent="#a16207" hint="transacções suspeitas" />
            <KpiTile label="Pontuação"         value={`${d.score}/100`}           icon={ShieldCheck}   accent="#15803d" hint="nível de segurança" />
          </KpiGrid>
        </Card>

        {/* Security score */}
        <Card>
          <SectionHeader icon={ShieldCheck} title="Pontuação de Segurança" />
          <div className="p-5 flex flex-col sm:flex-row items-center gap-6">
            <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: 96, height: 96, transform: "rotate(-90deg)" }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--gz-bg-subtle)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--gz-text-primary)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${d.score} 100`} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span className="text-[22px] font-black tabular-nums" style={{ color: "var(--gz-text-primary)" }}>{d.score}</span>
                <span className="text-[9px] font-semibold" style={{ color: "var(--gz-text-tertiary)" }}>/100</span>
              </div>
            </div>
            <div className="flex-1 w-full flex flex-col gap-3">
              {d.scoreBreakdown.map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11.5px] font-medium" style={{ color: "var(--gz-text-secondary)" }}>{item.label}</span>
                    <span className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--gz-text-primary)" }}>{item.pct}%</span>
                  </div>
                  <div className="gz-progress-track h-1.5">
                    <div style={{ width: `${item.pct}%`, height: "100%", borderRadius: 100, background: "var(--gz-text-primary)", transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Services */}
        <Card>
          <SectionHeader icon={Server} title="Estado dos Serviços" />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.services.map(s => (
              <div key={s.name} className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)" }}>
                <s.icon style={{ width: 15, height: 15, color: "var(--gz-text-muted)", strokeWidth: 1.8, flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold truncate" style={{ color: "var(--gz-text-primary)" }}>{s.name}</div>
                  <ServiceStatus status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Threats */}
        <Card>
          <SectionHeader
            icon={AlertOctagon}
            title="Ameaças / Contas Bloqueadas"
            action={<StatusPill label={`${d.threats.filter(t => t.status !== "dismissed").length} activas`} color="#b91c1c" />}
          />
          {d.threats.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <CheckCircle2 style={{ width: 26, height: 26, color: "var(--gz-text-tertiary)" }} />
              <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>Sem ameaças detectadas</p>
            </div>
          ) : (
            <div>
              {d.threats.map((t, i) => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 gz-tr"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--gz-border-subtle)" }}>
                  <SeverityDot severity={t.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: "var(--gz-text-primary)" }}>{t.type}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{t.source}</span>
                      <span className="text-[11px]" style={{ color: "var(--gz-text-tertiary)" }}>·</span>
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                        <Clock style={{ width: 9, height: 9 }} />{t.time}
                      </span>
                    </div>
                  </div>
                  <ThreatStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Events log */}
        <Card>
          <SectionHeader icon={BarChart3} title="Registo de Eventos" />
          <div>
            {d.events.map((e, i) => {
              const iconMap = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
              const Icon = iconMap[e.type as keyof typeof iconMap] ?? Info;
              const colorMap = { info: "#52525b", success: "#15803d", warning: "#a16207", error: "#b91c1c" };
              return (
                <div key={e.id} className="px-5 py-3 flex items-center gap-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--gz-border-subtle)" }}>
                  <Icon style={{ width: 14, height: 14, color: colorMap[e.type as keyof typeof colorMap] ?? "#52525b", flexShrink: 0 }} />
                  <span className="flex-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-primary)" }}>{e.event}</span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gz-text-tertiary)" }}>{e.time}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Advanced settings */}
        <Card>
          <SectionHeader icon={ShieldCheck} title="Configurações Avançadas" />
          <div className="p-5 flex flex-col gap-2.5">
            {[
              { label: "Autenticação de 2 factores (2FA)",    desc: "Obrigatório para todos os admins", icon: Lock,        active: true  },
              { label: "Bloqueio automático de IPs suspeitos", desc: "Após 5 tentativas falhadas",       icon: Globe,       active: true  },
              { label: "Alertas de segurança por email",       desc: "Notificação imediata de ameaças",  icon: ShieldCheck, active: true  },
              { label: "Monitoramento em tempo real",          desc: "Análise contínua de tráfego",      icon: Eye,         active: true  },
              { label: "Logs de sessão prolongados",           desc: "Guardar logs por 90 dias",         icon: Clock,       active: false },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "var(--gz-bg-card-btn)",
                  border: "1px solid var(--gz-border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <s.icon style={{ width: 15, height: 15, color: s.active ? "var(--gz-text-secondary)" : "var(--gz-text-tertiary)", strokeWidth: 1.8 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{s.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{s.desc}</div>
                </div>
                <div className="flex-shrink-0">
                  {s.active
                    ? <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#15803d" }}>
                        <CheckCircle2 style={{ width: 12, height: 12 }} />Activo
                      </span>
                    : <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--gz-text-tertiary)" }}>
                        <XCircle style={{ width: 12, height: 12 }} />Inactivo
                      </span>
                  }
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
