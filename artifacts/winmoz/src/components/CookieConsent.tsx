import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, ShieldCheck } from "lucide-react";

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
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 430,
            zIndex: 9999,
          }}
        >
          <div style={{
            background: "linear-gradient(135deg, #131320, #1a1a30)",
            borderRadius: 20,
            border: "1px solid rgba(124,58,237,0.25)",
            padding: "18px 20px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Cookie style={{ width: 18, height: 18, color: "#a78bfa" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14,
                  color: "#fff", margin: 0,
                }}>Cookies & Privacidade</p>
                <p style={{ fontSize: 10.5, color: "#71717a", margin: 0 }}>MOZBET respeita a tua privacidade</p>
              </div>
              <button
                onClick={decline}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#52525b" }}
                aria-label="Fechar"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Body */}
            <p style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 14 }}>
              Usamos cookies essenciais para autenticação e funcionamento da plataforma, além de cookies analíticos para melhorar a tua experiência de jogo. Podes aceitar ou recusar cookies não essenciais.
            </p>

            {/* Feature chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {["Autenticação segura", "Sessão de jogo", "Análise anónima"].map(chip => (
                <div key={chip} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 99,
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                }}>
                  <ShieldCheck style={{ width: 10, height: 10, color: "#22c55e" }} />
                  <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{chip}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={decline}
                style={{
                  flex: 1, height: 42, borderRadius: 12, border: "1px solid #2c2c2e",
                  background: "transparent", color: "#71717a",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Recusar
              </button>
              <button
                onClick={accept}
                style={{
                  flex: 2, height: 42, borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #7c3aed, #6C5CE7)",
                  color: "#fff",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                }}
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
