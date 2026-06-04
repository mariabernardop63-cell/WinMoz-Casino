import { useState } from "react";
import {
  Bell, Send, Users, Wifi, Calendar, Clock, Repeat,
  Megaphone, Image as ImageIcon, Link as LinkIcon,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  CheckCircle2, Sparkles, Trash2, AlertCircle,
} from "lucide-react";
import {
  useSendNotification,
  useGetNotificationHistory,
} from "@/admin/lib/supabase-api";

const V1 = "#6C5CE7";

type Tab = "criar" | "anuncios" | "historico";

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="gz-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-indigo-50/30">
        <span className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</span>
        {open ? <ChevronUp style={{ width: 16, height: 16, color: V1 }} /> : <ChevronDown style={{ width: 16, height: 16, color: "var(--gz-text-muted)" }} />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function ToggleSwitch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-2.5 text-[12.5px] font-medium" style={{ color: "var(--gz-text-secondary)" }}>
      {value
        ? <ToggleRight style={{ width: 24, height: 24, color: V1 }} />
        : <ToggleLeft  style={{ width: 24, height: 24, color: "var(--gz-text-tertiary)" }} />
      }
      {label}
    </button>
  );
}

function InputField({ label, placeholder, value, onChange, type = "text" }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-2xl outline-none text-[13px]"
        style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)", color: "var(--gz-text-primary)" }}
      />
    </div>
  );
}

