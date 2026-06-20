import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

const STORAGE_KEY = "mozbet_cookies_accepted";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) setVisible(true);
    } catch {
      /* ignore if localStorage unavailable */
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    setVisible(false);
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, "false"); } catch {}
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        /* Fixed outer wrapper handles the position — no transform conflict with Framer Motion */
        <div style={{
          position: "fixed",
          bottom: 88,
          left: 16,
          right: 16,
          zIndex: 9999,
          maxWidth: 414,
          margin: "0 auto",
          pointerEvents: "none",
        }}>
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ pointerEvents: "auto" }}
          >
            <div style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: "16px 18px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <ShieldCheck style={{ width: 17, height: 17, color: "#374151" }} />
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <p style={{
                    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13.5,
                    color: "#111827", margin: 0, lineHeight: 1.3,
                  }}>Cookies & Privacidade</p>
                  <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "2px 0 0" }}>Precisamos da tua autorização</p>
                </div>
                <button
                  onClick={decline}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 4, color: "#9ca3af", flexShrink: 0,
                    display: "flex", alignItems: "center",
                  }}
                  aria-label="Fechar"
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Body */}
              <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 14px" }}>
                Usamos cookies essenciais para autenticação e funcionamento da plataforma, além de cookies analíticos para melhorar a tua experiência.
              </p>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={decline}
                  style={{
                    flex: 1, height: 40, borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb", color: "#6b7280",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Recusar
                </button>
                <button
                  onClick={accept}
                  style={{
                    flex: 2, height: 40, borderRadius: 10, border: "none",
                    background: "#111827",
                    color: "#fff",
                    fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Aceitar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
