import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetUserNotifications, useMarkNotificationRead, UserNotification } from "@/admin/lib/supabase-api";
import { useLocation } from "wouter";

export default function NotificationBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: notifications = [] } = useGetUserNotifications(user?.id ?? null);
  const markRead = useMarkNotificationRead();
  const [queue, setQueue] = useState<UserNotification[]>([]);
  const [current, setCurrent] = useState<UserNotification | null>(null);
  const shownIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unread = notifications.filter(n => !n.isRead && !shownIds.current.has(n.id));
    if (unread.length > 0) {
      const fresh = unread.filter(n => {
        const age = Date.now() - new Date(n.createdAt).getTime();
        return age < 5 * 60 * 1000;
      });
      if (fresh.length > 0) {
        fresh.forEach(n => shownIds.current.add(n.id));
        setQueue(prev => {
          const existing = new Set(prev.map(p => p.id));
          return [...prev, ...fresh.filter(n => !existing.has(n.id))];
        });
      }
    }
  }, [notifications]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [queue, current]);

  useEffect(() => {
    if (current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dismiss(), 8000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current]);

  function dismiss() {
    if (!current || !user) return;
    markRead.mutate({ notificationId: current.id, userId: user.id });
    setCurrent(null);
  }

  function handleAction() {
    if (!current) return;
    if (current.actionButtonUrl) {
      if (current.actionButtonUrl.startsWith("http")) {
        window.open(current.actionButtonUrl, "_blank");
      } else {
        setLocation(current.actionButtonUrl);
      }
    }
    dismiss();
  }

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(92vw, 400px)",
            zIndex: 9999,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(124,58,237,0.35), 0 2px 12px rgba(0,0,0,0.15)",
          }}>

          {/* Image */}
          {current.imageUrl && (
            <img src={current.imageUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}

          {/* Content */}
          <div style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #3b1080 100%)", padding: "14px 16px 14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <Bell style={{ width: 17, height: 17, color: "#fff" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 2, fontFamily: "'Syne', sans-serif" }}>{current.title}</p>
                {current.subtitle && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{current.subtitle}</p>
                )}
              </div>
              <button onClick={dismiss} style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.7)" }} />
              </button>
            </div>

            {current.actionButtonLabel && (
              <button onClick={handleAction}
                style={{ marginTop: 12, width: "100%", padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                {current.actionButtonLabel}
                <ExternalLink style={{ width: 12, height: 12 }} />
              </button>
            )}

            {/* Progress bar */}
            <div style={{ marginTop: 10, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 8, ease: "linear" }}
                style={{ height: "100%", background: "rgba(255,255,255,0.5)", borderRadius: 2 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
