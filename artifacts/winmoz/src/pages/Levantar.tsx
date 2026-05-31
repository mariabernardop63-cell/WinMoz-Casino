import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, ChevronUp, ChevronDown, Delete,
  CheckCircle2, XCircle, AlertTriangle, Smartphone, Pencil, Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";
const METHOD_NAME = "M-Pesa";

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "confirm" | "success" | "pending" | "rejected";

function SwipeToConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef}
      className="relative rounded-full overflow-hidden flex items-center"
      style={{ height: 64, background: "#1c1c1e", margin: "0 0" }}>
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
        onDragEnd={(_, info) => {
          const cw = containerRef.current?.offsetWidth ?? 340;
          if (info.offset.x > cw * 0.65) { onConfirm(); }
          else { x.set(0); }
        }}
        onClick={() => !disabled && onConfirm()}
        className="flex items-center justify-center cursor-grab active:cursor-grabbing z-10 flex-shrink-0 shadow-lg"
        whileTap={{ scale: 0.92 }}>
        <ChevronRightIcon className="w-7 h-7 text-black" />
      </motion.div>
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function Levantar() {
  const [, setLocation] = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const balance = parseFloat(String(profile?.balance ?? "0")) || 0;
  const userPhone = profile?.phone ? `+258 ${profile.phone.slice(0, 3)} ${profile.phone.slice(3, 6)} ${profile.phone.slice(6)}` : "";

  const [screen, setScreen] = useState<Screen>("amount");
  const [rawCents, setRawCents] = useState(0);
  const [processingConfirm, setProcessingConfirm] = useState(false);
  const [txId] = useState(() => "TX" + Date.now().toString(36).toUpperCase());
  const [txDate] = useState(() => new Date().toLocaleString("pt-PT"));

  const amountVal = rawCents / 100;
  const phoneDisplay = userPhone || "+258 8XX XXX XXX";

  const MIN_WITHDRAW = 50;
  const MAX_WITHDRAW = balance;

  const handleDigit = (d: string) => {
    if (rawCents >= 999999) return;
    setRawCents(prev => {
      const next = parseInt(`${prev}${d}`) || 0;
      return next > 99999999 ? prev : next;
    });
  };

  const handleDelete = () => setRawCents(prev => Math.floor(prev / 10));

  const handleSetPercent = (pct: number) => {
    const val = Math.floor(balance * pct * 100);
    setRawCents(Math.min(val, 99999999));
  };

  const canProceed = amountVal >= MIN_WITHDRAW && amountVal <= MAX_WITHDRAW;

  const handleConfirm = async () => {
    setProcessingConfirm(true);

    if (amountVal > balance) {
      setProcessingConfirm(false);
      setScreen("rejected");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setProcessingConfirm(false);
        setScreen("rejected");
        return;
      }

      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountVal, phone: profile?.phone }),
      });

      if (!res.ok) {
        setProcessingConfirm(false);
        setScreen("rejected");
        return;
      }

      await refreshProfile();
      setProcessingConfirm(false);
      setScreen("pending");
    } catch {
      setProcessingConfirm(false);
      setScreen("rejected");
    }
  };

  if (screen === "amount") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">

          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base">Levantamento</p>
            <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <Bell className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center justify-between px-5 py-3 rounded-2xl mx-5 mb-4" style={{ background: "#1c1c1e" }}>
            <div className="flex items-center gap-2">
              <Smartphone style={{ width: 16, height: 16, color: CYAN }} />
              <span className="text-white text-sm font-medium">{METHOD_NAME}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">{phoneDisplay}</span>
              <Pencil style={{ width: 13, height: 13, color: CYAN }} />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-5 py-6">
            <p className="text-white/40 text-xs mb-3 uppercase tracking-widest">Valor a Levantar</p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-white font-light" style={{ fontSize: "4rem", lineHeight: 1, fontFamily: "system-ui" }}>
                {fmtMZN(amountVal)}
              </span>
              <span className="text-white/40 text-xl mb-3">MZN</span>
            </div>
            <p className="text-white/30 text-xs mb-5">
              Saldo disponível: <span style={{ color: CYAN }}>{fmtMZN(balance)} MZN</span>
            </p>

            <div className="flex gap-2 mb-6">
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <button key={pct} onClick={() => handleSetPercent(pct)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{ background: "#1c1c1e", color: CYAN, border: `1px solid ${CYAN}40` }}>
                  {pct * 100}%
                </button>
              ))}
            </div>
          </div>

          <div className="px-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(d => (
                <button key={d}
                  onClick={() => d === "⌫" ? handleDelete() : d !== "." ? handleDigit(d) : undefined}
                  className="h-14 rounded-2xl font-syne font-bold text-xl text-white flex items-center justify-center transition-all active:scale-95"
                  style={{ background: d === "⌫" ? "#1c1c1e" : "#111" }}>
                  {d === "⌫" ? <Delete style={{ width: 20, height: 20 }} /> : d}
                </button>
              ))}
            </div>

            {amountVal > 0 && amountVal < MIN_WITHDRAW && (
              <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: "#1c1c1e" }}>
                <Info style={{ width: 14, height: 14, color: "#f59e0b" }} />
                <p className="text-xs" style={{ color: "#f59e0b" }}>Valor mínimo de levantamento: {fmtMZN(MIN_WITHDRAW)} MZN</p>
              </div>
            )}
            {amountVal > MAX_WITHDRAW && (
              <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: "#1c1c1e" }}>
                <Info style={{ width: 14, height: 14, color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#ef4444" }}>Saldo insuficiente</p>
              </div>
            )}

            <button onClick={() => canProceed && setScreen("confirm")} disabled={!canProceed}
              className="w-full h-14 rounded-full font-syne font-bold text-base transition-all mb-8"
              style={{
                background: canProceed ? CYAN : "#1c1c1e",
                color: canProceed ? "#000" : "#3a3a3c",
                cursor: canProceed ? "pointer" : "default",
              }}>
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "confirm") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">

          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setScreen("amount")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base">Confirmar</p>
            <div className="w-10" />
          </div>

          <div className="flex flex-col items-center mb-8">
            <p className="text-white/40 text-sm font-medium uppercase tracking-widest mb-1">Levantamento</p>
            <p className="text-white font-light text-center"
              style={{ fontSize: "3rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
              {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MZN</span>
            </p>
            <div className="flex items-center gap-2 mt-3 px-4 py-2 rounded-full" style={{ background: "#1c1c1e" }}>
              <Smartphone style={{ width: 14, height: 14, color: CYAN }} />
              <span className="text-white/70 text-sm">{METHOD_NAME} · {phoneDisplay}</span>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-base">Detalhes do Levantamento</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "De",               val: "Saldo Disponível" },
                { label: "Método",           val: METHOD_NAME },
                { label: "Estado Estimado",  val: "Pendente (análise manual)" },
                { label: "Valor",            val: `${fmtMZN(amountVal)} MZN` },
                { label: "Taxa",             val: "0,00 MZN" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium text-white">{row.val}</span>
                </div>
              ))}
              <div className="border-t" style={{ borderColor: "#3a3a3c" }} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>
          </div>

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
    );
  }

  if (screen === "pending") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base">Levantamento</p>
            <div className="w-10" />
          </div>

          <motion.div className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-1">Pedido Submetido</p>
            <p className="text-white font-light text-center"
              style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
              {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MZN</span>
            </p>
          </motion.div>

          <motion.div className="rounded-2xl overflow-hidden mb-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-sm">Detalhes</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID",       val: txId },
                { label: "Data",     val: txDate },
                { label: "Carteira", val: `${METHOD_NAME} · ${phoneDisplay}` },
                { label: "Valor",    val: `${fmtMZN(amountVal)} MZN` },
                { label: "Estado",   val: "Pendente (análise manual)", highlight: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: (row as any).highlight ? "#f59e0b" : "#fff", maxWidth: 200, textAlign: "right" }}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-start gap-2 p-3 rounded-xl mb-6" style={{ background: "#1c1c1e" }}>
            <Info style={{ width: 14, height: 14, color: "#f59e0b", marginTop: 2, flexShrink: 0 }} />
            <p className="text-xs" style={{ color: "#8e8e93", lineHeight: 1.5 }}>
              O teu pedido foi recebido e está em análise. O pagamento será processado manualmente pela nossa equipa.
            </p>
          </div>

          <div className="flex flex-col gap-3">
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

  if (screen === "success") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base">Levantamento</p>
            <div className="w-10" />
          </div>
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
          <div className="flex flex-col gap-3">
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 rounded-full font-semibold text-base text-black"
              style={{ background: CYAN }}>
              Voltar ao Perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <button onClick={() => setScreen("amount")}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <p className="font-semibold text-white text-base">Levantamento</p>
          <div className="w-10" />
        </div>
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
        <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-6" style={{ background: "#1c1c1e" }}>
          <AlertTriangle style={{ width: 16, height: 16, color: "#f39c12", flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
            Saldo insuficiente ou erro ao processar. Recarrega a conta ou tenta novamente.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setRawCents(0); setScreen("amount"); }}
            className="w-full h-14 rounded-full font-semibold text-base text-black"
            style={{ background: CYAN }}>
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
