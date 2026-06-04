import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Send, Users, Megaphone, Clock, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { listNotifications, sendNotification, type AdminNotification } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

type Tab = "criar" | "historico";
type NotifType = "notification" | "announcement";
type TargetType = "all" | "specific";

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("criar");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [type, setType] = useState<NotifType>("notification");
  const [target, setTarget] = useState<TargetType>("all");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: listNotifications,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-notifs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  async function handleSend() {
    if (!user || !title.trim()) return;
    setSending(true);
    try {
      await sendNotification({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        type,
        action_button_label: actionLabel.trim() || undefined,
        action_button_url: actionUrl.trim() || undefined,
        target,
        sent_by: user.id,
      });
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setTitle(""); setSubtitle(""); setActionLabel(""); setActionUrl("");
        setType("notification"); setTarget("all");
        setTab("historico");
      }, 2000);
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar notificação", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enviar notificações push para os utilizadores</p>
        </div>
        <div className="flex gap-2">
          {(["criar", "historico"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${tab === t ? "text-white" : "bg-gray-100 text-gray-600"}`}
              style={tab === t ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)` } : {}}>
              {t === "criar" ? "Criar" : "Histórico"}
            </button>
          ))}
        </div>
      </div>

      {tab === "criar" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Form */}
          <div className="gz-card p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>
                <Bell style={{ width: 18, height: 18, color: "#fff" }} />
              </div>
              <div>
                <div className="font-bold" style={{ color: "var(--gz-text-primary)" }}>Nova Notificação</div>
                <div className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>Enviada em tempo real para os utilizadores</div>
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: "var(--gz-text-muted)" }}>Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {([["notification", "Notificação", Bell], ["announcement", "Anúncio", Megaphone]] as const).map(([val, lbl, Icon]) => (
                  <button key={val} onClick={() => setType(val)}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${type === val ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                    <Icon style={{ width: 16, height: 16, color: type === val ? V1 : "#9ca3af" }} />
                    <span className={`text-[13px] font-semibold ${type === val ? "text-indigo-700" : "text-gray-600"}`}>{lbl}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: "var(--gz-text-muted)" }}>Destinatários</label>
              <div className="grid grid-cols-2 gap-2">
                {([["all", "Todos", Users]] as const).map(([val, lbl, Icon]) => (
                  <button key={val} onClick={() => setTarget(val as TargetType)}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${target === val ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                    <Icon style={{ width: 16, height: 16, color: target === val ? V1 : "#9ca3af" }} />
                    <span className={`text-[13px] font-semibold ${target === val ? "text-indigo-700" : "text-gray-600"}`}>{lbl}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Título *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Torneio amanhã às 20h!"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
            </div>

            {/* Subtitle */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Subtítulo</label>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Ex: Prémio de MT 1000 para o vencedor"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Botão (label)</label>
                <input value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Ex: Jogar agora"
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Botão (link)</label>
                <input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="Ex: /explorar"
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>
            </div>

            <button onClick={handleSend} disabled={!title.trim() || sending || sent}
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: sent ? "#10b981" : !title.trim() ? "#e5e7eb" : `linear-gradient(135deg, ${V1}, #4f46e5)`, color: !title.trim() && !sent ? "#9ca3af" : "#fff" }}>
              {sent ? <><CheckCircle2 style={{ width: 16, height: 16 }} /> Enviado!</>
                : sending ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> A enviar…</>
                  : <><Send style={{ width: 15, height: 15 }} /> Enviar Notificação</>
              }
            </button>
          </div>

          {/* Preview */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--gz-text-muted)" }}>Preview</div>
            <div className="gz-card p-5">
              <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: "#f8f9ff", border: "1px solid rgba(108,92,231,.1)" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>
                  {type === "announcement" ? <Megaphone style={{ width: 18, height: 18, color: "#fff" }} /> : <Bell style={{ width: 18, height: 18, color: "#fff" }} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold" style={{ color: V1 }}>POKER WINNER</span>
                    <span className="text-[10px]" style={{ color: "var(--gz-text-muted)" }}>agora</span>
                  </div>
                  <p className="text-[13.5px] font-bold leading-snug mb-1" style={{ color: "var(--gz-text-primary)" }}>
                    {title || "Título da notificação…"}
                  </p>
                  {subtitle && <p className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>{subtitle}</p>}
                  {actionLabel && (
                    <div className="mt-2">
                      <span className="text-[11.5px] font-bold px-3 py-1 rounded-full" style={{ background: V1 + "15", color: V1 }}>
                        {actionLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div className="gz-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Notificações Enviadas</span>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
              <RefreshCw style={{ width: 11, height: 11 }} /> Actualizar
            </button>
          </div>
          <div className="divide-y" style={{ divideColor: "rgba(108,92,231,.04)" } as any}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></div>
              ))
            ) : history.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
                Nenhuma notificação enviada ainda
              </div>
            ) : history.map((n: AdminNotification) => (
              <div key={n.id} className="px-5 py-4 hover:bg-indigo-50/10 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: n.type === "announcement" ? "rgba(245,158,11,.1)" : "rgba(108,92,231,.1)" }}>
                    {n.type === "announcement"
                      ? <Megaphone style={{ width: 14, height: 14, color: "#f59e0b" }} />
                      : <Bell style={{ width: 14, height: 14, color: V1 }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{n.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: n.target === "all" ? "rgba(16,185,129,.1)" : "rgba(108,92,231,.1)", color: n.target === "all" ? "#10b981" : V1 }}>
                        {n.target === "all" ? "Todos" : "Específico"}
                      </span>
                    </div>
                    {n.subtitle && <p className="text-[12px] mb-0.5" style={{ color: "var(--gz-text-secondary)" }}>{n.subtitle}</p>}
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      <Clock style={{ width: 11, height: 11 }} />
                      {new Date(n.created_at).toLocaleDateString("pt-PT")} às {new Date(n.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
