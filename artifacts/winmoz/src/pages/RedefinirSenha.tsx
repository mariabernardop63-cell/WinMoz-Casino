import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, CheckCircle, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

export default function RedefinirSenha() {
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    const timeoutId = setTimeout(() => {
      if (!ready) setInvalidLink(true);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

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

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (password.length < 8) errs.password = "A senha deve ter pelo menos 8 caracteres";
    if (password !== confirm) errs.confirm = "As senhas não coincidem";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrors({ general: "Não foi possível atualizar a senha. O link pode ter expirado." });
      return;
    }

    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      setLocation("/login");
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-16 pb-10 relative">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex justify-center mb-9"
        >
          <PokerLogo />
        </motion.div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.38 }}
              style={{ textAlign: "center", paddingTop: 32 }}
            >
              <div style={{ width: 72, height: 72, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <CheckCircle style={{ width: 32, height: 32, color: "#16a34a" }} />
              </div>
              <h1 className="font-syne font-bold text-[24px] text-[#0a0a0a] mb-3">Senha Atualizada!</h1>
              <p className="text-[13.5px] text-slate-500">A redirecionar para o login…</p>
            </motion.div>
          ) : invalidLink && !ready ? (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
            >
              <div style={{ width: 54, height: 54, background: "#fef2f2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                <KeyRound style={{ width: 24, height: 24, color: "#dc2626" }} />
              </div>
              <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">Link Inválido</h1>
              <p className="text-[13.5px] text-slate-500 mb-8">
                Este link de recuperação expirou ou é inválido. Solicite um novo.
              </p>
              <button
                onClick={() => setLocation("/esqueceu-senha")}
                style={{
                  width: "100%", padding: "15px", background: "#000", color: "#fff",
                  fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
                  cursor: "pointer", letterSpacing: "0.3px", fontFamily: "'Syne', sans-serif",
                }}
              >
                Solicitar Novo Link
              </button>
            </motion.div>
          ) : !ready ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e5e7eb", borderTopColor: "#111", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13.5, color: "#9ca3af" }}>A verificar o link…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
            >
              <div style={{ width: 54, height: 54, background: "#f4f4f5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                <KeyRound style={{ width: 24, height: 24, color: "#111" }} />
              </div>
              <h1 className="font-syne font-bold text-[26px] text-[#0a0a0a] leading-tight mb-2">Nova Palavra-passe</h1>
              <p className="text-[13.5px] text-slate-500 mb-8">
                Escolha uma nova senha segura para a sua conta.
              </p>

              {errors.general && (
                <div className="mb-5 p-3.5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <p style={{ fontSize: 13, color: "#dc2626" }}>{errors.general}</p>
                </div>
              )}

              <div className="mb-4">
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Nova Palavra-passe</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(ev => { const n = { ...ev }; delete n.password; return n; }); }}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    disabled={loading}
                    style={{ ...inputStyle("password"), paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {showPw ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                  </button>
                </div>
                {errors.password && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.password}</p>}
              </div>

              <div className="mb-7">
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Confirmar Palavra-passe</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setErrors(ev => { const n = { ...ev }; delete n.confirm; return n; }); }}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused(null)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    disabled={loading}
                    style={{ ...inputStyle("confirm"), paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {showConfirm ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                  </button>
                </div>
                {errors.confirm && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{errors.confirm}</p>}
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
                  ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /><span>A guardar…</span></>
                  : "Guardar Nova Senha"
                }
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
