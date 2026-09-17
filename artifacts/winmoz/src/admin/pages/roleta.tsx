import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { adminSupabase } from "@/admin/lib/supabase-api";
import {
  RotateCw, Zap, Clock, Wallet, TrendingUp, Power, Save,
  AlertCircle, CheckCircle2, Loader2, Settings, BarChart3,
} from "lucide-react";

interface RoletaConfig {
  enabled: boolean;
  spinsPerWeek: number;
  winningHoursEnabled: boolean;
  winningHoursStart: number;
  winningHoursEnd: number;
  weeklyBudgetEnabled: boolean;
  weeklyBudgetAmount: number;
  weeklyBudgetPrize: number;
  weeklyBudgetUsed: number;
  weeklyBudgetWeek: string;
  multipliersEnabled: boolean;
  multipliers: { spin1: number; spin2: number; spin3: number };
  alwaysWinEnabled: boolean;
  alwaysWinPrize: number;
}

const DEFAULT_CONFIG: RoletaConfig = {
  enabled: true,
  spinsPerWeek: 3,
  winningHoursEnabled: false,
  winningHoursStart: 8,
  winningHoursEnd: 22,
  weeklyBudgetEnabled: false,
  weeklyBudgetAmount: 30,
  weeklyBudgetPrize: 1,
  weeklyBudgetUsed: 0,
  weeklyBudgetWeek: "",
  multipliersEnabled: false,
  multipliers: { spin1: 1, spin2: 1, spin3: 1 },
  alwaysWinEnabled: false,
  alwaysWinPrize: 1,
};

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--gz-bg-card)", borderColor: "var(--gz-border)" }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gz-bg-subtle)" }}>
          {icon}
        </div>
        <h3 className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{label}</p>
        {description && <p className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
        style={{ background: checked ? "#18181b" : "var(--gz-bg-subtle)" }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

function NumberInput({ value, onChange, label, min = 0, max = 9999, suffix }: {
  value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; suffix?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--gz-text-muted)" }}>{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          className="h-9 px-3 rounded-lg border text-[12.5px] font-semibold w-24 outline-none"
          style={{
            background: "var(--gz-bg-input)",
            borderColor: "var(--gz-border)",
            color: "var(--gz-text-primary)",
          }}
        />
        {suffix && <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function RoletaManagement() {
  const [config, setConfig] = useState<RoletaConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data: { session } } = await adminSupabase.auth.getSession();
      const res = await fetch("/api/admin/roleta/config", {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    setToast(null);
    try {
      const { data: { session } } = await adminSupabase.auth.getSession();
      const res = await fetch("/api/admin/roleta/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToast({ type: "success", msg: "Configuração guardada com sucesso!" });
        const data = await res.json();
        if (data.config) setConfig(data.config);
      } else {
        setToast({ type: "error", msg: "Erro ao guardar configuração." });
      }
    } catch {
      setToast({ type: "error", msg: "Erro de rede." });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  }

  const update = (partial: Partial<RoletaConfig>) => setConfig(prev => ({ ...prev, ...partial }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--gz-text-muted)" }} />
      </div>
    );
  }

  const budgetPercent = config.weeklyBudgetAmount > 0
    ? Math.min(100, (config.weeklyBudgetUsed / config.weeklyBudgetAmount) * 100)
    : 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gz-bg-subtle)" }}>
            <RotateCw className="w-5 h-5" style={{ color: "var(--gz-text-primary)" }} />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold" style={{ color: "var(--gz-text-primary)" }}>Gestão da Roleta</h1>
            <p className="text-[11.5px]" style={{ color: "var(--gz-text-muted)" }}>Configure prémios, orçamento e regras da roleta</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 h-9 px-5 rounded-lg text-[12px] font-bold text-white"
          style={{ background: "#18181b" }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "A guardar..." : "Guardar"}
        </motion.button>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold"
          style={{
            background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: toast.type === "success" ? "#15803d" : "#dc2626",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </motion.div>
      )}

      {/* Master Toggle */}
      <SectionCard title="Roleta" icon={<Power className="w-4 h-4" style={{ color: config.enabled ? "#16a34a" : "#dc2626" }} />}>
        <Toggle
          checked={config.enabled}
          onChange={enabled => update({ enabled })}
          label="Roleta activa"
          description={config.enabled ? "A roleta está disponível para os utilizadores" : "Aroleta está desactivada — utilizadores não podem girar"}
        />
        <div>
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Giros gratuitos por semana</p>
          <input
            type="number"
            value={config.spinsPerWeek}
            min={1}
            max={50}
            onChange={e => update({ spinsPerWeek: Math.max(1, Math.min(50, Number(e.target.value))) })}
            className="h-9 px-3 rounded-lg border text-[12.5px] font-semibold w-20 outline-none"
            style={{ background: "var(--gz-bg-input)", borderColor: "var(--gz-border)", color: "var(--gz-text-primary)" }}
          />
        </div>
      </SectionCard>

      {/* Winning Hours */}
      <SectionCard title="Horário de Vitórias" icon={<Clock className="w-4 h-4" style={{ color: "#3b82f6" }} />}>
        <Toggle
          checked={config.winningHoursEnabled}
          onChange={winningHoursEnabled => update({ winningHoursEnabled })}
          label="Restaurar horário"
          description="Apenas nos horários definidos os utilizadores podem ganhar prémios"
        />
        {config.winningHoursEnabled && (
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Início</p>
              <input
                type="number"
                value={config.winningHoursStart}
                min={0}
                max={23}
                onChange={e => update({ winningHoursStart: Math.max(0, Math.min(23, Number(e.target.value))) })}
                className="h-9 px-3 rounded-lg border text-[12.5px] font-semibold w-16 outline-none"
                style={{ background: "var(--gz-bg-input)", borderColor: "var(--gz-border)", color: "var(--gz-text-primary)" }}
              />
            </div>
            <span className="text-[12px] font-bold mt-5" style={{ color: "var(--gz-text-muted)" }}>até</span>
            <div>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Fim</p>
              <input
                type="number"
                value={config.winningHoursEnd}
                min={0}
                max={23}
                onChange={e => update({ winningHoursEnd: Math.max(0, Math.min(23, Number(e.target.value))) })}
                className="h-9 px-3 rounded-lg border text-[12.5px] font-semibold w-16 outline-none"
                style={{ background: "var(--gz-bg-input)", borderColor: "var(--gz-border)", color: "var(--gz-text-primary)" }}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Weekly Budget */}
      <SectionCard title="Orçamento Semanal" icon={<Wallet className="w-4 h-4" style={{ color: "#f59e0b" }} />}>
        <Toggle
          checked={config.weeklyBudgetEnabled}
          onChange={weeklyBudgetEnabled => update({ weeklyBudgetEnabled })}
          label="Limitar orçamento semanal"
          description="Após atingir o limite, utilizadores perdem até à próxima semana"
        />
        {config.weeklyBudgetEnabled && (
          <>
            <div className="flex items-center gap-4">
              <NumberInput
                value={config.weeklyBudgetAmount}
                onChange={v => update({ weeklyBudgetAmount: v })}
                label="Orçamento total (MT)"
                suffix="MT"
              />
              <NumberInput
                value={config.weeklyBudgetPrize}
                onChange={v => update({ weeklyBudgetPrize: v })}
                label="Prémio por vitória (MT)"
                suffix="MT"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>Utilizado esta semana</p>
                <p className="text-[11px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
                  {config.weeklyBudgetUsed} / {config.weeklyBudgetAmount} MT
                </p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--gz-bg-subtle)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${budgetPercent}%`,
                    background: budgetPercent > 80 ? "#dc2626" : budgetPercent > 50 ? "#f59e0b" : "#16a34a",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* Always Win Mode */}
      <SectionCard title="Modo Sempre Ganhar" icon={<Zap className="w-4 h-4" style={{ color: "#16a34a" }} />}>
        <Toggle
          checked={config.alwaysWinEnabled}
          onChange={alwaysWinEnabled => update({ alwaysWinEnabled })}
          label="Activar modo sempre ganhar"
          description="Todos os utilizadores ganham sempre o prémio definido (sem sortes)"
        />
        {config.alwaysWinEnabled && (
          <NumberInput
            value={config.alwaysWinPrize}
            onChange={v => update({ alwaysWinPrize: v })}
            label="Prémio fixo por giro (MT)"
            suffix="MT"
          />
        )}
      </SectionCard>

      {/* Multipliers */}
      <SectionCard title="Multiplicadores por Giro" icon={<TrendingUp className="w-4 h-4" style={{ color: "#8b5cf6" }} />}>
        <Toggle
          checked={config.multipliersEnabled}
          onChange={multipliersEnabled => update({ multipliersEnabled })}
          label="Activar multiplicadores"
          description="Define o prémio para cada giro individual (1º, 2º, 3º)"
        />
        {config.multipliersEnabled && (
          <div className="flex items-center gap-4">
            <NumberInput
              value={config.multipliers.spin1}
              onChange={v => update({ multipliers: { ...config.multipliers, spin1: v } })}
              label="1º Giro (MT)"
              suffix="MT"
            />
            <NumberInput
              value={config.multipliers.spin2}
              onChange={v => update({ multipliers: { ...config.multipliers, spin2: v } })}
              label="2º Giro (MT)"
              suffix="MT"
            />
            <NumberInput
              value={config.multipliers.spin3}
              onChange={v => update({ multipliers: { ...config.multipliers, spin3: v } })}
              label="3º Giro (MT)"
              suffix="MT"
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
