import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, X } from "lucide-react";

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

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
  </svg>
);

const TwitterXIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#000000">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function Registar() {
  const [, setLocation] = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "15px 16px",
    borderRadius: 0,
    border: focused === field ? "1.5px solid #000" : "1px solid #d1d5db",
    background: "#ffffff",
    fontSize: 14,
    color: "#111",
    outline: "none",
    transition: "border 0.15s ease",
    fontFamily: "inherit",
    boxSizing: "border-box",
  });

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative overflow-y-auto">

        {/* Close / Back button */}
        <button
          onClick={() => setLocation("/")}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36 }}
          aria-label="Fechar"
        >
          <X style={{ width: 22, height: 22, color: "#111" }} />
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
        >
          <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-1">
            Criar Conta
          </h1>
          <p className="text-[13.5px] text-slate-500 mb-7">
            Junte-se a milhares de jogadores em Moçambique.
          </p>

          {/* Nome completo */}
          <div className="mb-4">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7, letterSpacing: "0.2px" }}>
              Nome Completo
            </label>
            <input
              type="text"
              placeholder="O seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onFocus={() => setFocused("nome")}
              onBlur={() => setFocused(null)}
              style={inputStyle("nome")}
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7, letterSpacing: "0.2px" }}>
              Endereço de Email
            </label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7, letterSpacing: "0.2px" }}>
              Palavra-passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                style={{ ...inputStyle("password"), paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                {showPw ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="mb-7">
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7, letterSpacing: "0.2px" }}>
              Confirmar Palavra-passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Repita a palavra-passe"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                style={{ ...inputStyle("confirm"), paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                {showConfirm ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
              </button>
            </div>
          </div>

          {/* Register button */}
          <button
            style={{
              width: "100%", padding: "15px", background: "#000", color: "#fff",
              fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: "pointer", letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Criar Conta
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 500, letterSpacing: "1.5px" }}>OU REGISTE-SE COM</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Social buttons */}
          <div className="flex gap-3">
            {[
              { icon: <GoogleIcon />, label: "Google" },
              { icon: <FacebookIcon />, label: "Facebook" },
              { icon: <TwitterXIcon />, label: "X" },
            ].map(({ icon, label }) => (
              <button
                key={label}
                aria-label={label}
                className="flex-1 flex items-center justify-center transition-colors hover:bg-slate-50"
                style={{
                  height: 52, border: "1px solid #e5e7eb", borderRadius: 0,
                  background: "#ffffff", cursor: "pointer",
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Login link */}
          <p className="text-center text-[13px] text-slate-500 mt-8">
            Já tem conta?{" "}
            <Link href="/login">
              <button className="font-bold text-[#000] hover:underline text-[13px]">
                Iniciar Sessão
              </button>
            </Link>
          </p>
        </motion.div>

      </div>
    </div>
  );
}
