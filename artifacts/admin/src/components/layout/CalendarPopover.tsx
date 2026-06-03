import { useEffect, useRef, useState } from "react";
import { Calendar, Trophy, Gamepad2, X } from "lucide-react";

const EVENTS = [
  { title: "Torneio de Dama — Fase Final", date: "2026-06-05", time: "20:00", prize: "R$ 5.000", icon: Trophy, color: "#6C5CE7" },
  { title: "Torneio de Ludo — Eliminatórias", date: "2026-06-07", time: "18:00", prize: "R$ 2.500", icon: Gamepad2, color: "#a78bfa" },
  { title: "Torneio Especial Fim de Semana", date: "2026-06-08", time: "16:00", prize: "R$ 10.000", icon: Trophy, color: "#f59e0b" },
  { title: "Campeonato Mensal de Dama", date: "2026-06-15", time: "20:00", prize: "R$ 8.000", icon: Trophy, color: "#6C5CE7" },
  { title: "Torneio Relâmpago de Ludo", date: "2026-06-20", time: "21:00", prize: "R$ 1.500", icon: Gamepad2, color: "#a78bfa" },
];

export default function CalendarPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const upcoming = EVENTS.filter(e => new Date(e.date) >= new Date());

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95"
        style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.06)" }}
        title="Calendário"
      >
        <Calendar className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
      </button>
      {upcoming.length > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-black text-white flex items-center justify-center"
          style={{ background: "#10b981", border: "1.5px solid hsl(248 50% 97%)" }}
        >
          {upcoming.length}
        </span>
      )}

      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-[300px] animate-float-up overflow-hidden"
          style={{
            background: "var(--gz-bg-card-btn)",
            borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.08)",
            border: "1px solid rgba(108,92,231,.08)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Torneios</div>
              <div className="text-[11px] font-medium mt-0.5" style={{ color: "#a78bfa" }}>
                {upcoming.length} próximo{upcoming.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
            </button>
          </div>

          <div className="p-3 space-y-2 max-h-[340px] overflow-y-auto">
            {EVENTS.map((e, i) => {
              const Icon = e.icon;
              const eventDate = new Date(`${e.date}T${e.time}`);
              const isPast = eventDate < new Date();
              return (
                <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ opacity: isPast ? 0.5 : 1 }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${e.color}14` }}>
                    <Icon style={{ width: 14, height: 14, color: e.color, strokeWidth: 1.9 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--gz-text-primary)" }}>{e.title}</div>
                    <div className="text-[10.5px] mt-1 flex items-center gap-2" style={{ color: "var(--gz-text-muted)" }}>
                      <span>{new Date(e.date).toLocaleDateString("pt-BR")} às {e.time}</span>
                    </div>
                    <div className="text-[11px] font-bold mt-0.5" style={{ color: e.color }}>{e.prize}</div>
                  </div>
                  {isPast && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(107,114,128,.1)", color: "var(--gz-text-muted)" }}>Passado</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
