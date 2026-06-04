import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, Delete, CheckCircle2, XCircle,
  AlertTriangle, Smartphone, Pencil, Info, Clock, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";
const METHOD_NAME = "M-Pesa";
const WITHDRAWAL_FEE = 5;
const MIN_WITHDRAW = 50;

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "confirm" | "waiting" | "success" | "rejected";

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SwipeToConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef}
      className="relative rounded-full overflow-hidden flex items-center"
      style={{ height: 64, background: "#1c1c1e" }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-white/40 text-sm font-medium tracking-wide select-none">Deslizar para confirmar</p>
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
          if (info.offset.x > cw * 0.65) onConfirm();
          else x.set(0);
        }}
        onClick={() => !disabled && onConfirm()}
        className="flex items-center justify-center cursor-grab active:cursor-grabbing z-10 flex-shrink-0 shadow-lg"
        whileTap={{ scale: 0.92 }}>
        <ChevronRightIcon className="w-7 h-7 text-black" />
      </motion.div>
    </div>
  );
}

export default function Levantar() {
  const [, setLocation] = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const balance = parseFloat(String(profile?.balance ?? "0")) || 0;
  const userPhone = profile?.phone
    ? `+258 ${profile.phone.slice(0, 3)} ${profile.phone.slice(3, 6)} ${profile.phone.slice(6)}`
    : "";

  const [screen, setScreen] = useState<Screen>("amount");
  const [rawCents, setRawCents] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [txDate] = useState(() => new Date().toLocaleString("pt-PT"));

  const amountVal = rawCents / 100;
  const totalDeducted = amountVal + WITHDRAWAL_FEE;
  const phoneDisplay = userPhone || "+258 8XX XXX XXX";
  const canProceed = amountVal >= MIN_WITHDRAW && totalDeducted <= balance;

  const handleDigit = (d: string) => {
    setRawCents(prev => {
      const next = parseInt(`${prev}${d}`) || 0;
      return next > 99999999 ? prev : next;
    });
  };
  const handleDelete = () => setRawCents(prev => Math.floor(prev / 10));
  const handleSetPercent = (pct: number) => {
    const effectiveBal = Math.max(0, balance - WITHDRAWAL_FEE);
    setRawCents(Math.min(Math.floor(effectiveBal * pct * 100), 99999999));
  };

  const handleConfirm = async () => {
    if (!user || !canProceed) return;
    setProcessing(true);

    try {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();

      const currentBalance = Number(currentProfile?.balance ?? 0);
      if (totalDeducted > currentBalance) {
        setProcessing(false);
        setScreen("rejected");
        setRejectionReason("Saldo insuficiente para cobrir o valor + taxa.");
        return;
      }

      const newBalance = currentBalance - totalDeducted;
      await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

      const netAmount = amountVal;
      const { data: wd, error } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        user_name: profile?.full_name ?? profile?.email ?? "Usuário",
        amount: amountVal,
        fee: WITHDRAWAL_FEE,
        net_amount: netAmount,
        phone: profile?.phone,
        method: METHOD_NAME,
        status: "pending",
      }).select("id").single();

      if (error) {
        await supabase.from("profiles").update({ balance: currentBalance }).eq("id", user.id);
        throw error;
      }

      setWithdrawalId(wd.id);
      await refreshProfile();
      setProcessing(false);
      setScreen("waiting");
    } catch (e) {
      console.error(e);
      setProcessing(false);
      setRejectionReason("Erro ao processar. Tenta novamente.");
      setScreen("rejected");
    }
  };

  useEffect(() => {
    if (screen !== "waiting" || !withdrawalId) return;

    const channel = supabase
      .channel(`withdrawal_${withdrawalId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawals", filter: `id=eq.${withdrawalId}` },
        async (payload) => {
          const updated = payload.new as { status: string; rejection_reason?: string };
          if (updated.status === "approved") {
            await refreshProfile();
            setScreen("success");
          } else if (updated.status === "rejected") {
            await refreshProfile();
            setRejectionReason(updated.rejection_reason ?? "Pedido não aprovado.");
            setScreen("rejected");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [screen, withdrawalId]);

  if (screen === "amount") return (
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
            <span className="text-white/40 text-xl mb-3">MT</span>
          </div>
          {amountVal > 0 && (
            <p className="text-white/30 text-xs mb-1">
              Taxa: <span style={{ color: "#f59e0b" }}>{fmtMZN(WITHDRAWAL_FEE)} MT</span>
              {" · "}Total debitado: <span style={{ color: CYAN }}>{fmtMZN(totalDeducted)} MT</span>
            </p>
          )}
          <p className="text-white/30 text-xs mb-5">
            Saldo disponível: <span style={{ color: CYAN }}>{fmtMZN(balance)} MT</span>
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
              <p className="text-xs" style={{ color: "#f59e0b" }}>Mínimo: {fmtMZN(MIN_WITHDRAW)} MT</p>
            </div>
          )}
          {amountVal > 0 && totalDeducted > balance && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: "#1c1c1e" }}>
              <Info style={{ width: 14, height: 14, color: "#ef4444" }} />
              <p className="text-xs" style={{ color: "#ef4444" }}>
                Saldo insuficiente — precisas de {fmtMZN(totalDeducted)} MT (incl. taxa de {fmtMZN(WITHDRAWAL_FEE)} MT)
              </p>
            </div>
          )}
          <button onClick={() => canProceed && setScreen("confirm")} disabled={!canProceed}
            className="w-full h-14 rounded-full font-syne font-bold text-base transition-all mb-8"
            style={{ background: canProceed ? CYAN : "#1c1c1e", color: canProceed ? "#000" : "#3a3a3c", cursor: canProceed ? "pointer" : "default" }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );

  if (screen === "confirm") return (
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
          <p className="text-white font-light text-center" style={{ fontSize: "3rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
            {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MT</span>
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
              { label: "Valor solicitado", val: `${fmtMZN(amountVal)} MT` },
              { label: "Taxa de processamento", val: `${fmtMZN(WITHDRAWAL_FEE)} MT`, warn: true },
              { label: "Método", val: METHOD_NAME },
              { label: "Estado", val: "Aguardar aprovação" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                <span className="text-sm font-medium" style={{ color: (row as any).warn ? "#f59e0b" : "#fff" }}>{row.val}</span>
              </div>
            ))}
            <div className="border-t" style={{ borderColor: "#3a3a3c" }} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total debitado</span>
              <span className="text-sm font-bold" style={{ color: "#ef4444" }}>{fmtMZN(totalDeducted)} MT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Recebes</span>
              <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MT</span>
            </div>
          </div>
        </div>
        {processing ? (
          <div className="h-16 rounded-full flex items-center justify-center gap-3" style={{ background: CYAN }}>
            <div className="w-5 h-5 rounded-full border-2 border-black/25 border-t-black animate-spin" />
            <span className="text-black font-semibold text-base">A processar…</span>
          </div>
        ) : (
          <SwipeToConfirm onConfirm={handleConfirm} />
        )}
      </div>
    </div>
  );

  if (screen === "waiting") return (
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
            <Clock className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-2">Pedido Enviado</p>
          <p className="text-white font-light text-center" style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
            {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MT</span>
          </p>
        </motion.div>

        <motion.div className="rounded-2xl overflow-hidden mb-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }} style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-white font-bold text-sm">Detalhes</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3.5">
            {[
              { label: "Data",     val: txDate },
              { label: "Carteira", val: `${METHOD_NAME} · ${phoneDisplay}` },
              { label: "Valor",    val: `${fmtMZN(amountVal)} MT` },
              { label: "Taxa",     val: `${fmtMZN(WITHDRAWAL_FEE)} MT` },
              { label: "Estado",   val: "Aguardar verificação", highlight: true },
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

        <div className="flex items-start gap-3 p-4 rounded-2xl mb-6" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Loader2 style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} className="animate-spin" />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#f59e0b" }}>A aguardar aprovação</p>
            <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
              O teu pedido foi enviado e está em análise. Receberás uma resposta em <strong style={{ color: "#fff" }}>menos de 5 minutos</strong>. Esta página actualiza automaticamente.
            </p>
          </div>
        </div>

        <button onClick={() => setLocation("/perfil")}
          className="w-full h-14 rounded-full font-semibold text-sm"
          style={{ background: "#1c1c1e", color: "#8e8e93" }}>
          Voltar ao Perfil (aguardar em segundo plano)
        </button>
      </div>
    </div>
  );

  if (screen === "success") return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <div className="w-10" />
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
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-1">Aprovado!</p>
          <p className="text-white font-light text-center" style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
            {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MT</span>
          </p>
          <p className="text-white/40 text-sm mt-2">enviado para {phoneDisplay}</p>
        </motion.div>
        <motion.div className="rounded-2xl p-5 mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: "rgba(0,212,180,0.08)", border: "1px solid rgba(0,212,180,0.2)" }}>
          <p className="text-sm" style={{ color: "#8e8e93" }}>
            O teu levantamento foi processado com sucesso. O dinheiro foi enviado para o teu M-Pesa.
          </p>
        </motion.div>
        <button onClick={() => setLocation("/perfil")}
          className="w-full h-14 rounded-full font-semibold text-base text-black"
          style={{ background: CYAN }}>
          Voltar ao Perfil
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <button onClick={() => { setRawCents(0); setScreen("amount"); }}
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
          <p className="text-white font-light text-center" style={{ fontSize: "2.8rem", fontFamily: "system-ui", lineHeight: 1.1 }}>
            {fmtMZN(amountVal)}<span className="text-2xl text-white/40 ml-1">MT</span>
          </p>
        </motion.div>
        <div className="rounded-2xl p-4 mb-6" style={{ background: "#1c1c1e" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle style={{ width: 16, height: 16, color: "#f39c12", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "#f39c12" }}>Motivo da recusa</p>
              <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>
                {rejectionReason || "Pedido não aprovado pela equipa. Contacta o suporte para mais informações."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setRawCents(0); setScreen("amount"); }}
            className="w-full h-14 rounded-full font-semibold text-base text-black"
            style={{ background: CYAN }}>
            Tentar Novamente
          </button>
          <button onClick={() => setLocation("/suporte")}
            className="w-full h-14 rounded-full font-medium text-sm"
            style={{ background: "#1c1c1e", color: "#8e8e93" }}>
            Contactar Suporte
          </button>
        </div>
      </div>
    </div>
  );
}
