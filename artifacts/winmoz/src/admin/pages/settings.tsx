import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Bell, Shield, Globe, Gamepad2, Wallet, AlertTriangle, Save, Loader2 } from "lucide-react";
import { getPlatformSettings, updateMultipleSettings, type PlatformSettings } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
    </label>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

const DEFAULTS: PlatformSettings = {
  maintenance_mode: false,
  game_damas_enabled: true,
  game_ludo_enabled: true,
  game_xadrez_enabled: true,
  game_roleta_enabled: true,
  deposits_enabled: true,
  withdrawals_enabled: true,
  bets_enabled: true,
  new_registrations_enabled: true,
  withdrawal_fee: 5,
  platform_cut_pct: 10,
  platform_name: "POKER WINNER",
};

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlatformSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });

    const ch = supabase.channel("settings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, () => {
        getPlatformSettings().then(s => setSettings(s));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggle = (key: keyof PlatformSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const raw: Record<string, string> = {};
      for (const [k, v] of Object.entries(settings)) {
        raw[k] = String(v);
      }
      await updateMultipleSettings(raw, user.id);
      toast({ title: "Configurações guardadas", description: "As alterações foram aplicadas com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Falha ao guardar configurações.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administração da plataforma POKER WINNER</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #6C5CE7, #4f46e5)", boxShadow: "0 4px 14px rgba(108,92,231,.3)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "A guardar…" : "Guardar Alterações"}
        </button>
      </div>

      {/* Maintenance mode banner */}
      {settings.maintenance_mode && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Modo de Manutenção ACTIVO</p>
            <p className="text-xs text-amber-600">O site está inacessível para os utilizadores. Desactiva para restaurar o acesso.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Platform */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div className="font-semibold text-gray-800">Plataforma</div>
          </div>
          <SettingRow label="Modo Manutenção" description="Bloqueia acesso para utilizadores">
            <Toggle checked={settings.maintenance_mode} onChange={() => toggle("maintenance_mode")} />
          </SettingRow>
          <SettingRow label="Novos Registos" description="Permitir criação de novas contas">
            <Toggle checked={settings.new_registrations_enabled} onChange={() => toggle("new_registrations_enabled")} />
          </SettingRow>
          <SettingRow label="Apostas" description="Permitir apostas na plataforma">
            <Toggle checked={settings.bets_enabled} onChange={() => toggle("bets_enabled")} />
          </SettingRow>
        </div>

        {/* Finances */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="font-semibold text-gray-800">Pagamentos</div>
          </div>
          <SettingRow label="Depósitos" description="Permitir depósitos de saldo">
            <Toggle checked={settings.deposits_enabled} onChange={() => toggle("deposits_enabled")} />
          </SettingRow>
          <SettingRow label="Levantamentos" description="Permitir pedidos de levantamento">
            <Toggle checked={settings.withdrawals_enabled} onChange={() => toggle("withdrawals_enabled")} />
          </SettingRow>
          <SettingRow label={`Taxa de Levantamento: MT ${settings.withdrawal_fee}`} description="Taxa aplicada em cada levantamento">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} value={settings.withdrawal_fee}
                onChange={e => setSettings(p => ({ ...p, withdrawal_fee: Number(e.target.value) }))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-indigo-400" />
              <span className="text-xs text-gray-400">MT</span>
            </div>
          </SettingRow>
          <SettingRow label={`Corte da plataforma: ${settings.platform_cut_pct}%`} description="% retirada de cada aposta ganha">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} value={settings.platform_cut_pct}
                onChange={e => setSettings(p => ({ ...p, platform_cut_pct: Number(e.target.value) }))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-indigo-400" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </SettingRow>
        </div>

        {/* Games */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="font-semibold text-gray-800">Jogos</div>
          </div>
          <SettingRow label="Damas Clássico" description="Activar/desactivar jogo de Damas">
            <Toggle checked={settings.game_damas_enabled} onChange={() => toggle("game_damas_enabled")} />
          </SettingRow>
          <SettingRow label="Ludo Turbo" description="Activar/desactivar Ludo">
            <Toggle checked={settings.game_ludo_enabled} onChange={() => toggle("game_ludo_enabled")} />
          </SettingRow>
          <SettingRow label="Xadrez Rápido" description="Activar/desactivar Xadrez">
            <Toggle checked={settings.game_xadrez_enabled} onChange={() => toggle("game_xadrez_enabled")} />
          </SettingRow>
          <SettingRow label="Roleta da Sorte" description="Activar/desactivar Roleta">
            <Toggle checked={settings.game_roleta_enabled} onChange={() => toggle("game_roleta_enabled")} />
          </SettingRow>
        </div>

        {/* Security / Notifications */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div className="font-semibold text-gray-800">Segurança</div>
          </div>
          <div className="py-4 text-center text-sm text-gray-400">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Configurações de segurança avançadas em desenvolvimento</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-5 h-5" />
          <div className="font-semibold">POKER WINNER Admin v2.0</div>
        </div>
        <div className="text-sm text-indigo-200">Plataforma multiplayer de apostas — Damas, Ludo, Xadrez, Roleta da Sorte.</div>
        <div className="flex items-center gap-4 mt-4 text-xs text-indigo-300">
          <span>Supabase: ● Conectado</span>
          <span>Realtime: ● Activo</span>
          <span>Manutenção: {settings.maintenance_mode ? "● ON" : "○ OFF"}</span>
        </div>
      </div>
    </div>
  );
}
