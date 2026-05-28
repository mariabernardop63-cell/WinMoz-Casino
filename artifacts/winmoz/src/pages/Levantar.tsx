import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, ChevronUp, ChevronDown, Delete,
  CheckCircle2, XCircle, AlertTriangle, Smartphone, Pencil, Info,
  ArrowRight, RotateCcw, RefreshCw
} from "lucide-react";

const USER_PHONE = "+258 845 678 893";
const USER_PHONE_MASKED = "+258 845 *** 893";
const METHOD_NAME = "M-Pesa";
const CYAN = "#00D4B4";

function getBalance(): number {
  return parseFloat(localStorage.getItem("winmoz_balance") || "0");
}
function setBalance(v: number) {
  localStorage.setItem("winmoz_balance", v.toFixed(2));
}
function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "confirm" | "success" | "rejected";

/* ── Swipe to Confirm button ── */
function SwipeToConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div ref={containerRef}
      className="relative rounded-full overflow-hidden flex items-center"
      style={{ height: 64, background: "#1c1c1e", margin: "0 0" }}>

      {/* Track fill */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-white/40 text-sm font-medium tracking-wide select-none">
          Deslizar para confirmar
        </p>
        <span className="absolute right-5 text-white/30 font-bold select-none">»</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x, marginLeft: 6, width: 52, height: 52, background: CYAN, borderRadius: "50%" }}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_, info) => {
          setDragging(false);
          const cw = containerRef.current?.offsetWidth ?? 340;
          if (info.offset.x > cw * 0.65) {
            onConfirm();
          } else {
            x.set(0);
          }
        }}
        onClick={() => !disabled && onConfirm()}
        className="flex items-center justify-center cursor-grab active:cursor-grabbing z-10 flex-shrink-0 shadow-lg"
        whileTap={{ scale: 0.92 }}
      >
        <ChevronRight className="w-7 h-7 text-black" />
      </motion.div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ── Spinner ── */
function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
  );
}

