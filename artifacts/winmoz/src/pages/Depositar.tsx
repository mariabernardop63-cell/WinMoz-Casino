import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, X, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, Phone, Loader2, AlertCircle,
} from "lucide-react";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";
const EMOLA_GREEN = "#16a34a";
const MPESA_RED = "#dc2626";

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
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
  const [countdown, setCountdown] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const txDate = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  const amountVal = parseFloat(amountStr) || 0;
  const isAmountZero = amountVal <= 0;

  /* Disponibilidade das carteiras — controlada pelo admin (platform_settings) */
  const [walletsAvailable, setWalletsAvailable] = useState({ mpesa: true, emola: true });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [mp, em] = await Promise.all([
          fetch("/api/admin/settings?key=mpesa_wallet_enabled").then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/admin/settings?key=emola_wallet_enabled").then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (cancelled) return;
        setWalletsAvailable({
          mpesa: (mp as { setting?: { value?: string } | null })?.setting?.value !== "false",
          emola: (em as { setting?: { value?: string } | null })?.setting?.value !== "false",
        });
      } catch { /* em caso de falha, assume activas */ }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

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

  const TIMEOUT_SECS = 300;

  /* Countdown central: conta sempre que o ecrã "verifying" está visível.
     Antes, o interval só arrancava em startPolling — com M-Pesa o ecrã
     aparecia aos 10s com "2:00" fixo e nunca decrementava. */
  useEffect(() => {
    if (screen !== "verifying") return;
    const iv = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [screen]);

  const startPolling = (pid: string, amt: number) => {
    let count = 0;

    const stopAll = (ch: ReturnType<typeof supabase.channel>) => {
      clearInterval(pollRef.current!);
      supabase.removeChannel(ch);
    };

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

    let timedOut = false;
    // (o countdown agora corre no useEffect central, acima)

    const maxCycles = Math.ceil(TIMEOUT_SECS / 3);
    pollRef.current = setInterval(async () => {
      if (timedOut) return;
      count++;

      try {
        const pollSession = await getSessionWithRefresh();
        const csRes = await fetch("/api/debito/check-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(pollSession ? { "Authorization": `Bearer ${pollSession.access_token}` } : {}),
          },
          body: JSON.stringify({ txId: pid }),
        });
        if (csRes.ok) {
          const csData = await csRes.json() as { status: string; reason?: string };
          if (csData.status === "approved") {
            timedOut = true;
            stopAll(channel);
            setSuccessAmount(amt);
            setScreen("success");
            return;
          }
          if (csData.status === "rejected") {
            timedOut = true;
            stopAll(channel);
            setRejectReason(csData.reason || "");
            setScreen("rejected");
            return;
          }
        }
      } catch { /* erro de rede */ }

      if (count >= maxCycles && !timedOut) {
        timedOut = true;
        stopAll(channel);
        setRejectReason(
          provider === "mpesa"
            ? "Tempo de espera esgotado. Não confirmaste o PIN M-Pesa (*150#) a tempo. Tenta novamente."
            : "Tempo de espera esgotado. Não confirmaste o PIN e-Mola (*898#) a tempo. Tenta novamente.",
        );
        setScreen("rejected");
      }
    }, 3000);
  };

  const handleInitiate = async () => {
    if (!isPhoneValid) { setPhoneError("Número inválido — deve ter 9 dígitos"); return; }
    if (!user) { setPhoneError("Sessão inválida"); return; }

    if (provider === "mpesa" && !walletsAvailable.mpesa) { setPhoneError("A carteira M-Pesa está temporariamente indisponível"); return; }
    if (provider === "emola" && !walletsAvailable.emola) { setPhoneError("A carteira e-Mola está temporariamente indisponível"); return; }

    /* Mínimos reais do gateway Debito Pay por operadora */
    const minAmount = provider === "mpesa" ? 10 : 50;
    if (amountVal < minAmount) {
      setPhoneError(
        provider === "mpesa"
          ? "O mínimo para M-Pesa é 10 MZN"
          : "O mínimo para e-Mola é 50 MZN",
      );
      return;
    }

    setPhoneError("");
    setInitError("");
    setInitiating(true);

    const isMpesa = provider === "mpesa";
    // Tracks whether the 10s timer already switched the screen to "verifying"
    let screenSwitched = false;
    let mpesaTimer: ReturnType<typeof setTimeout> | null = null;

    if (isMpesa) {
      // Keep button loading while the USSD is being dispatched.
      // After 10s the USSD should already be on the phone — switch screen then.
      mpesaTimer = setTimeout(() => {
        screenSwitched = true;
        setCountdown(TIMEOUT_SECS);
        setScreen("verifying");
      }, 10_000);
    }

    try {
      const session = await getSessionWithRefresh();
      if (!session) {
        /* The session helper preserves the account state and lets the user
           retry when the browser/network becomes available again. */
        setInitiating(false);
        return;
      }

      // Frontend timeout — evita que o botão fique a carregar indefinidamente
      const fetchAbort = new AbortController();
      const fetchTimeout = setTimeout(
        () => fetchAbort.abort(),
        isMpesa ? 115_000 : 40_000,
      );

      const res = await fetch("/api/debito/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        signal: fetchAbort.signal,
        body: JSON.stringify({
          amount: amountVal,
          phone: cleanPhone,
          provider,
          type: "deposit",
          userId: session.user.id,
        }),
      });

      clearTimeout(fetchTimeout);
      const resData = await res.json() as any;
      if (mpesaTimer) clearTimeout(mpesaTimer);

      if (!res.ok) {
        const errorMsg = resData?.error || "Erro ao iniciar pagamento. Tenta novamente.";
        /* e-Mola: quando o OPERADOR recusa a criação do pagamento, o USSD
           nunca chega ao utilizador. Mostrar o erro na tela do número
           (antes do modal USSD) em vez do ecrã de espera — assim o user
           percebe logo que nada foi pedido ao seu telefone. */
        const refusedBeforeUssd =
          !isMpesa && /recusado|recusada|não pôde ser iniciado/i.test(errorMsg);
        if (refusedBeforeUssd) {
          if (mpesaTimer) clearTimeout(mpesaTimer);
          setInitError(errorMsg);
          setInitiating(false);
          return;
        }
        if (screenSwitched) {
          setRejectReason(errorMsg);
          setScreen("rejected");
        } else {
          setInitError(errorMsg);
        }
        setInitiating(false);
        return;
      }

      // M-Pesa confirmou de forma síncrona (utilizador confirmou o PIN rapidamente)
      if (resData?.mpesaSync === true) {
        setSuccessAmount(amountVal);
        setInitiating(false);
        setScreen("success");
        return;
      }

      // Pendente — eMola assíncrono ou M-Pesa timeout (webhook vai confirmar)
      const pid = resData?.txId as string;
      setPendingId(pid);
      setInitiating(false);
      setCountdown(TIMEOUT_SECS);
      setScreen("verifying");
      startPolling(pid, amountVal);
    } catch (err) {
      if (mpesaTimer) clearTimeout(mpesaTimer);
      const isAbort = err instanceof DOMException && (err as DOMException).name === "AbortError";
      const errorMsg = isAbort
        ? (isMpesa ? "Tempo de espera esgotado. Tenta novamente." : "A ligação demorou demasiado. Verifica a internet e tenta de novo.")
        : "Erro de ligação. Verifica a internet e tenta de novo.";
      if (screenSwitched) {
        setRejectReason(errorMsg);
        setScreen("rejected");
      } else {
        setInitError(errorMsg);
      }
      setInitiating(false);
    }
  };

  /* ── AMOUNT SCREEN ── */
  if (screen === "amount") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 pt-12 pb-2">
            <div className="w-10" />
            <p className="font-syne font-bold text-[#0a0a0a] text-base tracking-tight">Depositar</p>
            <button onClick={() => setLocation("/perfil")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <X style={{ width: 18, height: 18, color: "#111" }} />
            </button>
          </div>

          <div className="flex flex-col items-center px-5 pt-10 pb-6 border-b border-slate-100">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Montante a Depositar
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400, fontFamily: "system-ui" }}>MZN</span>
              <span style={{ fontSize: "3.6rem", fontFamily: "system-ui, -apple-system", fontWeight: 200, lineHeight: 1, color: "#0a0a0a" }}>
                {amountStr || "0"}
                <span style={{ opacity: 0.4 }}>|</span>
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>Mín: 10 MZN (M-Pesa) · 50 MZN (e-Mola) · Máx: 1.000.000 MZN</p>
          </div>

          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-5">
              {[100, 500, 1000, 5000].map(q => (
                <button key={q} onClick={() => setAmountStr(q.toString())}
                  className="flex-1 h-10 font-semibold text-sm transition-all"
                  style={{
                    background: amountVal === q ? "#0a0a0a" : "#f8fafc",
                    color: amountVal === q ? "#fff" : "#374151",
                    border: amountVal === q ? "1px solid #0a0a0a" : "1px solid #e5e7eb",
                    borderRadius: 0,
                  }}>
                  {q >= 1000 ? `${q / 1000}K` : q}
                </button>
              ))}
            </div>

            <button
              onClick={() => { if (!isAmountZero) setScreen("wallet"); }}
              disabled={isAmountZero}
              className="w-full h-14 font-syne font-bold text-sm transition-all mb-6"
              style={{
                background: !isAmountZero ? "#0a0a0a" : "#f1f5f9",
                color: !isAmountZero ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
              Continuar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 px-5 pb-10">
            {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(key => (
              <motion.button key={key}
                whileTap={{ scale: 0.93 }}
                onClick={() => key === "⌫" ? handleBackspace() : handleDigit(key)}
                className="h-16 flex items-center justify-center transition-colors"
                style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 0 }}>
                {key === "⌫"
                  ? <span style={{ fontSize: 20, color: "#374151" }}>⌫</span>
                  : <span style={{ fontSize: 26, fontWeight: 300, color: "#0a0a0a", fontFamily: "system-ui" }}>{key}</span>
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
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => setScreen("amount")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Escolher Carteira</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex-1 px-5 pt-6 pb-10"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}>

            <div className="flex items-center justify-center mb-7">
              <div className="px-5 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12.5, color: "#6b7280" }}>A depositar: </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0a0a0a" }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Selecciona a tua carteira móvel
            </p>

            {/* e-Mola — disponibilidade controlada pelo admin */}
            {walletsAvailable.emola ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setProvider("emola"); setScreen("phone"); }}
              className="w-full p-5 mb-3 flex items-center justify-between transition-all"
              style={{
                background: "#fff",
                border: `1.5px solid ${EMOLA_GREEN}`,
                borderRadius: 0,
                cursor: "pointer",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <img src="/emola-logo.png" alt="e-Mola" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: EMOLA_GREEN, fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>e-Mola</p>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Pagamento instantâneo via USSD</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#f0fdf4", color: EMOLA_GREEN, letterSpacing: "0.5px" }}>
                  ACTIVO
                </span>
                <CheckCircle2 style={{ width: 16, height: 16, color: EMOLA_GREEN }} />
              </div>
            </motion.button>
            ) : (
            <div className="w-full p-5 mb-3 flex items-center justify-between"
              style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 0, opacity: 0.65, cursor: "not-allowed" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#f1f5f9", border: "1px solid #e5e7eb", filter: "grayscale(1)" }}>
                  <img src="/emola-logo.png" alt="e-Mola" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: "#9ca3af", fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>e-Mola</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Temporariamente indisponível</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#fef2f2", color: "#ef4444", letterSpacing: "0.5px" }}>
                  INDISPONÍVEL
                </span>
                <AlertCircle style={{ width: 16, height: 16, color: "#ef4444" }} />
              </div>
            </div>
            )}

            {/* M-Pesa — disponibilidade controlada pelo admin */}
            {walletsAvailable.mpesa ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setProvider("mpesa"); setScreen("phone"); }}
              className="w-full p-5 mb-8 flex items-center justify-between transition-all"
              style={{
                background: "#fff",
                border: `1.5px solid ${MPESA_RED}`,
                borderRadius: 0,
                cursor: "pointer",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <img src="/mpesa-logo.jpg" alt="M-Pesa" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: MPESA_RED, fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>M-Pesa</p>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Confirmação instantânea</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#fef2f2", color: MPESA_RED, letterSpacing: "0.5px" }}>
                  ACTIVO
                </span>
                <CheckCircle2 style={{ width: 16, height: 16, color: MPESA_RED }} />
              </div>
            </motion.button>
            ) : (
            <div className="w-full p-5 mb-8 flex items-center justify-between"
              style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 0, opacity: 0.65, cursor: "not-allowed" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#f1f5f9", border: "1px solid #e5e7eb", filter: "grayscale(1)" }}>
                  <img src="/mpesa-logo.jpg" alt="M-Pesa" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: "#9ca3af", fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>M-Pesa</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Temporariamente indisponível</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#fef2f2", color: "#ef4444", letterSpacing: "0.5px" }}>
                  INDISPONÍVEL
                </span>
                <AlertCircle style={{ width: 16, height: 16, color: "#ef4444" }} />
              </div>
            </div>
            )}

            <div className="p-4" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                  O pagamento é processado pelo gateway seguro <strong style={{ color: "#374151" }}>Debito Pay</strong>.
                  M-Pesa confirma instantaneamente; e-Mola envia um pedido USSD para confirmares com o teu PIN.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── PHONE SCREEN ── */
  if (screen === "phone") {
    const providerColor = provider === "emola" ? EMOLA_GREEN : MPESA_RED;
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => setScreen("wallet")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">
              Número {provider === "emola" ? "e-Mola" : "M-Pesa"}
            </p>
            <div className="w-9" />
          </div>

          <motion.div className="flex-1 px-5 pt-6 pb-10"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}>

            <div className="flex items-center justify-center mb-7">
              <div className="px-5 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12.5, color: "#6b7280" }}>A depositar: </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0a0a0a" }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            <div className="mb-5 p-5" style={{ border: `1.5px solid ${providerColor}22`, background: "#fafafa" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 flex items-center justify-center"
                  style={{ background: provider === "emola" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${providerColor}33` }}>
                  <Phone style={{ width: 16, height: 16, color: providerColor }} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: providerColor, fontFamily: "'Syne', sans-serif" }}>
                    Número de {provider === "emola" ? "e-Mola" : "M-Pesa"}
                  </p>
                  <p style={{ fontSize: 11.5, color: "#9ca3af" }}>O número que vai efectuar o pagamento</p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3.5 bg-white"
                style={{ border: isPhoneValid ? `1.5px solid ${providerColor}` : "1.5px solid #d1d5db" }}>
                <div className="flex items-center gap-2 flex-shrink-0 border-r pr-3" style={{ borderColor: "#e5e7eb" }}>
                  <span style={{ fontSize: 16 }}>🇲🇿</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>+258</span>
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
                  className="flex-1 bg-transparent outline-none text-sm font-semibold"
                  style={{ color: "#0a0a0a", caretColor: providerColor, letterSpacing: "1px", fontFamily: "system-ui" }}
                />
                {isPhoneValid && (
                  <CheckCircle2 style={{ width: 16, height: 16, color: providerColor, flexShrink: 0 }} />
                )}
              </div>

              {phoneError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 8 }}>⚠ {phoneError}</p>}
              {initError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 8, lineHeight: 1.5 }}>⚠ {initError}</p>}
            </div>

            <div className="p-4 mb-7" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>Como funciona</p>
              {(provider === "mpesa" ? [
                "Introduz o teu número M-Pesa e prime «Pagar»",
                "Recebes um pedido USSD no teu telemóvel",
                "Confirma com o teu PIN M-Pesa",
                "O saldo é creditado instantaneamente",
              ] : [
                "Introduz o teu número e-Mola e prime «Pagar»",
                "Recebes um pedido USSD no teu telemóvel",
                "Confirma com o teu PIN e-Mola",
                "O saldo é creditado automaticamente",
              ]).map((step, i) => (
                <div key={i} className="flex items-start gap-3 mb-2.5 last:mb-0">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#0a0a0a" }}>
                    <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{i + 1}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{step}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleInitiate}
              disabled={!isPhoneValid || initiating}
              className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: isPhoneValid && !initiating ? "#0a0a0a" : "#f1f5f9",
                color: isPhoneValid && !initiating ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
              {initiating
                ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /><span>A iniciar pagamento…</span></>
                : "Pagar"
              }
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── VERIFYING SCREEN ── */
  if (screen === "verifying") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-6">
          <motion.div className="flex flex-col items-center w-full"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}>

            <div className="relative flex items-center justify-center mb-8" style={{ width: 96, height: 96 }}>
              <div className="absolute inset-0 rounded-full border animate-spin"
                style={{ borderColor: "#e5e7eb", borderTopColor: "#0a0a0a" }} />
              <div className="w-16 h-16 flex items-center justify-center"
                style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <Phone style={{ width: 22, height: 22, color: "#374151" }} />
              </div>
            </div>

            <h1 className="font-syne font-bold text-[22px] text-[#0a0a0a] text-center mb-2">
              Aguarda o USSD
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.65, maxWidth: 300, marginBottom: 24 }}>
              Um pedido USSD foi enviado para{" "}
              <strong style={{ color: "#0a0a0a" }}>+258 {cleanPhone}</strong>.
              Introduz o teu <strong style={{ color: "#0a0a0a" }}>PIN {provider === "emola" ? "e-Mola" : "M-Pesa"}</strong> para confirmar.
            </p>

            <div className="w-full p-4 mb-4" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  A aguardar confirmação do PIN…
                </span>
              </div>
              {countdown > 0 ? (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: countdown <= 30 ? "#f59e0b" : "#9ca3af" }}>Expira em</span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                    color: countdown <= 30 ? "#f59e0b" : "#374151",
                  }}>
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span style={{ fontSize: 12, color: "#f59e0b" }}>A verificar confirmação do banco…</span>
                </div>
              )}
            </div>

            {/* Instruções para quem não recebeu o USSD */}
            <div className="w-full p-4 mb-4" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                Não recebeste o pedido USSD?
              </p>
              <p style={{ fontSize: 12, color: "#a16207", lineHeight: 1.6 }}>
                {provider === "emola"
                  ? <>Abre o menu <strong>*898#</strong> no teu telemóvel, escolhe a opção de pagamento pendente (ou "Pagar Comerciante") e confirma com o teu PIN e-Mola.</>
                  : <>Abre o menu <strong>*150#</strong> no teu telemóvel, escolhe a opção de pagamentos pendentes e confirma com o teu PIN M-Pesa.</>}
              </p>
            </div>

            <p style={{ fontSize: 11.5, color: "#9ca3af", textAlign: "center", maxWidth: 260, lineHeight: 1.5 }}>
              Verifica também a cobertura de rede ou volta atrás e tenta de novo.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── SUCCESS SCREEN ── */
  if (screen === "success") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-end justify-end pt-12 pb-4">
            <button onClick={() => setLocation("/perfil")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <X style={{ width: 18, height: 18, color: "#111" }} />
            </button>
          </div>

          <motion.div className="flex flex-col items-center mb-8 pt-4"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="w-20 h-20 flex items-center justify-center mb-6"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: "#16a34a" }} strokeWidth={2} />
            </motion.div>
            <h1 className="font-syne font-bold text-[24px] text-[#0a0a0a] text-center mb-1">
              Depósito Confirmado!
            </h1>
            <p className="font-syne font-bold text-xl text-center mb-2" style={{ color: "#16a34a" }}>
              +{fmtMZN(successAmount || amountVal)} MZN
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>
              O teu saldo foi creditado com sucesso na carteira WinMoz.
            </p>
          </motion.div>

          <motion.div className="mb-5" style={{ border: "1px solid #e5e7eb" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}>
            <div className="px-4 py-3.5 border-b border-slate-100">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                Detalhes da Transacção
              </p>
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
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.highlight ? "#16a34a" : row.green ? "#16a34a" : "#0a0a0a" }}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 font-syne font-bold text-sm text-white transition-all"
              style={{ background: "#0a0a0a", borderRadius: 0, border: "none", letterSpacing: "0.3px" }}>
              Concluído
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── REJECTED SCREEN ── */
  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-end justify-end pt-12 pb-4">
          <button onClick={() => { setPendingId(null); setInitError(""); setScreen("phone"); }}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <X style={{ width: 18, height: 18, color: "#111" }} />
          </button>
        </div>

        <motion.div className="flex flex-col items-center mb-8 pt-4"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-20 h-20 flex items-center justify-center mb-6"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <XCircle style={{ width: 36, height: 36, color: "#dc2626" }} strokeWidth={2} />
          </motion.div>
          <h1 className="font-syne font-bold text-[22px] text-[#0a0a0a] text-center mb-2">
            Pagamento Falhado
          </h1>
          {rejectReason ? (
            <p style={{ fontSize: 13, color: "#f59e0b", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
              {rejectReason}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
              O pagamento não foi concluído. Verifica o PIN, saldo ou cobertura de rede.
            </p>
          )}
        </motion.div>

        <motion.div className="mb-4" style={{ border: "1px solid #e5e7eb" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}>
          <div className="px-4 py-3.5 border-b border-slate-100">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Possíveis Causas
            </p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {(provider === "mpesa" ? [
              "PIN M-Pesa incorrecto ou cancelaste o pedido USSD",
              "Saldo insuficiente na carteira M-Pesa",
              "Tempo de resposta ao USSD esgotado",
              "Número de telefone não corresponde à carteira M-Pesa",
            ] : [
              "PIN e-Mola incorrecto ou cancelaste o pedido USSD",
              "Saldo insuficiente na carteira e-Mola",
              "Tempo de resposta ao USSD esgotado",
              "Número de telefone não corresponde à carteira e-Mola",
            ]).map((cause, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <span style={{ fontSize: 9, color: "#dc2626", fontWeight: 700 }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>{cause}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex items-start gap-3 p-3.5 mb-6" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertTriangle style={{ width: 14, height: 14, color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
            Se o dinheiro foi debitado mas o depósito não foi creditado, contacta o suporte. O teu dinheiro está seguro.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setPendingId(null); setInitError(""); setScreen("phone"); }}
            className="w-full h-14 font-syne font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: "#0a0a0a", borderRadius: 0, border: "none" }}>
            <RotateCcw style={{ width: 16, height: 16 }} />
            Tentar Novamente
          </button>
          <button onClick={() => setLocation("/perfil")}
            className="w-full h-14 font-semibold text-sm transition-all"
            style={{ background: "#f8fafc", color: "#374151", borderRadius: 0, border: "1px solid #e5e7eb" }}>
            Voltar ao Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
