import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, CheckCircle, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";

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

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EsqueceuSenha() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!emailRe.test(email.trim())) {
      setError("Introduza um endereço de email válido");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
    } catch {
    }

    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative">

        <button
          onClick={() => setLocation("/login")}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
        </button>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex justify-center mb-9"
        >
          <PokerLogo />
        </motion.div>

        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.38, delay: 0.08 }}
            >
              <div style={{ width: 54, height: 54, background: "#f4f4f5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                <Mail style={{ width: 24, height: 24, color: "#111" }} />
              </div>

              <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
                Recuperar Acesso
              </h1>
              <p className="text-[13.5px] text-slate-500 mb-8 leading-relaxed">
                Introduza o seu email e enviaremos um link para repor a palavra-passe.
              </p>

              <div className="mb-7">
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                  Endereço de Email
                </label>
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "15px 16px",
                    borderRadius: 0,
                    border: error ? "1.5px solid #ef4444" : focused ? "1.5px solid #000" : "1px solid #d1d5db",
                    background: "#fff",
                    fontSize: 14,
                    color: "#111",
                    outline: "none",
                    transition: "border 0.15s ease",
                    fontFamily: "inherit",
                    boxSizing: "border-box" as const,
                  }}
                />
                {error && (
                  <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{error}</p>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: "100%", padding: "15px", background: loading ? "#555" : "#000", color: "#fff",
                  fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
                  cursor: loading ? "default" : "pointer", letterSpacing: "0.3px",
                  fontFamily: "'Syne', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.2s",
                }}
              >
                {loading
                  ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A enviar…</span></>
                  : "Enviar Link de Recuperação"
                }
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

              <p className="text-center text-[13px] text-slate-500 mt-8">
                Lembrou-se da palavra-passe?{" "}
                <Link href="/login">
                  <button className="font-bold text-[#000] hover:underline text-[13px]">Iniciar Sessão</button>
                </Link>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
            >
              <div style={{ width: 64, height: 64, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <CheckCircle style={{ width: 28, height: 28, color: "#16a34a" }} />
              </div>

              <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">
                Email Enviado!
              </h1>
              <p className="text-[13.5px] text-slate-500 mb-2 leading-relaxed">
                Enviámos um link de recuperação para:
              </p>
              <p className="font-semibold text-[14px] text-[#111] mb-6">{email.trim().toLowerCase()}</p>
              <p className="text-[13px] text-slate-400 leading-relaxed mb-8">
                Verifique a sua caixa de entrada (e a pasta de spam). Clique no link do email para redefinir a sua palavra-passe.
              </p>

              <button
                onClick={() => { setSent(false); setEmail(""); }}
                style={{
                  width: "100%", padding: "15px", background: "#f4f4f5", color: "#111",
                  fontSize: 14, fontWeight: 600, border: "none", borderRadius: 0,
                  cursor: "pointer", letterSpacing: "0.2px", fontFamily: "'Syne', sans-serif",
                  marginBottom: 12,
                }}
              >
                Tentar outro email
              </button>

              <button
                onClick={() => setLocation("/login")}
                style={{
                  width: "100%", padding: "15px", background: "#000", color: "#fff",
                  fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
                  cursor: "pointer", letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
                }}
              >
                Voltar ao Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
