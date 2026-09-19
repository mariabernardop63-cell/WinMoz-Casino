import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X } from "lucide-react";

interface BilharAccessModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

export default function BilharAccessModal({ open, onClose, onUnlock }: BilharAccessModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (code === "0011") {
      onUnlock();
      setCode("");
      setError(false);
    } else {
      setError(true);
      setCode("");
    }
  }

  function handleClose() {
    setCode("");
    setError(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[90%] max-w-[340px] rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
              border: "1px solid rgba(56,189,248,0.2)",
              boxShadow: "0 0 40px rgba(56,189,248,0.1), 0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <X className="w-4 h-4 text-white/60" />
            </button>

            {/* Content */}
            <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(14,116,144,0.2))",
                  border: "2px solid rgba(56,189,248,0.3)",
                }}
              >
                <Lock className="w-7 h-7 text-cyan-400" />
              </div>

              <h2 className="text-white font-bold text-lg mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
                Bilhar Exclusivo
              </h2>
              <p className="text-white/50 text-sm mb-6">
                Introduzir código de acesso para jogar
              </p>

              {/* Code input */}
              <div className="w-full mb-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: error
                      ? "2px solid rgba(239,68,68,0.6)"
                      : "2px solid rgba(56,189,248,0.2)",
                    color: "#fff",
                  }}
                />
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs mt-2"
                  >
                    Código incorrecto. Tenta novamente.
                  </motion.p>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={code.length < 4}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                  background: code.length === 4
                    ? "linear-gradient(135deg, #0ea5e9, #0891b2)"
                    : "rgba(255,255,255,0.08)",
                  color: code.length === 4 ? "#fff" : "rgba(255,255,255,0.3)",
                  cursor: code.length === 4 ? "pointer" : "not-allowed",
                }}
              >
                Entrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
