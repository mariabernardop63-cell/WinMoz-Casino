import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MailCheck, Loader2, RefreshCw } from "lucide-react";
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
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const otpType = params.get("type") || "signup";

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Listen for auth state change — fires when user clicks the magic link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
          if (otpType === "signup") {
            try {
              const pendingRaw = sessionStorage.getItem("pendingReg");
              const pending = pendingRaw ? JSON.parse(pendingRaw) : {};
              if (pending.full_name || pending.phone || pending.invite_code_used) {
                await fetch("/api/complete-registration", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: session.user.id,
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
            setLocation("/splash");
          } else if (otpType === "recovery") {
            setLocation("/redefinir-senha");
          } else {
            setLocation("/");
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpType]);

  // Manual "already clicked the link" check
  const handleCheckSession = async () => {
    setChecking(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (otpType === "signup") {
        try {
          const pendingRaw = sessionStorage.getItem("pendingReg");
          const pending = pendingRaw ? JSON.parse(pendingRaw) : {};
          if (pending.full_name || pending.phone || pending.invite_code_used) {
            await fetch("/api/complete-registration", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: session.user.id,
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
    } else {
      setChecking(false);
      setError("Link ainda não verificado. Por favor, clique no link enviado para o seu email.");
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setResendSuccess(false);
    setError("");
    setResendTimer(60);
    setCanResend(false);

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

          {/* Icon */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 64, height: 64, background: "#f4f4f5", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 24, alignSelf: "flex-start",
            }}>
            <MailCheck style={{ width: 28, height: 28, color: "#111" }} />
          </motion.div>

          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
            Verifique o seu Email
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-8 leading-relaxed">
            Enviámos um link de verificação para{" "}
            <span className="font-semibold text-[#111]">{email}</span>.
            Abra o seu email e clique no link para continuar.
          </p>

          {error && (
            <div className="mb-5 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-5 p-3.5" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: 13, color: "#16a34a" }}>Novo link enviado com sucesso!</p>
            </div>
          )}

          {/* Steps */}
          <div className="mb-8" style={{ background: "#f9fafb", borderRadius: 0, padding: "16px 18px", border: "1px solid #e5e7eb" }}>
            {[
              "Abra a aplicação de email no seu telemóvel ou computador",
              "Procure o email da WinMoz",
              "Clique no botão «Verificar Email»",
              "Será redirecionado automaticamente",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 3 ? 12 : 0, alignItems: "flex-start" }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#000",
                  color: "#fff", fontSize: 11, fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <button onClick={handleCheckSession} disabled={checking}
            style={{
              width: "100%", padding: "15px", background: checking ? "#555" : "#000",
              color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: checking ? "default" : "pointer", letterSpacing: "0.3px",
              fontFamily: "'Syne', sans-serif", transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 16,
            }}>
            {checking
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A verificar…</span></>
              : "Já cliquei no Link"
            }
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {/* Resend */}
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
                {resending ? "A enviar…" : "Reenviar link"}
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Reenviar em <span style={{ fontWeight: 600, color: "#374151" }}>00:{String(resendTimer).padStart(2, "0")}</span>
              </p>
            )}
          </div>

          <p className="text-center text-[12px] text-slate-400 mt-6 leading-relaxed">
            Não recebeu o email? Verifique a sua pasta de spam ou aguarde e reenvie.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
