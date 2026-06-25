import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Bell, Moon, Globe, Volume2, CreditCard,
  ChevronRight, Info, LogOut, Lock, TrendingDown, Plus,
  Trash2, Check, X, Smartphone, Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings, Language, Currency, PaymentMethod } from "@/contexts/AppSettingsContext";
import { supabase } from "@/lib/supabase";

/* ── Toggle ── */
function Toggle({ value, onChange, locked }: { value: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <button
      onClick={() => !locked && onChange?.(!value)}
      style={{ width: 46, height: 26, borderRadius: 13, background: value ? "#000" : "#d1d5db",
        border: "none", cursor: locked ? "default" : "pointer", flexShrink: 0, position: "relative", transition: "background 0.2s" }}>
      <motion.div animate={{ x: value ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

/* ── Row ── */
function Row({ icon: Icon, label, desc, value, onChange, onPress, badge, locked }: any) {
  const isToggle = onChange !== undefined || locked;
  const Tag = (isToggle || locked) ? "div" : "button" as any;
  return (
    <Tag onClick={(!isToggle && !locked && onPress) ? onPress : (isToggle && !locked ? () => onChange?.(!value) : undefined)}
      className="flex items-center gap-3.5 py-4 w-full text-left border-b border-slate-100 last:border-0 transition-colors cursor-pointer"
      style={{ background: "none", ...((!isToggle && !locked && onPress) ? {} : {}) }}>
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
        <Icon style={{ width: 16, height: 16, color: "#374151" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111" }}>{label}</p>
          {locked && <Lock style={{ width: 11, height: 11, color: "#9ca3af" }} />}
        </div>
        {desc && <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1, lineHeight: 1.4 }}>{desc}</p>}
      </div>
      {isToggle
        ? <Toggle value={value} onChange={onChange} locked={locked} />
        : badge
        ? <span className="text-xs font-semibold px-2.5 py-1" style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e5e7eb" }}>{badge}</span>
        : <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db" }} />
      }
    </Tag>
  );
}

const LANGUAGES: Language[] = ["Português", "English", "Français", "Español"];
const CURRENCIES: { code: Currency; label: string; flag: string }[] = [
  { code: "MZN", label: "Metical Moçambicano", flag: "🇲🇿" },
  { code: "USD", label: "Dólar Americano",      flag: "🇺🇸" },
  { code: "EUR", label: "Euro",                  flag: "🇪🇺" },
  { code: "ZAR", label: "Rand Sul-africano",     flag: "🇿🇦" },
  { code: "BRL", label: "Real Brasileiro",       flag: "🇧🇷" },
];

/* ── Sheet wrapper ── */
function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <motion.div className="w-full max-w-[430px] bg-white"
        style={{ maxHeight: "90vh", overflowY: "auto", borderTop: "1px solid #e5e7eb" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#0a0a0a" }}>{title}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb", background: "none", cursor: "pointer" }}>
            <X style={{ width: 16, height: 16, color: "#374151" }} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function Definicoes() {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const {
    darkMode, setDarkMode,
    language, setLanguage,
    currency, setCurrency, exchangeRates, convertAmount,
    paymentMethods, addPaymentMethod, removePaymentMethod, setDefaultPaymentMethod,
    bettingLimits, setBettingLimits,
    t,
  } = useAppSettings();

  /* App version */
  const [appVersion, setAppVersion] = useState("1.0.0");
  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "app_version").maybeSingle()
      .then(({ data }) => { if (data?.value) setAppVersion(data.value); }, () => {});
  }, []);

  /* Modals */
  const [langModal,     setLangModal]     = useState(false);
  const [currModal,     setCurrModal]     = useState(false);
  const [paymModal,     setPaymModal]     = useState(false);
  const [limModal,      setLimModal]      = useState(false);

  /* Add phone form */
  const [newPhone, setNewPhone]       = useState("");
  const [newLabel, setNewLabel]       = useState("");
  const [phoneErr, setPhoneErr]       = useState("");

  /* Betting limit form */
  const [limEnabled, setLimEnabled]   = useState(bettingLimits.enabled);
  const [limAmount,  setLimAmount]    = useState(String(bettingLimits.dailyLimit));

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  function handleAddPhone() {
    const clean = newPhone.replace(/\D/g, "");
    if (clean.length < 9) { setPhoneErr("Número inválido"); return; }
    if (!newLabel.trim()) { setPhoneErr("Escreve um nome para este número"); return; }
    const ok = addPaymentMethod(clean, newLabel.trim());
    if (!ok) { setPhoneErr("Máximo de 3 métodos atingido"); return; }
    setNewPhone(""); setNewLabel(""); setPhoneErr("");
  }

  function handleSaveLimits() {
    const amt = parseFloat(limAmount);
    if (isNaN(amt) || amt < 50) { return; }
    setBettingLimits({ enabled: limEnabled, dailyLimit: amt });
    setLimModal(false);
  }

  /* Rate display */
  const rateStr = currency !== "MZN"
    ? `1 MT = ${CURRENCIES.find(c => c.code === currency)?.flag ?? ""} ${exchangeRates[currency].toFixed(4)} ${currency}`
    : "";

  const sampleConvert = convertAmount(100);

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-12 pb-6 border-b border-slate-100">
          <button onClick={() => setLocation("/perfil")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ borderRadius: 0 }}>
            <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
          </button>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#0a0a0a" }}>
              {t("Definições", "Settings", "Paramètres", "Ajustes")}
            </h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              {t("Personaliza a tua experiência", "Personalise your experience", "Personnalisez votre expérience", "Personaliza tu experiencia")}
            </p>
          </div>
        </div>

        <div className="flex-1 px-5 py-5 pb-28 overflow-y-auto">

          {/* ── Notificações ── */}
          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
              {t("NOTIFICAÇÕES", "NOTIFICATIONS", "NOTIFICATIONS", "NOTIFICACIONES")}
            </p>
            <div style={{ border: "1px solid #e5e7eb" }}>
              <Row icon={Bell}    label={t("Depósitos e Levantamentos", "Deposits & Withdrawals")} desc={t("Alertas de movimentos na conta", "Account movement alerts")}  value={true}  locked />
              <Row icon={Bell}    label={t("Apostas e Resultados", "Bets & Results")}               desc={t("Notificações de partidas", "Match notifications")}            value={true}  locked />
              <Row icon={Bell}    label={t("Promoções", "Promotions", "Promotions", "Promociones")}  desc={t("Bónus e ofertas especiais", "Bonuses and special offers")}   value={true}  locked />
              <Row icon={Volume2} label={t("Sons", "Sounds", "Sons", "Sonidos")}                     desc={t("Toques de notificação", "Notification sounds")}              value={true}  locked />
            </div>
            <p style={{ fontSize: 10.5, color: "#d1d5db", marginTop: 6, paddingLeft: 2 }}>
              <Lock style={{ width: 9, height: 9, display: "inline", marginRight: 3 }} />
              {t("Notificações essenciais — não podem ser desativadas", "Essential notifications — cannot be disabled")}
            </p>
          </motion.div>

          {/* ── Aparência ── */}
          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
              {t("APARÊNCIA E IDIOMA", "APPEARANCE & LANGUAGE")}
            </p>
            <div style={{ border: "1px solid #e5e7eb" }}>
              <Row icon={Moon}  label={t("Modo escuro", "Dark mode", "Mode sombre", "Modo oscuro")} desc={t("Interface com fundo escuro", "Dark background interface")} value={false} locked />
              <Row icon={Globe} label={t("Idioma", "Language", "Langue", "Idioma")}                 desc={t("Língua da aplicação", "App language")} onPress={() => setLangModal(true)} badge={language.split(" ")[0]} />
            </div>
          </motion.div>

          {/* ── Conta e Pagamento ── */}
          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
              {t("CONTA E PAGAMENTO", "ACCOUNT & PAYMENT")}
            </p>
            <div style={{ border: "1px solid #e5e7eb" }}>
              <Row icon={CreditCard}  label={t("Moeda", "Currency")}                desc={t("Metical Moçambicano (MT)", "Mozambican Metical (MT)")}   badge="MZN" locked />
              <Row icon={Smartphone}  label={t("Métodos de pagamento", "Payment methods")} desc={`${paymentMethods.length}/3 ${t("números configurados", "numbers set up")}`} onPress={() => setPaymModal(true)} />
              <Row icon={TrendingDown} label={t("Limite de apostas", "Betting limit")} desc={bettingLimits.enabled ? `${bettingLimits.dailyLimit} MT/dia — ${bettingLimits.todaySpent} MT ${t("gastos", "spent")}` : t("Sem limite definido", "No limit set")} onPress={() => setLimModal(true)} />
            </div>
          </motion.div>

          {/* ── Aplicação ── */}
          <motion.div className="mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", marginBottom: 8 }}>
              {t("APLICAÇÃO", "APPLICATION")}
            </p>
            <div style={{ border: "1px solid #e5e7eb" }}>
              <Row icon={Info}    label={t("Versão", "Version")}                     desc={`WinMoz v${appVersion}`}                                   onPress={() => {}} badge={appVersion} />
              <Row icon={Info}    label={t("Termos de serviço", "Terms of Service")} desc={t("Lê os nossos termos", "Read our terms")}                 onPress={() => setLocation("/termos")} />
              <Row icon={Info}    label={t("Política de privacidade", "Privacy Policy")} desc={t("Sabe como usamos os teus dados", "See how we use your data")} onPress={() => setLocation("/politica-privacidade")} />
              <Row icon={Star}    label={t("Programa de afiliados", "Affiliate program")} desc={t("Ganha referindo amigos", "Earn by referring friends")} onPress={() => setLocation("/afiliados")} />
              <Row icon={LogOut}  label={t("Terminar sessão", "Sign out")}            desc={t("Sair da conta actual", "Sign out of current account")}    onPress={handleSignOut} />
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── Language Modal ── */}
      <AnimatePresence>
        {langModal && (
          <Sheet onClose={() => setLangModal(false)} title={t("Seleccionar Idioma", "Select Language", "Sélectionner la langue", "Seleccionar Idioma")}>
            {LANGUAGES.map(l => (
              <button key={l} onClick={() => { setLanguage(l); setLangModal(false); }}
                className="flex items-center justify-between w-full px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                style={{ background: "none" }}>
                <span style={{ fontSize: 14, color: "#111", fontWeight: language === l ? 700 : 400 }}>{l}</span>
                {language === l && <Check style={{ width: 15, height: 15, color: "#111" }} />}
              </button>
            ))}
            <div className="h-6" />
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── Currency Modal ── */}
      <AnimatePresence>
        {currModal && (
          <Sheet onClose={() => setCurrModal(false)} title={t("Seleccionar Moeda", "Select Currency")}>
            <div className="px-4 py-3 border-b border-slate-50" style={{ background: "#f8fafc" }}>
              <p style={{ fontSize: 11.5, color: "#6b7280" }}>
                {t("Taxas actualizadas automaticamente. Conversão indicativa.", "Rates auto-updated. Indicative conversion.")}
              </p>
              {currency !== "MZN" && (
                <p style={{ fontSize: 12, color: "#374151", marginTop: 4, fontWeight: 600 }}>
                  100 MT = {sampleConvert.formatted}
                </p>
              )}
            </div>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => { setCurrency(c.code); setCurrModal(false); }}
                className="flex items-center justify-between w-full px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                style={{ background: "none" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <div>
                    <p style={{ fontSize: 13.5, color: "#111", fontWeight: currency === c.code ? 700 : 400 }}>{c.code}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>{c.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.code !== "MZN" && (
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {exchangeRates[c.code].toFixed(4)}
                    </span>
                  )}
                  {currency === c.code && <Check style={{ width: 15, height: 15, color: "#111" }} />}
                </div>
              </button>
            ))}
            <div className="h-6" />
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── Payment Methods Modal ── */}
      <AnimatePresence>
        {paymModal && (
          <Sheet onClose={() => { setPaymModal(false); setNewPhone(""); setNewLabel(""); setPhoneErr(""); }} title={t("Métodos de Pagamento", "Payment Methods")}>
            <div className="px-5 py-4">
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                {t("Adiciona até 3 números de e-Mola ou M-Pesa para pagamentos rápidos.", "Add up to 3 e-Mola or M-Pesa numbers for quick payments.")}
              </p>

              {paymentMethods.length === 0 && (
                <div style={{ padding: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", textAlign: "center", marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#9ca3af" }}>{t("Nenhum método adicionado ainda", "No methods added yet")}</p>
                </div>
              )}

              {paymentMethods.map((pm: PaymentMethod) => (
                <div key={pm.id} className="flex items-center gap-3 py-3 border-b border-slate-100">
                  <div style={{ width: 36, height: 36, border: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Smartphone style={{ width: 16, height: 16, color: "#374151" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{pm.label}</p>
                    <p style={{ fontSize: 11.5, color: "#9ca3af" }}>{pm.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pm.isDefault
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: "#111", background: "#f0fdf4", border: "1px solid #86efac", padding: "2px 8px" }}>{t("PADRÃO", "DEFAULT")}</span>
                      : <button onClick={() => setDefaultPaymentMethod(pm.id)} style={{ fontSize: 10, color: "#6b7280", border: "1px solid #e5e7eb", padding: "2px 8px", background: "none", cursor: "pointer" }}>{t("Tornar padrão", "Set default")}</button>
                    }
                    <button onClick={() => removePaymentMethod(pm.id)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #fee2e2", background: "none", cursor: "pointer" }}>
                      <Trash2 style={{ width: 13, height: 13, color: "#ef4444" }} />
                    </button>
                  </div>
                </div>
              ))}

              {paymentMethods.length < 3 && (
                <div className="mt-4" style={{ border: "1px solid #e5e7eb", padding: "14px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 10 }}>{t("Adicionar número", "Add number")}</p>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={t("Nome (ex: e-Mola Principal)", "Name (e.g. Primary e-Mola)")}
                    style={{ width: "100%", height: 42, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box", borderRadius: 0 }} />
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder={t("Número de telefone", "Phone number")} type="tel" inputMode="numeric"
                    style={{ width: "100%", height: 42, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box", borderRadius: 0 }} />
                  {phoneErr && <p style={{ fontSize: 11.5, color: "#ef4444", marginBottom: 8 }}>{phoneErr}</p>}
                  <button onClick={handleAddPhone} style={{ width: "100%", height: 42, background: "#000", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Plus style={{ width: 15, height: 15 }} /> {t("Adicionar", "Add")}
                  </button>
                </div>
              )}
            </div>
            <div className="h-6" />
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── Betting Limits Modal ── */}
      <AnimatePresence>
        {limModal && (
          <Sheet onClose={() => setLimModal(false)} title={t("Limite de Apostas", "Betting Limit")}>
            <div className="px-5 py-4">
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                  {t("Define um limite de gastos diário para controlar as tuas apostas. O limite reinicia à meia-noite.", "Set a daily spending limit to control your bets. The limit resets at midnight.")}
                </p>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 mb-4">
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111" }}>{t("Activar limite diário", "Enable daily limit")}</p>
                  <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{t("Impede apostas acima do limite", "Prevents bets above the limit")}</p>
                </div>
                <Toggle value={limEnabled} onChange={setLimEnabled} />
              </div>

              {limEnabled && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.2 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t("Limite diário (MT)", "Daily limit (MT)")}</p>
                  <input value={limAmount} onChange={e => setLimAmount(e.target.value)} type="number" min="50" step="50"
                    style={{ width: "100%", height: 46, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box", borderRadius: 0 }} />
                  <div className="flex gap-2 mt-3">
                    {[100, 200, 500, 1000].map(v => (
                      <button key={v} onClick={() => setLimAmount(String(v))}
                        style={{ flex: 1, height: 36, border: `1px solid ${limAmount === String(v) ? "#000" : "#e5e7eb"}`, background: limAmount === String(v) ? "#000" : "#fff", color: limAmount === String(v) ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                        {v}
                      </button>
                    ))}
                  </div>

                  {bettingLimits.enabled && (
                    <div className="mt-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb", padding: "10px 12px" }}>
                      <p style={{ fontSize: 11.5, color: "#6b7280" }}>
                        {t("Hoje gastos:", "Today spent:")} <strong style={{ color: "#111" }}>{bettingLimits.todaySpent} MT</strong> / {bettingLimits.dailyLimit} MT
                      </p>
                      <div style={{ marginTop: 6, height: 4, background: "#e5e7eb", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: bettingLimits.todaySpent >= bettingLimits.dailyLimit ? "#ef4444" : "#22c55e", width: `${Math.min(100, (bettingLimits.todaySpent / bettingLimits.dailyLimit) * 100)}%`, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <button onClick={handleSaveLimits}
                style={{ width: "100%", height: 48, background: "#000", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'Syne', sans-serif", marginTop: 20 }}>
                {t("Guardar", "Save", "Enregistrer", "Guardar")}
              </button>
            </div>
            <div className="h-6" />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
