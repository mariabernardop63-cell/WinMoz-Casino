import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";

function PokerLogo() {
  return (
    <svg viewBox="0 0 230 46" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D"/>
      <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18"/>
      <text x="24" y="40" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="40" letterSpacing="-1.5" fill="#0D0D0D">Poker</text>
      <circle cx="218" cy="11" r="7" stroke="#0D0D0D" strokeWidth="1.8" fill="none"/>
      <text x="214.5" y="15.5" fontFamily="'Syne', sans-serif" fontWeight="700" fontSize="9" fill="#0D0D0D">R</text>
    </svg>
  );
}

export default function OTP() {
  const [, setLocation] = useLocation();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [focused, setFocused] = useState<number | null>(null);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = new URLSearchParams(window.location.search).get("email") || "o seu email";

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

  const handleResend = () => {
    if (!canResend) return;
    setResendTimer(60);
    setCanResend(false);
    setDigits(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const isComplete = digits.every(d => d !== "");

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative">

        {/* Back button */}
        <button
          onClick={() => setLocation("/esqueceu-senha")}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36 }}
          aria-label="Voltar"
        >
          <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
        </button>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex justify-center mb-9"
        >
          <PokerLogo />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08 }}
          className="flex flex-col"
        >
          {/* Icon */}
          <div
            style={{
              width: 60, height: 60,
              background: "#f4f4f5",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 24, alignSelf: "flex-start",
            }}
          >
            <ShieldCheck style={{ width: 26, height: 26, color: "#111" }} />
          </div>

          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
            Verificação de Código
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-8 leading-relaxed">
            Introduza o código de 6 dígitos que enviámos para{" "}
            <span className="font-semibold text-[#111]">{email}</span>.
          </p>

          {/* OTP boxes */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24, width: "100%" }}
            onPaste={handlePaste}
          >
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
                style={{
                  width: "100%",
                  height: 58,
                  borderRadius: 0,
                  border: focused === i
                    ? "1.5px solid #000"
                    : digit
                    ? "1.5px solid #111"
                    : "1px solid #d1d5db",
                  background: digit ? "#f9f9f9" : "#fff",
                  fontSize: 22,
                  fontWeight: 700,
                  textAlign: "center",
                  color: "#111",
                  outline: "none",
                  transition: "border 0.15s ease, background 0.15s ease",
                  fontFamily: "'Syne', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>

          {/* Resend */}
          <div className="flex items-center justify-center mb-8">
            {canResend ? (
              <button
                onClick={handleResend}
                style={{ fontSize: 13, fontWeight: 600, color: "#000", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Reenviar código
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Reenviar código em{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>00:{String(resendTimer).padStart(2, "0")}</span>
              </p>
            )}
          </div>

          {/* Verify button */}
          <button
            style={{
              width: "100%", padding: "15px", background: "#000", color: "#fff",
              fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: isComplete ? "pointer" : "default",
              letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
              transition: "opacity 0.2s",
              opacity: isComplete ? 1 : 0.4,
            }}
            disabled={!isComplete}
            onMouseEnter={e => { if (isComplete) e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={e => { if (isComplete) e.currentTarget.style.opacity = "1"; }}
          >
            Verificar e Continuar
          </button>

          {/* Help */}
          <p className="text-center text-[13px] text-slate-400 mt-6 leading-relaxed">
            Não recebeu o código? Verifique a sua pasta de spam ou{" "}
            <Link href="/esqueceu-senha">
              <button className="text-[#000] font-semibold hover:underline text-[13px]">
                tente com outro email
              </button>
            </Link>.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
