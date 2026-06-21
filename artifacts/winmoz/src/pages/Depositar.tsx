import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, X, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, Phone,
} from "lucide-react";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";
const EMOLA_GREEN = "#34d399";
const MPESA_RED = "#e74c3c";

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

function SuccessIcon() {
  return (
    <motion.div className="relative flex items-center justify-center"
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}>
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

type Provider = "emola" | "mpesa";
type Screen = "amount" | "wallet" | "phone" | "verifying" | "success" | "rejected";

export default function Depositar() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("amount");
  const [amountStr, setAmountStr] = useState("");
  const [provider, setProvider] = useState<Provider>("emola");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState(0);
  const [rejectReason, setRejectReason] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [initError, setInitError] = useState("");
  const [countdown, setCountdown] = useState(120);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const txDate = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  const amountVal = parseFloat(amountStr) || 0;
  const isAmountZero = amountVal <= 0;

  const handleDigit = (d: string) => {
    if (d === ".") {
      if (amountStr.includes(".")) return;
      setAmountStr(prev => (prev === "" ? "0." : prev + "."));
      return;
    }
    setAmountStr(prev => {
      const next = prev === "" || prev === "0" ? d : prev + d;
      if (next.includes(".")) {
        const [, dec] = next.split(".");
        if (dec && dec.length > 2) return prev;
      }
      if (next.replace(".", "").length > 8) return prev;
      return next;
    });
  };
  const handleBackspace = () => setAmountStr(prev => prev.length <= 1 ? "" : prev.slice(0, -1));

  const cleanPhone = phoneInput.replace(/\D/g, "").replace(/^258/, "");
  const isPhoneValid = cleanPhone.length === 9;

  const TIMEOUT_SECS = 120; // 2 minutes

  const startPolling = (pid: string, amt: number) => {
    let count = 0;
    setCountdown(TIMEOUT_SECS);

    const stopAll = (ch: ReturnType<typeof supabase.channel>) => {
      clearInterval(pollRef.current!);
      clearInterval(countdownRef.current!);
      supabase.removeChannel(ch);
    };

    // Supabase Realtime — deteção instantânea quando o webhook atualizar o registo
    const channel = supabase
      .channel(`deposit-${pid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${pid}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status as string | undefined;
          if (newStatus === "approved") {
            stopAll(channel);
            setSuccessAmount(amt);
            setScreen("success");
          } else if (newStatus === "rejected") {
            stopAll(channel);
            try {
              const desc = JSON.parse((payload.new as any)?.description || "{}");
              setRejectReason(desc.failReason || "");
            } catch { setRejectReason(""); }
            setScreen("rejected");
          }
        }
      )
      .subscribe();
    realtimeRef.current = channel;

    // countdown timer — ticks every second
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Polling de backup a cada 2s (caso o Realtime não esteja disponível)
    pollRef.current = setInterval(async () => {
      count++;
      const maxCycles = Math.ceil(TIMEOUT_SECS / 2); // ~60 ciclos a 2s

      try {
        // A cada 3 ciclos (~6s) consulta o check-status da Debito Pay diretamente
        if (count % 3 === 0) {
          try {
            const csRes = await fetch("/api/debito/check-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ txId: pid }),
            });
            if (csRes.ok) {
              const csData = await csRes.json() as { status: string };
              if (csData.status === "approved") {
                stopAll(channel);
                setSuccessAmount(amt);
                setScreen("success");
                return;
              } else if (csData.status === "rejected") {
                stopAll(channel);
                setScreen("rejected");
                return;
              }
            }
          } catch { /* continua para o poll do Supabase */ }
        }

        // Poll direto ao Supabase — apanha estado definido pelo webhook
        const { data } = await supabase
          .from("transactions")
          .select("status, description")
          .eq("id", pid)
          .single();
        const status = (data as any)?.status as string | undefined;
        if (status === "approved") {
          stopAll(channel);
          setSuccessAmount(amt);
          setScreen("success");
          return;
        } else if (status === "rejected") {
          stopAll(channel);
          try {
            const desc = JSON.parse((data as any)?.description || "{}");
            setRejectReason(desc.failReason || "");
          } catch { setRejectReason(""); }
          setScreen("rejected");
          return;
        }

        // Timeout após 2 minutos
        if (count >= maxCycles) {
          stopAll(channel);
          setRejectReason("Tempo de espera esgotado. Não respondeste ao USSD a tempo.");
          setScreen("rejected");
        }
      } catch {
        if (count >= maxCycles) {
          stopAll(channel);
          setRejectReason("Tempo de espera esgotado.");
          setScreen("rejected");
        }
      }
    }, 2000);
  };

  const handleInitiate = async () => {
    if (!isPhoneValid) { setPhoneError("Número inválido — deve ter 9 dígitos"); return; }
    if (!user) { setPhoneError("Sessão inválida"); return; }
    setPhoneError("");
    setInitError("");
    setInitiating(true);

    try {
      const session = await getSessionWithRefresh();
      if (!session) {
        setPhoneError("Sessão expirada. Volta a entrar na tua conta.");
        setLocation("/login");
        setInitiating(false);
        return;
      }

      const res = await fetch("/api/debito/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountVal,
          phone: cleanPhone,
          provider,
          type: "deposit",
          userId: session.user.id,
        }),
      });

      const resData = await res.json() as any;

      if (!res.ok) {
        setInitError(resData?.error || "Erro ao iniciar pagamento. Tenta novamente.");
        setInitiating(false);
        return;
      }

      const pid = resData?.txId as string;
      setPendingId(pid);
      setInitiating(false);
      setScreen("verifying");
      startPolling(pid, amountVal);
    } catch {
      setInitError("Erro de ligação. Verifica a internet e tenta de novo.");
      setInitiating(false);
    }
  };

  /* ── AMOUNT SCREEN ── */
  if (screen === "amount") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-5 pt-12 pb-2">
            <div className="w-10" />
            <p className="font-semibold text-white text-base tracking-tight">Depositar</p>
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <X style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </div>

          <div className="flex flex-col items-center px-5 pt-10 pb-6">
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-2">Montante a depositar</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-white/50 text-xl font-light" style={{ fontFamily: "system-ui" }}>MZN</span>
              <span className="text-white tracking-tight"
                style={{ fontSize: "3.8rem", fontFamily: "system-ui, -apple-system", fontWeight: 200, lineHeight: 1 }}>
                {amountStr || "0"}
                <span className="animate-pulse" style={{ opacity: 0.6 }}>|</span>
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "#636366" }}>Mín: 50 MZN · Máx: 500.000 MZN</p>
          </div>

          <div className="mx-5 mb-3">
            <motion.button
              onClick={() => { if (!isAmountZero) setScreen("wallet"); }}
              disabled={isAmountZero}
              whileTap={!isAmountZero ? { scale: 0.97 } : {}}
              className="w-full h-14 rounded-full flex items-center justify-center font-semibold text-base transition-all"
              style={{
                background: !isAmountZero ? CYAN : "#1c1c1e",
                color: !isAmountZero ? "#000" : "#3a3a3c",
              }}>
              Continuar
            </motion.button>
          </div>

          <div className="flex items-center justify-center gap-2 mx-5 mb-5">
            {[100, 500, 1000, 5000].map(q => (
              <button key={q} onClick={() => setAmountStr(q.toString())}
                className="flex-1 h-10 rounded-full font-medium text-sm transition-all"
                style={{
                  background: "#1c1c1e", color: "#fff",
                  border: amountVal === q ? `1.5px solid ${CYAN}` : "1.5px solid transparent",
                }}>
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 px-5 pb-10">
            {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(key => (
              <motion.button key={key}
                whileTap={{ scale: 0.88, background: "#3a3a3c" }}
                onClick={() => key === "⌫" ? handleBackspace() : handleDigit(key)}
                className="h-16 rounded-2xl flex items-center justify-center transition-colors"
                style={{ background: "#1c1c1e" }}>
                {key === "⌫"
                  ? <span style={{ fontSize: 20, color: "#fff" }}>⌫</span>
                  : <span style={{ fontSize: 26, fontWeight: 400, color: "#fff", fontFamily: "system-ui" }}>{key}</span>
                }
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── WALLET SELECTION SCREEN ── */
  if (screen === "wallet") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={() => setScreen("amount")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Escolher Carteira</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 px-5 pb-10">
            <div className="flex items-center justify-center mb-8">
              <div className="px-5 py-2 rounded-full" style={{ background: "#1c1c1e", border: `1.5px solid ${CYAN}22` }}>
                <span className="text-sm font-medium" style={{ color: "#8e8e93" }}>A depositar: </span>
                <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            <p className="text-xs font-semibold mb-4 uppercase tracking-widest" style={{ color: "#636366" }}>
              Selecciona a tua carteira móvel
            </p>

            {/* e-Mola — ACTIVE */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setProvider("emola"); setScreen("phone"); }}
              className="w-full rounded-2xl p-5 mb-3 flex items-center justify-between"
              style={{
                background: provider === "emola" ? `rgba(52,211,153,0.08)` : "#1c1c1e",
                border: `2px solid ${EMOLA_GREEN}`,
                cursor: "pointer",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(52,211,153,0.15)" }}>
                  <span style={{ fontSize: 22 }}>💳</span>
                </div>
                <div className="text-left">
                  <p className="font-bold" style={{ color: EMOLA_GREEN, fontSize: 16, letterSpacing: "0.5px" }}>e-Mola</p>
                  <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>Pagamento instantâneo via USSD</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: EMOLA_GREEN }}>
                  ACTIVO
                </span>
                <CheckCircle2 style={{ width: 16, height: 16, color: EMOLA_GREEN }} />
              </div>
            </motion.button>

            {/* M-Pesa — COMING SOON */}
            <div
              className="w-full rounded-2xl p-5 mb-8 flex items-center justify-between"
              style={{
                background: "#111",
                border: "2px solid #2c2c2e",
                opacity: 0.5,
                cursor: "not-allowed",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(231,76,60,0.1)" }}>
                  <span style={{ fontSize: 22 }}>📱</span>
                </div>
                <div className="text-left">
                  <p className="font-bold" style={{ color: MPESA_RED, fontSize: 16, letterSpacing: "0.5px" }}>M-Pesa</p>
                  <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Brevemente disponível</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#1c1c1e", color: "#52525b" }}>
                EM BREVE
              </span>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1c1c1e" }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `rgba(0,212,180,0.1)` }}>
                  <span style={{ fontSize: 12 }}>ℹ️</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#71717a" }}>
                  O pagamento é processado directamente pelo gateway seguro <strong style={{ color: "#a1a1aa" }}>Debito Pay</strong>.
                  Receberás um pedido USSD no teu telemóvel para confirmar com o teu PIN e-Mola.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── PHONE SCREEN ── */
  if (screen === "phone") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={() => setScreen("wallet")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Número {provider === "emola" ? "e-Mola" : "M-Pesa"}</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 px-5 pb-10">
            <div className="flex items-center justify-center mb-8">
              <div className="px-5 py-2 rounded-full" style={{ background: "#1c1c1e", border: `1.5px solid ${CYAN}22` }}>
                <span className="text-sm font-medium" style={{ color: "#8e8e93" }}>A depositar: </span>
                <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl p-5 mb-6"
              style={{ background: provider === "emola" ? "rgba(52,211,153,0.06)" : "rgba(231,76,60,0.06)", border: `1.5px solid ${provider === "emola" ? EMOLA_GREEN : MPESA_RED}44` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: provider === "emola" ? "rgba(52,211,153,0.15)" : "rgba(231,76,60,0.15)" }}>
                  <Phone style={{ width: 18, height: 18, color: provider === "emola" ? EMOLA_GREEN : MPESA_RED }} />
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: provider === "emola" ? EMOLA_GREEN : MPESA_RED }}>
                    Número de {provider === "emola" ? "e-Mola" : "M-Pesa"}
                  </p>
                  <p className="text-xs" style={{ color: "#71717a" }}>
                    O número que vai efectuar o pagamento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                style={{ background: "#1c1c1e", border: isPhoneValid ? `1.5px solid ${provider === "emola" ? EMOLA_GREEN : MPESA_RED}` : "1.5px solid #2c2c2e" }}>
                <div className="flex items-center gap-2 flex-shrink-0 border-r pr-3" style={{ borderColor: "#2c2c2e" }}>
                  <span style={{ fontSize: 16 }}>🇲🇿</span>
                  <span className="text-sm font-semibold" style={{ color: "#8e8e93" }}>+258</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneInput}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                    setPhoneInput(v);
                    setPhoneError("");
                    setInitError("");
                  }}
                  placeholder="8X XXX XXXX"
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-base font-semibold"
                  style={{ color: "#fff", caretColor: provider === "emola" ? EMOLA_GREEN : MPESA_RED, letterSpacing: "1px", fontFamily: "system-ui" }}
                />
                {isPhoneValid && (
                  <CheckCircle2 style={{ width: 16, height: 16, color: provider === "emola" ? EMOLA_GREEN : MPESA_RED, flexShrink: 0 }} />
                )}
              </div>

              {phoneError && (
                <p className="text-xs mt-2.5" style={{ color: "#e74c3c" }}>⚠ {phoneError}</p>
              )}
              {initError && (
                <p className="text-xs mt-2.5 leading-relaxed" style={{ color: "#e74c3c" }}>⚠ {initError}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="rounded-2xl p-4 mb-8"
              style={{ background: "#111", border: "1px solid #1c1c1e" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#636366" }}>Como funciona</p>
              {[
                "Introduz o teu número e-Mola e prime «Pagar»",
                "Recebes um pedido USSD no teu telemóvel",
                "Confirma com o teu PIN e-Mola",
                "O saldo é creditado automaticamente",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `rgba(0,212,180,0.1)`, border: `1px solid ${CYAN}33` }}>
                    <span style={{ fontSize: 9, color: CYAN, fontWeight: 700 }}>{i + 1}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#8e8e93" }}>{step}</p>
                </div>
              ))}
            </motion.div>

            <motion.button
              onClick={handleInitiate}
              disabled={!isPhoneValid || initiating}
              whileTap={isPhoneValid && !initiating ? { scale: 0.97 } : {}}
              className="w-full h-14 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: isPhoneValid && !initiating ? CYAN : "#1c1c1e",
                color: isPhoneValid && !initiating ? "#000" : "#3a3a3c",
              }}>
              {initiating
                ? <>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }} className="animate-spin" />
                    A iniciar pagamento…
                  </>
                : "Pagar"
              }
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  /* ── VERIFYING SCREEN ── */
  if (screen === "verifying") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
          <motion.div className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}>
            <div className="relative flex items-center justify-center mb-10" style={{ width: 120, height: 120 }}>
              {[1, 0.7, 0.45].map((scale, i) => (
                <motion.div key={i}
                  animate={{ scale: [scale, scale + 0.18, scale], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: "easeOut" }}
                  style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%",
                    border: `1.5px solid ${CYAN}`, transformOrigin: "center" }} />
              ))}
              <div style={{ width: 72, height: 72, borderRadius: "50%",
                background: `rgba(0,212,180,0.08)`,
                border: `1.5px solid ${CYAN}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `3px solid ${CYAN}33`, borderTopColor: CYAN }} className="animate-spin" />
              </div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 10, textAlign: "center" }}>
              Aguarda o USSD no telemóvel
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
              style={{ fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.65, maxWidth: 280 }}>
              Um pedido USSD foi enviado para o teu número{" "}
              <strong style={{ color: "#a1a1aa" }}>+258 {cleanPhone}</strong>.
              Introduz o teu <strong style={{ color: "#a1a1aa" }}>PIN {provider === "emola" ? "e-Mola" : "M-Pesa"}</strong> para confirmar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="mt-8 flex flex-col items-center gap-3">
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                background: `rgba(0,212,180,0.08)`, borderRadius: 99, border: `1px solid ${CYAN}33` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN }} className="animate-pulse" />
                <span style={{ fontSize: 11, color: CYAN, fontWeight: 600, letterSpacing: "0.5px" }}>
                  A AGUARDAR CONFIRMAÇÃO DO PIN…
                </span>
              </div>
              {/* Countdown timer */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: countdown <= 30 ? "#f59e0b" : "#52525b" }}>
                  Expira em
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                  color: countdown <= 30 ? "#f59e0b" : "#8e8e93",
                  minWidth: 36, textAlign: "center",
                }}>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#52525b", textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>
                Se não recebeste o USSD, verifica a cobertura de rede ou volta atrás e tenta de novo.
              </p>
            </motion.div>
          </motion.div>
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

          <motion.div className="flex flex-col items-center mb-8 pt-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <SuccessIcon />
            <motion.div className="text-center mt-6"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}>
              <p className="text-white font-semibold" style={{ fontSize: "1.55rem", lineHeight: 1.2 }}>
                Depósito Confirmado!
              </p>
              <p className="text-base font-bold mt-1" style={{ color: CYAN }}>
                +{fmtMZN(successAmount || amountVal)} MZN
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8e8e93" }}>
                O teu saldo foi creditado com sucesso na carteira WinMoz.
              </p>
            </motion.div>
          </motion.div>

          <motion.div className="rounded-2xl overflow-hidden mb-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            style={{ background: "#1c1c1e" }}>
            <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
              <p className="text-white font-bold text-sm">Detalhes da Transacção</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {([
                { label: "Data",     val: txDate },
                { label: "Origem",   val: provider === "emola" ? "e-Mola" : "M-Pesa" },
                { label: "Destino",  val: "Carteira WinMoz" },
                { label: "Montante", val: `${fmtMZN(successAmount || amountVal)} MZN` },
                { label: "Taxa",     val: "Grátis", green: true },
                { label: "Estado",   val: "Confirmado ✓", highlight: true },
              ] as any[]).map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium"
                    style={{ color: row.highlight ? CYAN : row.green ? "#22c55e" : "#fff" }}>
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
          <button onClick={() => { setPendingId(null); setInitError(""); setScreen("phone"); }}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <X style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
        </div>

        <motion.div className="flex flex-col items-center mb-8 pt-4"
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
            <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center mt-6">
            <p className="text-white font-semibold" style={{ fontSize: "1.4rem" }}>Pagamento Falhado</p>
            {rejectReason ? (
              <p className="text-sm mt-2 leading-relaxed font-medium" style={{ color: "#f59e0b" }}>
                {rejectReason}
              </p>
            ) : (
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8e8e93" }}>
                O pagamento não foi concluído. Verifica o PIN, saldo ou cobertura de rede.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div className="rounded-2xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-white font-bold text-sm">Possíveis Causas</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {[
              "PIN e-Mola incorrecto ou cancelaste o pedido USSD",
              "Saldo insuficiente na carteira e-Mola",
              "Tempo de resposta ao USSD esgotado",
              "Número de telefone não corresponde à carteira e-Mola",
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
            Se o dinheiro foi debitado mas o depósito não foi creditado, contacta o suporte. O teu dinheiro está seguro.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setPendingId(null); setInitError(""); setScreen("phone"); }}
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
