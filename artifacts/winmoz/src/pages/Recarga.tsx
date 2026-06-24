import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, CheckCircle2, XCircle, RotateCcw, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/apiBase";

function fmtMZN(val: number) {
  return val.toFixed(2).replace(".", ",");
}

function formatDisplay(raw: string): string {
  const digits = raw.slice(0, 15);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 5) parts.push(digits.slice(i, i + 5));
  return parts.join("-");
}

type Screen = "input" | "processing" | "success" | "error";

export default function Recarga() {
  const [, setLocation] = useLocation();
  const { refreshProfile } = useAuth();
  const [digits, setDigits] = useState("");
  const [screen, setScreen] = useState<Screen>("input");
  const [amount, setAmount] = useState(0);
  const [shake, setShake] = useState(false);

  const isComplete = digits.length === 15;
  const display = formatDisplay(digits);

  const handleDigit = (d: string) => {
    if (digits.length >= 15) return;
    setDigits(prev => prev + d);
  };
  const handleBackspace = () => setDigits(prev => prev.slice(0, -1));
  const handleClear = () => setDigits("");

  const handleSubmit = async () => {
    if (!isComplete) return;
    setScreen("processing");

    const timeout = (ms: number) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      );

    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        timeout(8000),
      ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;

      const session = sessionResult.data.session;
      if (!session) { setScreen("error"); return; }

      const res = await Promise.race([
        fetch(`${API_BASE}/recharge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: digits }),
        }),
        timeout(15000),
      ]) as Response;

      if (!res.ok) { setScreen("error"); return; }

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
      setScreen("error");
    }
  };

  const handleRetry = () => {
    setDigits("");
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
                O teu código de 15 dígitos encontra-se no comprovativo de compra.
              </p>
            </motion.div>

            <motion.div
              animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-4 p-5"
              style={{ border: isComplete ? "1.5px solid #0a0a0a" : "1px solid #e5e7eb", background: "#f8fafc" }}>
              <p
                className="text-center font-mono tracking-[0.22em] mb-3"
                style={{
                  fontSize: digits.length === 0 ? 18 : 22,
                  color: digits.length === 0 ? "#d1d5db" : isComplete ? "#0a0a0a" : "#374151",
                  letterSpacing: "0.2em",
                  fontWeight: 600,
                  minHeight: 34,
                  transition: "color 0.2s",
                }}>
                {digits.length === 0 ? "00000-00000-00000" : display || "—"}
              </p>

              <div className="w-full h-1 overflow-hidden" style={{ background: "#e5e7eb" }}>
                <motion.div
                  className="h-full"
                  style={{ background: isComplete ? "#0a0a0a" : "#9ca3af" }}
                  animate={{ width: `${(digits.length / 15) * 100}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
                {digits.length}/15 dígitos
              </p>

              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full px-4 py-3 text-center overflow-hidden"
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div className="flex items-center justify-center gap-2">
                      <Zap style={{ width: 13, height: 13, color: "#16a34a" }} />
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#16a34a" }}>Código pronto para validar</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="flex items-center gap-2 mb-5 px-1">
              <Zap style={{ width: 12, height: 12, color: "#9ca3af", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                Exemplo:{" "}
                <span className="font-mono" style={{ color: "#374151" }}>10000-00000-00000</span>
              </p>
            </div>

            <motion.button
              whileTap={isComplete ? { scale: 0.98 } : {}}
              onClick={handleSubmit}
              disabled={!isComplete}
              className="w-full h-14 font-syne font-bold text-sm mb-5 transition-all"
              style={{
                background: isComplete ? "#0a0a0a" : "#f1f5f9",
                color: isComplete ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                letterSpacing: "0.3px",
              }}>
              {isComplete ? "Processar Recarga" : "Introduz o código completo"}
            </motion.button>

            <div className="grid grid-cols-3 gap-2 pb-8">
              {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(key => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    if (key === "⌫") handleBackspace();
                    else if (key === "C") handleClear();
                    else handleDigit(key);
                  }}
                  className="h-14 flex items-center justify-center transition-colors"
                  style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 0 }}>
                  {key === "⌫"
                    ? <span style={{ fontSize: 18, color: "#374151" }}>⌫</span>
                    : <span style={{ fontSize: 22, fontWeight: key === "C" ? 700 : 300, color: key === "C" ? "#dc2626" : "#0a0a0a", fontFamily: "system-ui" }}>{key}</span>
                  }
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── PROCESSING SCREEN ── */
  if (screen === "processing") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center items-center">
        <motion.div className="flex flex-col items-center gap-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 border border-slate-100 absolute" />
            <div className="w-20 h-20 border-2 border-transparent border-t-[#0a0a0a] animate-spin absolute" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap style={{ width: 22, height: 22, color: "#374151" }} />
            </div>
          </div>
          <p className="font-syne font-bold text-[#0a0a0a] text-base">A validar código…</p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Por favor aguarda</p>
        </motion.div>
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
