import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Bell, Megaphone, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetUserNotifications, useMarkNotificationRead, UserNotification } from "@/admin/lib/supabase-api";
import { useLocation } from "wouter";
import { BrandMark } from "@/components/BrandLogo";
import { useBrand } from "@/lib/brand-context";

function CountdownButton({ onDismiss }: { onDismiss: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(8);

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
        marginTop: 16,
        width: "100%",
        padding: "12px 20px",
        borderRadius: 12,
        border: "none",
        cursor: ready ? "pointer" : "not-allowed",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Inter', 'Syne', sans-serif",
        color: ready ? "#fff" : "rgba(255,255,255,0.5)",
        background: ready
          ? "linear-gradient(135deg, #1d4ed8, #1e40af)"
          : "rgba(0,0,0,0.06)",
        transition: "all 0.3s ease",
        letterSpacing: "0.3px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {ready ? "Fechar" : `Fechar (${secondsLeft}s)`}
    </button>
  );
}

export default function NotificationBanner() {
  const { user, profile } = useAuth();
  const { brandName } = useBrand();
  const [, setLocation] = useLocation();
  const { data: notifications = [] } = useGetUserNotifications(user?.id ?? null, profile?.created_at ?? null);
  const markRead = useMarkNotificationRead();
  const [queue, setQueue] = useState<UserNotification[]>([]);
  const [current, setCurrent] = useState<UserNotification | null>(null);
  const SHOWN_KEY = "wm_notif_shown";
  const shownIds = useRef<Set<string>>((() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("wm_notif_shown") ?? "[]") as string[];
      return new Set<string>(saved);
    } catch {
      return new Set<string>();
    }
  })());

  useEffect(() => {
    const unread = notifications.filter(n => !n.isRead && !shownIds.current.has(n.id));
    if (unread.length === 0) return;

    const fresh = unread.filter(n => {
      const age = Date.now() - new Date(n.createdAt).getTime();
      return age < 10 * 60 * 1000;
    });

    if (fresh.length === 0) return;

    fresh.forEach(n => {
      shownIds.current.add(n.id);
    });
    try { sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shownIds.current])); } catch { /* ignore */ }
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
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              zIndex: 9998,
            }}
          />

          {/* Centering wrapper */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              pointerEvents: "none",
              padding: "20px",
            }}
          >
            <motion.div
              key="card"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              style={{
                width: isAnnouncement ? "min(92vw, 420px)" : "min(88vw, 380px)",
                pointerEvents: "all",
                borderRadius: 20,
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {/* Close button */}
              <button
                onClick={dismiss}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.05)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                <X style={{ width: 14, height: 14, color: "#64748b" }} />
              </button>

              {isAnnouncement ? (
                /* ── Announcement layout ── */
                <div>
                  {/* Header bar */}
                  <div style={{
                    background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Megaphone style={{ width: 16, height: 16, color: "#fff" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Anúncio</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Comunicado Oficial</p>
                    </div>
                  </div>

                  {/* Image */}
                  {current.imageUrl && (
                    <div style={{ width: "100%", maxHeight: 160, overflow: "hidden", position: "relative" }}>
                      <img
                        src={current.imageUrl}
                        alt=""
                        style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(to top, #fff, transparent)" }} />
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ padding: "18px 20px 20px" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.35, marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>
                      {current.title}
                    </p>
                    {current.subtitle && (
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
                        {current.subtitle}
                      </p>
                    )}
                    {current.actionButtonLabel && (
                      <button
                        onClick={handleAction}
                        style={{
                          width: "100%",
                          padding: "11px 16px",
                          borderRadius: 12,
                          border: "none",
                          background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontFamily: "'Inter', 'Syne', sans-serif",
                          boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
                        }}
                      >
                        {current.actionButtonLabel}
                        <ExternalLink style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                    <CountdownButton onDismiss={dismiss} />
                  </div>
                </div>
              ) : (
                /* ── Regular notification layout ── */
                <div>
                  {/* Header bar */}
                  <div style={{
                    background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Bell style={{ width: 16, height: 16, color: "#fff" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notificação</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{brandName}</p>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ padding: "20px 20px 20px" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.35, marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>
                      {current.title}
                    </p>
                    {current.subtitle && (
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.65, marginBottom: 14 }}>
                        {current.subtitle}
                      </p>
                    )}

                    {/* Action button */}
                    {current.actionButtonLabel && (
                      <button
                        onClick={handleAction}
                        style={{
                          width: "100%",
                          padding: "11px 16px",
                          borderRadius: 12,
                          border: "1px solid rgba(29,78,216,0.2)",
                          background: "rgba(29,78,216,0.06)",
                          color: "#1d4ed8",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontFamily: "'Inter', 'Syne', sans-serif",
                        }}
                      >
                        {current.actionButtonLabel}
                        <ExternalLink style={{ width: 13, height: 13 }} />
                      </button>
                    )}

                    <CountdownButton onDismiss={dismiss} />

                    {/* Progress bar */}
                    <div style={{ marginTop: 12, height: 3, borderRadius: 3, background: "rgba(0,0,0,0.04)", overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 8, ease: "linear" }}
                        style={{ height: "100%", background: "linear-gradient(to right, #1d4ed8, #3b82f6)", borderRadius: 3 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
