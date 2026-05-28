import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Shield, Eye, Bell, Database, Lock, ChevronRight,
  Smartphone, Globe, Trash2
} from "lucide-react";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative flex-shrink-0 transition-colors"
      style={{
        width: 46, height: 26, borderRadius: 13,
        background: value ? "#000" : "#d1d5db",
        border: "none", cursor: "pointer",
      }}>
      <motion.div animate={{ x: value ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

interface SettingRowProps {
  icon: React.ElementType;
  label: string;
  desc: string;
  value?: boolean;
  onChange?: (v: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon: Icon, label, desc, value, onChange, onPress, danger }: SettingRowProps) {
  const Tag = onChange !== undefined ? "div" : "button" as any;
  return (
    <Tag onClick={onPress || (onChange !== undefined ? undefined : undefined)}
      className="flex items-center gap-3.5 py-4 w-full text-left border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50 cursor-pointer"
      style={{ background: "none" }}
      {...(onChange === undefined ? { onClick: onPress } : { onClick: () => onChange?.(!value) })}>
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        style={{ background: danger ? "#fef2f2" : "#f8fafc", border: danger ? "1px solid #fecaca" : "1px solid #e5e7eb" }}>
        <Icon style={{ width: 16, height: 16, color: danger ? "#dc2626" : "#374151" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13.5, fontWeight: 600, color: danger ? "#dc2626" : "#111" }}>{label}</p>
        <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1, lineHeight: 1.4 }}>{desc}</p>
      </div>
      {onChange !== undefined
        ? <Toggle value={value!} onChange={onChange} />
        : <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db", flexShrink: 0 }} />
      }
    </Tag>
  );
}

export default function Privacidade() {
  const [, setLocation] = useLocation();
  const [profileVisible,    setProfileVisible]    = useState(true);
  const [activityVisible,   setActivityVisible]   = useState(false);
  const [analyticsEnabled,  setAnalyticsEnabled]  = useState(true);
  const [dataSharing,       setDataSharing]       = useState(false);
  const [locationAccess,    setLocationAccess]    = useState(false);
  const [biometricLogin,    setBiometricLogin]    = useState(true);
  const [twoFactor,         setTwoFactor]         = useState(false);
  const [sessionAlerts,     setSessionAlerts]     = useState(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const SECTIONS = [
    {
      title: "Visibilidade do Perfil",
      items: [
        { icon: Eye,        label: "Perfil público",         desc: "Outros utilizadores podem ver o teu perfil",       value: profileVisible,   onChange: setProfileVisible },
        { icon: Globe,      label: "Actividade visível",     desc: "Mostrar o teu estado de jogo a outros",            value: activityVisible,  onChange: setActivityVisible },
      ],
    },
    {
      title: "Dados e Análise",
      items: [
        { icon: Database,   label: "Análise de uso",         desc: "Ajuda-nos a melhorar com dados anónimos",          value: analyticsEnabled, onChange: setAnalyticsEnabled },
        { icon: Globe,      label: "Partilha com parceiros", desc: "Permite partilhar dados com parceiros confiáveis", value: dataSharing,      onChange: setDataSharing },
        { icon: Smartphone, label: "Localização",            desc: "Acesso à localização para funcionalidades locais", value: locationAccess,   onChange: setLocationAccess },
      ],
    },
    {
      title: "Segurança da Conta",
      items: [
        { icon: Lock,       label: "Login biométrico",       desc: "Usa impressão digital ou Face ID para entrar",     value: biometricLogin,   onChange: setBiometricLogin },
        { icon: Shield,     label: "Verificação em 2 passos",desc: "Código adicional no início de sessão",             value: twoFactor,        onChange: setTwoFactor },
        { icon: Bell,       label: "Alertas de sessão",      desc: "Notifica quando uma nova sessão é iniciada",       value: sessionAlerts,    onChange: setSessionAlerts },
      ],
    },
    {
      title: "Gestão de Dados",
      items: [
        { icon: Database,   label: "Exportar os meus dados", desc: "Descarrega uma cópia de todos os teus dados",      onPress: () => alert("A preparar exportação…") },
        { icon: Trash2,     label: "Eliminar conta",         desc: "Remove permanentemente a tua conta e dados",       onPress: () => setShowConfirmDelete(true), danger: true },
      ],
    },
  ];

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
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a]">Privacidade</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Controla os teus dados e segurança</p>
          </div>
        </div>

        {/* GDPR notice */}
        <div className="mx-5 mt-5 p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div className="flex items-start gap-2.5">
            <Shield style={{ width: 15, height: 15, color: "#64748b", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              A WinMoz respeita a tua privacidade. Os teus dados são armazenados de forma segura e nunca são vendidos a terceiros.
            </p>
          </div>
        </div>

        <div className="flex-1 px-5 py-5 pb-20 overflow-y-auto">
          {SECTIONS.map(({ title, items }, si) => (
            <motion.div key={title} className="mb-6"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.06, duration: 0.32 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
                {title.toUpperCase()}
              </p>
              <div style={{ border: "1px solid #e5e7eb" }}>
                {items.map(item => (
                  <SettingRow key={item.label} {...(item as any)} />
                ))}
              </div>
            </motion.div>
          ))}

          {/* Last updated */}
          <p className="text-center text-[11px] text-slate-300 mt-4">
            Política de privacidade actualizada a 1 de Janeiro de 2026
          </p>
        </div>

        {/* Delete account confirmation overlay */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
            <motion.div className="w-full max-w-[430px] bg-white p-6"
              initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <h3 className="font-syne font-bold text-xl text-red-600 mb-2">Eliminar conta?</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                Esta acção é <strong>irreversível</strong>. Todos os teus dados, saldo e histórico serão permanentemente eliminados.
              </p>
              <button onClick={() => setShowConfirmDelete(false)}
                style={{ width: "100%", padding: "15px", background: "#000", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif", marginBottom: 10, borderRadius: 0 }}>
                Cancelar — Manter Conta
              </button>
              <button onClick={() => setShowConfirmDelete(false)}
                style={{ width: "100%", padding: "14px", background: "none", color: "#dc2626", fontSize: 13, fontWeight: 600, border: "1.5px solid #fecaca", cursor: "pointer", fontFamily: "inherit", borderRadius: 0 }}>
                Eliminar permanentemente
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
