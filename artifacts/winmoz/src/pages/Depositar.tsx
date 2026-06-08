import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, X, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, Copy, Smartphone, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/apiBase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";

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

type Screen = "amount" | "instructions" | "verifying" | "success" | "rejected";

export default function Depositar() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("amount");
  const [amountStr, setAmountStr] = useState("");
  const [smsText, setSmsText] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const MPESA_NUM = "848519858";
  const EMOLA_NUM = "869189457";
  const [successAmount, setSuccessAmount] = useState(0);
  const txDate = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const startPolling = (pid: string, amt: number) => {
    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      try {
        const r = await fetch(`${API_BASE}/deposit/manual-status/${pid}`);
        if (!r.ok) { clearInterval(pollRef.current!); setScreen("rejected"); return; }
        const data = await r.json() as { status: string };
        if (data.status === "approved") {
          clearInterval(pollRef.current!);
          setSuccessAmount(amt);
          setScreen("success");
        } else if (data.status === "rejected" || data.status === "not_found" || count >= 200) {
          clearInterval(pollRef.current!);
          setScreen("rejected");
        }
      } catch {
        if (count >= 200) { clearInterval(pollRef.current!); setScreen("rejected"); }
      }
    }, 3000);
  };

  const handleVerify = async () => {
    if (!smsText.trim()) { setVerifyError("Cola a mensagem de confirmação da transferência"); return; }
    if (!user) { setVerifyError("Sessão inválida"); return; }
    setVerifyError("");
    setScreen("verifying");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setScreen("rejected"); return; }

      const r = await fetch(`${API_BASE}/deposit/manual-request`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "deposit", amount: amountVal, confirmationMsg: smsText.trim() }),
      });
      const data = await r.json() as { pendingId?: string; error?: string };

      if (data.pendingId) {
        setPendingId(data.pendingId);
        startPolling(data.pendingId, amountVal);
      } else {
        setScreen("rejected");
      }
    } catch {
      setScreen("rejected");
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
              onClick={() => { if (!isAmountZero) setScreen("instructions"); }}
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

  /* ── INSTRUCTIONS SCREEN ── */
  if (screen === "instructions") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#000" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen">

          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={() => setScreen("amount")}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <p className="font-semibold text-white text-base tracking-tight">Como Depositar</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 px-5 pb-10 overflow-y-auto">

            <div className="flex items-center justify-center mb-5">
              <div className="px-5 py-2 rounded-full" style={{ background: "#1c1c1e", border: `1.5px solid ${CYAN}22` }}>
                <span className="text-sm font-medium" style={{ color: "#8e8e93" }}>A depositar: </span>
                <span className="text-sm font-bold" style={{ color: CYAN }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            {/* Notice */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl p-4 mb-5"
              style={{ background: "#18180f", border: "1.5px solid #f59e0b44" }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(245,158,11,0.18)" }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#f59e0b" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1.5" style={{ color: "#f59e0b" }}>
                    Pagamentos instantâneos indisponíveis
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#a1a1aa" }}>
                    Os pagamentos automáticos via Push SDK não estão disponíveis de momento — estarão disponíveis brevemente.
                  </p>
                  <p className="text-xs leading-relaxed mt-2" style={{ color: "#71717a" }}>
                    Para depositar agora, transfere o valor manualmente para um dos números abaixo e cola a mensagem de confirmação que recebeste.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* M-Pesa number */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 }}
              className="rounded-2xl p-4 mb-3"
              style={{ background: "#1c1c1e" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(231,76,60,0.15)" }}>
                    <Smartphone style={{ width: 20, height: 20, color: "#e74c3c" }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-0.5 uppercase tracking-wider" style={{ color: "#e74c3c" }}>M-Pesa</p>
                    <p className="font-bold text-white text-lg" style={{ fontFamily: "system-ui", letterSpacing: "0.5px" }}>
                      +258 {MPESA_NUM.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>Celso Cristiano</p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(`+258${MPESA_NUM}`, "mpesa")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: copied === "mpesa" ? "rgba(0,212,180,0.2)" : "#2c2c2e",
                    color: copied === "mpesa" ? CYAN : "#8e8e93",
                  }}>
                  {copied === "mpesa"
                    ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                    : <Copy style={{ width: 14, height: 14 }} />
                  }
                  <span className="text-xs font-semibold">{copied === "mpesa" ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </motion.div>

            {/* e-Mola number */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 }}
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#1c1c1e" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(52,211,153,0.15)" }}>
                    <Smartphone style={{ width: 20, height: 20, color: "#34d399" }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-0.5 uppercase tracking-wider" style={{ color: "#34d399" }}>e-Mola</p>
                    <p className="font-bold text-white text-lg" style={{ fontFamily: "system-ui", letterSpacing: "0.5px" }}>
                      +258 {EMOLA_NUM.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>Celso Cristiano</p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(`+258${EMOLA_NUM}`, "emola")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: copied === "emola" ? "rgba(0,212,180,0.2)" : "#2c2c2e",
                    color: copied === "emola" ? CYAN : "#8e8e93",
                  }}>
                  {copied === "emola"
                    ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                    : <Copy style={{ width: 14, height: 14 }} />
                  }
                  <span className="text-xs font-semibold">{copied === "emola" ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </motion.div>

            {/* SMS input */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18 }}>
              <p className="text-xs font-semibold mb-2 ml-0.5 uppercase tracking-widest" style={{ color: "#636366" }}>
                Mensagem de Confirmação
              </p>
              <div className="rounded-2xl overflow-hidden" style={{
                background: "#1c1c1e",
                border: smsText.trim() ? `1.5px solid ${CYAN}` : "1.5px solid #2c2c2e",
                boxShadow: smsText.trim() ? `0 0 0 3px ${CYAN}18` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}>
                <textarea
                  value={smsText}
                  onChange={e => { setSmsText(e.target.value); setVerifyError(""); }}
                  placeholder="Cola aqui a mensagem SMS de confirmação do pagamento M-Pesa ou e-Mola…"
                  rows={5}
                  className="w-full bg-transparent outline-none p-4 text-sm leading-relaxed resize-none"
                  style={{ color: "#fff", caretColor: CYAN, fontFamily: "system-ui" }}
                />
                {smsText.trim() && (
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CYAN }} />
                      <span className="text-xs font-medium" style={{ color: CYAN }}>Mensagem detectada</span>
                    </div>
                    <button onClick={() => setSmsText("")}
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ color: "#636366", background: "#2c2c2e" }}>
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {verifyError && (
                <p className="text-xs mt-2 ml-0.5" style={{ color: "#e74c3c" }}>⚠ {verifyError}</p>
              )}
              <p className="text-xs mt-2.5 ml-0.5 leading-relaxed" style={{ color: "#52525b" }}>
                O sistema vai extrair automaticamente o valor e o ID da transacção para validar o teu pagamento.
              </p>
            </motion.div>

            {/* Confirm button */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.24 }}
              className="mt-6">
              <motion.button
                onClick={handleVerify}
                disabled={!smsText.trim()}
                whileTap={smsText.trim() ? { scale: 0.97 } : {}}
                className="w-full h-14 rounded-full font-semibold text-base transition-all"
                style={{
                  background: smsText.trim() ? CYAN : "#1c1c1e",
                  color: smsText.trim() ? "#000" : "#3a3a3c",
                }}>
                Confirmar Depósito
              </motion.button>
            </motion.div>

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
            <p style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 10, textAlign: "center" }}>
              A processar pedido…
            </p>
            <p style={{ fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.6, maxWidth: 270 }}>
              O teu pedido foi enviado à equipa WinMoz. Aguarda a validação da transferência — normalmente demora poucos minutos.
            </p>
            {pendingId && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-full"
                style={{ background: `rgba(0,212,180,0.08)`, border: `1px solid ${CYAN}33` }}>
                <Clock style={{ width: 13, height: 13, color: CYAN }} />
                <span style={{ fontSize: 11, color: CYAN, fontWeight: 600, letterSpacing: "0.3px" }}>
                  A aguardar aprovação da equipa…
                </span>
              </motion.div>
            )}
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
              {[
                { label: "Data",     val: txDate },
                { label: "Origem",   val: "M-Pesa / e-Mola" },
                { label: "Destino",  val: "Carteira WinMoz" },
                { label: "Montante", val: `${fmtMZN(successAmount || amountVal)} MZN` },
                { label: "Taxa",     val: "Grátis", green: true },
                { label: "Estado",   val: "Confirmado ✓", highlight: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8e8e93" }}>{row.label}</span>
                  <span className="text-sm font-medium"
                    style={{ color: (row as any).highlight ? CYAN : (row as any).green ? "#22c55e" : "#fff" }}>
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
          <button onClick={() => { setSmsText(""); setVerifyError(""); setPendingId(null); setScreen("amount"); }}
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
            <p className="text-white font-semibold" style={{ fontSize: "1.4rem" }}>Verificação Falhou</p>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8e8e93" }}>
              Não foi possível confirmar o teu pagamento. Verifica a mensagem SMS e tenta novamente.
            </p>
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
              "A mensagem SMS não corresponde ao pagamento efectuado",
              "O valor não coincide com o montante indicado",
              "O tempo de verificação expirou (60 segundos)",
              "Transacção não encontrada no sistema de confirmação",
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
            Se já efectuaste o pagamento e o problema persiste, contacta o suporte. O teu dinheiro está seguro.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setSmsText(""); setVerifyError(""); setPendingId(null); setScreen("instructions"); }}
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
