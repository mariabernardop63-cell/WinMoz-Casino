import { useState } from "react";
import {
  UserX, Search, ShieldOff, Globe, Clock, AlertTriangle,
  CheckCircle2, XCircle, Lock, Unlock, Filter,
  ChevronDown,
} from "lucide-react";

const V1 = "#6C5CE7";

type BlockType = "account" | "ip" | "device";

const BLOCKED_USERS = [
  { id: 1, name: "Roberto Silva",    email: "roberto@gmail.com", ip: "196.27.14.88",   reason: "Fraude confirmada",       blockedAt: "2025-06-01 14:30", type: "account" as BlockType, severity: "high"   },
  { id: 2, name: "Unknown",          email: "—",                  ip: "41.215.100.22",  reason: "Múltiplas contas",        blockedAt: "2025-05-28 10:00", type: "ip"      as BlockType, severity: "medium" },
  { id: 3, name: "Ana Costa",        email: "anacosta@outlook.com", ip: "196.30.5.11",  reason: "Comportamento suspeito",  blockedAt: "2025-05-25 09:15", type: "account" as BlockType, severity: "medium" },
  { id: 4, name: "Unknown",          email: "—",                  ip: "102.130.5.200",  reason: "DDoS detectado",          blockedAt: "2025-05-20 18:00", type: "ip"      as BlockType, severity: "high"   },
  { id: 5, name: "Luís Fernandes",   email: "luis.f@yahoo.com",   ip: "197.220.14.9",   reason: "Trapaça no jogo",         blockedAt: "2025-05-18 12:45", type: "account" as BlockType, severity: "low"    },
];

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    high:   { cls: "bg-red-100 text-red-700",    label: "Alto risco"    },
    medium: { cls: "bg-amber-100 text-amber-700", label: "Médio risco"  },
    low:    { cls: "bg-blue-100 text-blue-700",   label: "Baixo risco"  },
  };
  const item = map[severity] ?? map.low;
  return <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${item.cls}`}>{item.label}</span>;
}

function TypeBadge({ type }: { type: BlockType }) {
  const map: Record<BlockType, { cls: string; label: string; icon: React.ElementType }> = {
    account: { cls: "bg-purple-100 text-purple-700", label: "Conta",      icon: UserX  },
    ip:      { cls: "bg-red-100 text-red-700",       label: "Endereço IP", icon: Globe  },
    device:  { cls: "bg-orange-100 text-orange-700", label: "Dispositivo", icon: Lock   },
  };
  const item = map[type];
  const Icon = item.icon;
  return (
    <span className={`flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${item.cls}`}>
      <Icon style={{ width: 9, height: 9 }} />
      {item.label}
    </span>
  );
}

export default function BlockUsers() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BlockType>("all");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [confirmUnblockId, setConfirmUnblockId] = useState<number | null>(null);
  const [blockedList, setBlockedList] = useState(BLOCKED_USERS);
  const [showSuccess, setShowSuccess] = useState("");

  // New block form
  const [blockTarget, setBlockTarget] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("account");
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState<"permanent" | "7d" | "30d">("permanent");

  const filtered = blockedList.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.ip.includes(search);
    const matchType = typeFilter === "all" || u.type === typeFilter;
    return matchSearch && matchType;
  });

  function handleBlock() {
    const newEntry = {
      id: Date.now(),
      name: blockType === "ip" ? "Unknown" : blockTarget,
      email: blockType === "ip" ? "—" : `${blockTarget.toLowerCase().replace(/\s+/, ".")}@email.com`,
      ip: blockType === "ip" ? blockTarget : "196.0.0.1",
      reason: blockReason || "Bloqueio manual",
      blockedAt: new Date().toLocaleString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
      type: blockType,
      severity: "medium" as const,
    };
    setBlockedList(p => [newEntry, ...p]);
    setShowBlockModal(false);
    setBlockTarget(""); setBlockReason("");
    setShowSuccess("Utilizador bloqueado com sucesso.");
    setTimeout(() => setShowSuccess(""), 3500);
  }

  function handleUnblock(id: number) {
    setBlockedList(p => p.filter(u => u.id !== id));
    setConfirmUnblockId(null);
    setShowSuccess("Utilizador desbloqueado com sucesso.");
    setTimeout(() => setShowSuccess(""), 3500);
  }

  return (
    <div className="px-5 pb-10 pt-4">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-float-up"
          style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff" }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">{showSuccess}</span>
        </div>
      )}

      {/* Confirm unblock modal */}
      {confirmUnblockId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-4 mx-auto">
              <Unlock className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">Desbloquear utilizador?</h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-6">O utilizador voltará a ter acesso à plataforma imediatamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUnblockId(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleUnblock(confirmUnblockId)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
                Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-[16px] font-bold text-gray-900">Novo bloqueio</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block text-gray-400">Tipo de bloqueio</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "account" as BlockType, icon: UserX,  label: "Conta"      },
                    { id: "ip"      as BlockType, icon: Globe,  label: "IP"          },
                    { id: "device"  as BlockType, icon: Lock,   label: "Dispositivo" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setBlockType(t.id)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-[12px] font-bold transition-all"
                      style={{ border: blockType === t.id ? `1.5px solid ${V1}` : "1px solid #e5e7eb", background: blockType === t.id ? "rgba(108,92,231,.06)" : "#fff", color: blockType === t.id ? V1 : "#6b7280" }}>
                      <t.icon style={{ width: 16, height: 16 }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block text-gray-400">
                  {blockType === "ip" ? "Endereço IP" : blockType === "account" ? "Nome ou email do utilizador" : "ID do dispositivo"}
                </label>
                <input value={blockTarget} onChange={e => setBlockTarget(e.target.value)}
                  placeholder={blockType === "ip" ? "Ex: 196.27.14.88" : blockType === "account" ? "Ex: João Machava" : "Ex: dev-abc123"}
                  className="w-full px-3.5 py-2.5 rounded-xl outline-none text-[13px] border border-gray-200 focus:border-indigo-400" />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block text-gray-400">Motivo do bloqueio</label>
                <textarea value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  rows={3} className="w-full px-3.5 py-2.5 rounded-xl outline-none text-[13px] border border-gray-200 focus:border-indigo-400 resize-none" />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block text-gray-400">Duração</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "permanent" as const, label: "Permanente" },
                    { id: "30d"       as const, label: "30 dias"    },
                    { id: "7d"        as const, label: "7 dias"     },
                  ].map(d => (
                    <button key={d.id} onClick={() => setBlockDuration(d.id)}
                      className="py-2 rounded-xl text-[12px] font-semibold transition-all"
                      style={{ border: blockDuration === d.id ? `1.5px solid #ef4444` : "1px solid #e5e7eb", background: blockDuration === d.id ? "rgba(239,68,68,.06)" : "#fff", color: blockDuration === d.id ? "#ef4444" : "#6b7280" }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowBlockModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleBlock} disabled={!blockTarget.trim()}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
              <UserX style={{ width: 18, height: 18, color: "white", strokeWidth: 1.9 }} />
            </div>
            <div>
              <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Bloquear Utilizadores</h1>
              <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
                Gestão avançada de bloqueios · {blockedList.length} activos
              </p>
            </div>
          </div>
          <button onClick={() => setShowBlockModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
            style={{ background: `linear-gradient(135deg, #ef4444, #dc2626)`, boxShadow: "0 4px 12px rgba(239,68,68,.35)" }}>
            <ShieldOff style={{ width: 14, height: 14 }} />
            Novo bloqueio
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Contas bloqueadas", value: blockedList.filter(u => u.type === "account").length, icon: UserX,       color: "#ef4444" },
          { label: "IPs bloqueados",    value: blockedList.filter(u => u.type === "ip").length,      icon: Globe,       color: "#f97316" },
          { label: "Alto risco",        value: blockedList.filter(u => u.severity === "high").length,icon: AlertTriangle, color: "#dc2626" },
          { label: "Total activos",     value: blockedList.length,                                    icon: Lock,        color: V1 },
        ].map(s => (
          <div key={s.label} className="gz-card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}12` }}>
              <s.icon style={{ width: 16, height: 16, color: s.color, strokeWidth: 1.9 }} />
            </div>
            <div className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="gz-card p-4 flex items-center gap-3 mb-5">
        <Search style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar por nome, email ou IP..."
          className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: "var(--gz-text-primary)" }} />
        <div className="flex items-center gap-2 border-l pl-3" style={{ borderColor: "rgba(108,92,231,.08)" }}>
          <Filter style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as "all" | BlockType)}
            className="text-[12px] font-medium bg-transparent outline-none"
            style={{ color: "var(--gz-text-secondary)" }}>
            <option value="all">Todos os tipos</option>
            <option value="account">Conta</option>
            <option value="ip">IP</option>
            <option value="device">Dispositivo</option>
          </select>
          <ChevronDown style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
        </div>
      </div>

      {/* Blocked list */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{filtered.length} bloqueios encontrados</span>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <UserX style={{ width: 28, height: 28, color: "var(--gz-text-tertiary)", margin: "0 auto 8px", strokeWidth: 1.3 }} />
              <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum bloqueio encontrado</div>
            </div>
          ) : filtered.map(u => (
            <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-red-50/20 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,.08)" }}>
                {u.type === "ip" ? <Globe style={{ width: 16, height: 16, color: "#ef4444" }} /> : <UserX style={{ width: 16, height: 16, color: "#ef4444" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{u.name}</span>
                  <TypeBadge type={u.type} />
                  <SeverityBadge severity={u.severity} />
                </div>
                <div className="text-[11.5px] flex items-center gap-3 flex-wrap" style={{ color: "var(--gz-text-muted)" }}>
                  {u.email !== "—" && <span>{u.email}</span>}
                  <span className="flex items-center gap-1"><Globe style={{ width: 9, height: 9 }} />{u.ip}</span>
                  <span>·</span>
                  <span>{u.reason}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock style={{ width: 9, height: 9 }} />{u.blockedAt}</span>
                </div>
              </div>
              <button onClick={() => setConfirmUnblockId(u.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:shadow-md"
                style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.18)" }}>
                <Unlock style={{ width: 12, height: 12 }} />
                Desbloquear
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
