import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Zap, Delete
} from "lucide-react";

const CYAN = "#00D4B4";

function getBalance(): number {
  return parseFloat(localStorage.getItem("winmoz_balance") || "0");
}
function addBalance(amount: number) {
  const current = getBalance();
  localStorage.setItem("winmoz_balance", (current + amount).toFixed(2));
}
function fmtMZN(val: number) {
  return val.toFixed(2).replace(".", ",");
}

const CODE_MAP: Record<string, number> = {
  "1": 20,
  "2": 50,
  "3": 100,
  "4": 200,
  "5": 500,
};

function formatDisplay(raw: string): string {
  const digits = raw.slice(0, 15);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 5) parts.push(digits.slice(i, i + 5));
  return parts.join("-");
}

type Screen = "input" | "processing" | "success" | "error";

export default function Recarga() {
  const [, setLocation] = useLocation();
  const [digits, setDigits] = useState("");
  const [screen, setScreen] = useState<Screen>("input");
  const [amount, setAmount] = useState(0);
  const [shake, setShake] = useState(false);

  const isComplete = digits.length === 15;
  const display = formatDisplay(digits);

  const handleDigit = (d: string) => {
    if (digits.length >= 15) return;
    setDigits(prev => prev + d);
  };
  const handleBackspace = () => setDigits(prev => prev.slice(0, -1));
  const handleClear = () => setDigits("");

  const handleSubmit = () => {
    if (!isComplete) return;
    const firstDigit = digits[0];

    let resolved = 0;
    if (digits === "1".repeat(15)) {
      resolved = 500;
    } else if (CODE_MAP[firstDigit]) {
      resolved = CODE_MAP[firstDigit];
    }

    setScreen("processing");
    setTimeout(() => {
      if (resolved > 0) {
        addBalance(resolved);
        setAmount(resolved);
        setScreen("success");
      } else {
        setScreen("error");
      }
    }, 2000);
  };

  const handleRetry = () => {
    setDigits("");
    setScreen("input");
  };

  /* ── INPUT SCREEN ── */
  if (screen === "input") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-12 pb-6">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Recarregar Saldo</p>
            <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <Bell style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </div>

          <div className="flex-1 flex flex-col px-5">
            {/* Title area */}
            <div className="mb-7">
              <p className="text-4xl font-light text-white mb-2 leading-tight" style={{ fontFamily: "system-ui" }}>
                Introduz o<br />
                <span style={{ color: CYAN }}>código</span>
              </p>
              <p className="text-sm" style={{ color: "#8e8e93" }}>
                O teu código de 15 dígitos encontra-se no comprovativo de compra.
              </p>
            </div>

            {/* Code display */}
            <motion.div
              animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl px-5 py-5 mb-4 flex flex-col items-center"
              style={{ background: "#1c1c1e" }}
            >
              <p
                className="text-center font-mono tracking-[0.22em] mb-3"
                style={{
                  fontSize: digits.length === 0 ? 20 : 24,
                  color: digits.length === 0 ? "#3a3a3c" : isComplete ? CYAN : "#fff",
                  letterSpacing: "0.2em",
                  fontWeight: 600,
                  minHeight: 36,
                  transition: "color 0.2s",
                }}
              >
                {digits.length === 0 ? "00000-00000-00000" : display || "—"}
              </p>

              {/* Progress bar */}
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#2c2c2e" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: isComplete ? CYAN : "#636366" }}
                  animate={{ width: `${(digits.length / 15) * 100}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: "#636366" }}>{digits.length}/15 dígitos</p>

              {/* Amount preview */}
              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full rounded-xl px-4 py-3 text-center overflow-hidden"
                    style={{ background: "#2c2c2e" }}
                  >
                    {(() => {
                      const fd = digits[0];
                      const amt = digits === "1".repeat(15) ? 500 : CODE_MAP[fd];
                      return amt ? (
                        <>
                          <p className="text-xs mb-0.5" style={{ color: "#636366" }}>Valor detectado</p>
                          <p className="font-bold text-xl" style={{ color: CYAN, fontFamily: "system-ui" }}>
                            +{fmtMZN(amt)} MZN
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <AlertTriangle style={{ width: 14, height: 14, color: "#e74c3c" }} />
                          <p className="text-sm font-medium" style={{ color: "#e74c3c" }}>Código inválido</p>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Hint */}
            <div className="flex items-center gap-2 mb-6 px-1">
              <Zap style={{ width: 13, height: 13, color: CYAN, flexShrink: 0 }} />
              <p className="text-xs" style={{ color: "#636366" }}>
                Exemplo válido:{" "}
                <span className="font-mono" style={{ color: "#8e8e93" }}>10000-00000-00000</span>
              </p>
            </div>

            {/* Submit button */}
            <motion.button
              whileTap={isComplete ? { scale: 0.97 } : {}}
              onClick={handleSubmit}
              disabled={!isComplete}
              className="w-full h-14 rounded-full font-semibold text-base mb-6 transition-all"
              style={{
                background: isComplete ? CYAN : "#1c1c1e",
                color: isComplete ? "#000" : "#3a3a3c",
              }}
            >
              {isComplete ? "Processar Recarga" : "Introduz o código completo"}
            </motion.button>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.85, background: "#3a3a3c" }}
                  onClick={() => {
                    if (key === "⌫") handleBackspace();
                    else if (key === "C") handleClear();
                    else handleDigit(key);
                  }}
                  className="h-14 rounded-2xl flex items-center justify-center transition-colors"
                  style={{ background: "#1c1c1e" }}
                >
                  {key === "⌫"
                    ? <Delete style={{ width: 20, height: 20, color: "#fff" }} />
                    : <span style={{ fontSize: 22, fontWeight: key === "C" ? 600 : 400, color: key === "C" ? "#e74c3c" : "#fff", fontFamily: "system-ui" }}>{key}</span>
                  }
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── PROCESSING SCREEN ── */
  if (screen === "processing") {
    return (
      <div className="min-h-screen w-full flex justify-center items-center" style={{ background: "#000" }}>
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 rounded-full border-2 border-white/5 absolute" />
            <div className="w-20 h-20 rounded-full border-2 border-t-transparent animate-spin absolute"
              style={{ borderColor: `${CYAN} transparent transparent transparent` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap style={{ width: 24, height: 24, color: CYAN }} />
            </div>
          </div>
          <p className="font-medium text-white text-base">A validar código…</p>
          <p className="text-sm" style={{ color: "#636366" }}>Por favor aguarda</p>
        </div>
      </div>
    );
  }

  /* ── SUCCESS SCREEN ── */
  if (screen === "success") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-8">
            <div className="w-10" />
            <p className="font-semibold text-white text-base">Recarregar Saldo</p>
            <div className="w-10" />
          </div>

          <motion.div className="flex flex-col items-center mb-10"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
              style={{ background: "linear-gradient(135deg, #00b09b, #00D4B4)" }}>
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-2">Recarga Aprovada</p>
            <p className="font-light text-center" style={{ fontSize: "3.5rem", fontFamily: "system-ui", lineHeight: 1, color: "#fff" }}>
              +{fmtMZN(amount)}<span className="text-2xl ml-1" style={{ color: CYAN }}>MZN</span>
            </p>
            <p className="text-sm mt-3" style={{ color: "#636366" }}>
              Adicionado ao teu saldo principal
            </p>
          </motion.div>

          {/* Receipt */}
          <motion.div className="rounded-2xl overflow-hidden mb-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-sm">Recibo de Recarga</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID da Operação", val: "WM" + Math.random().toString(36).slice(2,8).toUpperCase() },
                { label: "Data",           val: new Date().toLocaleDateString("pt-PT", { day:"2-digit", month:"long", year:"numeric" }) },
                { label: "Valor",          val: `+${fmtMZN(amount)} MZN`, hi: true },
                { label: "Método",         val: "Código de Recarga" },
                { label: "Estado",         val: "Aprovado ✓", hi: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: (row as any).hi ? CYAN : "#fff" }}>{row.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex flex-col gap-3">
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 rounded-full font-semibold text-base text-black"
              style={{ background: CYAN }}>
              Ir ao Perfil
            </button>
            <button onClick={handleRetry}
              className="w-full h-14 rounded-full font-medium text-sm"
              style={{ background: "#1c1c1e", color: "#8e8e93" }}>
              Nova Recarga
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── ERROR SCREEN ── */
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <div className="w-10" />
          <p className="font-semibold text-white text-base">Recarregar Saldo</p>
          <div className="w-10" />
        </div>

        <motion.div className="flex flex-col items-center mb-10"
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
            <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-2">Código Inválido</p>
          <p className="font-semibold text-white text-2xl text-center">Recarga Recusada</p>
          <p className="text-sm text-center mt-2 max-w-xs" style={{ color: "#636366" }}>
            O código introduzido não é válido, expirou ou já foi utilizado anteriormente.
          </p>
        </motion.div>

        <motion.div className="rounded-2xl overflow-hidden mb-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-white font-bold text-sm">Possíveis Causas</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {[
              "Código digitado incorrectamente",
              "Código já utilizado anteriormente",
              "Código expirado ou inválido",
              "Tipo de código não suportado",
            ].map(item => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#e74c3c" }} />
                <p className="text-sm" style={{ color: "#8e8e93" }}>{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex flex-col gap-3">
          <button onClick={handleRetry}
            className="w-full h-14 rounded-full font-semibold text-base flex items-center justify-center gap-2 text-black"
            style={{ background: CYAN }}>
            <RotateCcw style={{ width: 18, height: 18 }} />
            Tentar Novamente
          </button>
          <button onClick={() => setLocation("/perfil")}
            className="w-full h-14 rounded-full font-medium text-sm"
            style={{ background: "#1c1c1e", color: "#8e8e93" }}>
            Voltar ao Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
