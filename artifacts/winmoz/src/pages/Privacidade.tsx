import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Shield, Eye, Bell, Database, Lock, ChevronRight,
  Smartphone, Globe, Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function Toggle({ value, locked }: { value: boolean; locked?: boolean }) {
  return (
    <button
      disabled
      style={{
        width: 46, height: 26, borderRadius: 13,
        background: value ? "#000" : "#d1d5db",
        border: "none", cursor: locked ? "default" : "pointer",
        flexShrink: 0, position: "relative",
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
  onPress?: () => void;
  danger?: boolean;
  locked?: boolean;
}

function SettingRow({ icon: Icon, label, desc, value, onPress, danger, locked }: SettingRowProps) {
  const isToggle = value !== undefined;
  const Tag = (!isToggle && onPress) ? "button" as any : "div" as any;
  return (
    <Tag onClick={(!isToggle && onPress) ? onPress : undefined}
      className="flex items-center gap-3.5 py-4 w-full text-left border-b border-slate-100 last:border-0 transition-colors"
      style={{ background: "none", cursor: (!isToggle && onPress) ? "pointer" : "default" }}>
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        style={{ background: danger ? "#fef2f2" : "#f8fafc", border: danger ? "1px solid #fecaca" : "1px solid #e5e7eb" }}>
        <Icon style={{ width: 16, height: 16, color: danger ? "#dc2626" : "#374151" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p style={{ fontSize: 13.5, fontWeight: 600, color: danger ? "#dc2626" : "#111" }}>{label}</p>
          {locked && <Lock style={{ width: 11, height: 11, color: "#9ca3af" }} />}
        </div>
        <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1, lineHeight: 1.4 }}>{desc}</p>
      </div>
      {isToggle
        ? <Toggle value={value!} locked={locked} />
        : <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db", flexShrink: 0 }} />
      }
    </Tag>
  );
}

export default function Privacidade() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExportData() {
    if (!user) return;
    setExporting(true);
    try {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, type, amount, status, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const rows = txs ?? [];
      const header = "ID,Tipo,Valor (MT),Estado,Descrição,Data\n";
      const body = rows.map(r =>
        `${r.id},${r.type},${r.amount},${r.status},"${(r.description ?? "").replace(/"/g, '""')}",${new Date(r.created_at).toLocaleString("pt-PT")}`
      ).join("\n");

      const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mozbet-extratos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(false);
    }
  }

  const SECTIONS = [
    {
      title: "Visibilidade do Perfil",
      items: [
        { icon: Eye,        label: "Perfil público",         desc: "Outros utilizadores podem ver o teu perfil",       value: true,  locked: true },
        { icon: Globe,      label: "Actividade visível",     desc: "Mostrar o teu estado de jogo a outros",            value: true,  locked: true },
      ],
    },
    {
      title: "Dados e Análise",
      items: [
        { icon: Database,   label: "Análise de uso",         desc: "Ajuda-nos a melhorar com dados anónimos",          value: true,  locked: true },
        { icon: Globe,      label: "Partilha com parceiros", desc: "Permite partilhar dados com parceiros confiáveis", value: true,  locked: true },
        { icon: Smartphone, label: "Localização",            desc: "Acesso à localização para funcionalidades locais", value: false, locked: true },
      ],
    },
    {
      title: "Segurança da Conta",
      items: [
        { icon: Lock,       label: "Login biométrico",       desc: "Usa impressão digital ou Face ID para entrar",     value: false, locked: true },
        { icon: Shield,     label: "Verificação em 2 passos",desc: "Código adicional no início de sessão",             value: false, locked: true },
        { icon: Bell,       label: "Alertas de sessão",      desc: "Notifica quando uma nova sessão é iniciada",       value: true,  locked: true },
      ],
    },
    {
      title: "Gestão de Dados",
      items: [
        { icon: Database,   label: "Exportar os meus dados", desc: "Descarrega uma cópia de todos os teus extratos",   onPress: handleExportData, danger: false },
        { icon: Trash2,     label: "Eliminar conta",         desc: "Remove permanentemente a tua conta e dados",       onPress: () => setShowConfirmDelete(true), danger: true },
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
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a]">Privacidade</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Controla os teus dados e segurança</p>
          </div>
        </div>

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

          {exporting && (
            <p className="text-center text-sm text-slate-400 mt-2">A preparar o teu extrato…</p>
          )}

          <p className="text-center text-[11px] text-slate-300 mt-4">
            Definições de privacidade actualizadas a 1 de Janeiro de 2026
          </p>
        </div>

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
