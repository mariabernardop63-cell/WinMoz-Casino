import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, PartyPopper } from "lucide-react";

interface WelcomeBonusModalProps {
  show: boolean;
  onClose: () => void;
}

export default function WelcomeBonusModal({ show, onClose }: WelcomeBonusModalProps) {
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    if (!show) return;
    setConfetti(true);
    const t = setTimeout(() => setConfetti(false), 3500);
    return () => clearTimeout(t);
  }, [show]);

  const confettiPieces = Array.from({ length: 18 });

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="wb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
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
              initial={{ opacity: 0, scale: 0.82, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              style={{
                width: "min(92vw, 400px)",
                pointerEvents: "all",
                borderRadius: 28,
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 32px 80px rgba(0,0,0,0.25), 0 12px 32px rgba(0,0,0,0.12)",
                border: "1px solid rgba(0,0,0,0.04)",
                position: "relative",
              }}
            >
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 10,
                  backdropFilter: "blur(4px)",
                }}
              >
                <X style={{ width: 16, height: 16, color: "rgba(255,255,255,0.8)" }} />
              </button>

              {/* Top section — gradient */}
              <div style={{
                background: "linear-gradient(145deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)",
                padding: "36px 28px 32px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Subtle pattern overlay */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.1) 0%, transparent 40%)",
                }} />

                {/* Confetti */}
                {confetti && confettiPieces.map((_, i) => {
                  const colors = ["#fbbf24", "#f472b6", "#a78bfa", "#34d399", "#60a5fa", "#fb923c"];
                  return (
                    <motion.div
                      key={i}
                      initial={{
                        opacity: 1,
                        y: 0,
                        x: (Math.random() - 0.5) * 160,
                        scale: Math.random() * 0.6 + 0.4,
                      }}
                      animate={{
                        opacity: 0,
                        y: -60 - Math.random() * 120,
                        x: (Math.random() - 0.5) * 280,
                        rotate: Math.random() * 540 - 270,
                      }}
                      transition={{
                        duration: 1.8 + Math.random() * 1.5,
                        ease: "easeOut",
                        delay: Math.random() * 0.4,
                      }}
                      style={{
                        position: "absolute",
                        top: "45%",
                        left: "50%",
                        width: i % 3 === 0 ? 10 : 6,
                        height: i % 3 === 0 ? 10 : 6,
                        borderRadius: i % 2 === 0 ? 999 : 2,
                        background: colors[i % colors.length],
                      }}
                    />
                  );
                })}

                {/* Gift icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 22,
                    background: "rgba(255,255,255,0.22)",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 18px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                    position: "relative",
                  }}
                >
                  <Gift style={{ width: 36, height: 36, color: "#fff" }} />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.65)",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    marginBottom: 6,
                    position: "relative",
                  }}
                >
                  Bónus de Boas-Vindas
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.35 }}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: 4,
                    position: "relative",
                  }}
                >
                  <span style={{
                    fontSize: 52,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: "'Syne', sans-serif",
                    lineHeight: 1,
                    textShadow: "0 3px 12px rgba(0,0,0,0.15)",
                  }}>
                    10
                  </span>
                  <span style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.9)",
                    marginTop: 8,
                  }}>
                    MT
                  </span>
                </motion.div>
              </div>

              {/* Bottom section — white */}
              <div style={{ padding: "28px 28px 32px", textAlign: "center" }}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}>
                    <PartyPopper style={{ width: 20, height: 20, color: "#f59e0b" }} />
                    <p style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#0f172a",
                      fontFamily: "'Syne', sans-serif",
                    }}>
                      Parabéns!
                    </p>
                  </div>

                  <p style={{
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.7,
                    marginBottom: 24,
                    maxWidth: 300,
                    margin: "0 auto 24px",
                  }}>
                    Recebeste <strong style={{ color: "#ea580c", fontWeight: 800 }}>10 MT</strong> de bónus
                    para começares a jogar. Boa sorte!
                  </p>

                  <button
                    onClick={onClose}
                    style={{
                      width: "100%",
                      padding: "15px",
                      borderRadius: 16,
                      border: "none",
                      background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Syne', sans-serif",
                      letterSpacing: "0.3px",
                      boxShadow: "0 8px 24px rgba(245,158,11,0.4)",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseDown={e => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(0.97)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(245,158,11,0.3)";
                    }}
                    onMouseUp={e => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(245,158,11,0.4)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(245,158,11,0.4)";
                    }}
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
