import { Settings as SettingsIcon, Bell, Shield, Globe, Database } from "lucide-react";

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
    </label>
  );
}

export default function Settings() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Administração da plataforma POKER WINNER</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {[
          {
            title: "Notificações",
            icon: Bell,
            color: "bg-indigo-100 text-indigo-600",
            items: [
              { label: "Alertas de Anti-Fraude", description: "Receber notificações de atividade suspeita", checked: true },
              { label: "Novos Saques Pendentes", description: "Alertas para aprovação de saques", checked: true },
              { label: "Denúncias Novas", description: "Notificações para novas denúncias", checked: false },
            ]
          },
          {
            title: "Segurança",
            icon: Shield,
            color: "bg-purple-100 text-purple-600",
            items: [
              { label: "Anti-Fraude Automático", description: "Detecção automática de padrões suspeitos", checked: true },
              { label: "Verificação 2FA Admin", description: "Autenticação de dois fatores para admins", checked: true },
              { label: "Log de Auditoria", description: "Registrar todas as ações administrativas", checked: false },
            ]
          },
          {
            title: "Plataforma",
            icon: Globe,
            color: "bg-green-100 text-green-600",
            items: [
              { label: "Permitir Novos Cadastros", description: "Habilitar registro de novos jogadores", checked: true },
              { label: "Apostas Ativas", description: "Permitir realização de apostas na plataforma", checked: true },
              { label: "Modo Manutenção", description: "Colocar plataforma em modo de manutenção", checked: false },
            ]
          },
          {
            title: "Banco de Dados",
            icon: Database,
            color: "bg-amber-100 text-amber-600",
            items: [
              { label: "Backup Automático", description: "Backup diário do banco de dados", checked: true },
              { label: "Cache de Consultas", description: "Habilitar cache de consultas SQL", checked: true },
              { label: "Logs de Query", description: "Registrar todas as queries do sistema", checked: false },
            ]
          },
        ].map((section) => (
          <div key={section.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl ${section.color} flex items-center justify-center`}>
                <section.icon className="w-4 h-4" />
              </div>
              <div className="font-semibold text-gray-800">{section.title}</div>
            </div>
            <div>
              {section.items.map((item) => (
                <SettingRow key={item.label} label={item.label} description={item.description}>
                  <Toggle defaultChecked={item.checked} />
                </SettingRow>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-5 h-5" />
          <div className="font-semibold">POKER WINNER Admin v1.0</div>
        </div>
        <div className="text-sm text-indigo-200">Plataforma multiplayer de Dama e Ludo com apostas em tempo real.</div>
        <div className="flex items-center gap-4 mt-4 text-xs text-indigo-300">
          <span>API: Online</span>
          <span>DB: Conectado</span>
          <span>Última sync: Agora</span>
        </div>
      </div>
    </div>
  );
}
