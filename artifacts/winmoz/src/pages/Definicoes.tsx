import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Bell, Moon, Globe, Vibrate, Volume2, CreditCard,
  ChevronRight, Info, LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex-shrink-0 relative transition-colors"
      style={{ width: 46, height: 26, borderRadius: 13, background: value ? "#000" : "#d1d5db", border: "none", cursor: "pointer" }}>
      <motion.div animate={{ x: value ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function Row({ icon: Icon, label, desc, value, onChange, onPress, badge }: any) {
  const isToggle = onChange !== undefined;
  const Tag = isToggle ? "div" : "button" as any;
  return (
    <Tag onClick={isToggle ? () => onChange(!value) : onPress}
      className="flex items-center gap-3.5 py-4 w-full text-left border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
      style={{ background: "none" }}>
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
        <Icon style={{ width: 16, height: 16, color: "#374151" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111" }}>{label}</p>
        {desc && <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1, lineHeight: 1.4 }}>{desc}</p>}
      </div>
      {isToggle
        ? <Toggle value={value} onChange={onChange} />
        : badge
        ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f1f5f9", color: "#64748b" }}>{badge}</span>
        : <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db" }} />
      }
    </Tag>
  );
}

const LANGUAGES = ["Português", "English", "Français", "Español"];
const CURRENCIES = ["MZN — Metical", "USD — Dólar", "EUR — Euro"];

export default function Definicoes() {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();

  const [notifDepositos,  setNotifDepositos]  = useState(true);
  const [notifApostas,    setNotifApostas]    = useState(true);
  const [notifPromos,     setNotifPromos]     = useState(false);
  const [notifSons,       setNotifSons]       = useState(true);
  const [notifVibracao,   setNotifVibracao]   = useState(true);
  const [darkMode,        setDarkMode]        = useState(false);
  const [langModal,       setLangModal]       = useState(false);
  const [currModal,       setCurrModal]       = useState(false);
  const [lang,            setLang]            = useState("Português");
  const [currency,        setCurrency]        = useState("MZN — Metical");
  const [version]         = useState("1.0.0");

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const SECTIONS = [
    {
      title: "Notificações",
      items: [
        { icon: Bell,     label: "Depósitos e Levamentos", desc: "Alertas de movimentos na conta",         value: notifDepositos, onChange: setNotifDepositos },
        { icon: Bell,     label: "Apostas e Resultados",   desc: "Notificações de partidas e torneios",   value: notifApostas,   onChange: setNotifApostas },
        { icon: Bell,     label: "Promoções",              desc: "Bónus, eventos e ofertas especiais",    value: notifPromos,    onChange: setNotifPromos },
        { icon: Volume2,  label: "Sons",                   desc: "Toques e sons de notificação",          value: notifSons,      onChange: setNotifSons },
        { icon: Vibrate,  label: "Vibração",               desc: "Vibração ao receber notificações",      value: notifVibracao,  onChange: setNotifVibracao },
      ],
    },
    {
      title: "Aparência e Idioma",
      items: [
        { icon: Moon,   label: "Modo escuro",  desc: "Interface com fundo escuro",             value: darkMode, onChange: setDarkMode },
        { icon: Globe,  label: "Idioma",       desc: "Língua da aplicação",                    onPress: () => setLangModal(true), badge: lang.split(" ")[0] },
      ],
    },
    {
      title: "Conta e Pagamento",
      items: [
        { icon: CreditCard, label: "Moeda",               desc: "Moeda preferida para exibição",       onPress: () => setCurrModal(true), badge: currency.split(" ")[0] },
        { icon: CreditCard, label: "Métodos de pagamento", desc: "Gere os teus métodos de depósito",   onPress: () => {} },
        { icon: CreditCard, label: "Limite de apostas",    desc: "Define limites de gastos diários",   onPress: () => {} },
      ],
    },
    {
      title: "Aplicação",
      items: [
        { icon: Info,   label: "Versão",                   desc: `WinMoz v${version}`,                    onPress: () => {}, badge: version },
        { icon: Info,   label: "Termos de serviço",        desc: "Lê os nossos termos",                   onPress: () => {} },
        { icon: Info,   label: "Política de privacidade",  desc: "Sabe como usamos os teus dados",        onPress: () => setLocation("/privacidade") },
        { icon: LogOut, label: "Terminar sessão",          desc: "Sair da conta actual",                  onPress: handleSignOut },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/perfil")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a]">Definições</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Personaliza a tua experiência</p>
          </div>
        </div>

        <div className="flex-1 px-5 py-5 pb-24 overflow-y-auto">
          {SECTIONS.map(({ title, items }, si) => (
            <motion.div key={title} className="mb-6"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.06, duration: 0.32 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
                {title.toUpperCase()}
              </p>
              <div style={{ border: "1px solid #e5e7eb" }}>
                {items.map(item => <Row key={item.label} {...item} />)}
              </div>
            </motion.div>
          ))}
        </div>

        {langModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
            <motion.div className="w-full max-w-[430px] bg-white"
              initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="font-syne font-bold text-lg text-[#0a0a0a]">Seleccionar Idioma</h3>
              </div>
              {LANGUAGES.map(l => (
                <button key={l} onClick={() => { setLang(l); setLangModal(false); }}
                  className="flex items-center justify-between w-full px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style={{ background: "none" }}>
                  <span style={{ fontSize: 14, color: "#111", fontWeight: lang === l ? 600 : 400 }}>{l}</span>
                  {lang === l && <span className="text-sm font-bold">✓</span>}
                </button>
              ))}
              <button onClick={() => setLangModal(false)}
                className="w-full py-4 text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                Cancelar
              </button>
            </motion.div>
          </div>
        )}

        {currModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
            <motion.div className="w-full max-w-[430px] bg-white"
              initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="font-syne font-bold text-lg text-[#0a0a0a]">Seleccionar Moeda</h3>
              </div>
              {CURRENCIES.map(c => (
                <button key={c} onClick={() => { setCurrency(c); setCurrModal(false); }}
                  className="flex items-center justify-between w-full px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style={{ background: "none" }}>
                  <span style={{ fontSize: 14, color: "#111", fontWeight: currency === c ? 600 : 400 }}>{c}</span>
                  {currency === c && <span className="text-sm font-bold">✓</span>}
                </button>
              ))}
              <button onClick={() => setCurrModal(false)}
                className="w-full py-4 text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
