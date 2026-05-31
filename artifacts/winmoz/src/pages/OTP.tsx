import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
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
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const otpType = params.get("type") || "signup";

  useEffect(() => {
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const fullCode = code.join("");

  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6) return;
    setVerifying(true);
    setError("");

    const type = otpType === "recovery" ? "recovery" : "signup";

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: codeStr,
      type,
    });

    if (verifyError) {
      setVerifying(false);
      setError("Código inválido ou expirado. Verifica e tenta novamente.");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }

    if (otpType === "signup" && data.session?.user) {
      try {
        const pendingRaw = sessionStorage.getItem("pendingReg");
        const pending = pendingRaw ? JSON.parse(pendingRaw) : {};
        if (pending.full_name || pending.phone || pending.invite_code_used) {
          await fetch("/api/complete-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: data.session.user.id,
              full_name: pending.full_name,
              phone: pending.phone,
              invite_code_used: pending.invite_code_used,
            }),
          });
          sessionStorage.removeItem("pendingReg");
        }
      } catch { /* non-critical */ }
      setLocation("/splash");
    } else if (otpType === "recovery") {
      setLocation("/redefinir-senha");
    } else {
      setLocation("/");
    }
  };

  const handleInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setError("");

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    const filled = next.join("");
    if (filled.length === 6 && !filled.includes("")) {
      handleVerify(filled);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const next = [...code];
        next[idx] = "";
        setCode(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      const next = text.split("");
      setCode(next);
      inputRefs.current[5]?.focus();
      handleVerify(text);
    }
    e.preventDefault();
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setResendSuccess(false);
    setError("");
    setResendTimer(60);
    setCanResend(false);
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);

    if (otpType === "recovery") {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/redefinir-senha",
      });
    } else {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/splash" },
      });
    }
    setResending(false);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 4000);
  };

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

          <div style={{
            width: 56, height: 56, background: "#f4f4f5", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}>
            <ShieldCheck style={{ width: 26, height: 26, color: "#111" }} />
          </div>

          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
            Inserir Código OTP
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-7 leading-relaxed">
            Enviámos um código de 6 dígitos para{" "}
            <span className="font-semibold text-[#111]">{email}</span>.
            Introduz o código abaixo.
          </p>

          {error && (
            <div className="mb-5 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-5 p-3.5" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: 13, color: "#16a34a" }}>Novo código enviado com sucesso!</p>
            </div>
          )}

          {/* OTP boxes */}
          <div className="flex gap-2.5 justify-between mb-8" onPaste={handlePaste}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={el => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleInput(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                disabled={verifying}
                style={{
                  width: 46, height: 56, textAlign: "center",
                  fontSize: 22, fontWeight: 700, color: "#111",
                  border: error ? "2px solid #ef4444" : digit ? "2px solid #000" : "1.5px solid #d1d5db",
                  borderRadius: 10, background: digit ? "#f9fafb" : "#fff",
                  outline: "none", fontFamily: "inherit",
                  transition: "border 0.15s ease, background 0.15s ease",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => handleVerify(fullCode)}
            disabled={verifying || fullCode.length < 6 || fullCode.includes("")}
            style={{
              width: "100%", padding: "15px",
              background: verifying || fullCode.length < 6 ? "#555" : "#000",
              color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: verifying || fullCode.length < 6 ? "default" : "pointer",
              fontFamily: "'Syne', sans-serif", transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 20,
              opacity: fullCode.length < 6 || fullCode.includes("") ? 0.5 : 1,
            }}>
            {verifying
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A verificar…</span></>
              : "Verificar Código"
            }
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <div className="flex items-center justify-center">
            {canResend ? (
              <button onClick={handleResend} disabled={resending}
                style={{
                  fontSize: 13, fontWeight: 600, color: "#000", background: "none",
                  border: "none", cursor: resending ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  opacity: resending ? 0.5 : 1,
                }}>
                <RefreshCw style={{ width: 13, height: 13 }} />
                {resending ? "A enviar…" : "Reenviar código"}
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Reenviar em <span style={{ fontWeight: 600, color: "#374151" }}>00:{String(resendTimer).padStart(2, "0")}</span>
              </p>
            )}
          </div>

          <p className="text-center text-[12px] text-slate-400 mt-6 leading-relaxed">
            Não recebeu o código? Verifique a sua pasta de spam ou aguarde e reenvie.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
