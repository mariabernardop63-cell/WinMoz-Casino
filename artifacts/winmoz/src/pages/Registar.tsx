import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, X, ArrowLeft, ShieldCheck } from "lucide-react";

/* ── Logo ── */
function PokerLogo() {
  return (
    <svg viewBox="0 0 230 46" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D" />
      <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18" />
      <text x="24" y="40" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="40" letterSpacing="-1.5" fill="#0D0D0D">Poker</text>
      <circle cx="218" cy="11" r="7" stroke="#0D0D0D" strokeWidth="1.8" fill="none" />
      <text x="214.5" y="15.5" fontFamily="'Syne', sans-serif" fontWeight="700" fontSize="9" fill="#0D0D0D">R</text>
    </svg>
  );
}

/* ── Social icons ── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
  </svg>
);
const TwitterXIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="#000">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ── Slide variants ── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 55 : -55, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -55 : 55, opacity: 0 }),
};
const slideTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

/* ── Email regex ── */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registar() {
  const [, setLocation] = useLocation();

  /* step state */
  const [step, setStep] = useState(1);
  const [dir, setDir]   = useState(1);

  /* form data */
  const [nome,    setNome]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [invite,  setInvite]  = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [digits,   setDigits]   = useState(["", "", "", "", "", ""]);

  /* ui */
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused,     setFocused]     = useState<string | null>(null);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend,   setCanResend]   = useState(false);

  /* otp refs */
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* resend countdown (only active when step === 3) */
  useEffect(() => {
    if (step !== 3) return;
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer, step]);

  /* ── input style ── */
  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "15px 16px",
    borderRadius: 0,
    border: errors[field]
      ? "1.5px solid #ef4444"
      : focused === field
      ? "1.5px solid #000"
      : "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    color: "#111",
    outline: "none",
    transition: "border 0.15s ease",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  });

  const clearError = (field: string) =>
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });

  /* ── navigation ── */
  const goBack = () => {
    if (step === 1) { setLocation("/"); return; }
    setDir(-1);
    setStep(s => s - 1);
    setErrors({});
  };

  const goNext = () => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (nome.trim().length < 4) errs.nome = "O nome deve ter pelo menos 4 caracteres";
      if (!emailRe.test(email.trim())) errs.email = "Formato de email inválido";
      if (!/^8[2-7]\d{7}$/.test(phone)) errs.phone = "Número inválido. Deve começar com 82–87 e ter 9 dígitos";
      if (!/^[A-Z0-9]{6}$/.test(invite)) errs.invite = "Código inválido. 6 caracteres maiúsculos e/ou dígitos";
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setDir(1); setStep(2); setErrors({});

    } else if (step === 2) {
      if (password.length < 8) errs.password = "A senha deve ter pelo menos 8 caracteres";
      if (confirm !== password) errs.confirm = "As senhas não coincidem";
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setDir(1); setStep(3); setErrors({});

    } else if (step === 3) {
      if (digits.some(d => d === "")) return;
      setLocation("/splash");
    }
  };

  /* ── OTP helpers ── */
  const handleDigit = (i: number, value: string) => {
    const ch = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length) {
      const next = ["", "", "", "", "", ""];
      pasted.split("").forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  const otpComplete = digits.every(d => d !== "");

  /* ── Progress bar ── */
  const progress = ((step - 1) / 2) * 100;

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div
        className="w-full max-w-[430px] min-h-screen bg-white flex flex-col pb-10 relative"
        style={{ overflowX: "hidden" }}
      >
        {/* Back / Close button */}
        <button
          onClick={goBack}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36, zIndex: 10 }}
          aria-label={step === 1 ? "Fechar" : "Voltar"}
        >
          {step === 1
            ? <X style={{ width: 22, height: 22, color: "#111" }} />
            : <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          }
        </button>

        {/* Progress bar */}
        <div className="w-full h-0.5 bg-slate-100 mt-0">
          <motion.div
            className="h-full bg-black"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Inner content */}
        <div className="flex flex-col flex-1 px-6 pt-12">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <PokerLogo />
          </div>

          {/* ── ANIMATED STEP CONTENT ── */}
          <AnimatePresence custom={dir} mode="wait">

            {/* STEP 1 — Nome + Email */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">
                  Criar Conta
                </h1>
                <p className="text-[13.5px] text-slate-500 mb-7">
                  Junte-se a milhares de jogadores em Moçambique.
                </p>

                {/* Nome */}
                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="O seu nome completo"
                    value={nome}
                    onChange={e => { setNome(e.target.value); clearError("nome"); }}
                    onFocus={() => setFocused("nome")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("nome")}
                  />
                  {errors.nome && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.nome}</p>
                  )}
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Endereço de Email
                  </label>
                  <input
                    type="email"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError("email"); }}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("email")}
                  />
                  {errors.email && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Número de Telefone
                  </label>
                  <div style={{ display: "flex", border: errors.phone ? "1.5px solid #ef4444" : focused === "phone" ? "1.5px solid #000" : "1px solid #d1d5db", borderRadius: 0, overflow: "hidden", transition: "border 0.15s ease" }}>
                    <div style={{ padding: "15px 14px", background: "#f9fafb", borderRight: "1px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#374151", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>
                      +258
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="82 000 0000"
                      value={phone}
                      maxLength={9}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 9); setPhone(v); clearError("phone"); }}
                      onFocus={() => setFocused("phone")}
                      onBlur={() => setFocused(null)}
                      style={{ flex: 1, padding: "15px 14px", border: "none", background: "#fff", fontSize: 14, color: "#111", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
                    />
                  </div>
                  {errors.phone && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.phone}</p>
                  )}
                </div>

                {/* Invite code */}
                <div className="mb-7">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Código de Convite <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 11 }}>(6 caracteres)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="EX: WM1234"
                    value={invite}
                    maxLength={6}
                    onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); setInvite(v); clearError("invite"); }}
                    onFocus={() => setFocused("invite")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle("invite"), letterSpacing: "0.18em", fontWeight: 700 }}
                  />
                  {errors.invite && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.invite}</p>
                  )}
                </div>

                {/* Social divider */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, letterSpacing: "1.4px" }}>OU REGISTE-SE COM</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="flex gap-3 mb-8">
                  {[{ icon: <GoogleIcon />, label: "Google" }, { icon: <FacebookIcon />, label: "Facebook" }, { icon: <TwitterXIcon />, label: "X" }].map(({ icon, label }) => (
                    <button key={label} aria-label={label}
                      className="flex-1 flex items-center justify-center hover:bg-slate-50 transition-colors"
                      style={{ height: 50, border: "1px solid #e5e7eb", borderRadius: 0, background: "#fff", cursor: "pointer" }}>
                      {icon}
                    </button>
                  ))}
                </div>

                <p className="text-center text-[13px] text-slate-500">
                  Já tem conta?{" "}
                  <Link href="/login">
                    <button className="font-bold text-[#000] hover:underline text-[13px]">Iniciar Sessão</button>
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP 2 — Senha */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">
                  Defina a sua Senha
                </h1>
                <p className="text-[13.5px] text-slate-500 mb-7">
                  Escolha uma senha forte para proteger a sua conta.
                </p>

                {/* Password */}
                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Palavra-passe
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearError("password"); }}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      style={{ ...inputStyle("password"), paddingRight: 48 }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {showPw ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.password}</p>
                  )}
                </div>

                {/* Confirm */}
                <div className="mb-8">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Confirmar Palavra-passe
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a palavra-passe"
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); clearError("confirm"); }}
                      onFocus={() => setFocused("confirm")}
                      onBlur={() => setFocused(null)}
                      style={{ ...inputStyle("confirm"), paddingRight: 48 }}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {showConfirm ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {errors.confirm && (
                    <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.confirm}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3 — OTP */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                {/* Icon */}
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <ShieldCheck style={{ width: 24, height: 24, color: "#111" }} />
                </div>

                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
                  Verificação Final
                </h1>
                <p className="text-[13.5px] text-slate-500 mb-8 leading-relaxed">
                  Enviámos um código de verificação de 6 dígitos para{" "}
                  <span className="font-semibold text-[#111]">{email}</span>.
                </p>

                {/* OTP grid */}
                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 9, marginBottom: 20, width: "100%" }}
                  onPaste={handlePaste}
                >
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      onFocus={() => setFocused(`otp${i}`)}
                      onBlur={() => setFocused(null)}
                      style={{
                        width: "100%",
                        height: 54,
                        borderRadius: 0,
                        border: focused === `otp${i}` ? "1.5px solid #000" : digit ? "1.5px solid #111" : "1px solid #d1d5db",
                        background: digit ? "#f9f9f9" : "#fff",
                        fontSize: 20,
                        fontWeight: 700,
                        textAlign: "center",
                        color: "#111",
                        outline: "none",
                        transition: "border 0.15s ease",
                        fontFamily: "'Syne', sans-serif",
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                </div>

                {/* Resend */}
                <div className="flex justify-center mb-8">
                  {canResend ? (
                    <button
                      onClick={() => { setResendTimer(60); setCanResend(false); setDigits(["", "", "", "", "", ""]); otpRefs.current[0]?.focus(); }}
                      style={{ fontSize: 13, fontWeight: 600, color: "#000", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Reenviar código
                    </button>
                  ) : (
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>
                      Reenviar em{" "}
                      <span style={{ fontWeight: 600, color: "#374151" }}>00:{String(resendTimer).padStart(2, "0")}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── MAIN BUTTON (always visible) ── */}
          <div className="mt-auto pt-4">
            <button
              onClick={goNext}
              disabled={step === 3 && !otpComplete}
              style={{
                width: "100%",
                padding: "15px",
                background: "#000",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                border: "none",
                borderRadius: 0,
                cursor: (step === 3 && !otpComplete) ? "default" : "pointer",
                letterSpacing: "0.3px",
                fontFamily: "'Syne', sans-serif",
                opacity: (step === 3 && !otpComplete) ? 0.42 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {step === 3 ? "Criar Conta" : "Próximo"}
            </button>

            {/* Step counter */}
            <p className="text-center mt-4" style={{ fontSize: 11.5, color: "#9ca3af" }}>
              Passo {step} de 3
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
