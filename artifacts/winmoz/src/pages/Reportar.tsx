import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Flag, Bug, CreditCard, User, HelpCircle, CheckCircle2, ChevronRight } from "lucide-react";

const CATEGORIES = [
  { icon: Bug,         label: "Problema técnico",   desc: "Erro, crash ou mau funcionamento" },
  { icon: CreditCard,  label: "Problema de pagamento", desc: "Depósito, levamento ou cobrança" },
  { icon: User,        label: "Utilizador",         desc: "Comportamento abusivo ou fraude" },
  { icon: Flag,        label: "Conteúdo impróprio", desc: "Conteúdo ofensivo ou inadequado" },
  { icon: HelpCircle,  label: "Outro",              desc: "Qualquer outro tipo de problema" },
];

const PRIORITIES = ["Baixa", "Média", "Alta", "Urgente"];

type Screen = "form" | "sent";

export default function Reportar() {
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("form");
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState("Média");
  const [description, setDescription] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ticketId = "WM-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!category) errs.category = "Selecciona uma categoria";
    if (description.trim().length < 20) errs.description = "Descreve o problema em pelo menos 20 caracteres";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setScreen("sent"); }, 1800);
  };

  if (screen === "sent") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col items-center justify-center px-6">
          <motion.div className="flex flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: "#f0fdf4", border: "3px solid #bbf7d0" }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: "#16a34a" }} />
            </div>
            <h2 className="font-syne font-bold text-2xl text-[#0a0a0a] mb-2">Relatório enviado!</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-2">
              Recebemos o teu relatório e a nossa equipa irá analisá-lo em breve.
            </p>
            <div className="px-4 py-2 rounded-full mb-8" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-[12px] font-semibold text-slate-600">Nº do caso: <span className="text-[#000]">{ticketId}</span></p>
            </div>
            <div className="w-full p-4 rounded-none mb-6" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                Responderemos ao teu email em <strong>24–48 horas</strong>. Para casos urgentes, contacta o suporte pelo chat em tempo real.
              </p>
            </div>
            <button onClick={() => setLocation("/perfil")}
              style={{ width: "100%", padding: "15px", background: "#000", color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif", borderRadius: 0 }}>
              Voltar ao Perfil
            </button>
            <button onClick={() => { setScreen("form"); setCategory(null); setDescription(""); setPriority("Média"); setErrors({}); }}
              className="mt-3 text-[13px] text-slate-400 hover:text-slate-700 transition-colors">
              Enviar outro relatório
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/perfil")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a]">Reportar Problema</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">A nossa equipa responde em 24–48h</p>
          </div>
        </div>

        <div className="flex-1 px-6 py-6 pb-20 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Category */}
            <div className="mb-6">
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                CATEGORIA DO PROBLEMA
              </label>
              <div className="flex flex-col gap-2">
                {CATEGORIES.map(({ icon: Icon, label, desc }) => (
                  <button key={label} onClick={() => { setCategory(label); setErrors(p => { const n = {...p}; delete n.category; return n; }); }}
                    className="flex items-center gap-3.5 p-3.5 text-left w-full transition-all"
                    style={{
                      border: category === label ? "1.5px solid #000" : "1px solid #e5e7eb",
                      background: category === label ? "#000" : "#fff",
                    }}>
                    <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                      style={{ background: category === label ? "#fff" : "#f8fafc" }}>
                      <Icon style={{ width: 17, height: 17, color: category === label ? "#000" : "#374151" }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: category === label ? "#fff" : "#111" }}>{label}</p>
                      <p style={{ fontSize: 11.5, color: category === label ? "rgba(255,255,255,0.6)" : "#9ca3af", marginTop: 1 }}>{desc}</p>
                    </div>
                    {category === label && <CheckCircle2 style={{ width: 16, height: 16, color: "#fff", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
              {errors.category && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 5 }}>{errors.category}</p>}
            </div>

            {/* Priority */}
            <div className="mb-6">
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                PRIORIDADE
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map(p => {
                  const colors: Record<string, string> = { Baixa: "#22c55e", Média: "#f59e0b", Alta: "#f97316", Urgente: "#ef4444" };
                  const active = priority === p;
                  return (
                    <button key={p} onClick={() => setPriority(p)}
                      className="py-2.5 font-semibold text-xs transition-all"
                      style={{
                        border: active ? `1.5px solid ${colors[p]}` : "1px solid #e5e7eb",
                        background: active ? colors[p] + "15" : "#fff",
                        color: active ? colors[p] : "#6b7280",
                      }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", letterSpacing: "0.3px" }}>
                  DESCRIÇÃO DO PROBLEMA
                </label>
                <span style={{ fontSize: 11, color: description.length < 20 ? "#9ca3af" : "#22c55e" }}>
                  {description.length}/20 mín
                </span>
              </div>
              <textarea rows={5} value={description}
                onChange={e => { setDescription(e.target.value); setErrors(p => { const n = {...p}; delete n.description; return n; }); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                placeholder="Descreve o problema com o máximo de detalhe possível. Inclui quando ocorreu, o que estavas a fazer e qualquer mensagem de erro que tenhas visto…"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: 13.5, color: "#111",
                  outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box",
                  border: errors.description ? "1.5px solid #ef4444" : focused ? "1.5px solid #000" : "1px solid #d1d5db",
                  background: "#fff", lineHeight: 1.6, borderRadius: 0,
                }} />
              {errors.description && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.description}</p>}
            </div>

            {/* Info */}
            <div className="p-4 mb-6" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="flex items-start gap-2">
                <Flag style={{ width: 14, height: 14, color: "#64748b", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                  O teu relatório é confidencial. Nunca partilhamos informações pessoais sem o teu consentimento.
                </p>
              </div>
            </div>

            {/* Submit */}
            <motion.button onClick={handleSubmit} disabled={submitting}
              whileTap={!submitting ? { scale: 0.98 } : {}}
              style={{
                width: "100%", padding: "15px", fontSize: 14.5, fontWeight: 700, border: "none",
                cursor: submitting ? "default" : "pointer", letterSpacing: "0.3px",
                fontFamily: "'Syne', sans-serif", borderRadius: 0,
                background: "#000", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
              {submitting
                ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>A enviar…</span></>
                : "Enviar Relatório"
              }
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