function fmtTarget(target: string): string {
  if (target === "all")      return "Todos";
  if (target === "online")   return "Online";
  if (target === "specific") return "Específico";
  return target;
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<Tab>("criar");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const sendNotification = useSendNotification();
  const { data: history = [], isLoading: loadingHistory } = useGetNotificationHistory();

  // Notification form
  const [notifTitle, setNotifTitle]       = useState("");
  const [notifSubtitle, setNotifSubtitle] = useState("");
  const [notifTarget, setNotifTarget]     = useState<"all" | "online" | "specific">("all");
  const [specificUser, setSpecificUser]   = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate]   = useState("");
  const [openSections, setOpenSections]   = useState({ target: true, schedule: false });

  // Announcement form
  const [annTitle, setAnnTitle]           = useState("");
  const [annSubtitle, setAnnSubtitle]     = useState("");
  const [annImage, setAnnImage]           = useState("");
  const [annBtnLabel, setAnnBtnLabel]     = useState("");
  const [annBtnType, setAnnBtnType]       = useState<"url" | "screen">("url");
  const [annBtnValue, setAnnBtnValue]     = useState("");
  const [openAnnSections, setOpenAnnSections] = useState({ content: true, action: true });

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(p => ({ ...p, [key]: !p[key] }));
  }
  function toggleAnnSection(key: keyof typeof openAnnSections) {
    setOpenAnnSections(p => ({ ...p, [key]: !p[key] }));
  }

  function handleSendNotif() {
    if (!notifTitle.trim()) return;
    sendNotification.mutate(
      {
        title:       notifTitle,
        subtitle:    notifSubtitle || undefined,
        type:        "notification",
        target:      notifTarget,
        targetUserIds: notifTarget === "specific" && specificUser ? [specificUser] : undefined,
      },
      {
        onSuccess: () => {
          setStatus("ok");
          setNotifTitle(""); setNotifSubtitle(""); setSpecificUser("");
          setTimeout(() => setStatus("idle"), 4000);
        },
        onError: () => {
          setStatus("error");
          setTimeout(() => setStatus("idle"), 4000);
        },
      }
    );
  }

  function handleSendAnn() {
    if (!annTitle.trim()) return;
    sendNotification.mutate(
      {
        title:             annTitle,
        subtitle:          annSubtitle || undefined,
        type:              "announcement",
        target:            "all",
        imageUrl:          annImage || undefined,
        actionButtonLabel: annBtnLabel || undefined,
        actionButtonUrl:   annBtnValue || undefined,
      },
      {
        onSuccess: () => {
          setStatus("ok");
          setAnnTitle(""); setAnnSubtitle(""); setAnnImage(""); setAnnBtnLabel(""); setAnnBtnValue("");
          setTimeout(() => setStatus("idle"), 4000);
        },
        onError: () => {
          setStatus("error");
          setTimeout(() => setStatus("idle"), 4000);
        },
      }
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "criar",    label: "Criar Notificação", icon: Bell      },
    { id: "anuncios", label: "Anúncios",          icon: Megaphone },
    { id: "historico",label: "Histórico",         icon: Clock     },
  ];

  return (
    <div className="px-5 pb-10 pt-4">

      {/* Status toast */}
      {status === "ok" && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl"
          style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff" }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">Enviado com sucesso!</span>
        </div>
      )}
      {status === "error" && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl"
          style={{ background: "#ef4444", color: "#fff" }}>
          <AlertCircle style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">Erro ao enviar. Tenta novamente.</span>
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
            <Bell style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
          </div>
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Notificações</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Envie notificações e anúncios — os utilizadores recebem em tempo real
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-bold whitespace-nowrap transition-all flex-shrink-0"
            style={activeTab === t.id
              ? { background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff", boxShadow: "0 4px 12px rgba(108,92,231,.35)" }
              : { background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }
            }>
            <t.icon style={{ width: 14, height: 14 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Criar Notificação ── */}
      {activeTab === "criar" && (
        <div className="space-y-4">
          <div className="gz-card p-5 space-y-4">
            <div className="text-[15px] font-bold mb-1" style={{ color: "var(--gz-text-primary)" }}>Conteúdo</div>
            <InputField label="Título" placeholder="Ex: Nova promoção disponível!" value={notifTitle} onChange={setNotifTitle} />
            <InputField label="Subtítulo (opcional)" placeholder="Ex: Aproveite até amanhã" value={notifSubtitle} onChange={setNotifSubtitle} />

            {/* Preview */}
            {notifTitle && (
              <div className="mt-2 p-3.5 rounded-2xl" style={{ background: "rgba(108,92,231,.05)", border: "1.5px solid rgba(108,92,231,.12)" }}>
                <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: "var(--gz-text-tertiary)" }}>Pré-visualização</div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>
                    <Bell style={{ width: 14, height: 14, color: "#fff" }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{notifTitle}</div>
                    {notifSubtitle && <div className="text-[11.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{notifSubtitle}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Section title="Destinatário" open={openSections.target} onToggle={() => toggleSection("target")}>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { id: "all" as const,      icon: Users, label: "Todos",             desc: "Incluindo offline" },
                { id: "online" as const,   icon: Wifi,  label: "Online",            desc: "Apenas activos"   },
                { id: "specific" as const, icon: Bell,  label: "Específico",        desc: "Por ID"           },
              ].map(t => (
                <button key={t.id} onClick={() => setNotifTarget(t.id)}
                  className="p-3.5 rounded-2xl text-left transition-all"
                  style={{
                    border: notifTarget === t.id ? `2px solid ${V1}` : "1.5px solid rgba(108,92,231,.12)",
                    background: notifTarget === t.id ? "rgba(108,92,231,.07)" : "transparent",
                  }}>
                  <div className="w-8 h-8 rounded-xl mb-2 flex items-center justify-center" style={{ background: notifTarget === t.id ? `${V1}18` : "rgba(0,0,0,.04)" }}>
                    <t.icon style={{ width: 15, height: 15, color: notifTarget === t.id ? V1 : "#111" }} />
                  </div>
                  <div className="text-[12px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{t.label}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{t.desc}</div>
                </button>
              ))}
            </div>
            {notifTarget === "specific" && (
              <div className="mt-3">
                <InputField label="ID do utilizador" placeholder="UUID do utilizador" value={specificUser} onChange={setSpecificUser} />
              </div>
            )}
          </Section>

          <Section title="Agendar envio" open={openSections.schedule} onToggle={() => toggleSection("schedule")}>
            <div className="mt-2 space-y-3">
              <ToggleSwitch value={scheduleEnabled} onChange={setScheduleEnabled} label="Activar agendamento" />
              {scheduleEnabled && (
                <InputField label="Data e hora" value={scheduleDate} onChange={setScheduleDate} type="datetime-local" />
              )}
            </div>
          </Section>

          <button onClick={handleSendNotif} disabled={!notifTitle.trim() || sendNotification.isPending}
            className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: notifTitle.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "rgba(108,92,231,.2)",
              boxShadow: notifTitle.trim() ? "0 6px 18px rgba(108,92,231,.4)" : "none",
              opacity: notifTitle.trim() ? 1 : 0.6,
            }}>
            {sendNotification.isPending
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /><span>A enviar…</span></>
              : <><Send style={{ width: 16, height: 16 }} />{scheduleEnabled ? "Agendar notificação" : "Enviar agora"}</>
            }
          </button>
        </div>
      )}

      {/* ── Tab: Anúncios ── */}
      {activeTab === "anuncios" && (
        <div className="space-y-4">
          <Section title="Conteúdo do anúncio" open={openAnnSections.content} onToggle={() => toggleAnnSection("content")}>
            <div className="space-y-4 mt-2">
              <InputField label="Título" placeholder="Ex: Grande promoção de verão!" value={annTitle} onChange={setAnnTitle} />
              <InputField label="Subtítulo" placeholder="Ex: Até 50% de bónus em todos os jogos" value={annSubtitle} onChange={setAnnSubtitle} />
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Imagem (URL opcional)</label>
                <div className="flex items-center gap-3">
                  {annImage && (
                    <img src={annImage} alt="preview" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" style={{ border: "1.5px solid rgba(108,92,231,.15)" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl" style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)" }}>
                    <ImageIcon style={{ width: 14, height: 14, color: V1, flexShrink: 0 }} />
                    <input value={annImage} onChange={e => setAnnImage(e.target.value)} placeholder="https://..." className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: "var(--gz-text-primary)" }} />
                  </div>
                </div>
              </div>

              {/* Preview do anúncio */}
              {annTitle && (
                <div className="mt-1 rounded-2xl overflow-hidden" style={{ border: "1.5px solid rgba(108,92,231,.12)" }}>
                  {annImage && <img src={annImage} alt="" className="w-full h-32 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div className="p-3.5" style={{ background: "rgba(108,92,231,.03)" }}>
                    <div className="text-[14px] font-bold mb-0.5" style={{ color: "var(--gz-text-primary)" }}>{annTitle}</div>
                    {annSubtitle && <div className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>{annSubtitle}</div>}
                    {annBtnLabel && (
                      <div className="mt-2.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-center text-white inline-block" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>{annBtnLabel}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title="Botão de ação (opcional)" open={openAnnSections.action} onToggle={() => toggleAnnSection("action")}>
            <div className="space-y-3 mt-2">
              <InputField label="Texto do botão" placeholder="Ex: Jogar agora" value={annBtnLabel} onChange={setAnnBtnLabel} />
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>Destino do botão</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { id: "url" as const,    icon: LinkIcon, label: "URL externo"  },
                    { id: "screen" as const, icon: Sparkles, label: "Tela do site" },
                  ].map(o => (
                    <button key={o.id} onClick={() => setAnnBtnType(o.id)}
                      className="flex items-center gap-2 p-3 rounded-xl text-[12.5px] font-semibold transition-all"
                      style={{ border: annBtnType === o.id ? `1.5px solid ${V1}` : "1.5px solid rgba(108,92,231,.12)", color: annBtnType === o.id ? V1 : "var(--gz-text-muted)", background: annBtnType === o.id ? "rgba(108,92,231,.06)" : "transparent" }}>
                      <o.icon style={{ width: 14, height: 14 }} />
                      {o.label}
                    </button>
                  ))}
                </div>
                <InputField
                  label={annBtnType === "url" ? "URL de destino" : "Tela de destino"}
                  placeholder={annBtnType === "url" ? "https://..." : "Ex: /jogos, /perfil"}
                  value={annBtnValue}
                  onChange={setAnnBtnValue}
                />
              </div>
            </div>
          </Section>

          <button onClick={handleSendAnn} disabled={!annTitle.trim() || sendNotification.isPending}
            className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: annTitle.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "rgba(108,92,231,.2)",
              boxShadow: annTitle.trim() ? "0 6px 18px rgba(108,92,231,.4)" : "none",
              opacity: annTitle.trim() ? 1 : 0.6,
            }}>
            {sendNotification.isPending
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /><span>A publicar…</span></>
              : <><Megaphone style={{ width: 16, height: 16 }} />Publicar anúncio</>
            }
          </button>
        </div>
      )}

      {/* ── Tab: Histórico ── */}
      {activeTab === "historico" && (
        <div className="gz-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
              {loadingHistory ? "A carregar…" : `${history.length} notificação${history.length !== 1 ? "ções" : ""} enviada${history.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loadingHistory && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
            </div>
          )}

          {!loadingHistory && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Bell style={{ width: 28, height: 28, color: "var(--gz-text-tertiary)", opacity: .4 }} />
              <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>Ainda não foram enviadas notificações.</p>
            </div>
          )}

          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
            {(history as Record<string, unknown>[]).map(h => {
              const isAnn = h.type === "announcement";
              return (
                <div key={h.id as string} className="px-5 py-4 flex items-center gap-4 hover:bg-indigo-50/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isAnn ? "rgba(245,158,11,.08)" : "rgba(16,185,129,.08)" }}>
                    {isAnn
                      ? <Megaphone style={{ width: 16, height: 16, color: "#f59e0b" }} />
                      : <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{h.title as string}</div>
                    <div className="text-[11.5px] mt-0.5 flex items-center gap-2" style={{ color: "var(--gz-text-muted)" }}>
                      <span>{fmtTarget(h.target as string)}</span>
                      <span>·</span>
                      <Clock style={{ width: 10, height: 10 }} />
                      <span>{new Date(h.created_at as string).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      {isAnn && <><span>·</span><span className="font-semibold" style={{ color: "#f59e0b" }}>Anúncio</span></>}
                    </div>
                    {(h.subtitle as string | null) && (
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--gz-text-tertiary)" }}>{h.subtitle as string}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

