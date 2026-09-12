import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, PartyPopper, Sparkles } from "lucide-react";

interface WelcomeBonusModalProps {
  show: boolean;
  onClose: () => void;
}

export default function WelcomeBonusModal({ show, onClose }: WelcomeBonusModalProps) {
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setConfetti(false), 3000);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="wb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
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
              padding: "20px",
            }}
          >
            <motion.div
              key="wb-card"
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 340, damping: 24 }}
              style={{
                width: "min(90vw, 380px)",
                pointerEvents: "all",
                borderRadius: 24,
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 30px 70px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.1)",
                border: "1px solid rgba(0,0,0,0.05)",
                position: "relative",
              }}
            >
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 30,
                  height: 30,
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
                <X style={{ width: 15, height: 15, color: "#64748b" }} />
              </button>

              {/* Top gradient bar */}
              <div style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316, #ef4444)",
                padding: "28px 24px 24px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Confetti particles */}
                {confetti && Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      opacity: 1,
                      y: 0,
                      x: (Math.random() - 0.5) * 200,
                      scale: Math.random() * 0.5 + 0.5,
                    }}
                    animate={{
                      opacity: 0,
                      y: -80 - Math.random() * 100,
                      x: (Math.random() - 0.5) * 300,
                      rotate: Math.random() * 360,
                    }}
                    transition={{
                      duration: 1.5 + Math.random() * 1.5,
                      ease: "easeOut",
                      delay: Math.random() * 0.3,
                    }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 8,
                      height: 8,
                      borderRadius: Math.random() > 0.5 ? 999 : 2,
                      background: ["#fbbf24", "#f472b6", "#a78bfa", "#34d399", "#60a5fa"][i % 5],
                    }}
                  />
                ))}

                {/* Gift icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <Gift style={{ width: 32, height: 32, color: "#fff" }} />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 4,
                  }}
                >
                  Bónus de Boas-Vindas
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.4 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  <span style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: "'Syne', sans-serif",
                    lineHeight: 1,
                    textShadow: "0 2px 10px rgba(0,0,0,0.15)",
                  }}>
                    10
                  </span>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.85)",
                    marginTop: 10,
                  }}>
                    MT
                  </span>
                </motion.div>
              </div>

              {/* Content */}
              <div style={{ padding: "24px 24px 28px", textAlign: "center" }}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}>
                    <PartyPopper style={{ width: 18, height: 18, color: "#f59e0b" }} />
                    <p style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0f172a",
                      fontFamily: "'Syne', sans-serif",
                    }}>
                      Parabéns!
                    </p>
                  </div>

                  <p style={{
                    fontSize: 13.5,
                    color: "#475569",
                    lineHeight: 1.65,
                    marginBottom: 8,
                  }}>
                    Recebeste <strong style={{ color: "#f59e0b" }}>10 MT</strong> de bónus de boas-vindas!
                  </p>
                  <p style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}>
                    Faz uma aposta para desbloquear o bónus para levantamento.
                    Boa sorte nos jogos!
                  </p>

                  <div style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "center",
                  }}>
                    <Sparkles style={{ width: 14, height: 14, color: "#d97706", flexShrink: 0 }} />
                    <p style={{ fontSize: 11.5, color: "#92400e", fontWeight: 600 }}>
                      Usa o bónus para jogar Damas, Ludo ou Xadrez
                    </p>
                  </div>

                  <button
                    onClick={onClose}
                    style={{
                      width: "100%",
                      padding: "13px",
                      borderRadius: 14,
                      border: "none",
                      background: "linear-gradient(135deg, #f59e0b, #f97316)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Syne', sans-serif",
                      letterSpacing: "0.2px",
                      boxShadow: "0 6px 20px rgba(245,158,11,0.35)",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseDown={e => { (e.target as HTMLElement).style.transform = "scale(0.97)"; }}
                    onMouseUp={e => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                  >
                    Começar a Jogar
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
