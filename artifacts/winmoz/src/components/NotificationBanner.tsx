import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetUserNotifications, useMarkNotificationRead, UserNotification } from "@/admin/lib/supabase-api";
import { useLocation } from "wouter";

function LogoBars() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3 }}>
      <div style={{
        width: 5, height: 14, borderRadius: 3,
        background: "linear-gradient(to bottom, #a78bfa, #6C5CE7)",
      }} />
      <div style={{
        width: 5, height: 21, borderRadius: 3,
        background: "linear-gradient(to bottom, #f472b6, #c026d3)",
      }} />
    </div>
  );
}

function CountdownButton({ onDismiss }: { onDismiss: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const ready = secondsLeft === 0;

  return (
    <button
      onClick={ready ? onDismiss : undefined}
      disabled={!ready}
      style={{
        marginTop: 20,
        width: "100%",
        padding: "11px 20px",
        borderRadius: 14,
        border: "none",
        cursor: ready ? "pointer" : "not-allowed",
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: "inherit",
        color: ready ? "#fff" : "rgba(255,255,255,0.45)",
        background: ready
          ? "linear-gradient(135deg, #6C5CE7, #4f46e5)"
          : "rgba(255,255,255,0.1)",
        transition: "all 0.3s ease",
        letterSpacing: "0.2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {ready ? "Já li" : `Já li  (${secondsLeft}s)`}
    </button>
  );
}

export default function NotificationBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: notifications = [] } = useGetUserNotifications(user?.id ?? null);
  const markRead = useMarkNotificationRead();
  const [queue, setQueue] = useState<UserNotification[]>([]);
  const [current, setCurrent] = useState<UserNotification | null>(null);
  const shownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unread = notifications.filter(n => !n.isRead && !shownIds.current.has(n.id));
    if (unread.length === 0) return;

    const fresh = unread.filter(n => {
      if (n.type === "announcement") return true;
      const age = Date.now() - new Date(n.createdAt).getTime();
      return age < 10 * 60 * 1000;
    });

    if (fresh.length === 0) return;

    fresh.forEach(n => shownIds.current.add(n.id));
    setQueue(prev => {
      const existing = new Set(prev.map(p => p.id));
      return [...prev, ...fresh.filter(n => !existing.has(n.id))];
    });
  }, [notifications]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [queue, current]);

  function dismiss() {
    if (!current || !user) return;
    markRead.mutate({ notificationId: current.id, userId: user.id });
    setCurrent(null);
  }

  function handleAction() {
    if (!current?.actionButtonUrl) return;
    if (current.actionButtonUrl.startsWith("http")) {
      window.open(current.actionButtonUrl, "_blank");
    } else {
      setLocation(current.actionButtonUrl);
    }
    dismiss();
  }

  const isAnnouncement = current?.type === "announcement";

  return (
    <AnimatePresence>
      {current && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 9998,
            }}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: isAnnouncement ? "min(92vw, 440px)" : "min(88vw, 380px)",
              zIndex: 9999,
              borderRadius: 22,
              overflow: "hidden",
              background: "linear-gradient(160deg, #1a0840 0%, #2d1065 50%, #1e0a3c 100%)",
              boxShadow: "0 24px 64px rgba(108,92,231,0.45), 0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            {isAnnouncement ? (
              /* ── Announcement layout: image left + content right ── */
              <div style={{ display: "flex", minHeight: 140 }}>
                {/* Left: image */}
                {current.imageUrl && (
                  <div style={{ width: 130, flexShrink: 0, position: "relative", overflow: "hidden" }}>
                    <img
                      src={current.imageUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, rgba(30,8,60,0.6))" }} />
                  </div>
                )}
                {/* Right: content */}
                <div style={{ flex: 1, padding: current.imageUrl ? "20px 20px 20px 18px" : "22px 22px 20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <LogoBars />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Anúncio</span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: 4, fontFamily: "'Syne', sans-serif" }}>
                    {current.title}
                  </p>
                  {current.subtitle && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 10 }}>
                      {current.subtitle}
                    </p>
                  )}
                  {current.actionButtonLabel && (
                    <button
                      onClick={handleAction}
                      style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6C5CE7, #4f46e5)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                      {current.actionButtonLabel}
                      <ExternalLink style={{ width: 11, height: 11 }} />
                    </button>
                  )}
                  <CountdownButton onDismiss={dismiss} />
                </div>
              </div>
            ) : (
              /* ── Regular notification layout ── */
              <div style={{ padding: "22px 22px 22px 22px" }}>
                {/* Logo bars top-left */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <LogoBars />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Notificação</span>
                </div>

                {/* Title + subtitle */}
                <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.35, marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
                  {current.title}
                </p>
                {current.subtitle && (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
                    {current.subtitle}
                  </p>
                )}

                {/* Action button */}
                {current.actionButtonLabel && (
                  <button
                    onClick={handleAction}
                    style={{ marginTop: 14, padding: "9px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                    {current.actionButtonLabel}
                    <ExternalLink style={{ width: 12, height: 12 }} />
                  </button>
                )}

                {/* Countdown dismiss button */}
                <CountdownButton onDismiss={dismiss} />

                {/* Progress bar */}
                <div style={{ marginTop: 14, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 10, ease: "linear" }}
                    style={{ height: "100%", background: "linear-gradient(to right, #a78bfa, #6C5CE7)", borderRadius: 2 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
