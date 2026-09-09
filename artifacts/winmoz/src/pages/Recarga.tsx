import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, CheckCircle2, XCircle, RotateCcw, Zap, ClipboardPaste,
} from "lucide-react";
import { forceSessionLogout, getSessionWithRefresh, recoverAfter401 } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";

function fmtMZN(val: number) {
  return val.toFixed(2).replace(".", ",");
}

function formatDisplay(raw: string): string {
  const digits = raw.slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
  return parts.join("-");
}

type Screen = "input" | "success" | "error";

export default function Recarga() {
  const [, setLocation] = useLocation();
  const { refreshProfile } = useAuth();
  const [digits, setDigits] = useState("");
  const [screen, setScreen] = useState<Screen>("input");
  const [amount, setAmount] = useState(0);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rechargeContact, setRechargeContact] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "recharge_whatsapp_contact")
          .maybeSingle();
        if (alive && data) setRechargeContact((data as { value: string }).value ?? "");
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, []);

  const isComplete = digits.length === 12;
  const display = formatDisplay(digits);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = (text ?? "").replace(/\D/g, "").slice(0, 12);
      if (cleaned.length > 0) {
        setDigits(cleaned);
        setErrorMsg(null);
      } else {
        setErrorMsg("Nenhum código de recarga válido encontrado na área de transferência.");
      }
    } catch {
      setErrorMsg("Não foi possível aceder à área de transferência. Autoriza o acesso ou digita o código.");
    }
  };

  const handleClear = () => {
    setDigits("");
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);

    const timeout = (ms: number) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      );

    try {
      const session = await Promise.race([
        getSessionWithRefresh(),
        timeout(8000),
      ]);

       if (!session) {
         setScreen("error");
         return;
       }

      const doRecharge = (token: string) => fetch(`${API_BASE}/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: digits }),
      });

      const res = await Promise.race([
        doRecharge(session.access_token).then(async r => {
          // Token expirado a meio: refresca e repete uma vez antes de falhar.
          if (r.status === 401 && await recoverAfter401()) {
            const fresh = await getSessionWithRefresh();
            if (fresh) return doRecharge(fresh.access_token);
          }
          return r;
        }),
        timeout(15000),
      ]) as Response;

       if (!res.ok) {
         if (res.status === 401) forceSessionLogout("recharge_unauthorized");
         try {
           const errData = await res.json() as { error?: string };
           setErrorMsg(errData?.error ?? null);
         } catch {
           setErrorMsg(null);
         }
         setScreen("error");
         return;
       }

      const data = await res.json();
      const creditedAmount: number = data.amount ?? 0;

      try {
        await Promise.race([refreshProfile(), timeout(8000)]);
      } catch {
        /* refresh failed but recharge succeeded */
      }

      setAmount(creditedAmount);
      setScreen("success");
    } catch {
      setErrorMsg("Sem ligação ao servidor. Verifica a tua internet e tenta novamente.");
      setScreen("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setDigits("");
    setSubmitting(false);
    setErrorMsg(null);
    setScreen("input");
  };

  /* ── INPUT SCREEN ── */
  if (screen === "input") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen bg-white">

          <div className="flex items-center justify-between px-5 pt-12 pb-5 border-b border-slate-100">
            <button onClick={() => setLocation("/perfil")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Recarregar Saldo</p>
            <div className="w-9" />
          </div>

          <div className="flex-1 flex flex-col px-5 pt-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="mb-7">
              <h1 className="font-syne font-bold text-[28px] text-[#0a0a0a] leading-tight mb-2">
                Introduz o<br />
                <span style={{ color: "#374151" }}>código</span>
              </h1>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                Digita ou cola o teu código de 12 dígitos que se encontra no comprovativo de compra.
              </p>
            </motion.div>

            <motion.div
              animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-3"
              style={{ border: isComplete ? "1.5px solid #0a0a0a" : "1px solid #e5e7eb", background: "#f8fafc" }}>

              <div className="flex items-center px-4" style={{ borderBottom: "1px solid #eef2f6" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={display}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="0000-0000-0000"
                  className="w-full font-mono text-center outline-none bg-transparent"
                  style={{
                    fontSize: 22,
                    letterSpacing: "0.14em",
                    fontWeight: 600,
                    color: "#0a0a0a",
                    height: 58,
                    caretColor: "#0a0a0a",
                  }}
                />
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between">
                <p style={{ fontSize: 11, color: "#9ca3af" }}>
                  {digits.length}/12 dígitos
                </p>
                <div className="flex items-center gap-1">
                  {digits.length > 0 && (
                    <button onClick={handleClear}
                      className="h-7 px-2.5 flex items-center gap-1 transition-colors hover:bg-slate-100"
                      style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                      Limpar
                    </button>
                  )}
                  <button onClick={handlePaste}
                    className="h-7 px-2.5 flex items-center gap-1 rounded transition-colors hover:bg-slate-100"
                    style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>
                    <ClipboardPaste style={{ width: 12, height: 12 }} />
                    Colar
                  </button>
                </div>
              </div>

              <div className="w-full h-1 overflow-hidden" style={{ background: "#e5e7eb" }}>
                <motion.div
                  className="h-full"
                  style={{ background: isComplete ? "#0a0a0a" : "#9ca3af" }}
                  animate={{ width: `${(digits.length / 12) * 100}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>

              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full px-4 py-2.5 text-center overflow-hidden"
                    style={{ background: "#f0fdf4", borderTop: "1px solid #bbf7d0" }}>
                    <div className="flex items-center justify-center gap-2">
                      <Zap style={{ width: 12, height: 12, color: "#16a34a" }} />
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Código pronto para validar</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mb-3 px-4 py-3 flex items-start gap-2"
                style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <XCircle style={{ width: 14, height: 14, color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>{errorMsg}</p>
              </motion.div>
            )}

            <motion.button
              whileTap={isComplete ? { scale: 0.98 } : {}}
              onClick={handleSubmit}
              disabled={!isComplete || submitting}
              className="w-full h-14 font-syne font-bold text-sm mb-3 transition-all"
              style={{
                 background: isComplete && !submitting ? "#0a0a0a" : "#f1f5f9",
                 color: isComplete && !submitting ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
               {submitting ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /><span>A validar código…</span></> : isComplete ? "Processar Recarga" : "Introduz o código completo"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const contact = (rechargeContact ?? "").trim();
                const digitsContact = contact.replace(/\D/g, "");
                let url: string;
                if (/^https?:\/\//i.test(contact)) {
                  url = contact;
                } else if (digitsContact.length >= 9) {
                  url = `https://wa.me/${digitsContact.replace(/^0+/, "")}?text=${encodeURIComponent("Olá! Quero comprar uma recarga de saldo.")}`;
                } else {
                  url = "https://wa.me/";
                }
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="w-full font-semibold text-sm mb-8 flex items-center justify-center gap-2.5 transition-all"
              style={{
                background: "#25D366",
                color: "#fff",
                border: "none",
                borderRadius: 0,
                padding: "15px 16px",
                boxShadow: "0 4px 14px rgba(37,211,102,.35)",
              }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              Comprar Recarga no WhatsApp
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  /* ── SUCCESS SCREEN ── */
  if (screen === "success") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 bg-white">
          <div className="flex items-center justify-between pt-12 pb-4 border-b border-slate-100">
            <div className="w-9" />
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Recarregar Saldo</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex flex-col items-center py-8"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="w-20 h-20 flex items-center justify-center mb-6"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: "#16a34a" }} strokeWidth={2} />
            </motion.div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
              Recarga Aprovada
            </p>
            <p className="font-syne font-bold text-center" style={{ fontSize: "3.2rem", lineHeight: 1, color: "#0a0a0a" }}>
              +{fmtMZN(amount)}<span style={{ fontSize: "1.2rem", color: "#16a34a", marginLeft: 6 }}>MZN</span>
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
              Adicionado ao teu saldo principal
            </p>
          </motion.div>

          <motion.div className="mb-6" style={{ border: "1px solid #e5e7eb" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}>
            <div className="px-4 py-3.5 border-b border-slate-100">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                Recibo de Recarga
              </p>
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
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: (row as any).hi ? "#16a34a" : "#0a0a0a" }}>{row.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex flex-col gap-3">
            <button onClick={() => setLocation("/perfil")}
              className="w-full h-14 font-syne font-bold text-sm text-white"
              style={{ background: "#0a0a0a", borderRadius: 0, border: "none", letterSpacing: "0.3px" }}>
              Ir ao Perfil
            </button>
            <button onClick={handleRetry}
              className="w-full h-14 font-semibold text-sm"
              style={{ background: "#f8fafc", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 0 }}>
              Nova Recarga
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── ERROR SCREEN ── */
  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 bg-white">
        <div className="flex items-center justify-between pt-12 pb-4 border-b border-slate-100">
          <div className="w-9" />
          <p className="font-syne font-bold text-[#0a0a0a] text-base">Recarregar Saldo</p>
          <div className="w-9" />
        </div>

        <motion.div className="flex flex-col items-center py-8"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-20 h-20 flex items-center justify-center mb-6"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <XCircle style={{ width: 36, height: 36, color: "#dc2626" }} strokeWidth={2} />
          </motion.div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
            Código Inválido
          </p>
          <h1 className="font-syne font-bold text-[22px] text-[#0a0a0a] text-center mb-2">
            Recarga Recusada
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
            O código introduzido não é válido, expirou ou já foi utilizado anteriormente.
          </p>
        </motion.div>

        <motion.div className="mb-5" style={{ border: "1px solid #e5e7eb" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}>
          <div className="px-4 py-3.5 border-b border-slate-100">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Possíveis Causas
            </p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {[
              "Código digitado incorrectamente",
              "Código já utilizado anteriormente",
              "Código expirado ou inválido",
              "Tipo de código não suportado",
            ].map(item => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 mt-1.5 flex-shrink-0" style={{ background: "#dc2626" }} />
                <p style={{ fontSize: 13, color: "#6b7280" }}>{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex flex-col gap-3">
          <button onClick={handleRetry}
            className="w-full h-14 font-syne font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: "#0a0a0a", borderRadius: 0, border: "none", letterSpacing: "0.3px" }}>
            <RotateCcw style={{ width: 16, height: 16 }} />
            Tentar Novamente
          </button>
          <button onClick={() => setLocation("/perfil")}
            className="w-full h-14 font-semibold text-sm"
            style={{ background: "#f8fafc", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 0 }}>
            Voltar ao Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
