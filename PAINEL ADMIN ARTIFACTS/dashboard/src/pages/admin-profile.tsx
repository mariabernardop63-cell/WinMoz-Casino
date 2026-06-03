import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, Mail, Phone, Lock, Save, Shield,
  Calendar, Edit3, CheckCircle2, Image,
} from "lucide-react";
import { api, type AdminProfile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  financial: "Financeiro",
  moderator: "Moderador",
  support: "Suporte",
};
const ROLE_COLORS: Record<string, string> = {
  super_admin: "#6C5CE7",
  admin: "#3b82f6",
  financial: "#10b981",
  moderator: "#f59e0b",
  support: "#8b5cf6",
};

const ADMIN_ROLES = ["super_admin", "admin", "financial", "moderator", "support"] as const;

const V1 = "#6C5CE7";

function FieldInput({ label, icon: Icon, value, onChange, type = "text", disabled = false, placeholder }: {
  label: string; icon: React.ElementType; value: string; onChange?: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>{label}</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
        style={{ background: disabled ? "rgba(108,92,231,.03)" : "rgba(108,92,231,.05)", border: "1.5px solid rgba(108,92,231,.12)" }}>
        <Icon style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9, flexShrink: 0, opacity: disabled ? 0.4 : 1 }} />
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[13.5px] font-medium"
          style={{ color: disabled ? "var(--gz-text-muted)" : "var(--gz-text-primary)" }}
        />
      </div>
    </div>
  );
}

