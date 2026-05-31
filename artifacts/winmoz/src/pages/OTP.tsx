import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function WinMozLogo() {
  return (
    <svg viewBox="0 0 220 44" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 42 L0 42 Z" fill="#0D0D0D" />
      <path d="M13 2 L19 2 L15 42 L9 42 Z" fill="#0D0D0D" opacity="0.18" />
      <text x="22" y="38" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="38" letterSpacing="-1" fill="#0D0D0D">WinMoz</text>
    </svg>
  );
}

export default function OTP() {
  const [, setLocation] = useLocation();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [focused, setFocused] = useState<number | null>(null);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const otpType = params.get("type") || "signup";

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleDigit = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError("");
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length) {
      const next = ["", "", "", "", "", ""];
      pasted.split("").forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      const lastFilled = Math.min(pasted.length, 5);
      inputRefs.current[lastFilled]?.focus();
    }
    e.preventDefault();
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResendTimer(60);
    setCanResend(false);
    setDigits(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();

    if (otpType === "recovery") {
      await supabase.auth.resetPasswordForEmail(email);
    } else {
      await supabase.auth.resend({ type: "signup", email });
    }
  };

  const handleVerify = async () => {
    const token = digits.join("");
    if (token.length < 6) return;

    setLoading(true);
    setError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: otpType as "signup" | "recovery",
    });

    if (verifyError) {
      setLoading(false);
      setError("Código inválido ou expirado. Tente novamente.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }

    if (otpType === "signup" && data.user) {
      try {
        const pendingRaw = sessionStorage.getItem("pendingReg");
        const pending = pendingRaw ? JSON.parse(pendingRaw) : {};
        if (pending.full_name || pending.phone || pending.invite_code_used) {
          await fetch("/api/complete-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: data.user.id,
              full_name: pending.full_name,
              phone: pending.phone,
              invite_code_used: pending.invite_code_used,
            }),
          });
          sessionStorage.removeItem("pendingReg");
        }
      } catch {
        // non-critical
      }
      setLoading(false);
      setLocation("/splash");
    } else if (otpType === "recovery") {
      setLoading(false);
      setLocation("/redefinir-senha");
    } else {
      setLoading(false);
      setLocation("/");
    }
  };

  const isComplete = digits.every(d => d !== "");

  const backPath = otpType === "recovery" ? "/esqueceu-senha" : "/registar";

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative">

        <button onClick={() => setLocation(backPath)}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36 }}>
          <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
        </button>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex justify-center mb-9">
          <WinMozLogo />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.08 }}
          className="flex flex-col">

          <div style={{ width: 60, height: 60, background: "#f4f4f5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, alignSelf: "flex-start" }}>
            <ShieldCheck style={{ width: 26, height: 26, color: "#111" }} />
          </div>

          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
            Verificação de Código
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-8 leading-relaxed">
            Introduza o código de 6 dígitos que enviámos para{" "}
            <span className="font-semibold text-[#111]">{email}</span>.
          </p>

          {error && (
            <div className="mb-5 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24, width: "100%" }}
            onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused(null)}
                disabled={loading}
                style={{
                  width: "100%", height: 58, borderRadius: 0,
                  border: focused === i ? "1.5px solid #000" : digit ? "1.5px solid #111" : "1px solid #d1d5db",
                  background: digit ? "#f9f9f9" : "#fff",
                  fontSize: 22, fontWeight: 700, textAlign: "center", color: "#111",
                  outline: "none", transition: "border 0.15s ease, background 0.15s ease",
                  fontFamily: "'Syne', sans-serif", boxSizing: "border-box",
                  opacity: loading ? 0.6 : 1,
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center mb-8">
            {canResend ? (
              <button onClick={handleResend}
                style={{ fontSize: 13, fontWeight: 600, color: "#000", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Reenviar código
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Reenviar em <span style={{ fontWeight: 600, color: "#374151" }}>00:{String(resendTimer).padStart(2, "0")}</span>
              </p>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={!isComplete || loading}
            style={{
              width: "100%", padding: "15px", background: "#000", color: "#fff",
              fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: isComplete && !loading ? "pointer" : "default",
              letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
              opacity: isComplete && !loading ? 1 : 0.4,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.2s",
            }}>
            {loading
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A verificar…</span></>
              : "Verificar e Continuar"
            }
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <p className="text-center text-[13px] text-slate-400 mt-6 leading-relaxed">
            Não recebeu o código? Verifique a sua pasta de spam ou aguarde e reenvie.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
