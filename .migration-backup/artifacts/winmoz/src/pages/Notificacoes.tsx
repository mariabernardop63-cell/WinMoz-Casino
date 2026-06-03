import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Search, Bell, ArrowDownToLine, ArrowUpFromLine,
  LogIn, Shield, RefreshCw, Gamepad2, Gift, AlertCircle, CheckCircle2, Info, X, SlidersHorizontal
} from "lucide-react";

type NotifCategory = "Todos" | "Financeiro" | "Sistema" | "Jogos" | "Promoções";
const CATS: NotifCategory[] = ["Todos", "Financeiro", "Sistema", "Jogos", "Promoções"];

type Notif = {
  id: string;
  category: Exclude<NotifCategory, "Todos">;
  icon: any;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  time: string;
  date: string;
  read: boolean;
  badge?: "sucesso" | "pendente" | "erro" | "info";
};

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  sucesso:  { bg: "#dcfce7", color: "#16a34a", label: "Sucesso" },
  pendente: { bg: "#fef3c7", color: "#d97706", label: "Pendente" },
  erro:     { bg: "#fee2e2", color: "#dc2626", label: "Erro" },
  info:     { bg: "#dbeafe", color: "#1d4ed8", label: "Info" },
};

const ICON_MAP: Record<string, any> = {
  ArrowDownToLine, ArrowUpFromLine, LogIn, Shield, RefreshCw,
  Gamepad2, Gift, AlertCircle, CheckCircle2, Info,
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

function resolveIcon(iconName: string) {
  return ICON_MAP[iconName] ?? Bell;
}

export default function Notificacoes() {
  const [, setLocation] = useLocation();
  const [cat, setCat] = useState<NotifCategory>("Todos");
  const [search, setSearch] = useState("");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const unread = notifs.filter(n => !n.read && !dismissed.has(n.id)).length;

  const markAllRead = () => setNotifs(p => p.map(n => ({ ...n, read: true })));
  const dismiss = (id: string) => setDismissed(p => new Set([...p, id]));

  const filtered = notifs.filter(n => {
    if (dismissed.has(n.id)) return false;
    if (cat !== "Todos" && n.category !== cat) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped: Record<string, Notif[]> = {};
  filtered.forEach(n => {
    if (!grouped[n.date]) grouped[n.date] = [];
    grouped[n.date].push(n);
  });

  const markRead = (id: string) => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#f8f9fa" }}>
      <div className="w-full max-w-[430px] flex flex-col pb-6">

        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: 999, background: "#f8f9fa", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 17, height: 17, color: "#374151" }} />
            </button>
            <div className="flex-1">
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#111827" }}>Notificações</h1>
              {unread > 0 && (
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{unread} não lida{unread !== 1 ? "s" : ""}</p>
              )}
            </div>
            {notifs.length > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Marcar tudo
              </button>
            )}
            <button style={{ width: 34, height: 34, borderRadius: 999, background: "#f8f9fa", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <SlidersHorizontal style={{ width: 15, height: 15, color: "#6b7280" }} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div style={{ background: "#f3f4f6", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
              <Search style={{ width: 15, height: 15, color: "#9ca3af", flexShrink: 0 }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar notificações..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#111827", fontFamily: "inherit" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                  <X style={{ width: 14, height: 14, color: "#9ca3af" }} />
                </button>
              )}
            </div>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all 0.15s",
                background: cat === c ? "#111827" : "#f3f4f6",
                color: cat === c ? "#fff" : "#6b7280",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pt-3">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell style={{ width: 28, height: 28, color: "#d1d5db" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", fontFamily: "'Syne', sans-serif" }}>Sem notificações</p>
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                {cat !== "Todos"
                  ? `Não há notificações em "${cat}".`
                  : "As suas notificações aparecerão aqui."}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="mb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.6px", textTransform: "uppercase" }}>{date}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2">
                  {items.map(n => {
                    const IconComp = typeof n.icon === "string" ? resolveIcon(n.icon) : (n.icon ?? Bell);
                    const badge = n.badge ? BADGE_STYLES[n.badge] : null;
                    return (
                      <motion.div key={n.id} variants={fadeUp}
                        onClick={() => markRead(n.id)}
                        style={{ background: n.read ? "#fff" : "#f5f0ff", borderRadius: 16, border: n.read ? "1px solid #f1f5f9" : "1px solid #ddd6fe", padding: "12px 14px", display: "flex", gap: 12, cursor: "pointer", boxShadow: n.read ? "0 1px 4px rgba(0,0,0,0.04)" : "0 2px 12px rgba(124,58,237,0.10)", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: n.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <IconComp style={{ width: 19, height: 19, color: n.iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: n.read ? 600 : 700, fontSize: 13.5, color: "#111827", lineHeight: 1.3 }}>{n.title}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!n.read && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#7c3aed", flexShrink: 0, display: "inline-block" }} />}
                              <span style={{ fontSize: 10.5, color: "#9ca3af", whiteSpace: "nowrap" }}>{n.time}</span>
                            </div>
                          </div>
                          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>{n.desc}</p>
                          {badge && (
                            <div className="mt-2">
                              <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, padding: "2px 8px", borderRadius: 20 }}>
                                {badge.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", opacity: 0.4 }}>
                          <X style={{ width: 12, height: 12, color: "#374151" }} />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
