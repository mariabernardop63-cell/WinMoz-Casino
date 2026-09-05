import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon, Bell, Shield, Globe, Database,
  Bot, Lock, Mail, Key, Eye, EyeOff, CheckCircle, AlertCircle,
  Save, Wrench, Smartphone, Copy, Link2, Phone, LayoutTemplate, Zap,
  Tag, FileText, BookOpen, Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGetPlatformSettings, useUpdatePlatformSetting } from "@/admin/lib/supabase-api";
import { toast } from "sonner";

/* ── Locked toggle (always ON, cannot be disabled) ── */
function LockedToggle() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: "linear-gradient(135deg, #6C5CE7, #4f46e5)",
        position: "relative", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(108,92,231,0.35)",
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

/* ── Functional toggle (connected to Supabase) ── */
function FunctionalToggle({
  settingKey,
  value,
  onChange,
  loading,
}: {
  settingKey: string;
  value: boolean;
  onChange: (key: string, val: boolean) => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={() => !loading && onChange(settingKey, !value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? "linear-gradient(135deg, #6C5CE7, #4f46e5)" : "rgba(0,0,0,0.12)",
        position: "relative", border: "none", cursor: loading ? "wait" : "pointer",
        transition: "background 0.25s",
        boxShadow: value ? "0 2px 8px rgba(108,92,231,0.35)" : "none",
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

/* ── Setting row ── */
function SettingRow({
  label,
  description,
  children,
  locked,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(108,92,231,0.06)" }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--gz-text-primary)" }}>{label}</span>
          {locked && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 100,
              background: "rgba(108,92,231,0.08)", color: "#6C5CE7",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              OBRIGATÓRIO
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--gz-text-muted)", marginTop: 2 }}>{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ── Section card ── */
function SectionCard({
  title,
  icon: Icon,
  color,
  bg,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gz-card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 17, height: 17, color }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--gz-text-primary)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Debito Pay Section (self-contained) ── */
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

  const CYAN_COLOR = "#00D4B4";
  const spinStyle = { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", animation: "spin 0.8s linear infinite" } as const;
  const inputBox = (borderColor = "rgba(0,212,180,0.2)") => ({
    flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
    borderRadius: 12, background: "var(--gz-bg-subtle)", border: `1.5px solid ${borderColor}`,
  } as const);
  const saveBtn = (active: boolean, saving: boolean, color = CYAN_COLOR) => ({
    padding: "10px 14px", borderRadius: 12, border: "none", cursor: active && !saving ? "pointer" : "default",
    background: active && !saving ? `linear-gradient(135deg, ${color}, ${color}cc)` : "var(--gz-bg-subtle)",
    color: active && !saving ? "#000" : "var(--gz-text-tertiary)",
    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
  } as const);

  return (
    <SectionCard title="Debito Pay (Gateway)" icon={Zap} color="#00D4B4" bg="rgba(0,212,180,0.1)">
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Webhook URL */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
            URL do Webhook Debito Pay
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(0,212,180,0.05)", border: "1.5px solid rgba(0,212,180,0.2)" }}>
            <span style={{ flex: 1, fontSize: 11, color: CYAN_COLOR, fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>
              {webhookUrl}
            </span>
            <button onClick={copyWebhook}
              style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: copiedWH ? "rgba(0,212,180,0.2)" : "rgba(0,212,180,0.1)",
                color: CYAN_COLOR, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              {copiedWH ? <CheckCircle style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
              {copiedWH ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
            Configura esta URL no painel <strong>Debito Pay → Webhooks</strong>. Marca todos os eventos: <code style={{ fontFamily: "monospace", background: "rgba(0,212,180,0.08)", padding: "1px 5px", borderRadius: 4 }}>payment.completed</code>, <code style={{ fontFamily: "monospace", background: "rgba(0,212,180,0.08)", padding: "1px 5px", borderRadius: 4 }}>payment.failed</code>.
          </p>
        </div>

        {/* API Key info */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(0,212,180,0.05)", border: "1px solid rgba(0,212,180,0.15)" }}>
          <Key style={{ width: 14, height: 14, color: CYAN_COLOR, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", marginBottom: 4 }}>API Key (SLACK_LIVE_API_KEY)</p>
            <p style={{ fontSize: 11, color: "var(--gz-text-muted)", lineHeight: 1.5 }}>
              A API Key está configurada como variável de ambiente <code style={{ fontFamily: "monospace", background: "rgba(0,212,180,0.08)", padding: "1px 5px", borderRadius: 4 }}>SLACK_LIVE_API_KEY</code> no painel do Vercel. Não é necessário inserir aqui.
            </p>
          </div>
        </div>

        {/* Public ID */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
            ID Público (Public Identifier)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={inputBox()}>
              <Shield style={{ width: 14, height: 14, color: CYAN_COLOR, flexShrink: 0 }} />
              <input type="text" value={publicId} onChange={e => setPublicId(e.target.value)}
                placeholder="1e4d1d55-d740-447f-8cb4-8c8ce1bb0a0c"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--gz-text-primary)", fontFamily: "monospace" }} />
            </div>
            <button onClick={() => saveKey("debito_public_id", publicId, setSavingPID, "Public ID")}
              disabled={!publicId.trim() || savingPID} style={saveBtn(!!publicId.trim(), savingPID)}>
              {savingPID ? <div style={spinStyle} /> : <Save style={{ width: 14, height: 14 }} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
            O identificador público visível no painel Debito Pay. Pré-preenchido com o valor por defeito.
          </p>
        </div>

        {/* Wallet Code */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
            Wallet Code <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 100, background: "rgba(0,212,180,0.1)", color: CYAN_COLOR, textTransform: "uppercase", letterSpacing: "0.5px", marginLeft: 4 }}>OBRIGATÓRIO</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={inputBox()}>
              <Zap style={{ width: 14, height: 14, color: CYAN_COLOR, flexShrink: 0 }} />
              <input type="text" value={walletCode} onChange={e => setWalletCode(e.target.value)}
                placeholder="55291"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "monospace" }} />
            </div>
            <button onClick={() => saveKey("debito_wallet_code", walletCode, setSavingWC, "Wallet Code")}
              disabled={!walletCode.trim() || savingWC} style={saveBtn(!!walletCode.trim(), savingWC)}>
              {savingWC ? <div style={spinStyle} /> : <Save style={{ width: 14, height: 14 }} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
            Código de 5 dígitos da carteira — visível em <strong>Debito Pay → Settings → API</strong>. Campo obrigatório em todos os pedidos de pagamento.
          </p>
        </div>

        {/* Webhook Secret */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
            Webhook Secret
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={inputBox()}>
              <Key style={{ width: 14, height: 14, color: CYAN_COLOR, flexShrink: 0 }} />
              <input type={showWS ? "text" : "password"} value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                placeholder="Segredo fornecido pelo Debito Pay"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              <button onClick={() => setShowWS(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gz-text-tertiary)", padding: 0 }}>
                {showWS ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
              </button>
            </div>
            <button onClick={() => saveKey("debito_webhook_secret", webhookSecret, setSavingWS, "Webhook Secret")}
              disabled={!webhookSecret.trim() || savingWS} style={saveBtn(!!webhookSecret.trim(), savingWS)}>
              {savingWS ? <div style={spinStyle} /> : <Save style={{ width: 14, height: 14 }} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
            Encontras o Webhook Secret no painel Debito Pay em <strong>Webhooks → Webhook Secret</strong>. Guarda aqui para validação de segurança.
          </p>
        </div>

        {/* API Base URL */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
            URL Base da API (opcional)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={inputBox()}>
              <Link2 style={{ width: 14, height: 14, color: CYAN_COLOR, flexShrink: 0 }} />
              <input type="url" value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="https://api.debitopay.co.mz"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--gz-text-primary)", fontFamily: "monospace" }} />
            </div>
            <button onClick={() => saveKey("debito_api_base_url", apiBaseUrl, setSavingBase, "URL Base")}
              disabled={!apiBaseUrl.trim() || savingBase} style={saveBtn(!!apiBaseUrl.trim(), savingBase)}>
              {savingBase ? <div style={spinStyle} /> : <Save style={{ width: 14, height: 14 }} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
            Deixa em branco para usar o padrão: <code style={{ fontFamily: "monospace" }}>https://api.debitopay.co.mz</code>. Só altera se o Debito Pay fornecer uma URL diferente.
          </p>
        </div>

        {/* Status indicators */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "rgba(52,211,153,0.12)", color: "#34d399", fontWeight: 600 }}>
            ✓ e-Mola Activo
          </span>
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "rgba(255,255,255,0.04)", color: "#52525b", fontWeight: 600 }}>
            ⏳ M-Pesa Em Breve
          </span>
        </div>

      </div>
    </SectionCard>
  );
}

export default function Settings() {
  const { data: platformSettings = {}, isLoading } = useGetPlatformSettings();
  const updateSetting = useUpdatePlatformSetting();

  // Local state for platform toggles
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
  const [appVersion, setAppVersion]     = useState("1.0.0");
  const [savingVersion, setSavingVersion] = useState(false);

  // Terms & Privacy content editors
  const [termsContent,   setTermsContent]   = useState("");
  const [privacyContent, setPrivacyContent] = useState("");
  const [savingTerms,    setSavingTerms]    = useState(false);
  const [savingPrivacy,  setSavingPrivacy]  = useState(false);

  // Footer settings
  const [adBannerScript, setAdBannerScript] = useState("");
  const [savingAdScript, setSavingAdScript] = useState(false);

  const [footerTagline, setFooterTagline] = useState("Joga. Aposta. Vence.");
  const [footerPhone, setFooterPhone]     = useState("");
  const [footerEmail, setFooterEmail]     = useState("");
  const [footerAppUrl, setFooterAppUrl]   = useState("");
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [savingFooter, setSavingFooter]   = useState(false);

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
      // Also update session so admin doesn't get locked out
      sessionStorage.setItem("_wmz_gate", "1");
      setCurrentSecPw(secPw);
      setSecPw("");
      toast.success("Senha de segurança actualizada");
    } catch {
      toast.error("Erro ao guardar senha de segurança");
    }
    setSavingSecPw(false);
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(108,92,231,0.2)", borderTopColor: "#6C5CE7", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "linear-gradient(135deg, #6C5CE7, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(108,92,231,0.35)" }}>
            <SettingsIcon style={{ width: 18, height: 18, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--gz-text-primary)", margin: 0 }}>Configurações</h1>
            <p style={{ fontSize: 12, color: "var(--gz-text-muted)", margin: 0 }}>Administração da plataforma Winmoz</p>
          </div>
        </div>
      </div>

      <div className="admin-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Notifications — all locked */}
        <SectionCard title="Notificações" icon={Bell} color="#6C5CE7" bg="rgba(108,92,231,0.1)">
          <SettingRow label="Alertas de Anti-Fraude" description="Receber notificações de atividade suspeita" locked>
            <LockedToggle />
          </SettingRow>
          <SettingRow label="Novos Saques Pendentes" description="Alertas para aprovação de saques" locked>
            <LockedToggle />
          </SettingRow>
          <SettingRow label="Denúncias Novas" description="Notificações para novas denúncias" locked>
            <LockedToggle />
          </SettingRow>
        </SectionCard>

        {/* Security — all locked */}
        <SectionCard title="Segurança" icon={Shield} color="#8b5cf6" bg="rgba(139,92,246,0.1)">
          <SettingRow label="Anti-Fraude Automático" description="Detecção automática de padrões suspeitos" locked>
            <LockedToggle />
          </SettingRow>
          <SettingRow label="Verificação 2FA Admin" description="Autenticação de dois fatores para admins" locked>
            <LockedToggle />
          </SettingRow>
          <SettingRow label="Log de Auditoria" description="Registrar todas as ações administrativas" locked>
            <LockedToggle />
          </SettingRow>
        </SectionCard>

        {/* Platform — functional */}
        <SectionCard title="Plataforma" icon={Globe} color="#10b981" bg="rgba(16,185,129,0.1)">
          <SettingRow label="Permitir Novos Cadastros" description="Habilitar registro de novos jogadores">
            <FunctionalToggle settingKey="allow_new_users" value={settings.allow_new_users ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
          </SettingRow>
          <SettingRow label="Apostas Activas" description="Permitir realização de apostas na plataforma">
            <FunctionalToggle settingKey="bets_active" value={settings.bets_active ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
          </SettingRow>
          <SettingRow
            label="Modo Manutenção"
            description={settings.maintenance_mode ? "⚠️ Plataforma OFFLINE para todos os users" : "Colocar plataforma em modo de manutenção"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {settings.maintenance_mode && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(239,68,68,0.1)", color: "#ef4444", textTransform: "uppercase" }}>
                  ACTIVO
                </span>
              )}
              <FunctionalToggle settingKey="maintenance_mode" value={settings.maintenance_mode ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
            </div>
          </SettingRow>
          <SettingRow label="Modo IA no Suporte" description="Respostas automáticas via IA para mensagens de suporte">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bot style={{ width: 13, height: 13, color: settings.support_ai_mode ? "#0ea5e9" : "var(--gz-text-tertiary)" }} />
              <FunctionalToggle settingKey="support_ai_mode" value={settings.support_ai_mode ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
            </div>
          </SettingRow>
          <SettingRow
            label="Modo Poker Winner"
            description={settings.poker_winner_mode ? "🃏 Branding activo: POKER / Winner Online" : "Substituir 'MOZBET'→'POKER' e 'MOZAMBIQUE'→'Winner Online' em toda a plataforma"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {settings.poker_winner_mode && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(139,92,246,0.12)", color: "#8b5cf6", textTransform: "uppercase" }}>
                  ACTIVO
                </span>
              )}
              <FunctionalToggle settingKey="poker_winner_mode" value={settings.poker_winner_mode ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
            </div>
          </SettingRow>
        </SectionCard>

        {/* Carteiras de Pagamento */}
        <SectionCard title="Carteiras de Pagamento" icon={Wallet} color="#16a34a" bg="rgba(22,163,74,0.1)">
          <SettingRow
            label="M-Pesa"
            description={settings.mpesa_wallet_enabled ? "Carteira activa — os utilizadores podem depositar via M-Pesa" : "⚠️ Carteira INDISPONÍVEL — os utilizadores não conseguem escolher M-Pesa nos depósitos"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, textTransform: "uppercase",
                background: settings.mpesa_wallet_enabled ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.1)",
                color: settings.mpesa_wallet_enabled ? "#16a34a" : "#ef4444" }}>
                {settings.mpesa_wallet_enabled ? "Activa" : "Indisponível"}
              </span>
              <FunctionalToggle settingKey="mpesa_wallet_enabled" value={settings.mpesa_wallet_enabled ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
            </div>
          </SettingRow>
          <SettingRow
            label="e-Mola"
            description={settings.emola_wallet_enabled ? "Carteira activa — os utilizadores podem depositar via e-Mola" : "⚠️ Carteira INDISPONÍVEL — os utilizadores não conseguem escolher e-Mola nos depósitos"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, textTransform: "uppercase",
                background: settings.emola_wallet_enabled ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.1)",
                color: settings.emola_wallet_enabled ? "#16a34a" : "#ef4444" }}>
                {settings.emola_wallet_enabled ? "Activa" : "Indisponível"}
              </span>
              <FunctionalToggle settingKey="emola_wallet_enabled" value={settings.emola_wallet_enabled ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
            </div>
          </SettingRow>
        </SectionCard>

        {/* Footer & App Download */}
        <SectionCard title="Rodapé & App" icon={LayoutTemplate} color="#8b5cf6" bg="rgba(139,92,246,0.1)">
          <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Tagline */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.3px" }}>
                Tagline do Rodapé
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(139,92,246,0.2)" }}>
                <LayoutTemplate style={{ width: 14, height: 14, color: "#8b5cf6", flexShrink: 0 }} />
                <input type="text" value={footerTagline} onChange={e => setFooterTagline(e.target.value)} placeholder="Ex: Joga. Aposta. Vence."
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.3px" }}>
                Telefone de Contacto
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(139,92,246,0.2)" }}>
                <Phone style={{ width: 14, height: 14, color: "#8b5cf6", flexShrink: 0 }} />
                <input type="text" value={footerPhone} onChange={e => setFooterPhone(e.target.value)} placeholder="Ex: +258 84 000 0000"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.3px" }}>
                E-mail de Contacto
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(139,92,246,0.2)" }}>
                <Mail style={{ width: 14, height: 14, color: "#8b5cf6", flexShrink: 0 }} />
                <input type="email" value={footerEmail} onChange={e => setFooterEmail(e.target.value)} placeholder="Ex: suporte@mozbet.co.mz"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              </div>
            </div>

            {/* App download URL */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.3px" }}>
                Link de Download da App
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(139,92,246,0.2)" }}>
                <Link2 style={{ width: 14, height: 14, color: "#8b5cf6", flexShrink: 0 }} />
                <input type="url" value={footerAppUrl} onChange={e => setFooterAppUrl(e.target.value)} placeholder="https://play.google.com/..."
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 5 }}>URL para o botão "Descarregar App" no rodapé da página inicial.</p>
            </div>

            {/* WhatsApp Group URL */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.3px" }}>
                Link do Grupo do WhatsApp
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(37,211,102,0.25)" }}>
                <Link2 style={{ width: 14, height: 14, color: "#25d366", flexShrink: 0 }} />
                <input type="url" value={whatsappGroupUrl} onChange={e => setWhatsappGroupUrl(e.target.value)} placeholder="https://chat.whatsapp.com/..."
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 5 }}>URL exibido no botão "Grupo do WhatsApp" no menu de jogos.</p>
            </div>

            {/* Save button */}
            <button onClick={handleSaveFooter} disabled={savingFooter}
              style={{
                padding: "11px 20px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #8b5cf6, #6C5CE7)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                display: "flex", alignItems: "center", gap: 8,
                cursor: savingFooter ? "wait" : "pointer",
                fontFamily: "inherit", alignSelf: "flex-start",
                boxShadow: "0 4px 14px rgba(139,92,246,0.3)",
              }}>
              {savingFooter ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
              Guardar Rodapé
            </button>
          </div>
        </SectionCard>

        {/* Database */}
        <SectionCard title="Banco de Dados" icon={Database} color="#f59e0b" bg="rgba(245,158,11,0.1)">
          <SettingRow label="Backup Automático" description="Backup diário do banco de dados">
            <FunctionalToggle settingKey="backup_auto" value={settings.backup_auto ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
          </SettingRow>
          <SettingRow label="Cache de Consultas" description="Habilitar cache de consultas SQL">
            <FunctionalToggle settingKey="query_cache" value={settings.query_cache ?? true} onChange={handleToggle} loading={updateSetting.isPending} />
          </SettingRow>
          <SettingRow label="Logs de Query" description="Registrar todas as queries do sistema">
            <FunctionalToggle settingKey="query_logs" value={settings.query_logs ?? false} onChange={handleToggle} loading={updateSetting.isPending} />
          </SettingRow>
        </SectionCard>

        {/* Admin Credentials */}
        <SectionCard title="Credenciais de Acesso" icon={Mail} color="#0ea5e9" bg="rgba(14,165,233,0.1)">
          <div style={{ paddingTop: 12 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                E-mail Atual (para identificação)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(14,165,233,0.25)" }}>
                <Mail style={{ width: 14, height: 14, color: "#0ea5e9", flexShrink: 0 }} />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="teu@email-atual.com"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-muted)", margin: "5px 0 0" }}>Necessário para identificar a conta nos dois campos abaixo</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Alterar E-mail do Admin
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,0.1)" }}>
                  <Mail style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                </div>
                <button
                  onClick={handleChangeEmail}
                  disabled={!newEmail.trim() || savingEmail}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none", cursor: newEmail.trim() ? "pointer" : "default",
                    background: newEmail.trim() ? "linear-gradient(135deg, #6C5CE7, #4f46e5)" : "var(--gz-bg-subtle)",
                    color: newEmail.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}
                >
                  {savingEmail ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Alterar Palavra-Passe do Admin
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,0.1)" }}>
                  <Key style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Nova palavra-passe (mín. 8 chars)"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                  <button onClick={() => setShowPw(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gz-text-tertiary)", padding: 0 }}>
                    {showPw ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                  </button>
                </div>
                <button
                  onClick={handleChangePw}
                  disabled={newPw.length < 8 || savingPw}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none", cursor: newPw.length >= 8 ? "pointer" : "default",
                    background: newPw.length >= 8 ? "linear-gradient(135deg, #6C5CE7, #4f46e5)" : "var(--gz-bg-subtle)",
                    color: newPw.length >= 8 ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}
                >
                  {savingPw ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* SMS Forwarder Configuration */}
        <SectionCard title="Pagamentos SMS Forwarder" icon={Smartphone} color="#00D4B4" bg="rgba(0,212,180,0.1)">
          <div style={{ paddingTop: 12 }}>

            {/* Webhook URL */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                URL do Webhook SMS Forwarder
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(0,212,180,0.05)", border: "1.5px solid rgba(0,212,180,0.2)" }}>
                <span style={{ flex: 1, fontSize: 11, color: "#00D4B4", fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>
                  {webhookUrl}
                </span>
                <button onClick={copyWebhookUrl}
                  style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: copiedWebhook ? "rgba(0,212,180,0.2)" : "rgba(0,212,180,0.1)",
                    color: "#00D4B4", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  {copiedWebhook ? <CheckCircle style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedWebhook ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                Configura esta URL no app <strong>SMS Forwarder</strong> (Android) para que os SMS de confirmação M-Pesa/e-Mola sejam enviados automaticamente.
              </p>
            </div>

            {/* Webhook Token */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Token de Segurança do Webhook
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(0,212,180,0.15)" }}>
                  <Key style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
                  <input
                    type={showWebhookToken ? "text" : "password"}
                    value={webhookToken}
                    onChange={e => setWebhookToken(e.target.value)}
                    placeholder="Define um segredo para autenticar o webhook"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                  <button onClick={() => setShowWebhookToken(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gz-text-tertiary)", padding: 0 }}>
                    {showWebhookToken ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                  </button>
                </div>
                <button onClick={handleSaveWebhookToken} disabled={!webhookToken.trim() || savingWebhookToken}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: webhookToken.trim() ? "pointer" : "default",
                    background: webhookToken.trim() ? "linear-gradient(135deg, #00D4B4, #00b89c)" : "var(--gz-bg-subtle)",
                    color: webhookToken.trim() ? "#000" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                  {savingWebhookToken ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
                Envia este token no header <code style={{ background: "rgba(0,212,180,0.1)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>Authorization: Bearer &lt;token&gt;</code> do app SMS Forwarder.
              </p>
            </div>

            {/* M-Pesa Number */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Número M-Pesa da Plataforma
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(231,76,60,0.2)" }}>
                  <Smartphone style={{ width: 14, height: 14, color: "#e74c3c", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={mpesaNum}
                    onChange={e => setMpesaNum(e.target.value)}
                    placeholder="84 XXX XXXX (sem prefixo +258)"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                </div>
                <button onClick={handleSaveMpesa} disabled={!mpesaNum.trim() || savingMpesa}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: mpesaNum.trim() ? "pointer" : "default",
                    background: mpesaNum.trim() ? "linear-gradient(135deg, #e74c3c, #c0392b)" : "var(--gz-bg-subtle)",
                    color: mpesaNum.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                  {savingMpesa ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>Exemplo: <code style={{ fontFamily: "monospace" }}>84 612 3456</code>. Exibido aos utilizadores na tela de depósito.</p>
            </div>

            {/* M-Pesa Name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Nome do Titular M-Pesa
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(231,76,60,0.2)" }}>
                  <span style={{ fontSize: 13, color: "#e74c3c", flexShrink: 0 }}>👤</span>
                  <input
                    type="text"
                    value={mpesaName}
                    onChange={e => setMpesaName(e.target.value)}
                    placeholder="Ex: Celso Cristiano"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                </div>
                <button onClick={handleSaveMpesaName} disabled={!mpesaName.trim() || savingMpesaName}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: mpesaName.trim() ? "pointer" : "default",
                    background: mpesaName.trim() ? "linear-gradient(135deg, #e74c3c, #c0392b)" : "var(--gz-bg-subtle)",
                    color: mpesaName.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                  {savingMpesaName ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>Nome exibido por baixo do número M-Pesa na tela de depósito/aposta.</p>
            </div>

            {/* e-Mola Number */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Número e-Mola da Plataforma
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(52,211,153,0.2)" }}>
                  <Smartphone style={{ width: 14, height: 14, color: "#34d399", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={emolaNum}
                    onChange={e => setEmolaNum(e.target.value)}
                    placeholder="87 XXX XXXX (sem prefixo +258)"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                </div>
                <button onClick={handleSaveEmola} disabled={!emolaNum.trim() || savingEmola}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: emolaNum.trim() ? "pointer" : "default",
                    background: emolaNum.trim() ? "linear-gradient(135deg, #34d399, #059669)" : "var(--gz-bg-subtle)",
                    color: emolaNum.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                  {savingEmola ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>Exemplo: <code style={{ fontFamily: "monospace" }}>87 123 4567</code>. Exibido aos utilizadores na tela de depósito.</p>
            </div>

            {/* e-Mola Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Nome do Titular e-Mola
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(52,211,153,0.2)" }}>
                  <span style={{ fontSize: 13, color: "#34d399", flexShrink: 0 }}>👤</span>
                  <input
                    type="text"
                    value={emolaName}
                    onChange={e => setEmolaName(e.target.value)}
                    placeholder="Ex: Celso Cristiano"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                  />
                </div>
                <button onClick={handleSaveEmolaName} disabled={!emolaName.trim() || savingEmolaName}
                  style={{
                    padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: emolaName.trim() ? "pointer" : "default",
                    background: emolaName.trim() ? "linear-gradient(135deg, #34d399, #059669)" : "var(--gz-bg-subtle)",
                    color: emolaName.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                  {savingEmolaName ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>Nome exibido por baixo do número e-Mola na tela de depósito/aposta.</p>
            </div>

          </div>
        </SectionCard>

        {/* Ad Banner Script — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionCard title="Banner de Anúncios" icon={LayoutTemplate} color="#f59e0b" bg="rgba(245,158,11,0.1)">
            <div style={{ paddingTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Script do Anúncio (Banner de Apostas &amp; Home)
              </label>
              <textarea
                value={adBannerScript}
                onChange={e => setAdBannerScript(e.target.value)}
                placeholder={`<script>\n  atOptions = { 'key': '...', 'format': 'iframe', 'height': 50, 'width': 320 };\n</script>\n<script src="https://...invoke.js"></script>`}
                rows={6}
                style={{
                  width: "100%", background: "var(--gz-bg-subtle)",
                  border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: 12,
                  padding: "12px 14px", resize: "vertical", outline: "none",
                  fontSize: 12, color: "var(--gz-text-primary)", fontFamily: "monospace",
                  lineHeight: 1.6, boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                Cola aqui o script completo do anúncio (ex: Adsterra, Google AdSense). O banner será exibido automaticamente na tela de Apostas e acima dos Saques 24h na Home.
              </p>
              <button
                onClick={handleSaveAdScript}
                disabled={savingAdScript}
                style={{
                  marginTop: 14, padding: "11px 20px", borderRadius: 12, border: "none",
                  background: adBannerScript.trim() ? "linear-gradient(135deg, #f59e0b, #d97706)" : "var(--gz-bg-subtle)",
                  color: adBannerScript.trim() ? "#000" : "var(--gz-text-tertiary)",
                  fontWeight: 700, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                  cursor: adBannerScript.trim() && !savingAdScript ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >
                {savingAdScript ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                Guardar Script de Anúncio
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Debito Pay Gateway */}
        <DebitoPaySection />

        {/* Security Gate Password */}
        <SectionCard title="Senha da Porta de Segurança" icon={Lock} color="#8b5cf6" bg="rgba(139,92,246,0.1)">
          <div style={{ paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(108,92,231,0.05)", border: "1px solid rgba(108,92,231,0.1)", marginBottom: 16 }}>
              <Shield style={{ width: 14, height: 14, color: "#6C5CE7", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--gz-text-muted)" }}>
                Senha actual: <strong style={{ color: "var(--gz-text-primary)", fontFamily: "monospace" }}>{currentSecPw ? "●".repeat(currentSecPw.length) : "..."}</strong>
              </span>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
              Nova Senha de Segurança
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,0.1)" }}>
                <Lock style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
                <input
                  type={showSecPw ? "text" : "password"}
                  value={secPw}
                  onChange={e => setSecPw(e.target.value)}
                  placeholder="Nova senha (mín. 6 chars)"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "inherit" }}
                />
                <button onClick={() => setShowSecPw(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gz-text-tertiary)", padding: 0 }}>
                  {showSecPw ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                </button>
              </div>
              <button
                onClick={handleSaveSecPw}
                disabled={secPw.length < 6 || savingSecPw}
                style={{
                  padding: "10px 14px", borderRadius: 12, border: "none", cursor: secPw.length >= 6 ? "pointer" : "default",
                  background: secPw.length >= 6 ? "linear-gradient(135deg, #8b5cf6, #6C5CE7)" : "var(--gz-bg-subtle)",
                  color: secPw.length >= 6 ? "#fff" : "var(--gz-text-tertiary)",
                  fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                }}
              >
                {savingSecPw ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 8 }}>
              ⚠️ Altera imediatamente — a nova senha é exigida no próximo acesso ao painel.
            </p>
          </div>
        </SectionCard>

        {/* Version Control */}
        <SectionCard title="Controlo de Versão" icon={Tag} color="#6366F1" bg="rgba(99,102,241,0.1)">
          <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Versão da Aplicação
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(99,102,241,0.2)" }}>
                  <Tag style={{ width: 14, height: 14, color: "#6366F1", flexShrink: 0 }} />
                  <input type="text" value={appVersion} onChange={e => setAppVersion(e.target.value)}
                    placeholder="1.0.0"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--gz-text-primary)", fontFamily: "monospace" }} />
                </div>
                <button onClick={handleSaveVersion} disabled={!appVersion.trim() || savingVersion}
                  style={{ padding: "10px 14px", borderRadius: 12, border: "none",
                    cursor: appVersion.trim() && !savingVersion ? "pointer" : "default",
                    background: appVersion.trim() ? "linear-gradient(135deg, #6366F1, #4f46e5)" : "var(--gz-bg-subtle)",
                    color: appVersion.trim() ? "#fff" : "var(--gz-text-tertiary)",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                  {savingVersion ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6 }}>
                Versão exibida nas Definições do utilizador e no rodapé do admin. Use o formato <code style={{ fontFamily: "monospace" }}>MAJOR.MINOR.PATCH</code>.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Terms of Service Editor */}
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionCard title="Termos de Serviço" icon={FileText} color="#0ea5e9" bg="rgba(14,165,233,0.1)">
            <div style={{ paddingTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Conteúdo dos Termos de Serviço (texto ou Markdown)
              </label>
              <textarea value={termsContent} onChange={e => setTermsContent(e.target.value)}
                placeholder={"# Termos de Serviço\n\n**1. Aceitação dos Termos**\nAo aceder à plataforma WinMoz...\n\n**2. Elegibilidade**\nTens de ter 18 anos ou mais..."}
                rows={12}
                style={{ width: "100%", background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(14,165,233,0.25)",
                  borderRadius: 12, padding: "12px 14px", resize: "vertical", outline: "none",
                  fontSize: 12, color: "var(--gz-text-primary)", fontFamily: "monospace",
                  lineHeight: 1.6, boxSizing: "border-box" }} />
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                O conteúdo é exibido na página <strong>/termos</strong>. Suporta Markdown básico (**negrito**, # título, • listas).
              </p>
              <button onClick={handleSaveTerms} disabled={savingTerms}
                style={{ marginTop: 12, padding: "11px 20px", borderRadius: 12, border: "none",
                  background: termsContent.trim() ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : "var(--gz-bg-subtle)",
                  color: termsContent.trim() ? "#fff" : "var(--gz-text-tertiary)", fontWeight: 700, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8, cursor: termsContent.trim() && !savingTerms ? "pointer" : "default", fontFamily: "inherit" }}>
                {savingTerms ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                Guardar Termos de Serviço
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Privacy Policy Editor */}
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionCard title="Política de Privacidade" icon={BookOpen} color="#10b981" bg="rgba(16,185,129,0.1)">
            <div style={{ paddingTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gz-text-secondary)", display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Conteúdo da Política de Privacidade (texto ou Markdown)
              </label>
              <textarea value={privacyContent} onChange={e => setPrivacyContent(e.target.value)}
                placeholder={"# Política de Privacidade\n\n**Última actualização:** Junho 2025\n\n**1. Dados Recolhidos**\nRecolhemos os seguintes dados..."}
                rows={12}
                style={{ width: "100%", background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(16,185,129,0.25)",
                  borderRadius: 12, padding: "12px 14px", resize: "vertical", outline: "none",
                  fontSize: 12, color: "var(--gz-text-primary)", fontFamily: "monospace",
                  lineHeight: 1.6, boxSizing: "border-box" }} />
              <p style={{ fontSize: 11, color: "var(--gz-text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                O conteúdo é exibido na página <strong>/privacidade</strong>. Suporta Markdown básico.
              </p>
              <button onClick={handleSavePrivacy} disabled={savingPrivacy}
                style={{ marginTop: 12, padding: "11px 20px", borderRadius: 12, border: "none",
                  background: privacyContent.trim() ? "linear-gradient(135deg, #10b981, #059669)" : "var(--gz-bg-subtle)",
                  color: privacyContent.trim() ? "#fff" : "var(--gz-text-tertiary)", fontWeight: 700, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8, cursor: privacyContent.trim() && !savingPrivacy ? "pointer" : "default", fontFamily: "inherit" }}>
                {savingPrivacy ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                Guardar Política de Privacidade
              </button>
            </div>
          </SectionCard>
        </div>

      </div>

      {/* Footer info */}
      <div style={{
        marginTop: 24, borderRadius: 20, padding: "20px 24px",
        background: "linear-gradient(135deg, #1a0533, #2d0f6b)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wrench style={{ width: 17, height: 17, color: "#a78bfa" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>MOZBET Admin v1.0</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Plataforma de jogos com apostas em tempo real</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "API", status: "Online", color: "#34d399" },
            { label: "DB", status: "Conectado", color: "#34d399" },
            { label: "IA", status: settings.support_ai_mode ? "Activa" : "Desligada", color: settings.support_ai_mode ? "#0ea5e9" : "#6b7280" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, textAlign: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</span>
              <span style={{ fontSize: 10, color: item.color, fontWeight: 700 }}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
