import { motion, AnimatePresence } from "framer-motion";
import { Gift, X } from "lucide-react";

interface WelcomeBonusModalProps {
  show: boolean;
  onClose: () => void;
}

export default function WelcomeBonusModal({ show, onClose }: WelcomeBonusModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="wb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 9998,
            }}
          />

          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              pointerEvents: "none",
              padding: "24px",
            }}
          >
            <motion.div
              key="wb-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="welcome-bonus-title"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{
                width: "min(92vw, 400px)",
                pointerEvents: "all",
                borderRadius: 0,
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
                border: "1px solid #111111",
                position: "relative",
              }}
            >
              <button
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 0,
                  background: "#000000",
                  border: "1px solid #ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                <X style={{ width: 16, height: 16, color: "#ffffff" }} />
              </button>

              <div
                style={{
                  background: "#000000",
                  padding: "36px 28px 32px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 0,
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 18px",
                    border: "1px solid #ffffff",
                  }}
                >
                  <Gift style={{ width: 36, height: 36, color: "#000000" }} />
                </div>

                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#d4d4d4",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    marginBottom: 6,
                  }}
                >
                  Bónus de Boas-Vindas
                </p>

                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 52,
                      fontWeight: 900,
                      color: "#ffffff",
                      fontFamily: "'Syne', sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    10
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", marginTop: 8 }}>
                    MT
                  </span>
                </div>
              </div>

              <div style={{ padding: "28px 28px 32px", textAlign: "center" }}>
                <p
                  id="welcome-bonus-title"
                  style={{
                    fontSize: 19,
                    fontWeight: 900,
                    color: "#111111",
                    fontFamily: "'Syne', sans-serif",
                    marginBottom: 12,
                  }}
                >
                  Parabéns!
                </p>

                <p style={{ fontSize: 14, color: "#404040", lineHeight: 1.7, margin: "0 auto 24px", maxWidth: 300 }}>
                  Recebeste <strong style={{ color: "#000000", fontWeight: 800 }}>10 MT</strong> de bónus
                  para começares a jogar. Boa sorte!
                </p>

                <button
                  onClick={onClose}
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 0,
                    border: "1px solid #000000",
                    background: "#000000",
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "'Syne', sans-serif",
                    letterSpacing: "0.3px",
                    transition: "transform 0.15s",
                  }}
                  onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
                  onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                  Começar a Jogar
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}