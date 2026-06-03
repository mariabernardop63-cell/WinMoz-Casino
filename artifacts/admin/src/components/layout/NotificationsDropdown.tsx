import { useEffect, useRef, useState } from "react";
import { Bell, CreditCard, UserPlus, Flag, ArrowDownLeft, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, type NotificationsData } from "@/lib/api";

const typeIcon: Record<string, React.ElementType> = {
  withdrawal: CreditCard,
  deposit: ArrowDownLeft,
  new_user: UserPlus,
  report: Flag,
};

const typeColor: Record<string, string> = {
  withdrawal: "#f59e0b",
  deposit: "#10b981",
  new_user: "#6C5CE7",
  report: "#ef4444",
};

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<NotificationsData>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsData>("/notifications"),
    refetchInterval: 30000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const total = data?.total ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95"
        style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.06)" }}
        title="Notificações"
      >
        <Bell className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
      </button>
      {total > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-black text-white flex items-center justify-center"
          style={{ background: "#6C5CE7", border: "1.5px solid hsl(248 50% 97%)" }}
        >
          {total > 9 ? "9+" : total}
        </span>
      )}

      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-[320px] animate-float-up overflow-hidden"
          style={{
            background: "var(--gz-bg-card-btn)",
            borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.08)",
            border: "1px solid rgba(108,92,231,.08)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Notificações</div>
              {total > 0 && (
                <div className="text-[11px] font-medium mt-0.5" style={{ color: "#a78bfa" }}>
                  {total} nova{total !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
            </button>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {/* Summary row */}
            {data && (
              <div className="grid grid-cols-2 gap-2 p-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
                {[
                  { label: "Levantamentos", count: data.pendingWithdrawals, color: "#f59e0b" },
                  { label: "Depósitos", count: data.newDeposits, color: "#10b981" },
                  { label: "Novos users", count: data.newPlayers, color: "#6C5CE7" },
                  { label: "Denúncias", count: data.pendingReports, color: "#ef4444" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(108,92,231,.04)" }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{item.count}</div>
                      <div className="text-[10px]" style={{ color: "var(--gz-text-muted)" }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(data?.items ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Sem notificações novas</div>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {(data?.items ?? []).map((item, i) => {
                  const Icon = typeIcon[item.type] ?? Bell;
                  const color = typeColor[item.type] ?? "#6C5CE7";
                  return (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}14` }}>
                        <Icon style={{ width: 14, height: 14, color, strokeWidth: 1.9 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--gz-text-primary)" }}>{item.label}</div>
                        <div className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                          {new Date(item.createdAt).toLocaleString("pt-BR", { timeStyle: "short", dateStyle: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
