import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, X, CheckCircle2, Copy, ClipboardPaste,
  Loader2, AlertCircle, ArrowRight, Send,
} from "lucide-react";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "transfer" | "processing";

export default function Depositar() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("amount");
  const [amountStr, setAmountStr] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const DEFAULT_PHONE = "868245531";
  const SUPPORT_NAME = "Tina Alberto João";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "recharge_whatsapp_contact")
          .maybeSingle();
        if (alive && data?.value) setSupportPhone(data.value);
        else if (alive) setSupportPhone(DEFAULT_PHONE);
      } catch { if (alive) setSupportPhone(DEFAULT_PHONE); }
    })();
    return () => { alive = false; };
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

  const handleCopyNumber = async () => {
    const phone = supportPhone || DEFAULT_PHONE;
    const clean = phone.replace(/\D/g, "");
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(amountVal));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleSubmit = async () => {
    if (!confirmationMsg.trim() || !user) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const session = await getSessionWithRefresh();
      if (!session) { setSubmitting(false); return; }

      const res = await fetch("/api/deposit/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: amountVal, confirmationMsg: confirmationMsg.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao enviar pedido");
      setShowSuccessModal(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao enviar pedido");
    }
    setSubmitting(false);
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    setLocation("/perfil");
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
            <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>Mín: 10 MZN · Máx: 1.000.000 MZN</p>
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
              onClick={() => { if (!isAmountZero) setScreen("transfer"); }}
              disabled={isAmountZero}
              className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all mb-6"
              style={{
                background: !isAmountZero ? "#0a0a0a" : "#f1f5f9",
                color: !isAmountZero ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
              Continuar
              {!isAmountZero && <ArrowRight style={{ width: 16, height: 16 }} />}
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

  /* ── TRANSFER INSTRUCTIONS SCREEN ── */
  if (screen === "transfer") {
    const phone = supportPhone || DEFAULT_PHONE;
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length >= 9
      ? `+258 ${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 6)} ${cleanPhone.slice(6)}`
      : `+258 ${cleanPhone}`;

    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => setScreen("amount")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Transferência</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex-1 px-5 pt-6 pb-10"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}>

            {/* Amount badge */}
            <div className="flex items-center justify-center mb-7">
              <div className="px-5 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12.5, color: "#6b7280" }}>A depositar: </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0a0a0a" }}>{fmtMZN(amountVal)} MZN</span>
              </div>
            </div>

            {/* Step 1: Transfer number */}
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>1</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Transfere o valor</p>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 12 }}>
                Transfere <strong style={{ color: "#0a0a0a" }}>{fmtMZN(amountVal)} MZN</strong> para o número abaixo:
              </p>

              <div className="flex items-center gap-2 p-3.5" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <div className="flex-1">
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#0a0a0a", fontFamily: "system-ui", letterSpacing: "1px" }}>
                    {formattedPhone}
                  </p>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    Titular: <strong style={{ color: "#374151" }}>{SUPPORT_NAME}</strong>
                  </p>
                </div>
                <button onClick={handleCopyNumber}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: copied ? "#f0fdf4" : "#f1f5f9",
                    color: copied ? "#16a34a" : "#374151",
                    border: `1px solid ${copied ? "#bbf7d0" : "#e5e7eb"}`,
                  }}>
                  {copied ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>

              <div className="mt-3 p-3 flex items-start gap-2" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <AlertCircle style={{ width: 14, height: 14, color: "#d97706", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 11.5, color: "#92400e", lineHeight: 1.5 }}>
                  Usa o teu app de pagamento (M-Pesa, e-Mola, etc.) para transferir exactamente este valor.
                </p>
              </div>
            </div>

            {/* Step 2: Confirmation message */}
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>2</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Mensagem de confirmação</p>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 12 }}>
                Copia a mensagem de confirmação que recebeste após a transferência e cola aqui:
              </p>

              <div className="relative">
                <textarea
                  value={confirmationMsg}
                  onChange={e => { setConfirmationMsg(e.target.value); setSubmitError(""); }}
                  placeholder="Ex: Transferência de 500 MZN para +258 84 123 4567. Ref: 123456789. Saldo anterior: 1234,56 MZN..."
                  rows={5}
                  className="w-full px-4 py-3 text-[13px] outline-none resize-none"
                  style={{
                    background: "#f8fafc",
                    border: confirmationMsg ? "1.5px solid #0a0a0a" : "1.5px solid #e5e7eb",
                    color: "#0a0a0a",
                    fontFamily: "system-ui",
                    lineHeight: 1.6,
                  }}
                />
                {confirmationMsg && (
                  <button onClick={() => setConfirmationMsg("")}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
                    style={{ background: "#e5e7eb" }}>
                    <X style={{ width: 12, height: 12, color: "#6b7280" }} />
                  </button>
                )}
              </div>

              {!confirmationMsg && (
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setConfirmationMsg(text.trim());
                    } catch { /* noop */ }
                  }}
                  className="flex items-center gap-1.5 mt-2 text-[11.5px] font-semibold"
                  style={{ color: "#6b7280" }}>
                  <ClipboardPaste style={{ width: 13, height: 13 }} />
                  Colar da área de transferência
                </button>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 mb-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <AlertCircle style={{ width: 14, height: 14, color: "#dc2626", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#dc2626" }}>{submitError}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!confirmationMsg.trim() || submitting}
              className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: confirmationMsg.trim() && !submitting ? "#0a0a0a" : "#f1f5f9",
                color: confirmationMsg.trim() && !submitting ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
              {submitting
                ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /><span>A enviar...</span></>
                : <><Send style={{ width: 15, height: 15 }} /><span>Submeter Pedido</span></>
              }
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── SUCCESS / PROCESSING MODAL ── */
  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <AnimatePresence>
          {showSuccessModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-6"
              style={{ background: "rgba(0,0,0,0.5)" }}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-[340px] bg-white p-8 flex flex-col items-center"
                style={{ borderRadius: 0 }}>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  className="w-16 h-16 flex items-center justify-center mb-5"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <CheckCircle2 style={{ width: 32, height: 32, color: "#16a34a" }} strokeWidth={2} />
                </motion.div>

                <h2 className="font-syne font-bold text-lg text-center mb-2" style={{ color: "#0a0a0a" }}>
                  Pedido Enviado!
                </h2>
                <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.6, marginBottom: 8 }}>
                  A tua recarga de <strong style={{ color: "#0a0a0a" }}>{fmtMZN(amountVal)} MZN</strong> será processada em segundos.
                </p>
                <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", lineHeight: 1.5, marginBottom: 24 }}>
                  O teu saldo será actualizado assim que o depósito for aprovado.
                </p>

                <button onClick={handleDone}
                  className="w-full h-12 font-syne font-bold text-sm text-white transition-all"
                  style={{ background: "#0a0a0a", borderRadius: 0, border: "none" }}>
                  Concluído
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 flex items-center justify-center mb-5"
            style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <Loader2 style={{ width: 28, height: 28, color: "#374151" }} className="animate-spin" />
          </div>
          <p className="font-syne font-bold text-base text-center" style={{ color: "#0a0a0a" }}>
            A processar...
          </p>
        </div>
      </div>
    </div>
  );
}
