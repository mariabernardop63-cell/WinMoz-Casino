import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, User, Check } from "lucide-react";

function getProfile() {
  return {
    name:   localStorage.getItem("winmoz_user_name")  || "SONIA DAUSSE F.",
    email:  localStorage.getItem("winmoz_user_email") || "sonia.dausse@email.com",
    phone:  localStorage.getItem("winmoz_user_phone") || "845678893",
    avatar: localStorage.getItem("winmoz_user_avatar") || "",
  };
}

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function EditarPerfil() {
  const [, setLocation] = useLocation();
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = getProfile();
    setName(p.name); setEmail(p.email); setPhone(p.phone); setAvatar(p.avatar);
  }, []);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setAvatar(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "O nome não pode estar vazio";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Formato de email inválido";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) errs.phone = "O número deve ter pelo menos 9 dígitos";
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem("winmoz_user_name",  name.trim());
      localStorage.setItem("winmoz_user_email", email.trim());
      localStorage.setItem("winmoz_user_phone", phone.replace(/\D/g, ""));
      if (avatar) localStorage.setItem("winmoz_user_avatar", avatar);
      else localStorage.removeItem("winmoz_user_avatar");
      setSaving(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setLocation("/perfil"); }, 1200);
    }, 1400);
  };

  const inputBase: React.CSSProperties = {
    width: "100%", padding: "14px 16px", fontSize: 14, color: "#111",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    background: "#fff", transition: "border 0.15s ease", borderRadius: 0,
  };
  const inputStyle = (field: string): React.CSSProperties => ({
    ...inputBase,
    border: errors[field]
      ? "1.5px solid #ef4444"
      : focused === field ? "1.5px solid #000" : "1px solid #d1d5db",
  });

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col relative">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/perfil")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#0a0a0a] leading-tight">Editar Perfil</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Actualiza as tuas informações pessoais</p>
          </div>
        </div>

        <div className="flex-1 px-6 py-6 overflow-y-auto pb-32">
          {/* Avatar */}
          <motion.div className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-2 border-slate-200"
                style={{ background: "#f1f5f9" }}>
                {avatar
                  ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  : <User style={{ width: 40, height: 40, color: "#94a3b8" }} />
                }
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                style={{ background: "#000", border: "2.5px solid #fff" }}>
                <Camera style={{ width: 16, height: 16, color: "#fff" }} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="mt-3 text-[13px] font-semibold text-[#000] hover:underline">
              Alterar foto de perfil
            </button>
            {avatar && (
              <button onClick={() => setAvatar("")}
                className="mt-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors">
                Remover foto
              </button>
            )}
          </motion.div>

          {/* Fields */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.38 }}>
            {/* Name */}
            <div className="mb-5">
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, letterSpacing: "0.3px" }}>
                NOME COMPLETO
              </label>
              <input type="text" value={name} placeholder="O teu nome completo"
                onChange={e => { setName(e.target.value); setErrors(p => { const n = {...p}; delete n.name; return n; }); }}
                onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                style={inputStyle("name")} />
              {errors.name && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="mb-5">
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, letterSpacing: "0.3px" }}>
                ENDEREÇO DE EMAIL
              </label>
              <input type="email" value={email} placeholder="exemplo@email.com"
                onChange={e => { setEmail(e.target.value); setErrors(p => { const n = {...p}; delete n.email; return n; }); }}
                onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                style={inputStyle("email")} />
              {errors.email && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="mb-8">
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, letterSpacing: "0.3px" }}>
                NÚMERO DE TELEMÓVEL
              </label>
              <div className="flex" style={{ border: errors.phone ? "1.5px solid #ef4444" : focused === "phone" ? "1.5px solid #000" : "1px solid #d1d5db" }}>
                <div className="flex items-center gap-1.5 px-3 border-r border-slate-200 flex-shrink-0 bg-slate-50">
                  <span className="text-base">🇲🇿</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111", fontFamily: "system-ui" }}>+258</span>
                </div>
                <input type="tel" value={formatPhone(phone)} placeholder="84 123 4567"
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 9)); setErrors(p => { const n = {...p}; delete n.phone; return n; }); }}
                  onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)}
                  style={{ ...inputBase, flex: 1, border: "none", background: "#fff" }} />
              </div>
              {errors.phone && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.phone}</p>}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 mb-6" />

            {/* Info notice */}
            <div className="p-4 mb-6" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                As alterações ao perfil são aplicadas imediatamente em toda a aplicação. O teu email é usado para recuperar a conta.
              </p>
            </div>

            {/* Save button */}
            <motion.button onClick={handleSave} disabled={saving || saved}
              whileTap={!saving && !saved ? { scale: 0.98 } : {}}
              style={{
                width: "100%", padding: "15px", fontSize: 14.5, fontWeight: 700, border: "none",
                cursor: saving || saved ? "default" : "pointer", letterSpacing: "0.3px",
                fontFamily: "'Syne', sans-serif", borderRadius: 0,
                background: saved ? "#22c55e" : "#000", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "background 0.3s ease",
              }}>
              {saving ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>A guardar…</span></>
              ) : saved ? (
                <><Check style={{ width: 18, height: 18 }} /><span>Guardado!</span></>
              ) : "Guardar Alterações"}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