export default function Levantar() {
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("amount");

  /* amount state — raw cents */
  const [rawCents, setRawCents] = useState(0);
  const balance = getBalance();
  const amountVal = rawCents / 100;
  const isZero = rawCents === 0;

  /* processing states */
  const [processingContinue, setProcessingContinue] = useState(false);
  const [processingConfirm, setProcessingConfirm] = useState(false);

  /* edit phone */
  const [editingPhone, setEditingPhone] = useState(false);
  const [customPhone, setCustomPhone] = useState("");

  /* transaction id */
  const [txId] = useState(() => "WM" + Math.random().toString(36).slice(2, 10).toUpperCase());
  const txDate = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

  const displayAmount = (() => {
    const str = rawCents.toString().padStart(3, "0");
    const intPart = str.slice(0, -2) || "0";
    const decPart = str.slice(-2);
    const intFormatted = Number(intPart).toLocaleString("pt-PT");
    return `${intFormatted},${decPart}`;
  })();

  const handleDigit = (d: string) => {
    if (d === ".") return;
    const newCents = parseInt((rawCents.toString() + d).slice(-8), 10);
    setRawCents(newCents || 0);
  };
  const handleBackspace = () => {
    setRawCents(Math.floor(rawCents / 10));
  };
  const handleQuick = (val: number) => {
    setRawCents(Math.round(val * 100));
  };

  const handleContinue = () => {
    if (isZero || processingContinue) return;
    setProcessingContinue(true);
    setTimeout(() => {
      setProcessingContinue(false);
      setScreen("confirm");
    }, 1800);
  };

  const handleConfirm = () => {
    if (processingConfirm) return;
    setProcessingConfirm(true);
    setTimeout(() => {
      setProcessingConfirm(false);
      if (amountVal <= balance) {
        setBalance(balance - amountVal);
        setScreen("success");
      } else {
        setScreen("rejected");
      }
    }, 2000);
  };

  const phoneDisplay = customPhone || USER_PHONE_MASKED;

  /* ── AMOUNT SCREEN ── */
  if (screen === "amount") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-12 pb-2">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Levantamento</p>
            <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <Bell className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Amount display */}
          <div className="flex flex-col items-center px-5 pt-8 pb-5">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-white/50 text-xl font-light" style={{ fontFamily: "system-ui" }}>MZN</span>
              <span
                className="text-white tracking-tight"
                style={{ fontSize: "3.8rem", fontFamily: "system-ui, -apple-system", fontWeight: 200, lineHeight: 1 }}
              >
                {displayAmount}
                <span className="animate-pulse" style={{ opacity: 0.7 }}>|</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm" style={{ color: "#636366" }}>
                Disponível para levantamento:{" "}
                <span className="font-semibold" style={{ color: "#8e8e93" }}>
                  {fmtMZN(balance)} MZN
                </span>
              </span>
              <Info style={{ width: 14, height: 14, color: "#636366" }} />
            </div>
          </div>

          {/* Method card */}
          <div className="mx-5 mb-5 rounded-2xl flex items-center gap-3 px-4 py-3.5" style={{ background: "#1c1c1e" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2c2c2e" }}>
              <Smartphone style={{ width: 18, height: 18, color: CYAN }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{METHOD_NAME}</p>
              {editingPhone ? (
                <input
                  type="tel" autoFocus
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  onBlur={() => setEditingPhone(false)}
                  placeholder={USER_PHONE}
                  className="bg-transparent text-xs outline-none w-full"
                  style={{ color: "#8e8e93" }}
                />
              ) : (
                <p className="text-xs truncate" style={{ color: "#8e8e93" }}>{phoneDisplay}</p>
              )}
            </div>
            <button onClick={() => setEditingPhone(true)} className="mr-2 p-1">
              <Pencil style={{ width: 14, height: 14, color: "#636366" }} />
            </button>
            <div className="flex flex-col items-center gap-0" style={{ color: "#636366" }}>
              <ChevronUp style={{ width: 14, height: 14 }} />
              <ChevronDown style={{ width: 14, height: 14 }} />
            </div>
          </div>

          {/* Continue button */}
          <div className="mx-5 mb-4">
            <motion.button
              onClick={handleContinue}
              disabled={isZero || processingContinue}
              whileTap={!isZero && !processingContinue ? { scale: 0.97 } : {}}
              className="w-full h-14 rounded-full flex items-center justify-center font-semibold text-base transition-opacity"
              style={{
                background: isZero || processingContinue ? "#333" : CYAN,
                color: isZero || processingContinue ? "#666" : "#000",
              }}
            >
              {processingContinue ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                  <span className="text-black font-semibold">A processar…</span>
                </div>
              ) : "Continuar"}
            </motion.button>
          </div>

          {/* Quick amounts */}
          <div className="flex items-center justify-center gap-2 mx-5 mb-6">
            {[50, 100, 500].map(q => (
              <button key={q} onClick={() => handleQuick(q)}
                className="flex-1 h-10 rounded-full font-medium text-sm transition-all"
                style={{ background: "#1c1c1e", color: "#fff", border: rawCents === q * 100 ? `1.5px solid ${CYAN}` : "1.5px solid transparent" }}>
                {q} MZN
              </button>
            ))}
            <button onClick={() => handleQuick(balance)}
              className="flex-1 h-10 rounded-full font-medium text-sm"
              style={{ background: "#1c1c1e", color: "#fff", border: rawCents === Math.round(balance * 100) && balance > 0 ? `1.5px solid ${CYAN}` : "1.5px solid transparent" }}>
              Máx
            </button>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-10">
            {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(key => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.88, background: "#3a3a3c" }}
                onClick={() => key === "⌫" ? handleBackspace() : handleDigit(key)}
                className="h-16 rounded-2xl flex items-center justify-center transition-colors"
                style={{ background: key === "⌫" ? "#1c1c1e" : "#1c1c1e" }}
              >
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

  /* ── CONFIRMATION SCREEN ── */
  if (screen === "confirm") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-12 pb-6">
            <button onClick={() => setScreen("amount")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Confirmação</p>
            <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <Bell style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </div>

          <div className="flex-1 px-5 flex flex-col">
            {/* Method card */}
            <div className="rounded-2xl flex items-center gap-3 px-4 py-3.5 mb-5" style={{ background: "#1c1c1e" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#2c2c2e" }}>
                <Smartphone style={{ width: 18, height: 18, color: CYAN }} />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{METHOD_NAME}</p>
                <p className="text-xs" style={{ color: "#8e8e93" }}>{phoneDisplay}</p>
              </div>
              <div className="flex flex-col items-center" style={{ color: "#636366" }}>
                <ChevronUp style={{ width: 14, height: 14 }} />
                <ChevronDown style={{ width: 14, height: 14 }} />
              </div>
            </div>

            {/* Details card */}
            <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "#1c1c1e" }}>
              <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
                <p className="text-white font-bold text-base">Detalhes do Levantamento</p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3.5">
                {[
                  { label: "De",                 val: "Saldo Disponível" },
                  { label: "Método",             val: METHOD_NAME },
                  { label: "Chegada Estimada",   val: "Imediato" },
                  { label: "Valor",              val: `${fmtMZN(amountVal)} MZN` },
                  { label: "Taxa",               val: "0,00 MZN" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                    <span className="text-sm font-medium text-white">{row.val}</span>
                  </div>
                ))}

                {/* Divider */}
                <div className="border-t" style={{ borderColor: "#3a3a3c" }} />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
                </div>
              </div>
            </div>

            {/* Processing state */}
            {processingConfirm ? (
              <div className="h-16 rounded-full flex items-center justify-center gap-3" style={{ background: CYAN }}>
                <div className="w-5 h-5 rounded-full border-2 border-black/25 border-t-black animate-spin" />
                <span className="text-black font-semibold text-base">A confirmar…</span>
              </div>
            ) : (
              <SwipeToConfirm onConfirm={handleConfirm} />
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

          {/* Header */}
          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base">Levantamento</p>
            <div className="w-10" />
          </div>

          {/* Success icon */}
          <motion.div className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl"
              style={{ background: "linear-gradient(135deg, #00b09b, #00D4B4)" }}>
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-1">Aprovado</p>
            <p className="text-white font-light text-center"
              style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
              {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MZN</span>
            </p>
          </motion.div>

          {/* Details card */}
          <motion.div className="rounded-2xl overflow-hidden mb-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-sm">Detalhes da Transação</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID da Transação", val: txId },
                { label: "Data",            val: txDate },
                { label: "Carteira",        val: `${METHOD_NAME} · ${phoneDisplay}` },
                { label: "Valor",           val: `${fmtMZN(amountVal)} MZN` },
                { label: "Taxa",            val: "0,00 MZN" },
                { label: "Estado",          val: "Aprovado ✓", highlight: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: (row as any).highlight ? CYAN : "#fff", maxWidth: 200, textAlign: "right" }}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex flex-col gap-3 mt-2">
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 rounded-full font-semibold text-base text-black"
              style={{ background: CYAN }}>
              Voltar ao Perfil
            </button>
            <button onClick={() => { setRawCents(0); setScreen("amount"); }}
              className="w-full h-14 rounded-full font-medium text-sm"
              style={{ background: "#1c1c1e", color: "#8e8e93" }}>
              Novo Levantamento
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── REJECTED SCREEN ── */
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-12 pb-8">
          <button onClick={() => setScreen("amount")}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <p className="font-semibold text-white text-base">Levantamento</p>
          <div className="w-10" />
        </div>

        {/* Error icon */}
        <motion.div className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
            <XCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-1">Recusado</p>
          <p className="text-white font-light text-center"
            style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
            {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MZN</span>
          </p>
        </motion.div>

        {/* Reason card */}
        <motion.div className="rounded-2xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-white font-bold text-sm">Motivo da Recusa</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3.5">
            {[
              { label: "Causa",           val: "Saldo Insuficiente" },
              { label: "Saldo Actual",    val: `${fmtMZN(balance)} MZN` },
              { label: "Valor Solicitado",val: `${fmtMZN(amountVal)} MZN` },
              { label: "Diferença",       val: `${fmtMZN(amountVal - balance)} MZN`, err: true },
              { label: "Estado",          val: "Recusado ✗", err: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                <span className="text-sm font-medium" style={{ color: (row as any).err ? "#e74c3c" : "#fff" }}>{row.val}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Notice */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-6" style={{ background: "#1c1c1e" }}>
          <AlertTriangle style={{ width: 16, height: 16, color: "#f39c12", flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
            O valor solicitado excede o teu saldo disponível. Recarrega a tua conta ou ajusta o valor a levantar.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setRawCents(0); setScreen("amount"); }}
            className="w-full h-14 rounded-full font-semibold text-base flex items-center justify-center gap-2 text-black"
            style={{ background: CYAN }}>
            <RotateCcw style={{ width: 18, height: 18 }} />
            Tentar Novamente
          </button>
          <button onClick={() => setLocation("/recarga")}
            className="w-full h-14 rounded-full font-medium text-sm"
            style={{ background: "#1c1c1e", color: "#8e8e93" }}>
            Recarregar Saldo
          </button>
        </div>
      </div>
    </div>
  );
}
