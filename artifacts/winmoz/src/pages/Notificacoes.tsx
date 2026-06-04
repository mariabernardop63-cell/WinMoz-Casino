import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Bell, Search, X, Megaphone, RefreshCw,
  CheckCircle2, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface AdminNotif {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  action_button_label: string | null;
  action_button_url: string | null;
  target: string;
  created_at: string;
  isRead: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}

export default function Notificacoes() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function fetchNotifs() {
    if (!user) return;
    const { data: all } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user.id);

    const readSet = new Set((reads ?? []).map(r => r.notification_id));

    const mapped: AdminNotif[] = (all ?? []).map(n => ({
      ...n,
      isRead: readSet.has(n.id),
    }));

    setNotifs(mapped);
    setLoading(false);
  }

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("user-notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => fetchNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function markRead(id: string) {
    if (!user) return;
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await supabase.from("notification_reads").upsert({ notification_id: id, user_id: user.id }).onConflict("notification_id,user_id");
  }

  async function markAllRead() {
    if (!user) return;
    const unread = notifs.filter(n => !n.isRead);
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    await Promise.all(unread.map(n =>
      supabase.from("notification_reads").upsert({ notification_id: n.id, user_id: user.id }).onConflict("notification_id,user_id")
    ));
  }

  const filtered = notifs.filter(n =>
    search === "" || n.title.toLowerCase().includes(search.toLowerCase())
    || (n.subtitle ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <button onClick={() => setLocation("/perfil")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div className="text-center">
            <h1 className="font-syne font-bold text-base text-gray-900">Notificações</h1>
            {unreadCount > 0 && (
              <p className="text-[11px] text-indigo-600 font-semibold">{unreadCount} não lida{unreadCount !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button onClick={() => fetchNotifs()} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar notificações…"
              className="w-full pl-9 pr-4 py-2.5 rounded-full bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-indigo-200 text-gray-800" />
          </div>
        </div>

        {unreadCount > 0 && (
          <div className="px-5 pb-3">
            <button onClick={markAllRead}
              className="flex items-center gap-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
              Marcar todas como lidas
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pb-24 px-4 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="font-syne font-bold text-lg text-gray-700 mb-1">Nenhuma notificação</h3>
            <p className="text-sm text-gray-400">
              {search ? "Nenhuma notificação corresponde à pesquisa" : "Ainda não recebeste notificações"}
            </p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            <AnimatePresence>
              {filtered.map(n => (
                <motion.div
                  key={n.id}
                  variants={fadeUp}
                  layout
                  onClick={() => { markRead(n.id); if (n.action_button_url) setLocation(n.action_button_url); }}
                  className={`relative flex items-start gap-3.5 p-4 rounded-2xl transition-all cursor-pointer ${n.isRead ? "bg-white border border-gray-100" : "bg-indigo-50/70 border border-indigo-100"}`}>
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: n.type === "announcement" ? "rgba(245,158,11,.12)" : "rgba(108,92,231,.1)" }}>
                    {n.type === "announcement"
                      ? <Megaphone className="w-5 h-5" style={{ color: "#f59e0b" }} />
                      : <Bell className="w-5 h-5" style={{ color: "#6C5CE7" }} />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13.5px] leading-snug pr-2 ${n.isRead ? "font-medium text-gray-700" : "font-bold text-gray-900"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.subtitle && (
                      <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{n.subtitle}</p>
                    )}
                    {n.action_button_label && (
                      <div className="mt-2">
                        <span className="text-[11.5px] font-bold px-3 py-1 rounded-full"
                          style={{ background: "#6C5CE7", color: "#fff" }}>
                          {n.action_button_label}
                        </span>
                      </div>
                    )}
                  </div>

                  {!n.isRead && (
                    <span className="absolute right-4 top-4 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
