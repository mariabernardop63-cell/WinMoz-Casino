import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface BilharAccessModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

export default function BilharAccessModal({ open, onClose, onUnlock }: BilharAccessModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setError(false);
      const prev = parseInt(sessionStorage.getItem("wm_bilhar_attempts") ?? "0");
      setAttempts(prev);
      setLocked(prev >= 5);
      if (prev < 5) setTimeout(() => inputsRef.current[0]?.focus(), 200);
    }
  }, [open]);

  function handleChange(idx: number, val: string) {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/^\d$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError(false);
    if (val && idx < 3) {
      inputsRef.current[idx + 1]?.focus();
    }
    if (next.every(d => d !== "")) {
      setTimeout(() => {
        if (next.join("") === "0011") {
          sessionStorage.removeItem("wm_bilhar_attempts");
          onUnlock();
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          try { sessionStorage.setItem("wm_bilhar_attempts", String(newAttempts)); } catch {}
          if (newAttempts >= 5) {
            setLocked(true);
          } else {
            setError(true);
            setDigits(["", "", "", ""]);
            inputsRef.current[0]?.focus();
          }
        }
      }, 150);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const next = pasted.split("").concat(["", "", "", ""]).slice(0, 4);
    setDigits(next);
    const firstEmpty = next.findIndex(d => d === "");
    const focusIdx = firstEmpty === -1 ? 3 : firstEmpty;
    inputsRef.current[focusIdx]?.focus();
    if (pasted.length === 4) {
      setTimeout(() => {
        if (pasted === "0011") {
          sessionStorage.removeItem("wm_bilhar_attempts");
          onUnlock();
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          try { sessionStorage.setItem("wm_bilhar_attempts", String(newAttempts)); } catch {}
          if (newAttempts >= 5) {
            setLocked(true);
          } else {
            setError(true);
            setDigits(["", "", "", ""]);
            inputsRef.current[0]?.focus();
          }
        }
      }, 150);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[88%] max-w-[320px]"
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "36px 28px 28px",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              style={{
                position: "absolute", top: 12, right: 12,
                width: 28, height: 28, borderRadius: "50%",
                background: "#f3f4f6", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X className="w-3.5 h-3.5" style={{ color: "#999" }} />
            </button>

            {/* Top accent line */}
            <div style={{
              position: "absolute", top: 0, left: 28, right: 28, height: 2,
              background: "#000", borderRadius: "0 0 2px 2px",
            }} />

            {/* Billiard ball icon */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", position: "relative",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontFamily: "Syne, sans-serif", fontWeight: 900,
                  fontSize: 11, color: "#000", lineHeight: 1,
                }}>8</span>
              </div>
            </div>

            {/* Title */}
            <h2 style={{
              fontFamily: "Syne, sans-serif", fontWeight: 800,
              fontSize: 17, color: "#000", textAlign: "center",
              marginBottom: 6, letterSpacing: "-0.3px",
            }}>
              Acesso Exclusivo
            </h2>

            {/* Description */}
            <p style={{
              fontSize: 12.5, color: "#888", textAlign: "center",
              lineHeight: 1.6, marginBottom: locked ? 8 : 24, padding: "0 4px",
            }}>
              Este jogo ainda está em fase de desenvolvimento.
              <br />
              {locked
                ? "O acesso está temporariamente indisponível."
                : "Introduzir o código de acesso para continuar."}
            </p>

            {/* Code inputs — only when not locked */}
            {!locked && (
              <>
                <div style={{
                  display: "flex", gap: 10, justifyContent: "center",
                  marginBottom: error ? 8 : 0,
                }}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      autoFocus={i === 0}
                      style={{
                        width: 52, height: 58, borderRadius: 12,
                        border: error
                          ? "2px solid #dc2626"
                          : d ? "2px solid #000" : "2px solid #e5e7eb",
                        background: d ? "#f9fafb" : "#fff",
                        textAlign: "center",
                        fontFamily: "Syne, sans-serif", fontWeight: 800,
                        fontSize: 22, color: "#000",
                        outline: "none", caretColor: "#000",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    />
                  ))}
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{
                        fontSize: 11.5, color: "#dc2626", textAlign: "center",
                        marginTop: 8, fontWeight: 600,
                      }}
                    >
                      Código incorrecto. Tenta novamente.
                    </motion.p>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* Locked state — just the line */}
            {locked && (
              <div style={{
                width: 40, height: 2, borderRadius: 1,
                background: "#ddd", margin: "0 auto",
              }} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
