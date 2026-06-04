import { usePlatformSettings } from "@/lib/platform-settings";

export default function MaintenanceScreen({ children }: { children: React.ReactNode }) {
  const { settings, loading } = usePlatformSettings();

  if (loading) return <>{children}</>;

  if (settings.maintenance_mode) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0a0a0a 100%)" }}
      >
        <div className="flex flex-col items-center text-center px-8 max-w-sm">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #6C5CE7, #a78bfa)" }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          <div
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: "#a78bfa" }}
          >
            POKER WINNER
          </div>

          <h1
            className="text-3xl font-black mb-4"
            style={{ color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Em Manutenção
          </h1>

          <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
            Estamos a melhorar a plataforma para ti. Voltamos em breve!
          </p>

          <div
            className="w-full rounded-2xl p-5 mb-6"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                O que está a acontecer?
              </span>
            </div>
            <p className="text-sm leading-relaxed text-left" style={{ color: "rgba(255,255,255,0.45)" }}>
              A nossa equipa técnica está a realizar manutenção programada para melhorar a experiência. Por favor tenta novamente em alguns minutos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Verificar a cada minuto automaticamente…
            </span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
