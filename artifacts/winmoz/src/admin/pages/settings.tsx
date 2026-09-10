import { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon, Bell, Shield, Globe, Database,
  Bot, Lock, Mail, Key, Eye, EyeOff, CheckCircle,
  Save, Wrench, Smartphone, Copy, Link2, Phone, LayoutTemplate, Zap,
  Tag, FileText, BookOpen, Wallet, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGetPlatformSettings, useUpdatePlatformSetting } from "@/admin/lib/supabase-api";
import { toast } from "sonner";

/* ══════════════════════════════════════════════════════════════
   PRIMITIVES
══════════════════════════════════════════════════════════════ */

function LockedToggle() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: "linear-gradient(135deg, #18181b, #4f46e5)",
        position: "relative", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          position: "absolute", top: 2, right: 2, width: 20, height: 20,
          borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </div>
      <Lock style={{ width: 11, height: 11, color: "var(--gz-text-tertiary)", opacity: 0.5 }} />
    </div>
  );
}

function FunctionalToggle({
  settingKey, value, onChange, loading,
}: {
  settingKey: string;
  value: boolean;
  onChange: (key: string, val: boolean) => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={() => !loading && onChange(settingKey, !value)}
      aria-label={settingKey}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? "linear-gradient(135deg, #18181b, #4f46e5)" : "rgba(0,0,0,0.12)",
        position: "relative", border: "none", cursor: loading ? "wait" : "pointer",
        transition: "background 0.25s",
        boxShadow: value ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2, width: 20, height: 20,
        borderRadius: "50%", background: "#fff",
        left: value ? "calc(100% - 22px)" : 2,
        transition: "left 0.25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function StatusTag({ active, labelOn, labelOff }: { active: boolean; labelOn: string; labelOff: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
      textTransform: "uppercase", letterSpacing: "0.04em",
      background: active ? "rgba(21,128,61,.1)" : "var(--gz-bg-subtle)",
      color: active ? "#15803d" : "var(--gz-text-tertiary)",
      border: `1px solid ${active ? "rgba(21,128,61,.2)" : "var(--gz-border-subtle)"}`,
    }}>
      {active ? labelOn : labelOff}
    </span>
  );
}

/* ── Card with section header ── */
function Card({
  id, title, description, icon: Icon, children,
}: {
  id?: string; title: string; description?: string;
  icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <section id={id} className="gz-card overflow-hidden scroll-mt-24">
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          background: "var(--gz-bg-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 16, height: 16, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</div>
          {description && (
            <div className="text-[11.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{description}</div>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ── Setting row inside a card ── */
function SettingRow({
  label, description, children, locked,
}: {
  label: string; description: string;
  children: React.ReactNode; locked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5"
      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{label}</span>
          {locked && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 100,
              background: "var(--gz-bg-subtle)", color: "var(--gz-text-tertiary)",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              Obrigatório
            </span>
          )}
        </div>
        <div className="text-[11.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{description}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/* ── Field label + input ── */
function Field({
  label, hint, badge, children,
}: {
  label: string; hint?: React.ReactNode; badge?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[12px] font-semibold" style={{ color: "var(--gz-text-secondary)", letterSpacing: "0.2px" }}>
          {label}
        </label>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 100,
            background: "var(--gz-bg-subtle)", color: "var(--gz-text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--gz-text-tertiary)" }}>{hint}</p>
      )}
    </div>
  );
}

/* ── Text input with leading icon and optional trailing control ── */
function TextInput({
  icon: Icon, iconColor, value, onChange, placeholder, type = "text",
  monospace, trailing, accent = "var(--gz-border-subtle)",
}: {
  icon?: React.ElementType; iconColor?: string;
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; monospace?: boolean;
  trailing?: React.ReactNode; accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 rounded-xl"
      style={{ background: "var(--gz-bg-subtle)", border: `1.5px solid ${accent}` }}>
      {Icon && <Icon style={{ width: 14, height: 14, color: iconColor ?? "var(--gz-text-tertiary)", flexShrink: 0 }} />}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none py-2.5"
        style={{
          fontSize: 13,
          color: "var(--gz-text-primary)",
          fontFamily: monospace ? "monospace" : "inherit",
        }}
      />
      {trailing}
    </div>
  );
}

/* ── Save / action button ── */
function SaveBtn({
  onClick, disabled, saving, label, full,
}: {
  onClick: () => void; disabled?: boolean; saving?: boolean;
  label?: string; full?: boolean;
}) {
  const active = !disabled;
  return (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className="flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98]"
      style={{
        padding: label ? "10px 18px" : "10px 13px",
        minWidth: label ? undefined : 44,
        width: full ? "100%" : undefined,
        border: "none",
        background: active ? "#18181b" : "var(--gz-bg-subtle)",
        color: active ? "#fff" : "var(--gz-text-tertiary)",
        cursor: active && !saving ? "pointer" : "default",
        fontSize: 12.5,
      }}
    >
      {saving
        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
        : <Save style={{ width: 14, height: 14 }} />}
      {label && <span>{label}</span>}
    </button>
  );
}

/* ── Eye toggle ── */
function EyeBtn({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} type="button"
      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gz-text-tertiary)", padding: 0, flexShrink: 0 }}>
      {shown ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
    </button>
  );
}

const CYAN = "#18181b";
const TEAL_INPUT = "rgba(0,212,180,0.2)";

