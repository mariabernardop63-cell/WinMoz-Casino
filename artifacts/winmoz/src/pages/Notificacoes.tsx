import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Search, Bell, ArrowDownToLine, ArrowUpFromLine,
  LogIn, Shield, RefreshCw, Gamepad2, Gift, AlertCircle, CheckCircle2, Info, X, SlidersHorizontal,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetUserNotifications, useMarkNotificationRead } from "@/admin/lib/supabase-api";

type FilterCat = "Todos" | "Promoções" | "Sistema" | "Jogos";
const CATS: FilterCat[] = ["Todos", "Promoções", "Sistema", "Jogos"];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

function getNotifStyle(type: string) {
  switch (type) {
    case "announcement": return { iconBg: "#fef3c7", iconColor: "#d97706", Icon: Megaphone,       cat: "Promoções" };
    case "game":         return { iconBg: "#ede9fe", iconColor: "#7c3aed", Icon: Gamepad2,        cat: "Jogos"     };
    case "finance":      return { iconBg: "#dcfce7", iconColor: "#16a34a", Icon: ArrowDownToLine, cat: "Sistema"   };
    case "security":     return { iconBg: "#fee2e2", iconColor: "#dc2626", Icon: Shield,          cat: "Sistema"   };
    case "login":        return { iconBg: "#dbeafe", iconColor: "#1d4ed8", Icon: LogIn,           cat: "Sistema"   };
    default:             return { iconBg: "#ede9fe", iconColor: "#7c3aed", Icon: Bell,            cat: "Promoções" };
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function Notificacoes() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useGetUserNotifications(user?.id ?? null);
  const markRead = useMarkNotificationRead();
  const [cat, setCat]       = useState<FilterCat>("Todos");
  const [search, setSearch] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function dismiss(id: string) {
    if (user?.id) markRead.mutate({ notificationId: id, userId: user.id });
    setDismissed(prev => new Set([...prev, id]));
  }

  function handleClick(id: string) {
    if (user?.id) markRead.mutate({ notificationId: id, userId: user.id });
  }

  function markAllRead() {
    notifications.filter(n => !n.isRead).forEach(n => {
      if (user?.id) markRead.mutate({ notificationId: n.id, userId: user.id });
    });
  }

  const filtered = notifications.filter(n => {
    if (dismissed.has(n.id)) return false;
    const style = getNotifStyle(n.type);
    if (cat !== "Todos" && style.cat !== cat) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.subtitle.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unread = filtered.filter(n => !n.isRead).length;

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach(n => {
    const key = fmtDate(n.createdAt);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  });

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
            {unread > 0 && (
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
          {isLoading && (
            <div className="flex flex-col gap-3 pt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-3 p-4 bg-white rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && Object.keys(grouped).length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell style={{ width: 28, height: 28, color: "#d1d5db" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", fontFamily: "'Syne', sans-serif" }}>Sem notificações</p>
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                {cat !== "Todos"
                  ? `Não há notificações em "${cat}".`
                  : "As tuas notificações aparecerão aqui."}
              </p>
            </div>
          )}

          {!isLoading && Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.6px", textTransform: "uppercase" }}>{date}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2">
                {items.map(n => {
                  const { iconBg, iconColor, Icon } = getNotifStyle(n.type);
                  return (
                    <motion.div key={n.id} variants={fadeUp}
                      onClick={() => handleClick(n.id)}
                      style={{
                        background: n.isRead ? "#fff" : "#f5f0ff",
                        borderRadius: 16,
                        border: n.isRead ? "1px solid #f1f5f9" : "1px solid #ddd6fe",
                        padding: "12px 14px",
                        display: "flex", gap: 12, cursor: "pointer",
                        boxShadow: n.isRead ? "0 1px 4px rgba(0,0,0,0.04)" : "0 2px 12px rgba(124,58,237,0.10)",
                        position: "relative", transition: "background 0.2s",
                      }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon style={{ width: 19, height: 19, color: iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: n.isRead ? 600 : 700, fontSize: 13.5, color: "#111827", lineHeight: 1.3 }}>{n.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#7c3aed", flexShrink: 0, display: "inline-block" }} />}
                            <span style={{ fontSize: 10.5, color: "#9ca3af", whiteSpace: "nowrap" }}>{fmtTime(n.createdAt)}</span>
                          </div>
                        </div>
                        {n.subtitle && (
                          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>{n.subtitle}</p>
                        )}
                        {n.actionButtonLabel && n.actionButtonUrl && (
                          <div className="mt-2">
                            <a href={n.actionButtonUrl}
                              style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textDecoration: "none" }}>
                              {n.actionButtonLabel} →
                            </a>
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
          ))}
        </div>
      </div>
    </div>
  );
}
