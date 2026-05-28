import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Zap, AlertTriangle } from "lucide-react";

const AMOUNT_MAP: Record<string, string> = {
  "1": "20 MT",
  "2": "50 MT",
  "3": "100 MT",
  "4": "200 MT",
  "5": "500 MT",
};

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 5) {
    parts.push(digits.slice(i, i + 5));
  }
  return parts.join("-");
}

type Screen = "input" | "success" | "error";

export default function Recarga() {
  const [, setLocation] = useLocation();
  const [raw, setRaw] = useState("");
  const [screen, setScreen] = useState<Screen>("input");
  const [amount, setAmount] = useState("");
  const [shaking, setShaking] = useState(false);

  const digits = raw.replace(/\D/g, "");
  const displayCode = formatCode(raw);
  const isComplete = digits.length === 15;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 15);
    setRaw(val);
  };

  const handleSubmit = () => {
    if (!isComplete) return;
    const firstDigit = digits[0];
    if (AMOUNT_MAP[firstDigit]) {
      setAmount(AMOUNT_MAP[firstDigit]);
      setScreen("success");
    } else {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      setScreen("error");
    }
  };

  const handleRetry = () => {
    setRaw("");
    setScreen("input");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col relative">

        {/* HEADER */}
        <div
          className="relative px-5 pt-6 pb-8"
          style={{
            background: screen === "success"
              ? "linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%)"
              : screen === "error"
              ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 60%, #ef4444 100%)"
              : "linear-gradient(135deg, #1e1b4b 0%, #5b21b6 60%, #7c3aed 100%)",
            transition: "background 0.5s ease",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute bottom-0 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          <button
            onClick={() => screen !== "input" ? handleRetry() : setLocation("/perfil")}
            className="relative z-10 flex items-center justify-center mb-6 hover:opacity-80 transition-opacity"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.12)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)" }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="relative z-10">
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mb-1">
              {screen === "success" ? "Recarga Confirmada" : screen === "error" ? "Código Inválido" : "WinMoz Pay"}
            </p>
            <h1 className="font-syne font-extrabold text-2xl text-white">
              {screen === "success" ? "Recarga Efectuada!" : screen === "error" ? "Código Recusado" : "Recarregar Saldo"}
            </h1>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 px-5 pt-6 pb-10">
          <AnimatePresence mode="wait">

            {/* ── INPUT SCREEN ── */}
            {screen === "input" && (
              <motion.div key="input" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

                {/* Info card */}
                <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-syne font-bold text-indigo-900 text-sm mb-0.5">Como funciona?</p>
                    <p className="text-indigo-600/80 text-[12px] leading-relaxed">
                      Introduz o teu código de recarga de 15 dígitos. O código é validado instantaneamente.
                    </p>
                  </div>
                </div>

                {/* Code input */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-5 mb-5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Código de Recarga
                  </label>

                  <motion.div
                    animate={shaking ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                  >
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="00000-00000-00000"
                      value={displayCode}
                      onChange={handleInput}
                      className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-mono text-xl font-bold tracking-[0.18em] outline-none transition-all duration-200 text-center ${
                        isComplete
                          ? "border-violet-500 bg-violet-50/40 text-violet-900"
                          : "border-slate-100 focus:border-violet-400 text-slate-800"
                      }`}
                    />
                  </motion.div>

                  {/* Progress dots */}
                  <div className="flex items-center justify-center gap-1 mt-3">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div
                        key={i}
                        className="transition-all duration-200"
                        style={{
                          width: i > 0 && i % 5 === 0 ? 0 : 6,
                          height: 6,
                          marginLeft: i > 0 && i % 5 === 0 ? 8 : 0,
                          borderRadius: "50%",
                          background: i < digits.length ? "#7c3aed" : "#e2e8f0",
                        }}
                      />
                    ))}
                  </div>

                  <p className="text-center text-[11px] text-slate-400 mt-2 font-mono">
                    {digits.length}/15 dígitos
                  </p>
                </div>

                {/* Amount preview */}
                <AnimatePresence>
                  {isComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-between p-4 bg-violet-50 rounded-2xl border border-violet-200 mb-5"
                    >
                      <div>
                        <p className="text-violet-500 text-[11px] font-bold uppercase tracking-widest">Valor detectado</p>
                        {AMOUNT_MAP[digits[0]] ? (
                          <p className="font-syne font-extrabold text-2xl text-violet-900 mt-0.5">{AMOUNT_MAP[digits[0]]}</p>
                        ) : (
                          <p className="font-syne font-bold text-sm text-red-600 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Código parece inválido
                          </p>
                        )}
                      </div>
                      {AMOUNT_MAP[digits[0]] && (
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-violet-600" />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <motion.button
                  whileTap={isComplete ? { scale: 0.97 } : {}}
                  onClick={handleSubmit}
                  disabled={!isComplete}
                  className={`w-full py-4 rounded-2xl font-syne font-bold text-base transition-all duration-300 shadow-lg ${
                    isComplete
                      ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-700 hover:to-purple-800 hover:shadow-violet-200 hover:shadow-xl"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {isComplete ? "Processar Recarga" : "Introduz o código completo"}
                </motion.button>

                {/* Example note */}
                <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed">
                  Exemplo de código válido: <span className="font-mono font-semibold text-slate-600">10000-00000-00000</span>
                </p>
              </motion.div>
            )}

            {/* ── SUCCESS SCREEN ── */}
            {screen === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                >
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                  <p className="text-emerald-600 text-[11px] font-bold uppercase tracking-widest mb-2">Sucesso</p>
                  <h2 className="font-syne font-extrabold text-3xl text-slate-900 mb-1">+{amount}</h2>
                  <p className="text-slate-500 text-sm mb-6">O saldo foi adicionado à tua conta com sucesso.</p>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 mb-6 text-left w-full max-w-xs mx-auto">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest">Recibo</span>
                      <span className="text-[10px] text-emerald-500 font-mono">#{Math.random().toString(36).slice(2,8).toUpperCase()}</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Valor", val: amount },
                        { label: "Código", val: displayCode.slice(0, 11) + "***" },
                        { label: "Estado", val: "Aprovado ✓" },
                        { label: "Data", val: new Date().toLocaleDateString("pt-PT") },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-emerald-700/60 text-[12px]">{row.label}</span>
                          <span className="font-syne font-bold text-emerald-800 text-[12px]">{row.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setLocation("/perfil")}
                    className="w-full py-4 rounded-2xl font-syne font-bold text-base bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-300"
                  >
                    Ir para o Perfil
                  </button>
                  <button
                    onClick={handleRetry}
                    className="w-full py-3 mt-2 rounded-2xl font-syne font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Fazer outra recarga
                  </button>
                </motion.div>
              </motion.div>
            )}

            {/* ── ERROR SCREEN ── */}
            {screen === "error" && (
              <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: 30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}
                >
                  <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }} className="w-full">
                  <p className="text-red-500 text-[11px] font-bold uppercase tracking-widest mb-2">Falhou</p>
                  <h2 className="font-syne font-extrabold text-2xl text-slate-900 mb-2">Código Inválido</h2>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
                    O código introduzido não é válido ou já foi utilizado. Por favor verifica e tenta novamente.
                  </p>

                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-left">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-syne font-bold text-red-700 text-sm mb-1">Possíveis causas:</p>
                        <ul className="space-y-1">
                          {["Código digitado incorrectamente","Código já utilizado anteriormente","Código expirado ou inválido"].map(item => (
                            <li key={item} className="text-red-600/70 text-[12px] flex items-center gap-1.5">
                              <span className="w-1 h-1 bg-red-400 rounded-full flex-shrink-0" />{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRetry}
                    className="w-full py-4 rounded-2xl font-syne font-bold text-base bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-center gap-2 shadow-lg hover:from-red-700 hover:to-rose-700 transition-all duration-300"
                  >
                    <RotateCcw className="w-5 h-5" /> Tentar Novamente
                  </button>
                  <button
                    onClick={() => setLocation("/perfil")}
                    className="w-full py-3 mt-2 rounded-2xl font-syne font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Voltar ao Perfil
                  </button>
                </motion.div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