/* ══════════════════════════════════════════════════════════════
   DEBITO PAY SECTION (self-contained)
══════════════════════════════════════════════════════════════ */
function DebitoPaySection() {
  const updateSetting = useUpdatePlatformSetting();
  const { data: platformSettings = {} } = useGetPlatformSettings();

  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWS, setShowWS] = useState(false);
  const [savingWS, setSavingWS] = useState(false);

  const [publicId, setPublicId] = useState("");
  const [savingPID, setSavingPID] = useState(false);

  const [walletCode, setWalletCode] = useState("55291");
  const [savingWC, setSavingWC] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [savingBase, setSavingBase] = useState(false);

  const [copiedWH, setCopiedWH] = useState(false);

  useEffect(() => {
    if (platformSettings["debito_public_id"]) setPublicId(platformSettings["debito_public_id"]);
    if (platformSettings["debito_wallet_code"]) setWalletCode(platformSettings["debito_wallet_code"]);
    if (platformSettings["debito_api_base_url"]) setApiBaseUrl(platformSettings["debito_api_base_url"]);
  }, [platformSettings]);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/debito/webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopiedWH(true);
    setTimeout(() => setCopiedWH(false), 2000);
  };

  const saveKey = async (key: string, value: string, setSaving: (v: boolean) => void, label: string) => {
    if (!value.trim()) { toast.error(`Insere ${label}`); return; }
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key, value: value.trim() });
      toast.success(`${label} guardado`);
    } catch { toast.error("Erro ao guardar"); }
    setSaving(false);
  };

  return (
    <Card title="Debito Pay (Gateway)" description="Pagamentos automáticos via e-Mola" icon={Zap}>
      <div className="flex flex-col gap-5">

        {/* Webhook URL */}
        <Field
          label="URL do Webhook Debito Pay"
          hint={<>Configura esta URL no painel <strong>Debito Pay → Webhooks</strong>. Marca os eventos <code style={{ fontFamily: "monospace" }}>payment.completed</code> e <code style={{ fontFamily: "monospace" }}>payment.failed</code>.</>}
        >
          <div className="flex items-center gap-2 px-3.5 rounded-xl"
            style={{ background: "rgba(0,212,180,0.05)", border: `1.5px solid ${TEAL_INPUT}` }}>
            <span className="flex-1 text-[11px] overflow-x-auto whitespace-nowrap py-2.5"
              style={{ color: CYAN, fontFamily: "monospace" }}>
              {webhookUrl}
            </span>
            <button onClick={copyWebhook}
              style={{
                flexShrink: 0, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: copiedWH ? "rgba(0,212,180,0.2)" : "var(--gz-bg-subtle)",
                color: CYAN, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
              }}>
              {copiedWH ? <CheckCircle style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
              {copiedWH ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </Field>

        {/* API Key info */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl"
          style={{ background: "rgba(0,212,180,0.05)", border: "1px solid rgba(0,212,180,0.15)" }}>
          <Key style={{ width: 14, height: 14, color: CYAN, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--gz-text-secondary)" }}>API Key (SLACK_LIVE_API_KEY)</p>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--gz-text-muted)" }}>
              A API Key está configurada como variável de ambiente no painel do Vercel. Não é necessário inserir aqui.
            </p>
          </div>
        </div>

        <Field label="ID Público (Public Identifier)" hint="O identificador público visível no painel Debito Pay.">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <TextInput icon={Shield} iconColor={CYAN} value={publicId} onChange={setPublicId}
                placeholder="1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c" monospace accent={TEAL_INPUT} />
            </div>
            <SaveBtn onClick={() => saveKey("debito_public_id", publicId, setSavingPID, "Public ID")}
              disabled={!publicId.trim()} saving={savingPID} />
          </div>
        </Field>

        <Field label="Wallet Code" badge="Obrigatório"
          hint="Código de 5 dígitos da carteira, visível em Debito Pay → Settings → API.">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <TextInput icon={Zap} iconColor={CYAN} value={walletCode} onChange={setWalletCode}
                placeholder="55291" monospace accent={TEAL_INPUT} />
            </div>
            <SaveBtn onClick={() => saveKey("debito_wallet_code", walletCode, setSavingWC, "Wallet Code")}
              disabled={!walletCode.trim()} saving={savingWC} />
          </div>
        </Field>

        <Field label="Webhook Secret"
          hint={<>Encontras o segredo no painel Debito Pay em <strong>Webhooks → Webhook Secret</strong>.</>}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <TextInput icon={Key} iconColor={CYAN} type={showWS ? "text" : "password"}
                value={webhookSecret} onChange={setWebhookSecret}
                placeholder="Segredo fornecido pelo Debito Pay" accent={TEAL_INPUT}
                trailing={<EyeBtn shown={showWS} onToggle={() => setShowWS(v => !v)} />} />
            </div>
            <SaveBtn onClick={() => saveKey("debito_webhook_secret", webhookSecret, setSavingWS, "Webhook Secret")}
              disabled={!webhookSecret.trim()} saving={savingWS} />
          </div>
        </Field>

        <Field label="URL Base da API" badge="Opcional"
          hint={<>Deixa em branco para usar o padrão <code style={{ fontFamily: "monospace" }}>https://api.debitopay.co.mz</code>.</>}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <TextInput icon={Link2} iconColor={CYAN} type="url" value={apiBaseUrl} onChange={setApiBaseUrl}
                placeholder="https://api.debitopay.co.mz" monospace accent={TEAL_INPUT} />
            </div>
            <SaveBtn onClick={() => saveKey("debito_api_base_url", apiBaseUrl, setSavingBase, "URL Base")}
              disabled={!apiBaseUrl.trim()} saving={savingBase} />
          </div>
        </Field>

        <div className="flex gap-2 flex-wrap">
          <StatusTag active labelOn="e-Mola Activo" labelOff="" />
          <span style={{
            fontSize: 10, padding: "3px 9px", borderRadius: 100, fontWeight: 700,
            background: "var(--gz-bg-subtle)", color: "var(--gz-text-tertiary)",
            border: "1px solid var(--gz-border-subtle)", textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            M-Pesa em breve
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
   NAV
══════════════════════════════════════════════════════════════ */
const NAV = [
  { id: "plataforma",   label: "Plataforma",   icon: Globe           },
  { id: "pagamentos",   label: "Pagamentos",   icon: Smartphone      },
  { id: "notificacoes", label: "Notificações", icon: Bell            },
  { id: "credenciais",  label: "Credenciais",  icon: Mail            },
  { id: "aparencia",    label: "Aparência",    icon: LayoutTemplate  },
  { id: "conteudo",     label: "Conteúdo",     icon: FileText        },
  { id: "sistema",      label: "Sistema",      icon: Database        },
] as const;

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function Settings() {
  const { data: platformSettings = {}, isLoading } = useGetPlatformSettings();
  const updateSetting = useUpdatePlatformSetting();

  const [settings, setSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSettings({
      maintenance_mode: platformSettings["maintenance_mode"] === "true",
      support_ai_mode: platformSettings["support_ai_mode"] !== "false",
      allow_new_users: platformSettings["allow_new_users"] !== "false",
      bets_active: platformSettings["bets_active"] !== "false",
      backup_auto: platformSettings["backup_auto"] !== "false",
      query_cache: platformSettings["query_cache"] !== "false",
      query_logs: platformSettings["query_logs"] === "true",
      poker_winner_mode: platformSettings["poker_winner_mode"] === "true",
      mpesa_wallet_enabled: platformSettings["mpesa_wallet_enabled"] !== "false",
      emola_wallet_enabled: platformSettings["emola_wallet_enabled"] !== "false",
    });
  }, [platformSettings]);

  const handleToggle = async (key: string, val: boolean) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    try {
      await updateSetting.mutateAsync({ key, value: val ? "true" : "false" });
      toast.success(val ? "Activado com sucesso" : "Desactivado com sucesso");
    } catch (err) {
      setSettings(prev => ({ ...prev, [key]: !val }));
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro: " + msg);
    }
  };

  // Admin credentials
  const [adminEmail, setAdminEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleChangeEmail = async () => {
    if (!adminEmail.trim() || !adminEmail.includes("@")) { toast.error("Introduz o teu e-mail actual (para identificação)"); return; }
    if (!newEmail.trim() || !newEmail.includes("@")) { toast.error("Novo e-mail inválido"); return; }
    setSavingEmail(true);
    try {
      const res = await fetch("/api/admin/update-admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", value: newEmail.trim(), adminEmail: adminEmail.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error("Erro: " + (data.error ?? "Falha ao actualizar")); setSavingEmail(false); return; }
      toast.success("E-mail actualizado com sucesso.");
      setNewEmail("");
    } catch {
      toast.error("Erro de ligação ao servidor");
    }
    setSavingEmail(false);
  };

  const handleChangePw = async () => {
    if (!adminEmail.trim() || !adminEmail.includes("@")) { toast.error("Introduz o teu e-mail actual (para identificação)"); return; }
    if (newPw.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres"); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/admin/update-admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "password", value: newPw, adminEmail: adminEmail.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error("Erro: " + (data.error ?? "Falha ao actualizar")); setSavingPw(false); return; }
      toast.success("Palavra-passe actualizada com sucesso.");
      setNewPw("");
    } catch {
      toast.error("Erro de ligação ao servidor");
    }
    setSavingPw(false);
  };

  // SMS Forwarder settings
  const [mpesaNum, setMpesaNum] = useState("");
  const [emolaNum, setEmolaNum] = useState("");
  const [mpesaName, setMpesaName] = useState("");
  const [emolaName, setEmolaName] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [savingMpesa, setSavingMpesa] = useState(false);
  const [savingEmola, setSavingEmola] = useState(false);
  const [savingMpesaName, setSavingMpesaName] = useState(false);
  const [savingEmolaName, setSavingEmolaName] = useState(false);
  const [savingWebhookToken, setSavingWebhookToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Version control
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [savingVersion, setSavingVersion] = useState(false);

  // Terms & Privacy
  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");
  const [savingTerms, setSavingTerms] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Footer / Ad
  const [adBannerScript, setAdBannerScript] = useState("");
  const [savingAdScript, setSavingAdScript] = useState(false);

  const [footerTagline, setFooterTagline] = useState("Joga. Aposta. Vence.");
  const [footerPhone, setFooterPhone] = useState("");
  const [footerEmail, setFooterEmail] = useState("");
  const [footerAppUrl, setFooterAppUrl] = useState("");
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [rechargeWhatsapp, setRechargeWhatsapp] = useState("");
  const [savingFooter, setSavingFooter] = useState(false);

  useEffect(() => {
    if (platformSettings["app_version"])             setAppVersion(platformSettings["app_version"]);
    if (platformSettings["terms_of_service_content"]) setTermsContent(platformSettings["terms_of_service_content"]);
    if (platformSettings["privacy_policy_content"])  setPrivacyContent(platformSettings["privacy_policy_content"]);
    if (platformSettings["ad_banner_script"])        setAdBannerScript(platformSettings["ad_banner_script"]);
    if (platformSettings["sms_mpesa_number"]) setMpesaNum(platformSettings["sms_mpesa_number"]);
    if (platformSettings["sms_emola_number"]) setEmolaNum(platformSettings["sms_emola_number"]);
    if (platformSettings["sms_mpesa_name"])   setMpesaName(platformSettings["sms_mpesa_name"]);
    if (platformSettings["sms_emola_name"])   setEmolaName(platformSettings["sms_emola_name"]);
    if (platformSettings["footer_tagline"])          setFooterTagline(platformSettings["footer_tagline"]);
    if (platformSettings["footer_phone"])            setFooterPhone(platformSettings["footer_phone"]);
    if (platformSettings["footer_email"])            setFooterEmail(platformSettings["footer_email"]);
    if (platformSettings["footer_app_download_url"]) setFooterAppUrl(platformSettings["footer_app_download_url"]);
    if (platformSettings["whatsapp_group_url"])      setWhatsappGroupUrl(platformSettings["whatsapp_group_url"]);
    if (platformSettings["recharge_whatsapp_contact"]) setRechargeWhatsapp(platformSettings["recharge_whatsapp_contact"]);
  }, [platformSettings]);

  const handleSaveVersion = async () => {
    if (!appVersion.trim()) { toast.error("Insere uma versão"); return; }
    setSavingVersion(true);
    try {
      await updateSetting.mutateAsync({ key: "app_version", value: appVersion.trim() });
      toast.success("Versão actualizada");
    } catch { toast.error("Erro ao guardar versão"); }
    setSavingVersion(false);
  };

  const handleSaveTerms = async () => {
    setSavingTerms(true);
    try {
      await updateSetting.mutateAsync({ key: "terms_of_service_content", value: termsContent.trim() });
      toast.success("Termos de Serviço guardados");
    } catch { toast.error("Erro ao guardar Termos"); }
    setSavingTerms(false);
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await updateSetting.mutateAsync({ key: "privacy_policy_content", value: privacyContent.trim() });
      toast.success("Política de Privacidade guardada");
    } catch { toast.error("Erro ao guardar Política"); }
    setSavingPrivacy(false);
  };

  const handleSaveAdScript = async () => {
    setSavingAdScript(true);
    try {
      await updateSetting.mutateAsync({ key: "ad_banner_script", value: adBannerScript.trim() });
      toast.success("Script de anúncio guardado com sucesso");
    } catch { toast.error("Erro ao guardar script de anúncio"); }
    setSavingAdScript(false);
  };

  const handleSaveFooter = async () => {
    setSavingFooter(true);
    try {
      await updateSetting.mutateAsync({ key: "footer_tagline",          value: footerTagline.trim() });
      await updateSetting.mutateAsync({ key: "footer_phone",            value: footerPhone.trim() });
      await updateSetting.mutateAsync({ key: "footer_email",            value: footerEmail.trim() });
      await updateSetting.mutateAsync({ key: "footer_app_download_url", value: footerAppUrl.trim() });
      await updateSetting.mutateAsync({ key: "whatsapp_group_url",      value: whatsappGroupUrl.trim() });
      await updateSetting.mutateAsync({ key: "recharge_whatsapp_contact", value: rechargeWhatsapp.trim() });
      toast.success("Rodapé guardado com sucesso");
    } catch { toast.error("Erro ao guardar rodapé"); }
    setSavingFooter(false);
  };

  const handleSaveMpesa = async () => {
    if (!mpesaNum.trim()) { toast.error("Insere o número M-Pesa"); return; }
    setSavingMpesa(true);
    try { await updateSetting.mutateAsync({ key: "sms_mpesa_number", value: mpesaNum.trim() }); toast.success("Número M-Pesa guardado"); }
    catch { toast.error("Erro ao guardar"); }
    setSavingMpesa(false);
  };

  const handleSaveMpesaName = async () => {
    if (!mpesaName.trim()) { toast.error("Insere o nome do titular M-Pesa"); return; }
    setSavingMpesaName(true);
    try { await updateSetting.mutateAsync({ key: "sms_mpesa_name", value: mpesaName.trim() }); toast.success("Nome M-Pesa guardado"); }
    catch { toast.error("Erro ao guardar"); }
    setSavingMpesaName(false);
  };

  const handleSaveEmola = async () => {
    if (!emolaNum.trim()) { toast.error("Insere o número e-Mola"); return; }
    setSavingEmola(true);
    try { await updateSetting.mutateAsync({ key: "sms_emola_number", value: emolaNum.trim() }); toast.success("Número e-Mola guardado"); }
    catch { toast.error("Erro ao guardar"); }
    setSavingEmola(false);
  };

  const handleSaveEmolaName = async () => {
    if (!emolaName.trim()) { toast.error("Insere o nome do titular e-Mola"); return; }
    setSavingEmolaName(true);
    try { await updateSetting.mutateAsync({ key: "sms_emola_name", value: emolaName.trim() }); toast.success("Nome e-Mola guardado"); }
    catch { toast.error("Erro ao guardar"); }
    setSavingEmolaName(false);
  };

  const handleSaveWebhookToken = async () => {
    if (!webhookToken.trim()) { toast.error("Insere um token"); return; }
    setSavingWebhookToken(true);
    try { await updateSetting.mutateAsync({ key: "sms_webhook_token", value: webhookToken.trim() }); toast.success("Token guardado"); setWebhookToken(""); }
    catch { toast.error("Erro ao guardar token"); }
    setSavingWebhookToken(false);
  };

  const webhookUrl = `${window.location.origin}/api/sms/webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Security gate password
  const [secPw, setSecPw] = useState("");
  const [showSecPw, setShowSecPw] = useState(false);
  const [savingSecPw, setSavingSecPw] = useState(false);
  const [currentSecPw, setCurrentSecPw] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/security-password", {
          headers: session?.access_token
            ? { "Authorization": `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) { setCurrentSecPw("12345678y"); return; }
        const data = await res.json() as { password?: string | null };
        setCurrentSecPw(data?.password ?? "12345678y");
      } catch {
        setCurrentSecPw("12345678y");
      }
    })();
  }, []);

  const handleSaveSecPw = async () => {
    if (secPw.length < 6) { toast.error("A senha de segurança deve ter pelo menos 6 caracteres"); return; }
    setSavingSecPw(true);
    try {
      await updateSetting.mutateAsync({ key: "admin_security_password", value: secPw });
      sessionStorage.setItem("_wmz_gate", "1");
      setCurrentSecPw(secPw);
      setSecPw("");
      toast.success("Senha de segurança actualizada");
    } catch {
      toast.error("Erro ao guardar senha de segurança");
    }
    setSavingSecPw(false);
  };

  // Section navigation
  const [activeSection, setActiveSection] = useState<string>(NAV[0].id);
  const navRef = useRef<HTMLDivElement | null>(null);

  const goTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`sec-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 400 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(0,0,0,0.2)", borderTopColor: "#18181b", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--gz-bg-subtle)",
    border: "1.5px solid var(--gz-border-subtle)",
    borderRadius: 12,
    padding: "12px 14px",
    resize: "vertical",
    outline: "none",
    fontSize: 12,
    color: "var(--gz-text-primary)",
    fontFamily: "monospace",
    lineHeight: 1.6,
    boxSizing: "border-box",
  };

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.035em] leading-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
            <SettingsIcon style={{ width: 22, height: 22, strokeWidth: 2 }} />
            <span className="gz-gradient-text">Configurações</span>
          </h1>
          <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
            Administração da plataforma MOZBET
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Left nav ── */}
        <aside className="lg:w-[220px] lg:flex-shrink-0">
          <div
            ref={navRef}
            className="gz-card p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-20 hide-scrollbar"
          >
            {NAV.map(item => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all whitespace-nowrap flex-shrink-0 lg:w-full text-left"
                  style={{
                    background: active ? "var(--gz-bg-subtle)" : "transparent",
                    color: active ? "var(--gz-text-primary)" : "var(--gz-text-muted)",
                    border: active ? "1px solid var(--gz-border-subtle)" : "1px solid transparent",
                  }}
                >
                  <item.icon style={{ width: 15, height: 15, strokeWidth: active ? 2.1 : 1.8, flexShrink: 0 }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ═══ PLATAFORMA ═══ */}
          <div id="sec-plataforma" className="space-y-5 scroll-mt-24">
            <Card title="Plataforma" description="Controlo geral do funcionamento da app" icon={Globe}>
              <SettingRow label="Permitir Novos Cadastros" description="Habilitar registro de novos jogadores">
                <FunctionalToggle settingKey="allow_new_users" value={settings.allow_new_users ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
              </SettingRow>
              <SettingRow label="Apostas Activas" description="Permitir realização de apostas na plataforma">
                <FunctionalToggle settingKey="bets_active" value={settings.bets_active ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
              </SettingRow>
              <SettingRow
                label="Modo Manutenção"
                description={settings.maintenance_mode ? "Plataforma OFFLINE para todos os utilizadores" : "Colocar plataforma em modo de manutenção"}
              >
                <div className="flex items-center gap-2">
                  <StatusTag active={!!settings.maintenance_mode} labelOn="Activo" labelOff="Inactivo" />
                  <FunctionalToggle settingKey="maintenance_mode" value={settings.maintenance_mode ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
                </div>
              </SettingRow>
              <SettingRow label="Modo IA no Suporte" description="Respostas automáticas via IA para mensagens de suporte">
                <div className="flex items-center gap-2">
                  <Bot style={{ width: 14, height: 14, color: settings.support_ai_mode ? "#0ea5e9" : "var(--gz-text-tertiary)" }} />
                  <FunctionalToggle settingKey="support_ai_mode" value={settings.support_ai_mode ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
                </div>
              </SettingRow>
              <SettingRow
                label="Modo Poker Winner"
                description={settings.poker_winner_mode ? "Branding activo: POKER / Winner Online" : "Substituir 'MOZBET' → 'POKER' e 'MOZAMBIQUE' → 'Winner Online'"}
              >
                <div className="flex items-center gap-2">
                  <StatusTag active={!!settings.poker_winner_mode} labelOn="Activo" labelOff="Inactivo" />
                  <FunctionalToggle settingKey="poker_winner_mode" value={settings.poker_winner_mode ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
                </div>
              </SettingRow>
            </Card>

            <Card title="Carteiras de Pagamento" description="Disponibilidade dos métodos de depósito" icon={Wallet}>
              <SettingRow
                label="M-Pesa"
                description={settings.mpesa_wallet_enabled ? "Carteira activa — depósitos permitidos" : "Carteira indisponível — oculta nos depósitos"}
              >
                <div className="flex items-center gap-2">
                  <StatusTag active={!!settings.mpesa_wallet_enabled} labelOn="Activa" labelOff="Indisponível" />
                  <FunctionalToggle settingKey="mpesa_wallet_enabled" value={settings.mpesa_wallet_enabled ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
                </div>
              </SettingRow>
              <SettingRow
                label="e-Mola"
                description={settings.emola_wallet_enabled ? "Carteira activa — depósitos permitidos" : "Carteira indisponível — oculta nos depósitos"}
              >
                <div className="flex items-center gap-2">
                  <StatusTag active={!!settings.emola_wallet_enabled} labelOn="Activa" labelOff="Indisponível" />
                  <FunctionalToggle settingKey="emola_wallet_enabled" value={settings.emola_wallet_enabled ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
                </div>
              </SettingRow>
            </Card>
          </div>

          {/* ═══ PAGAMENTOS ═══ */}
          <div id="sec-pagamentos" className="space-y-5 scroll-mt-24">
            <Card title="SMS Forwarder" description="Confirmação automática de depósitos via SMS" icon={Smartphone}>
              <div className="flex flex-col gap-5">
                <Field
                  label="URL do Webhook SMS Forwarder"
                  hint={<>Configura esta URL na app <strong>SMS Forwarder</strong> (Android) para reencaminhar os SMS de confirmação M-Pesa / e-Mola.</>}
                >
                  <div className="flex items-center gap-2 px-3.5 rounded-xl"
                    style={{ background: "var(--gz-bg-subtle)", border: `1.5px solid ${TEAL_INPUT}` }}>
                    <span className="flex-1 text-[11px] overflow-x-auto whitespace-nowrap py-2.5"
                      style={{ color: CYAN, fontFamily: "monospace" }}>
                      {webhookUrl}
                    </span>
                    <button onClick={copyWebhookUrl}
                      style={{
                        flexShrink: 0, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: copiedWebhook ? "rgba(0,212,180,0.2)" : "var(--gz-bg-subtle)",
                        color: CYAN, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
                      }}>
                      {copiedWebhook ? <CheckCircle style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      {copiedWebhook ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </Field>

                <Field label="Token de Segurança do Webhook"
                  hint={<>Enviado no header <code style={{ fontFamily: "monospace" }}>Authorization: Bearer &lt;token&gt;</code> da app.</>}>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <TextInput icon={Key} type={showWebhookToken ? "text" : "password"}
                        value={webhookToken} onChange={setWebhookToken}
                        placeholder="Define um segredo para autenticar o webhook"
                        trailing={<EyeBtn shown={showWebhookToken} onToggle={() => setShowWebhookToken(v => !v)} />} />
                    </div>
                    <SaveBtn onClick={handleSaveWebhookToken} disabled={!webhookToken.trim()} saving={savingWebhookToken} />
                  </div>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Número M-Pesa da Plataforma" hint={<>Exemplo: <code style={{ fontFamily: "monospace" }}>84 612 3456</code>. Exibido na tela de depósito.</>}>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Smartphone} value={mpesaNum} onChange={setMpesaNum}
                          placeholder="84 XXX XXXX" trailing={undefined} />
                      </div>
                      <SaveBtn onClick={handleSaveMpesa} disabled={!mpesaNum.trim()} saving={savingMpesa} />
                    </div>
                  </Field>

                  <Field label="Nome do Titular M-Pesa" hint="Nome exibido por baixo do número na tela de depósito.">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Users} value={mpesaName} onChange={setMpesaName} placeholder="Ex: Celso Cristiano" />
                      </div>
                      <SaveBtn onClick={handleSaveMpesaName} disabled={!mpesaName.trim()} saving={savingMpesaName} />
                    </div>
                  </Field>

                  <Field label="Número e-Mola da Plataforma" hint={<>Exemplo: <code style={{ fontFamily: "monospace" }}>87 123 4567</code>. Exibido na tela de depósito.</>}>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Smartphone} value={emolaNum} onChange={setEmolaNum} placeholder="87 XXX XXXX" />
                      </div>
                      <SaveBtn onClick={handleSaveEmola} disabled={!emolaNum.trim()} saving={savingEmola} />
                    </div>
                  </Field>

                  <Field label="Nome do Titular e-Mola" hint="Nome exibido por baixo do número na tela de depósito.">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Users} value={emolaName} onChange={setEmolaName} placeholder="Ex: Celso Cristiano" />
                      </div>
                      <SaveBtn onClick={handleSaveEmolaName} disabled={!emolaName.trim()} saving={savingEmolaName} />
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            <DebitoPaySection />
          </div>

          {/* ═══ NOTIFICAÇÕES ═══ */}
          <div id="sec-notificacoes" className="space-y-5 scroll-mt-24">
            <Card title="Notificações" description="Alertas operacionais do painel" icon={Bell}>
              <SettingRow label="Alertas de Anti-Fraude" description="Receber notificações de atividade suspeita" locked>
                <LockedToggle />
              </SettingRow>
              <SettingRow label="Novos Saques Pendentes" description="Alertas para aprovação de saques" locked>
                <LockedToggle />
              </SettingRow>
              <SettingRow label="Denúncias Novas" description="Notificações para novas denúncias" locked>
                <LockedToggle />
              </SettingRow>
            </Card>

            <Card title="Segurança" description="Proteções automáticas do sistema" icon={Shield}>
              <SettingRow label="Anti-Fraude Automático" description="Detecção automática de padrões suspeitos" locked>
                <LockedToggle />
              </SettingRow>
              <SettingRow label="Verificação 2FA Admin" description="Autenticação de dois fatores para admins" locked>
                <LockedToggle />
              </SettingRow>
              <SettingRow label="Log de Auditoria" description="Registrar todas as ações administrativas" locked>
                <LockedToggle />
              </SettingRow>
            </Card>
          </div>

          {/* ═══ CREDENCIAIS ═══ */}
          <div id="sec-credenciais" className="space-y-5 scroll-mt-24">
            <Card title="Credenciais de Acesso" description="E-mail e palavra-passe do administrador" icon={Mail}>
              <div className="flex flex-col gap-5">
                <Field label="E-mail Atual" hint="Necessário para identificar a conta nos campos abaixo.">
                  <TextInput icon={Mail} iconColor="#0ea5e9" type="email" value={adminEmail}
                    onChange={setAdminEmail} placeholder="teu@email-atual.com" accent="rgba(14,165,233,0.25)" />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Alterar E-mail do Admin">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Mail} type="email" value={newEmail} onChange={setNewEmail} placeholder="novo@email.com" />
                      </div>
                      <SaveBtn onClick={handleChangeEmail} disabled={!newEmail.trim()} saving={savingEmail} />
                    </div>
                  </Field>

                  <Field label="Alterar Palavra-Passe do Admin">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <TextInput icon={Key} type={showPw ? "text" : "password"} value={newPw}
                          onChange={setNewPw} placeholder="Mín. 8 caracteres"
                          trailing={<EyeBtn shown={showPw} onToggle={() => setShowPw(v => !v)} />} />
                      </div>
                      <SaveBtn onClick={handleChangePw} disabled={newPw.length < 8} saving={savingPw} />
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Senha da Porta de Segurança" description="Proteção de acesso ao painel admin" icon={Lock}>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl"
                  style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)" }}>
                  <Shield style={{ width: 14, height: 14, color: "var(--gz-text-secondary)", flexShrink: 0 }} />
                  <span className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>
                    Senha actual: <strong style={{ color: "var(--gz-text-primary)", fontFamily: "monospace" }}>
                      {currentSecPw ? "●".repeat(currentSecPw.length) : "..."}
                    </strong>
                  </span>
                </div>
                <Field label="Nova Senha de Segurança" hint="Altera imediatamente — a nova senha é exigida no próximo acesso ao painel.">
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <TextInput icon={Lock} type={showSecPw ? "text" : "password"} value={secPw}
                        onChange={setSecPw} placeholder="Mín. 6 caracteres"
                        trailing={<EyeBtn shown={showSecPw} onToggle={() => setShowSecPw(v => !v)} />} />
                    </div>
                    <SaveBtn onClick={handleSaveSecPw} disabled={secPw.length < 6} saving={savingSecPw} />
                  </div>
                </Field>
              </div>
            </Card>
          </div>

          {/* ═══ APARÊNCIA ═══ */}
          <div id="sec-aparencia" className="space-y-5 scroll-mt-24">
            <Card title="Rodapé & App" description="Contactos e links exibidos na aplicação" icon={LayoutTemplate}>
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Tagline do Rodapé">
                    <TextInput icon={LayoutTemplate} value={footerTagline} onChange={setFooterTagline} placeholder="Ex: Joga. Aposta. Vence." />
                  </Field>
                  <Field label="Telefone de Contacto">
                    <TextInput icon={Phone} value={footerPhone} onChange={setFooterPhone} placeholder="Ex: +258 84 000 0000" />
                  </Field>
                  <Field label="E-mail de Contacto">
                    <TextInput icon={Mail} type="email" value={footerEmail} onChange={setFooterEmail} placeholder="Ex: suporte@mozbet.co.mz" />
                  </Field>
                  <Field label="Link de Download da App" hint={<>URL do botão "Descarregar App" no rodapé da página inicial.</>}>
                    <TextInput icon={Link2} type="url" value={footerAppUrl} onChange={setFooterAppUrl} placeholder="https://play.google.com/..." />
                  </Field>
                  <Field label="Link do Grupo do WhatsApp" hint={<>URL do botão "Grupo do WhatsApp" no menu de jogos.</>}>
                    <TextInput icon={Link2} iconColor="#25d366" type="url" value={whatsappGroupUrl}
                      onChange={setWhatsappGroupUrl} placeholder="https://chat.whatsapp.com/..." accent="rgba(37,211,102,0.25)" />
                  </Field>
                  <Field label="WhatsApp — Comprar Recargas"
                    hint={<>Número (258XXXXXXXXX) ou link wa.me — destino do botão "Comprar Recarga".</>}>
                    <TextInput icon={Phone} iconColor="#25d366" value={rechargeWhatsapp}
                      onChange={setRechargeWhatsapp} placeholder="25884xxxxxxx" accent="rgba(37,211,102,0.25)" />
                  </Field>
                </div>
                <div>
                  <SaveBtn onClick={handleSaveFooter} saving={savingFooter} label="Guardar Rodapé" />
                </div>
              </div>
            </Card>

            <Card title="Banner de Anúncios" description="Script exibido na tela de Apostas e na Home" icon={LayoutTemplate}>
              <Field
                label="Script do Anúncio"
                hint={<>Cola aqui o script completo (ex: Adsterra, Google AdSense). O banner é exibido automaticamente na tela de Apostas e acima dos Saques 24h na Home.</>}
              >
                <textarea
                  value={adBannerScript}
                  onChange={e => setAdBannerScript(e.target.value)}
                  placeholder={`<script>\n  atOptions = { 'key': '...', 'format': 'iframe', 'height': 50, 'width': 320 };\n</script>\n<script src="https://...invoke.js"></script>`}
                  rows={6}
                  style={textareaStyle}
                />
              </Field>
              <div className="mt-4">
                <SaveBtn onClick={handleSaveAdScript} disabled={!adBannerScript.trim()} saving={savingAdScript} label="Guardar Script de Anúncio" />
              </div>
            </Card>
          </div>

          {/* ═══ CONTEÚDO ═══ */}
          <div id="sec-conteudo" className="space-y-5 scroll-mt-24">
            <Card title="Termos de Serviço" description="Conteúdo exibido em /termos" icon={FileText}>
              <Field label="Conteúdo (texto ou Markdown)" hint={<>Exibido na página <strong>/termos</strong>. Suporta Markdown básico.</>}>
                <textarea value={termsContent} onChange={e => setTermsContent(e.target.value)}
                  placeholder={"# Termos de Serviço\n\n**1. Aceitação dos Termos**\nAo aceder à plataforma MOZBET...\n\n**2. Elegibilidade**\nTens de ter 18 anos ou mais..."}
                  rows={12} style={textareaStyle} />
              </Field>
              <div className="mt-4">
                <SaveBtn onClick={handleSaveTerms} disabled={!termsContent.trim()} saving={savingTerms} label="Guardar Termos de Serviço" />
              </div>
            </Card>

            <Card title="Política de Privacidade" description="Conteúdo exibido em /privacidade" icon={BookOpen}>
              <Field label="Conteúdo (texto ou Markdown)" hint={<>Exibido na página <strong>/privacidade</strong>. Suporta Markdown básico.</>}>
                <textarea value={privacyContent} onChange={e => setPrivacyContent(e.target.value)}
                  placeholder={"# Política de Privacidade\n\n**Última actualização:** Junho 2025\n\n**1. Dados Recolhidos**\nRecolhemos os seguintes dados..."}
                  rows={12} style={textareaStyle} />
              </Field>
              <div className="mt-4">
                <SaveBtn onClick={handleSavePrivacy} disabled={!privacyContent.trim()} saving={savingPrivacy} label="Guardar Política de Privacidade" />
              </div>
            </Card>
          </div>

          {/* ═══ SISTEMA ═══ */}
          <div id="sec-sistema" className="space-y-5 scroll-mt-24">
            <Card title="Banco de Dados" description="Backups, cache e registos" icon={Database}>
              <SettingRow label="Backup Automático" description="Backup diário do banco de dados">
                <FunctionalToggle settingKey="backup_auto" value={settings.backup_auto ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
              </SettingRow>
              <SettingRow label="Cache de Consultas" description="Habilitar cache de consultas SQL">
                <FunctionalToggle settingKey="query_cache" value={settings.query_cache ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
              </SettingRow>
              <SettingRow label="Logs de Query" description="Registrar todas as queries do sistema">
                <FunctionalToggle settingKey="query_logs" value={settings.query_logs ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
              </SettingRow>
            </Card>

            <Card title="Controlo de Versão" description="Versão publicada da aplicação" icon={Tag}>
              <Field label="Versão da Aplicação"
                hint={<>Exibida nas Definições do utilizador e no rodapé do admin. Formato <code style={{ fontFamily: "monospace" }}>MAJOR.MINOR.PATCH</code>.</>}>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <TextInput icon={Tag} iconColor="#6366F1" value={appVersion} onChange={setAppVersion}
                      placeholder="1.0.0" monospace accent="rgba(99,102,241,0.2)" />
                  </div>
                  <SaveBtn onClick={handleSaveVersion} disabled={!appVersion.trim()} saving={savingVersion} />
                </div>
              </Field>
            </Card>
          </div>

          {/* ── Footer info ── */}
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: "#0a0a0a" }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wrench style={{ width: 17, height: 17, color: "#a1a1aa" }} />
              </div>
              <div>
                <div className="font-bold text-[13.5px] text-white">MOZBET Admin</div>
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Plataforma de jogos com apostas em tempo real</div>
              </div>
            </div>
            <div className="flex gap-4">
              {[
                { label: "API", status: "Online", color: "#34d399" },
                { label: "DB", status: "Conectado", color: "#34d399" },
                { label: "IA", status: settings.support_ai_mode ? "Activa" : "Desligada", color: settings.support_ai_mode ? "#0ea5e9" : "#6b7280" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>{item.label}</span>
                  <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
