import { useState } from "react";
import {
  Bell, Send, Users, Wifi, Calendar, Clock, Repeat,
  Megaphone, Image as ImageIcon, Link as LinkIcon,
  Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  CheckCircle2, Sparkles,
} from "lucide-react";

const V1 = "#6C5CE7";

type Tab = "criar" | "anuncios" | "agendadas" | "historico";

const SENT_HISTORY = [
  { id: 1, title: "Bem-vindo ao POKER WINNER!",   target: "Todos",          sent: "2025-06-01 09:00", reached: 1240 },
  { id: 2, title: "Novo jogo: Roleta da Sorte",  target: "Online",         sent: "2025-05-28 18:30", reached:  312 },
  { id: 3, title: "Saque processado",            target: "Específico",     sent: "2025-05-25 14:00", reached:    1 },
  { id: 4, title: "Torneio de Dama — amanhã!",  target: "Todos",          sent: "2025-05-20 20:00", reached: 980  },
];

const SCHEDULED = [
  { id: 1, title: "Promoção de fim-de-semana",  target: "Todos",  scheduledAt: "2025-06-07 19:00", repeat: "Nenhum"           },
  { id: 2, title: "Lembrete diário de jogo",    target: "Online", scheduledAt: "Diário às 20:00",  repeat: "Todos os dias"    },
  { id: 3, title: "Oferta de segunda-feira",    target: "Todos",  scheduledAt: "Toda segunda-feira 09:00", repeat: "Semanal"  },
];

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

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<Tab>("criar");
  const [showSuccess, setShowSuccess] = useState(false);

  // Notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifSubtitle, setNotifSubtitle] = useState("");
  const [notifTarget, setNotifTarget] = useState<"all" | "online" | "specific">("all");
  const [specificUser, setSpecificUser] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationType, setAutomationType] = useState<"once_daily" | "once_weekly">("once_daily");
  const [automationDays, setAutomationDays] = useState(7);
  const [openSections, setOpenSections] = useState({ target: true, schedule: false, automation: false });

  // Announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annSubtitle, setAnnSubtitle] = useState("");
  const [annImage, setAnnImage] = useState("");
  const [annBtnLabel, setAnnBtnLabel] = useState("");
  const [annBtnType, setAnnBtnType] = useState<"url" | "screen">("url");
  const [annBtnValue, setAnnBtnValue] = useState("");
  const [annSchedule, setAnnSchedule] = useState(false);
  const [annScheduleDate, setAnnScheduleDate] = useState("");
  const [annAutomation, setAnnAutomation] = useState(false);
  const [openAnnSections, setOpenAnnSections] = useState({ content: true, action: true, schedule: false, automation: false });

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(p => ({ ...p, [key]: !p[key] }));
  }
  function toggleAnnSection(key: keyof typeof openAnnSections) {
    setOpenAnnSections(p => ({ ...p, [key]: !p[key] }));
  }

  function handleSend() {
    setShowSuccess(true);
    setNotifTitle(""); setNotifSubtitle(""); setSpecificUser("");
    setTimeout(() => setShowSuccess(false), 4000);
  }
  function handleSendAnn() {
    setShowSuccess(true);
    setAnnTitle(""); setAnnSubtitle(""); setAnnImage(""); setAnnBtnLabel(""); setAnnBtnValue("");
    setTimeout(() => setShowSuccess(false), 4000);
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "criar",     label: "Criar Notificação",  icon: Bell       },
    { id: "anuncios",  label: "Anúncios",            icon: Megaphone  },
    { id: "agendadas", label: "Agendadas",           icon: Calendar   },
    { id: "historico", label: "Histórico",           icon: Clock      },
  ];

  return (
    <div className="px-5 pb-10 pt-4">

      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-float-up"
          style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff" }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">Enviado com sucesso!</span>
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
              Envie notificações e anúncios aos utilizadores da plataforma
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
          </div>

          <Section title="Destinatário" open={openSections.target} onToggle={() => toggleSection("target")}>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { id: "all" as const,      icon: Users, label: "Todos os utilizadores",         desc: "Incluindo offline" },
                { id: "online" as const,   icon: Wifi,  label: "Utilizadores online",            desc: "Apenas activos"    },
                { id: "specific" as const, icon: Bell,  label: "Utilizador específico",          desc: "Por nome ou ID"    },
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
                <InputField label="Nome ou ID do utilizador" placeholder="Ex: João Machava" value={specificUser} onChange={setSpecificUser} />
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

          <Section title="Automação avançada" open={openSections.automation} onToggle={() => toggleSection("automation")}>
            <div className="mt-2 space-y-4">
              <ToggleSwitch value={automationEnabled} onChange={setAutomationEnabled} label="Activar automação" />
              {automationEnabled && (
                <>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>Frequência</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "once_daily" as const,  label: "1× por dia",     icon: Repeat },
                        { id: "once_weekly" as const, label: "1× por semana",  icon: Calendar },
                      ].map(o => (
                        <button key={o.id} onClick={() => setAutomationType(o.id)}
                          className="flex items-center gap-2 p-3 rounded-xl text-[12.5px] font-semibold transition-all"
                          style={{ border: automationType === o.id ? `1.5px solid ${V1}` : "1.5px solid rgba(108,92,231,.12)", color: automationType === o.id ? V1 : "var(--gz-text-muted)", background: automationType === o.id ? "rgba(108,92,231,.06)" : "transparent" }}>
                          <o.icon style={{ width: 14, height: 14 }} />
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Duração do ciclo (dias)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={1} max={30} value={automationDays} onChange={e => setAutomationDays(+e.target.value)} className="flex-1" style={{ accentColor: V1 }} />
                      <span className="text-[14px] font-bold w-10 text-right" style={{ color: V1 }}>{automationDays}d</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>

          <button onClick={handleSend} disabled={!notifTitle.trim()}
            className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: notifTitle.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "rgba(108,92,231,.2)",
              boxShadow: notifTitle.trim() ? "0 6px 18px rgba(108,92,231,.4)" : "none",
              opacity: notifTitle.trim() ? 1 : 0.6,
            }}>
            <Send style={{ width: 16, height: 16 }} />
            {scheduleEnabled ? "Agendar notificação" : automationEnabled ? "Activar automação" : "Enviar agora"}
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
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Imagem (URL)</label>
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
            </div>
          </Section>

          <Section title="Botão de ação" open={openAnnSections.action} onToggle={() => toggleAnnSection("action")}>
            <div className="space-y-3 mt-2">
              <InputField label="Texto do botão" placeholder="Ex: Jogar agora" value={annBtnLabel} onChange={setAnnBtnLabel} />
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>Destino do botão</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { id: "url" as const,    icon: LinkIcon, label: "URL externo"          },
                    { id: "screen" as const, icon: Sparkles, label: "Tela do site"         },
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
                  placeholder={annBtnType === "url" ? "https://..." : "Ex: /jogos, /perfil, /ludo"}
                  value={annBtnValue}
                  onChange={setAnnBtnValue}
                />
              </div>
            </div>
          </Section>

          <Section title="Agendar anúncio" open={openAnnSections.schedule} onToggle={() => toggleAnnSection("schedule")}>
            <div className="mt-2 space-y-3">
              <ToggleSwitch value={annSchedule} onChange={setAnnSchedule} label="Activar agendamento" />
              {annSchedule && <InputField label="Data e hora" value={annScheduleDate} onChange={setAnnScheduleDate} type="datetime-local" />}
            </div>
          </Section>

          <Section title="Automação do anúncio" open={openAnnSections.automation} onToggle={() => toggleAnnSection("automation")}>
            <div className="mt-2 space-y-3">
              <ToggleSwitch value={annAutomation} onChange={setAnnAutomation} label="Mostrar automaticamente" />
              {annAutomation && (
                <div className="text-[12px] px-3 py-2.5 rounded-xl" style={{ background: "rgba(108,92,231,.05)", color: "var(--gz-text-secondary)" }}>
                  O anúncio aparecerá para cada utilizador uma vez por dia, durante 7 dias após a activação.
                </div>
              )}
            </div>
          </Section>

          <button onClick={handleSendAnn} disabled={!annTitle.trim()}
            className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: annTitle.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "rgba(108,92,231,.2)",
              boxShadow: annTitle.trim() ? "0 6px 18px rgba(108,92,231,.4)" : "none",
              opacity: annTitle.trim() ? 1 : 0.6,
            }}>
            <Megaphone style={{ width: 16, height: 16 }} />
            {annSchedule ? "Agendar anúncio" : "Publicar anúncio"}
          </button>
        </div>
      )}

      {/* ── Tab: Agendadas ── */}
      {activeTab === "agendadas" && (
        <div className="gz-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{SCHEDULED.length} notificações agendadas</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
            {SCHEDULED.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-indigo-50/30 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(108,92,231,.07)" }}>
                  <Calendar style={{ width: 16, height: 16, color: V1 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{s.title}</div>
                  <div className="text-[11.5px] mt-0.5 flex items-center gap-2" style={{ color: "var(--gz-text-muted)" }}>
                    <span>{s.target}</span>
                    <span>·</span>
                    <Clock style={{ width: 10, height: 10 }} />
                    <span>{s.scheduledAt}</span>
                    {s.repeat !== "Nenhum" && <><span>·</span><Repeat style={{ width: 10, height: 10, color: V1 }} /><span style={{ color: V1 }}>{s.repeat}</span></>}
                  </div>
                </div>
                <button className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors" title="Cancelar agendamento">
                  <Trash2 style={{ width: 14, height: 14, color: "#ef4444" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Histórico ── */}
      {activeTab === "historico" && (
        <div className="gz-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{SENT_HISTORY.length} notificações enviadas</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
            {SENT_HISTORY.map(h => (
              <div key={h.id} className="px-5 py-4 flex items-center gap-4 hover:bg-indigo-50/30 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,.08)" }}>
                  <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{h.title}</div>
                  <div className="text-[11.5px] mt-0.5 flex items-center gap-2" style={{ color: "var(--gz-text-muted)" }}>
                    <span>{h.target}</span>
                    <span>·</span>
                    <span>{h.sent}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[13px] font-bold" style={{ color: V1 }}>{h.reached.toLocaleString()}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--gz-text-muted)" }}>alcançados</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
