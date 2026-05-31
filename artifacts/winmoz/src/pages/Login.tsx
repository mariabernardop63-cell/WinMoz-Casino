import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuth, DEMO_EMAIL, DEMO_STORAGE_KEY } from "@/contexts/AuthContext";

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

export default function Login() {
  const [, setLocation] = useLocation();
  const { forceRefresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const clearErr = (f: keyof typeof errors) =>
    setErrors(e => { const n = { ...e }; delete n[f]; return n; });

  const handleSubmit = async () => {
    const errs: typeof errors = {};
    if (!emailRe.test(email.trim())) errs.email = "Formato de email inválido";
    if (password.length < 6) errs.password = "Palavra-passe demasiado curta";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});

    const isDemoEmail = email.trim().toLowerCase() === DEMO_EMAIL;

    if (isDemoEmail) {
      localStorage.setItem(DEMO_STORAGE_KEY, "true");
      await forceRefresh();
      setLoading(false);
      setLocation("/");
      return;
    }

    try {
      await authApi.login(email.trim().toLowerCase(), password);
      await forceRefresh();
      setLoading(false);
      setLocation("/");
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message ?? "";
      if (msg.includes("incorretos") || msg.includes("credentials")) {
        setErrors({ general: "Email ou palavra-passe incorretos." });
      } else {
        setErrors({ general: msg || "Erro ao iniciar sessão." });
      }
    }
  };

  const inputStyle = (field: "email" | "password"): React.CSSProperties => ({
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

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative">

        <button
          onClick={() => setLocation("/")}
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08 }}
        >
          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">
            Iniciar Sessão
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-7">
            Bem-vindo de volta. Introduza os seus dados.
          </p>

          {errors.general && (
            <div className="mb-5 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 13, color: "#dc2626" }}>{errors.general}</p>
            </div>
          )}

          <div className="mb-4">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
              Endereço de Email
            </label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearErr("email"); }}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
              disabled={loading}
            />
            {errors.email && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.email}</p>}
          </div>

          <div className="mb-3">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
              Palavra-passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="A sua palavra-passe"
                value={password}
                onChange={e => { setPassword(e.target.value); clearErr("password"); }}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{ ...inputStyle("password"), paddingRight: 48 }}
                disabled={loading}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                {showPassword ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
              </button>
            </div>
            {errors.password && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.password}</p>}
          </div>

          <div className="flex justify-end mb-6">
            <Link href="/esqueceu-senha">
              <button className="text-[12.5px] font-semibold text-[#111] hover:underline">
                Esqueceu a palavra-passe?
              </button>
            </Link>
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
            {loading ? (
              <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A entrar…</span></>
            ) : "Iniciar Sessão"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 500, letterSpacing: "1.5px" }}>OU</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        </motion.div>

        <p className="text-center text-[13px] text-slate-500 mt-4">
          Não tem conta?{" "}
          <Link href="/registar">
            <button className="font-bold text-[#000] hover:underline text-[13px]">Registar-se</button>
          </Link>
        </p>
      </div>
    </div>
  );
}
