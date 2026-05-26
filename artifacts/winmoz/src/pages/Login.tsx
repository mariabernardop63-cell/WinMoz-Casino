import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";

function PokerLogo() {
  return (
    <svg viewBox="0 0 230 46" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D"/>
      <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18"/>
      <text
        x="24"
        y="40"
        fontFamily="'Syne', sans-serif"
        fontWeight="800"
        fontSize="40"
        letterSpacing="-1.5"
        fill="#0D0D0D"
      >Poker</text>
      <circle cx="218" cy="11" r="7" stroke="#0D0D0D" strokeWidth="1.8" fill="none"/>
      <text
        x="214.5"
        y="15.5"
        fontFamily="'Syne', sans-serif"
        fontWeight="700"
        fontSize="9"
        fill="#0D0D0D"
      >R</text>
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-[#F5F5F5] w-full flex justify-center items-center">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col px-6 pt-14 pb-10 relative">

        {/* Back button */}
        <button
          onClick={() => setLocation("/")}
          className="absolute top-5 left-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          data-testid="button-back"
          aria-label="Voltar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#0D0D0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-start mb-8"
        >
          <PokerLogo />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-4 flex-1"
        >
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-syne">
              Email
            </label>
            <input
              type="email"
              placeholder="Introduz o teu email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-slate-400 focus:bg-white transition-all placeholder-slate-400"
              data-testid="input-email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-syne">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Introduz a tua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-slate-400 focus:bg-white transition-all placeholder-slate-400"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group" data-testid="label-remember">
              <div
                onClick={() => setRememberMe(v => !v)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  rememberMe
                    ? "bg-blue-700 border-blue-700"
                    : "border-slate-300 bg-white group-hover:border-slate-400"
                }`}
              >
                {rememberMe && (
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-sm text-slate-600 font-medium">Lembrar-me</span>
            </label>
            <button className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors" data-testid="button-forgot">
              Esqueceste a senha?
            </button>
          </div>

          {/* Sign in button */}
          <button
            className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-syne font-bold text-base transition-all duration-200 shadow-lg mt-1"
            data-testid="button-signin"
          >
            Entrar
          </button>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google */}
          <button
            className="w-full py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-3 transition-all duration-200 shadow-sm"
            data-testid="button-google"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-semibold text-slate-700">Continuar com Google</span>
          </button>

          {/* Apple */}
          <button
            className="w-full py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-3 transition-all duration-200 shadow-sm"
            data-testid="button-apple"
          >
            <svg width="17" height="20" viewBox="0 0 17 20" fill="none">
              <path d="M13.837 10.58c-.02-2.02 1.65-2.993 1.724-3.04-0.94-1.374-2.402-1.561-2.92-1.579-1.24-.126-2.43.733-3.06.733-.63 0-1.6-.717-2.633-.697-1.35.02-2.6.786-3.294 1.993-1.41 2.44-.36 6.051.999 8.031.668.959 1.463 2.033 2.507 1.994 1.01-.04 1.39-.648 2.612-.648 1.222 0 1.57.648 2.641.626 1.083-.02 1.77-.973 2.432-1.935.77-1.11 1.085-2.19 1.1-2.247-.024-.01-2.107-.806-2.128-3.231zm-1.989-5.937c.553-.672.927-1.601.826-2.533-.8.033-1.765.534-2.337 1.207-.514.594-.965 1.545-.843 2.455.893.069 1.804-.454 2.354-1.129z" fill="#0D0D0D"/>
            </svg>
            <span className="text-sm font-semibold text-slate-700">Continuar com Apple</span>
          </button>
        </motion.div>

        {/* Sign up link */}
        <p className="text-center text-sm text-slate-500 mt-8">
          Não tens conta?{" "}
          <button className="font-bold text-slate-900 hover:underline" data-testid="button-signup">
            Registar
          </button>
        </p>

      </div>
    </div>
  );
}
