import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, X, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DEMO_EMAIL, DEMO_STORAGE_KEY } from "@/contexts/AuthContext";

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

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 55 : -55, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -55 : 55, opacity: 0 }),
};
const slideTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registar() {
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [invite, setInvite] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step !== 4) return;
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer, step]);

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

  const goBack = () => {
    if (step === 1) { setLocation("/"); return; }
    setDir(-1);
    setStep(s => s - 1);
    setErrors({});
    setGeneralError("");
  };

  const goNext = async () => {
    setGeneralError("");
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (nome.trim().length < 4) errs.nome = "O nome deve ter pelo menos 4 caracteres";
      if (!emailRe.test(email.trim())) errs.email = "Formato de email inválido";
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setDir(1); setStep(2); setErrors({});

    } else if (step === 2) {
      if (!/^8[2-7]\d{7}$/.test(phone)) errs.phone = "Número inválido (ex: 821234567)";
      if (invite && !/^[A-Z0-9]{6}$/.test(invite)) errs.invite = "Código inválido — 6 caracteres maiúsculos";
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setDir(1); setStep(3); setErrors({});

    } else if (step === 3) {
      if (password.length < 8) errs.password = "A senha deve ter pelo menos 8 caracteres";
      if (confirm !== password) errs.confirm = "As senhas não coincidem";
      if (Object.keys(errs).length) { setErrors(errs); return; }

      const isDemoEmail = email.trim().toLowerCase() === DEMO_EMAIL;

      if (isDemoEmail) {
        setDir(1); setStep(4); setErrors({});
        setResendTimer(60);
        setCanResend(false);
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: nome.trim(),
            phone: phone,
            invite_code_used: invite || null,
          },
        },
      });
      setLoading(false);

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          setGeneralError("Este email já está registado. Tente iniciar sessão.");
        } else {
          setGeneralError(error.message);
        }
        return;
      }

      setDir(1); setStep(4); setErrors({});
      setResendTimer(60);
      setCanResend(false);

    } else if (step === 4) {
      if (digits.some(d => d === "")) return;

      const isDemoEmail = email.trim().toLowerCase() === DEMO_EMAIL;

      if (isDemoEmail) {
        localStorage.setItem(DEMO_STORAGE_KEY, "true");
        setLocation("/splash");
        return;
      }

      const token = digits.join("");

      setLoading(true);

      let verifyError: any = null;

      // Try 'signup' type first (used when account was created with signUp())
      const { error: err1 } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "signup",
      });

      if (err1) {
        // Fallback: try 'email' type (used with signInWithOtp)
        const { error: err2 } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token,
          type: "email",
        });
        verifyError = err2;
      }

      setLoading(false);

      if (verifyError) {
        if (verifyError.message?.includes("expired")) {
          setGeneralError("O código expirou. Clica em 'Reenviar código' para receber um novo.");
        } else if (verifyError.message?.includes("invalid") || verifyError.message?.includes("not found")) {
          setGeneralError("Código incorrecto. Verifica o email e introduz os 6 dígitos exactos.");
        } else {
          setGeneralError("Não foi possível verificar o código. Tenta novamente.");
        }
        return;
      }

      setLocation("/splash");
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setDigits(["", "", "", "", "", ""]);
    setGeneralError("");
    await supabase.auth.resend({ email: email.trim().toLowerCase(), type: "signup" });
    otpRefs.current[0]?.focus();
  };

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
  const progress = ((step - 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col pb-10 relative" style={{ overflowX: "hidden" }}>

        <button onClick={goBack}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36, zIndex: 10 }}
          aria-label={step === 1 ? "Fechar" : "Voltar"}>
          {step === 1 ? <X style={{ width: 22, height: 22, color: "#111" }} /> : <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />}
        </button>

        <div className="w-full h-0.5 bg-slate-100 mt-0">
          <motion.div className="h-full bg-black" animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
        </div>

        <div className="flex flex-col flex-1 px-6 pt-12">
          <div className="flex justify-center mb-8"><PokerLogo /></div>

          {generalError && (
            <div className="mb-4 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{generalError}</p>
            </div>
          )}

          <AnimatePresence custom={dir} mode="wait">

            {step === 1 && (
              <motion.div key="step1" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={slideTransition}>
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">Criar Conta</h1>
                <p className="text-[13.5px] text-slate-500 mb-7">Junte-se a milhares de jogadores em Moçambique.</p>

                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Nome Completo</label>
                  <input type="text" placeholder="O seu nome completo" value={nome}
                    onChange={e => { setNome(e.target.value); clearError("nome"); }}
                    onFocus={() => setFocused("nome")} onBlur={() => setFocused(null)}
                    style={inputStyle("nome")} />
                  {errors.nome && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.nome}</p>}
                </div>

                <div className="mb-6">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Endereço de Email</label>
                  <input type="email" placeholder="exemplo@email.com" value={email}
                    onChange={e => { setEmail(e.target.value); clearError("email"); }}
                    onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                    style={inputStyle("email")} />
                  {errors.email && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.email}</p>}
                </div>

              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={slideTransition}>
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">Contacto & Convite</h1>
                <p className="text-[13.5px] text-slate-500 mb-7">Adicione o seu número de telemóvel.</p>

                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Número de Telemóvel</label>
                  <div style={{ display: "flex", border: errors.phone ? "1.5px solid #ef4444" : focused === "phone" ? "1.5px solid #000" : "1px solid #d1d5db", borderRadius: 0, overflow: "hidden", transition: "border 0.15s ease" }}>
                    <div style={{ padding: "15px 14px", background: "#f9fafb", borderRight: "1px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#374151", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>+258</div>
                    <input type="tel" inputMode="numeric" placeholder="82 000 0000" value={phone} maxLength={9}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 9); setPhone(v); clearError("phone"); }}
                      onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)}
                      style={{ flex: 1, padding: "15px 14px", border: "none", background: "#fff", fontSize: 14, color: "#111", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                  </div>
                  {errors.phone && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.phone}</p>}
                </div>

                <div className="mb-7">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                    Código de Convite <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 11 }}>(opcional)</span>
                  </label>
                  <input type="text" placeholder="EX: WM1234" value={invite} maxLength={6}
                    onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); setInvite(v); clearError("invite"); }}
                    onFocus={() => setFocused("invite")} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle("invite"), letterSpacing: "0.18em", fontWeight: 700 }} />
                  {errors.invite && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.invite}</p>}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={slideTransition}>
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">Defina a sua Senha</h1>
                <p className="text-[13.5px] text-slate-500 mb-7">Escolha uma senha forte para proteger a sua conta.</p>

                <div className="mb-4">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Palavra-passe</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPw ? "text" : "password"} placeholder="Mínimo 8 caracteres" value={password}
                      onChange={e => { setPassword(e.target.value); clearError("password"); }}
                      onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle("password"), paddingRight: 48 }} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {showPw ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {errors.password && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.password}</p>}
                </div>

                <div className="mb-8">
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Confirmar Palavra-passe</label>
                  <div style={{ position: "relative" }}>
                    <input type={showConfirm ? "text" : "password"} placeholder="Repita a palavra-passe" value={confirm}
                      onChange={e => { setConfirm(e.target.value); clearError("confirm"); }}
                      onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle("confirm"), paddingRight: 48 }} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {showConfirm ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {errors.confirm && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.confirm}</p>}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={slideTransition}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <ShieldCheck style={{ width: 24, height: 24, color: "#111" }} />
                </div>
                <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">Verificação Final</h1>
                <p className="text-[13.5px] text-slate-500 mb-3 leading-relaxed">
                  Enviámos um email para{" "}
                  <span className="font-semibold text-[#111]">{email}</span>.
                </p>
                <div className="mb-6 p-3.5" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 0 }}>
                  <p style={{ fontSize: 12.5, color: "#15803d", margin: 0, lineHeight: 1.6 }}>
                    📧 Procura no email um <strong>código de 6 dígitos</strong>. Não cliques em nenhum link — introduz apenas o código aqui.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 9, marginBottom: 20, width: "100%" }} onPaste={handlePaste}>
                  {digits.map((digit, i) => (
                    <input key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      onFocus={() => setFocused(`otp${i}`)} onBlur={() => setFocused(null)}
                      style={{
                        width: "100%", height: 54, borderRadius: 0,
                        border: focused === `otp${i}` ? "1.5px solid #000" : digit ? "1.5px solid #111" : "1px solid #d1d5db",
                        background: digit ? "#f9f9f9" : "#fff",
                        fontSize: 20, fontWeight: 700, textAlign: "center", color: "#111",
                        outline: "none", transition: "border 0.15s ease",
                        fontFamily: "'Syne', sans-serif", boxSizing: "border-box",
                      }} />
                  ))}
                </div>

                <div className="flex justify-center mb-8">
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
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-6">
            <button onClick={goNext}
              disabled={(step === 4 && !otpComplete) || loading}
              style={{
                width: "100%", padding: "15px",
                background: (step === 4 && !otpComplete) || loading ? "#555" : "#000",
                color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
                cursor: ((step === 4 && !otpComplete) || loading) ? "default" : "pointer",
                letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
                opacity: (step === 4 && !otpComplete) ? 0.42 : 1,
                transition: "opacity 0.2s, background 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? (
                <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A processar…</span></>
              ) : step === 4 ? "Criar Conta" : "Próximo"}
            </button>
            {step === 1 && (
              <p className="text-center text-[13px] text-slate-500 mt-5">
                Já tem conta?{" "}
                <Link href="/login"><button className="font-bold text-[#000] hover:underline text-[13px]">Iniciar Sessão</button></Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