export default function AdminProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<AdminProfile>({
    queryKey: ["admin-profile"],
    queryFn: () => api.get<AdminProfile>("/admin/profile"),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const updateProfile = useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; role: string; avatarUrl: string }) =>
      api.put<AdminProfile>("/admin/profile", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profile"] });
      setEditMode(false);
      toast({ title: "Perfil actualizado", description: "As suas informações foram guardadas." });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível actualizar o perfil.", variant: "destructive" }),
  });

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post("/admin/change-password", data),
    onSuccess: () => {
      setCurrentPassword(""); setNewPass(""); setConfirmPass("");
      toast({ title: "Senha alterada", description: "A sua senha foi actualizada com sucesso." });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function handleEnterEdit() {
    setName(profile?.name ?? "");
    setEmail(profile?.email ?? "");
    setPhone(profile?.phone ?? "");
    setRole(profile?.role ?? "admin");
    setAvatarUrl(profile?.avatarUrl ?? "");
    setEditMode(true);
  }

  function handleSaveProfile() {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Erro", description: "Nome e email são obrigatórios.", variant: "destructive" });
      return;
    }
    updateProfile.mutate({ name, email, phone, role, avatarUrl });
  }

  function handleChangePassword() {
    if (!currentPassword || !newPass) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    if (newPass !== confirmPass) { toast({ title: "As senhas não coincidem", variant: "destructive" }); return; }
    if (newPass.length < 6) { toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" }); return; }
    changePassword.mutate({ currentPassword, newPassword: newPass });
  }

  if (isLoading) {
    return (
      <div className="px-5 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {[140, 300, 260].map((h, i) => (
            <div key={i} className="gz-card animate-pulse" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profile?.role ?? ""] ?? "Admin";
  const roleColor = ROLE_COLORS[profile?.role ?? ""] ?? V1;
  const avatarSrc = profile?.avatarUrl
    ? profile.avatarUrl
    : `https://api.dicebear.com/9.x/avataaars/svg?seed=${profile?.username ?? "Admin"}&backgroundColor=6C5CE7`;

  return (
    <div className="px-5 pb-10 pt-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Avatar card */}
        <div className="gz-card p-6 flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(108,92,231,.18)" }}>
              <img
                src={editMode && avatarUrl ? avatarUrl : avatarSrc}
                alt={profile?.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", background: "white" }}
                onError={e => { (e.target as HTMLImageElement).src = avatarSrc; }}
              />
            </div>
            <span style={{
              position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: "50%",
              background: "#10b981", border: "2.5px solid white", boxShadow: "0 0 8px rgba(16,185,129,.5)",
            }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>{profile?.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: `${roleColor}14`, color: roleColor }}>
                {roleLabel}
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>@{profile?.username}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Calendar style={{ width: 11, height: 11, color: "var(--gz-text-tertiary)", strokeWidth: 2 }} />
              <span className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                Membro desde {new Date(profile?.createdAt ?? "").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
          {!editMode && (
            <button onClick={handleEnterEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
              <Edit3 style={{ width: 13, height: 13 }} />
              Editar
            </button>
          )}
        </div>

        {/* Profile form */}
        <div className="gz-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Informações Pessoais</div>
            {editMode && (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition-all hover:bg-gray-100 active:scale-95"
                  style={{ color: "var(--gz-text-muted)" }}>
                  Cancelar
                </button>
                <button onClick={handleSaveProfile}
                  disabled={updateProfile.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, opacity: updateProfile.isPending ? 0.7 : 1 }}>
                  <Save style={{ width: 12, height: 12 }} />
                  {updateProfile.isPending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <FieldInput label="Nome Completo" icon={User}
              value={editMode ? name : (profile?.name ?? "")}
              onChange={setName} disabled={!editMode} />
            <FieldInput label="Email" icon={Mail} type="email"
              value={editMode ? email : (profile?.email ?? "")}
              onChange={setEmail} disabled={!editMode} />
            <FieldInput label="Telefone" icon={Phone}
              value={editMode ? phone : (profile?.phone ?? "—")}
              onChange={setPhone} disabled={!editMode} />
            <FieldInput label="Utilizador" icon={User}
              value={profile?.username ?? ""} disabled />

            {/* Avatar URL with live preview + remove */}
            {editMode ? (
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>
                  URL do Avatar (opcional)
                </label>
                <div className="flex items-center gap-3">
                  {/* Live preview */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid rgba(108,92,231,.15)" }}>
                    <img
                      src={avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${profile?.username ?? "Admin"}&backgroundColor=6C5CE7`}
                      alt="preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "white" }}
                      onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${profile?.username ?? "Admin"}&backgroundColor=6C5CE7`; }}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl"
                    style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)" }}>
                    <Image style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9, flexShrink: 0 }} />
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-transparent outline-none text-[13.5px] font-medium"
                      style={{ color: "var(--gz-text-primary)" }}
                    />
                    {avatarUrl && (
                      <button
                        onClick={() => setAvatarUrl("")}
                        title="Remover avatar"
                        className="w-5 h-5 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <span style={{ color: "#ef4444", fontSize: 14, lineHeight: 1, fontWeight: 700 }}>×</span>
                      </button>
                    )}
                  </div>
                </div>
                {avatarUrl && (
                  <button
                    onClick={() => setAvatarUrl("")}
                    className="mt-2 text-[11.5px] font-bold flex items-center gap-1.5 transition-colors hover:opacity-80"
                    style={{ color: "#ef4444" }}
                  >
                    <span>✕</span> Remover avatar (usar gerado automaticamente)
                  </button>
                )}
              </div>
            ) : (
              <FieldInput label="URL do Avatar" icon={Image}
                value={profile?.avatarUrl ?? "—"}
                disabled />
            )}

            {/* Role select */}
            {editMode && (
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Cargo</label>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_ROLES.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all"
                      style={{
                        background: role === r ? V1 : "rgba(108,92,231,.07)",
                        color: role === r ? "white" : "var(--gz-text-muted)",
                      }}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {editMode && (
            <div className="mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.15)" }}>
              <CheckCircle2 style={{ width: 13, height: 13, color: "#10b981", strokeWidth: 2 }} />
              <span className="text-[12px] font-medium" style={{ color: "#059669" }}>Edição activa — não esqueça de guardar</span>
            </div>
          )}
        </div>

        {/* Role card */}
        <div className="gz-card p-6">
          <div className="text-[15px] font-bold mb-4" style={{ color: "var(--gz-text-primary)" }}>Permissões</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${roleColor}14` }}>
              <Shield style={{ width: 18, height: 18, color: roleColor, strokeWidth: 1.8 }} />
            </div>
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{roleLabel}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                {profile?.role === "super_admin"
                  ? "Acesso total a todas as funcionalidades da plataforma"
                  : profile?.role === "admin"
                  ? "Acesso administrativo geral à plataforma"
                  : profile?.role === "financial"
                  ? "Acesso a pagamentos, saques e relatórios financeiros"
                  : profile?.role === "moderator"
                  ? "Acesso a gestão de jogadores e denúncias"
                  : "Acesso limitado conforme a função"}
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="gz-card p-6" id="security">
          <div className="text-[15px] font-bold mb-5" style={{ color: "var(--gz-text-primary)" }}>Alterar Senha</div>
          <div className="space-y-4">
            <FieldInput label="Senha Actual" icon={Lock} type="password" value={currentPassword} onChange={setCurrentPassword} />
            <FieldInput label="Nova Senha" icon={Lock} type="password" value={newPass} onChange={setNewPass} />
            <FieldInput label="Confirmar Nova Senha" icon={Lock} type="password" value={confirmPass} onChange={setConfirmPass} />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={changePassword.isPending}
            className="mt-5 w-full py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${V1}, #4f46e5)`,
              boxShadow: "0 4px 14px rgba(108,92,231,.35)",
              opacity: changePassword.isPending ? 0.7 : 1,
            }}
          >
            {changePassword.isPending ? "A alterar..." : "Alterar Senha"}
          </button>
        </div>

      </div>
    </div>
  );
}
