import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, X, Smartphone, Delete, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
} from "lucide-react";

const CYAN = "#00D4B4";
const METHOD_NAME = "M-Pesa";

function getBalance(): number {
  return parseFloat(localStorage.getItem("winmoz_balance") || "0");
}
function setBalance(v: number) {
  localStorage.setItem("winmoz_balance", v.toFixed(2));
}
function addTransaction(tx: object) {
  const existing = JSON.parse(localStorage.getItem("winmoz_transactions") || "[]");
  localStorage.setItem("winmoz_transactions", JSON.stringify([tx, ...existing]));
}
function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "confirm" | "success" | "rejected";

function Spinner() {
  return <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />;
}

/* ── Animated success checkmark ── */
function SuccessIcon() {
  return (
    <motion.div className="relative flex items-center justify-center"
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}>
      {/* Outer pulse ring */}
      <motion.div className="absolute rounded-full"
        style={{ width: 110, height: 110, background: "rgba(34,197,94,0.15)" }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
        style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}>
          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function Depositar() {
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("amount");
  const [rawCents, setRawCents] = useState(0);
  const [phone, setPhone] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [processingContinue, setProcessingContinue] = useState(false);
  const [processingConfirm, setProcessingConfirm] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [txId] = useState(() => "WM" + Math.random().toString(36).slice(2, 10).toUpperCase());
  const txDate = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

  const amountVal = rawCents / 100;
  const isAmountZero = rawCents === 0;
  const phoneDigits = phone.replace(/\D/g, "");
  const canContinue = !isAmountZero && phoneDigits.length >= 9;

  const displayAmount = (() => {
    const str = rawCents.toString().padStart(3, "0");
    const intPart = str.slice(0, -2) || "0";
    const decPart = str.slice(-2);
    return `${Number(intPart).toLocaleString("pt-PT")},${decPart}`;
  })();

  const handleDigit = (d: string) => {
    if (d === ".") return;
    const newCents = parseInt((rawCents.toString() + d).slice(-8), 10);
    setRawCents(newCents || 0);
  };
  const handleBackspace = () => setRawCents(Math.floor(rawCents / 10));

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhone(raw);
  };

  const formatPhone = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handleContinue = () => {
    if (!canContinue || processingContinue) return;
    setProcessingContinue(true);
    setTimeout(() => { setProcessingContinue(false); setScreen("confirm"); }, 1800);
  };

  const handleConfirm = () => {
    if (processingConfirm) return;
    setProcessingConfirm(true);
    setTimeout(() => {
      setProcessingConfirm(false);
      const success = Math.random() > 0.25;
      if (success) {
        setBalance(getBalance() + amountVal);
        addTransaction({
          id: txId, type: "Depósito", method: METHOD_NAME, phone: `+258 ${formatPhone(phoneDigits)}`,
          amount: amountVal, date: txDate, state: "Aprovado",
        });
        setScreen("success");
      } else {
        setScreen("rejected");
      }
    }, 2200);
  };

  /* ── AMOUNT SCREEN ── */
  if (screen === "amount") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-12 pb-2">
            <div className="w-10" />
            <p className="font-semibold text-white text-base tracking-tight">Depositar</p>
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <X style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </div>

          {/* Amount display */}
          <div className="flex flex-col items-center px-5 pt-10 pb-6">
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-2">Montante a depositar</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-white/50 text-xl font-light" style={{ fontFamily: "system-ui" }}>MZN</span>
              <span className="text-white tracking-tight"
                style={{ fontSize: "3.8rem", fontFamily: "system-ui, -apple-system", fontWeight: 200, lineHeight: 1 }}>
                {displayAmount}
                <span className="animate-pulse" style={{ opacity: 0.6 }}>|</span>
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "#636366" }}>Mín: 50 MZN · Máx: 500.000 MZN</p>
          </div>

          {/* Phone input bar */}
          <div className="mx-5 mb-5">
            <p className="text-xs font-medium mb-2 ml-1" style={{ color: "#8e8e93" }}>Número M-Pesa para transferência</p>
            <motion.button
              onClick={() => phoneRef.current?.focus()}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center rounded-2xl overflow-hidden transition-all"
              style={{
                background: "#1c1c1e",
                border: phoneFocused
                  ? `1.5px solid ${CYAN}`
                  : phoneDigits.length > 0
                  ? "1.5px solid #3a3a3c"
                  : "1.5px solid transparent",
                boxShadow: phoneFocused ? `0 0 0 3px ${CYAN}20` : "none",
              }}>
              {/* Country code badge */}
              <div className="flex items-center gap-1.5 px-4 py-4 border-r flex-shrink-0"
                style={{ borderColor: phoneFocused ? CYAN + "60" : "#2c2c2e" }}>
                <span className="text-base font-bold" style={{ fontFamily: "system-ui" }}>🇲🇿</span>
                <span className="font-bold text-white text-sm" style={{ fontFamily: "system-ui" }}>+258</span>
              </div>

              {/* Number input */}
              <div className="flex-1 px-4 py-4 relative">
                <input
                  ref={phoneRef}
                  type="tel"
                  value={formatPhone(phoneDigits)}
                  onChange={handlePhoneChange}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  placeholder="84 123 4567"
                  inputMode="numeric"
                  className="w-full bg-transparent outline-none font-semibold text-base"
                  style={{
                    color: phoneDigits.length > 0 ? "#fff" : "#3a3a3c",
                    fontFamily: "system-ui, -apple-system",
                    letterSpacing: "0.5px",
                    caretColor: CYAN,
                  }}
                />
                {phoneDigits.length > 0 && phoneDigits.length < 9 && (
                  <p className="text-xs mt-0.5" style={{ color: "#636366" }}>
                    {9 - phoneDigits.length} dígito{9 - phoneDigits.length !== 1 ? "s" : ""} em falta
                  </p>
                )}
                {phoneDigits.length >= 9 && (
                  <p className="text-xs mt-0.5" style={{ color: CYAN }}>✓ Número válido</p>
                )}
              </div>

              {phoneDigits.length > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setPhone(""); }}
                  className="pr-4 pl-1 py-4 flex items-center justify-center flex-shrink-0">
                  <X style={{ width: 16, height: 16, color: "#636366" }} />
                </button>
              )}
            </motion.button>
          </div>

          {/* Continue button */}
          <div className="mx-5 mb-3">
            <motion.button
              onClick={handleContinue}
              disabled={!canContinue || processingContinue}
              whileTap={canContinue && !processingContinue ? { scale: 0.97 } : {}}
              className="w-full h-14 rounded-full flex items-center justify-center font-semibold text-base transition-all"
              style={{
                background: canContinue ? CYAN : "#1c1c1e",
                color: canContinue ? "#000" : "#3a3a3c",
              }}>
              {processingContinue ? (
                <div className="flex items-center gap-3">
                  <Spinner />
                  <span className="text-black font-semibold">A verificar…</span>
                </div>
              ) : "Continuar"}
            </motion.button>
          </div>

          {/* Quick amounts */}
          <div className="flex items-center justify-center gap-2 mx-5 mb-5">
            {[100, 500, 1000, 5000].map(q => (
              <button key={q} onClick={() => setRawCents(q * 100)}
                className="flex-1 h-10 rounded-full font-medium text-sm transition-all"
                style={{
                  background: "#1c1c1e", color: "#fff",
                  border: rawCents === q * 100 ? `1.5px solid ${CYAN}` : "1.5px solid transparent",
                }}>
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-10">
            {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(key => (
              <motion.button key={key}
                whileTap={{ scale: 0.88, background: "#3a3a3c" }}
                onClick={() => key === "⌫" ? handleBackspace() : handleDigit(key)}
                className="h-16 rounded-2xl flex items-center justify-center transition-colors"
                style={{ background: "#1c1c1e" }}>
                {key === "⌫"
                  ? <Delete style={{ width: 22, height: 22, color: "#fff" }} />
                  : <span style={{ fontSize: 26, fontWeight: 400, color: "#fff", fontFamily: "system-ui" }}>{key}</span>
                }
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── CONFIRM SCREEN ── */
  if (screen === "confirm") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-5 pt-12 pb-6">
            <button onClick={() => setScreen("amount")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Rever o Depósito</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 px-5 flex flex-col">
            {/* Amount hero */}
            <div className="flex flex-col items-center mb-7">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: "#1c1c1e", border: "2px solid #2c2c2e" }}>
                <Smartphone style={{ width: 28, height: 28, color: CYAN }} />
              </div>
              <p className="text-white font-light" style={{ fontSize: "2.6rem", fontFamily: "system-ui", lineHeight: 1 }}>
                {fmtMZN(amountVal)}
              </p>
              <p style={{ color: "#8e8e93", fontSize: 14, marginTop: 4 }}>{METHOD_NAME}</p>
            </div>

            {/* Details card */}
            <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "#1c1c1e" }}>
              <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
                <p className="text-white font-bold text-sm">Detalhes do Depósito</p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3.5">
                {[
                  { label: "Montante",       val: `${fmtMZN(amountVal)} MZN` },
                  { label: "Data",           val: txDate },
                  { label: "Frequência",     val: "Uma vez" },
                  { label: "De",             val: `${METHOD_NAME} · +258 ${formatPhone(phoneDigits)}` },
                  { label: "Para",           val: "Carteira WinMoz" },
                  { label: "Taxa de serviço", val: "Grátis", green: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                    <span className="text-sm font-medium" style={{ color: (row as any).green ? "#22c55e" : "#fff", maxWidth: 220, textAlign: "right" }}>
                      {row.val}
                    </span>
                  </div>
                ))}
                <div className="border-t" style={{ borderColor: "#2c2c2e" }} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
                </div>
              </div>
            </div>

            {/* Info notice */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-5" style={{ background: "#1c1c1e" }}>
              <AlertTriangle style={{ width: 15, height: 15, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
                Após confirmar, receberás uma notificação no teu telemóvel para aprovar a transferência via {METHOD_NAME}.
              </p>
            </div>

            {/* Confirm button */}
            {processingConfirm ? (
              <div className="h-14 rounded-full flex items-center justify-center gap-3" style={{ background: CYAN }}>
                <Spinner />
                <span className="text-black font-semibold">A processar…</span>
              </div>
            ) : (
              <motion.button onClick={handleConfirm}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-full font-semibold text-base text-black"
                style={{ background: CYAN }}>
                Confirmar
              </motion.button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── SUCCESS SCREEN ── */
  if (screen === "success") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-end justify-end pt-12 pb-4">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <X style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </div>

          {/* Success hero */}
          <motion.div className="flex flex-col items-center mb-8 pt-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <SuccessIcon />
            <motion.div className="text-center mt-6"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}>
              <p className="text-white font-semibold" style={{ fontSize: "1.55rem", lineHeight: 1.2 }}>
                Adicionaste {fmtMZN(amountVal)} MZN
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8e8e93" }}>
                O teu dinheiro deve chegar em instantes,{"\n"}mas pode demorar até 2 horas.
              </p>
            </motion.div>
          </motion.div>

          {/* Transaction details */}
          <motion.div className="rounded-2xl overflow-hidden mb-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-sm">Detalhes da Transação</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID da Transação", val: txId },
                { label: "Data",            val: txDate },
                { label: "Origem",          val: `${METHOD_NAME} · +258 ${formatPhone(phoneDigits)}` },
                { label: "Destino",         val: "Carteira WinMoz" },
                { label: "Montante",        val: `${fmtMZN(amountVal)} MZN` },
                { label: "Taxa",            val: "Grátis", green: true },
                { label: "Estado",          val: "Confirmado ✓", highlight: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium"
                    style={{ color: (row as any).highlight ? CYAN : (row as any).green ? "#22c55e" : "#fff", maxWidth: 200, textAlign: "right" }}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 rounded-full font-semibold text-base text-black"
              style={{ background: CYAN }}>
              Concluído
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── REJECTED SCREEN ── */
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-end justify-end pt-12 pb-4">
          <button onClick={() => setScreen("amount")}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <X style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
        </div>

        {/* Rejected hero */}
        <motion.div className="flex flex-col items-center mb-8 pt-6"
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
            <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center mt-6">
            <p className="text-white font-semibold" style={{ fontSize: "1.4rem" }}>Depósito não confirmado</p>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8e8e93" }}>
              Não conseguimos confirmar o teu pagamento. Por favor, tenta novamente.
            </p>
          </div>
        </motion.div>

        {/* Reasons */}
        <motion.div className="rounded-2xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-white font-bold text-sm">Possíveis Causas</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {[
              "O pagamento não foi aprovado no telemóvel",
              "Tempo limite de confirmação excedido",
              "Saldo M-Pesa insuficiente",
              "Número de telefone inválido ou inativo",
            ].map((cause, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "#2c2c2e" }}>
                  <span style={{ fontSize: 10, color: "#e74c3c", fontWeight: 700 }}>{i + 1}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#8e8e93" }}>{cause}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-6" style={{ background: "#1c1c1e" }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#f39c12", flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
            Não foste cobrado. Tenta novamente ou contacta o suporte caso o problema persista.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setRawCents(0); setPhone(""); setScreen("amount"); }}
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
