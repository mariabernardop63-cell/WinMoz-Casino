import { useState } from "react";
import {
  UserX, Search, ShieldOff, Globe, Clock, AlertTriangle,
  CheckCircle2, Unlock, Lock, Filter, ChevronDown, User,
} from "lucide-react";
import {
  useListBlockedUsers,
  useBlockUser,
  useUnblockUser,
  useSearchProfilesForBlock,
} from "@/admin/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";

const V1 = "#6C5CE7";
type BlockType = "account" | "ip" | "device";

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    high:   { cls: "bg-red-100 text-red-700",    label: "Alto risco"   },
    medium: { cls: "bg-amber-100 text-amber-700", label: "Médio risco" },
    low:    { cls: "bg-blue-100 text-blue-700",   label: "Baixo risco" },
  };
  const item = map[severity] ?? map.medium;
  return <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${item.cls}`}>{item.label}</span>;
}

function TypeBadge({ type }: { type: BlockType }) {
  const map: Record<BlockType, { cls: string; label: string; icon: React.ElementType }> = {
    account: { cls: "bg-purple-100 text-purple-700", label: "Conta",       icon: UserX  },
    ip:      { cls: "bg-red-100 text-red-700",        label: "Endereço IP", icon: Globe  },
    device:  { cls: "bg-orange-100 text-orange-700",  label: "Dispositivo", icon: Lock   },
  };
  const item = map[type] ?? map.account;
  const Icon = item.icon;
  return (
    <span className={`flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${item.cls}`}>
      <Icon style={{ width: 9, height: 9 }} />
      {item.label}
    </span>
  );
}

export default function BlockUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BlockType>("all");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [confirmUnblockId, setConfirmUnblockId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState("");
  const [showError, setShowError] = useState("");

  const { data: blockedList = [], isLoading } = useListBlockedUsers();
  const blockUser    = useBlockUser();
  const unblockUser  = useUnblockUser();

  // New block form
  const [blockSearch, setBlockSearch]   = useState("");
  const [blockType, setBlockType]       = useState<BlockType>("account");
  const [blockDuration, setBlockDuration] = useState<"permanent" | "7d" | "30d">("permanent");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");

  const { data: searchResults = [], isFetching: searching } = useSearchProfilesForBlock(blockSearch);

  const filtered = blockedList.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || u.blockType === typeFilter;
    return matchSearch && matchType;
  });

  function toast(msg: string, isError = false) {
    if (isError) { setShowError(msg); setTimeout(() => setShowError(""), 3500); }
    else          { setShowSuccess(msg); setTimeout(() => setShowSuccess(""), 3500); }
  }

  function handleBlock() {
    if (!selectedUserId) return;
    blockUser.mutate(
      { userId: selectedUserId, blockType },
      {
        onSuccess: () => {
          setShowBlockModal(false);
          setBlockSearch(""); setSelectedUserId(null); setSelectedUserName("");
          qc.invalidateQueries({ queryKey: ["blocked-users"] });
          toast(`${selectedUserName} bloqueado com sucesso.`);
        },
        onError: () => toast("Erro ao bloquear utilizador.", true),
      }
    );
  }

  function handleUnblock(id: string) {
    const name = blockedList.find(u => u.id === id)?.name ?? "Utilizador";
    unblockUser.mutate(id, {
      onSuccess: () => {
        setConfirmUnblockId(null);
        qc.invalidateQueries({ queryKey: ["blocked-users"] });
        toast(`${name} desbloqueado com sucesso.`);
      },
      onError: () => { setConfirmUnblockId(null); toast("Erro ao desbloquear.", true); },
    });
  }

  return (
    <div className="px-5 pb-10 pt-4">

      {/* Toasts */}
      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-float-up"
          style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, color: "#fff" }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">{showSuccess}</span>
        </div>
      )}
      {showError && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl"
          style={{ background: "#ef4444", color: "#fff" }}>
          <AlertTriangle style={{ width: 18, height: 18 }} />
          <span className="text-[13.5px] font-bold">{showError}</span>
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
              <button onClick={() => handleUnblock(confirmUnblockId)} disabled={unblockUser.isPending}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-60">
                {unblockUser.isPending ? "A desbloquear…" : "Desbloquear"}
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
                    { id: "account" as BlockType, icon: UserX,  label: "Conta"       },
                    { id: "ip"      as BlockType, icon: Globe,  label: "IP"           },
                    { id: "device"  as BlockType, icon: Lock,   label: "Dispositivo"  },
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
                  Procurar utilizador por nome ou telefone
                </label>
                <div className="relative">
                  <Search style={{ width: 13, height: 13, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    value={blockSearch}
                    onChange={e => { setBlockSearch(e.target.value); setSelectedUserId(null); setSelectedUserName(""); }}
                    placeholder="Nome ou número de telefone…"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl outline-none text-[13px] border border-gray-200 focus:border-indigo-400"
                  />
                </div>

                {/* Search results */}
                {blockSearch.trim().length >= 2 && (
                  <div className="mt-1.5 rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    {searching && (
                      <div className="px-4 py-3 text-[12px] text-gray-400 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-indigo-400 animate-spin" />
                        A procurar…
                      </div>
                    )}
                    {!searching && searchResults.length === 0 && (
                      <div className="px-4 py-3 text-[12px] text-gray-400">Nenhum utilizador encontrado</div>
                    )}
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => { setSelectedUserId(r.id); setSelectedUserName(r.name); setBlockSearch(r.name); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                        style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(108,92,231,.1)" }}>
                          <User style={{ width: 13, height: 13, color: V1 }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-bold text-gray-800 truncate">{r.name}</div>
                          {r.phone !== "—" && <div className="text-[11px] text-gray-400">{r.phone}</div>}
                        </div>
                        {r.isBlocked && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Já bloqueado</span>}
                        {selectedUserId === r.id && <CheckCircle2 style={{ width: 14, height: 14, color: V1, flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )}

                {selectedUserId && (
                  <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)" }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: "#059669" }} />
                    <span className="text-[12px] font-bold text-green-700">Selecionado: {selectedUserName}</span>
                  </div>
                )}
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
                      style={{ border: blockDuration === d.id ? "1.5px solid #ef4444" : "1px solid #e5e7eb", background: blockDuration === d.id ? "rgba(239,68,68,.06)" : "#fff", color: blockDuration === d.id ? "#ef4444" : "#6b7280" }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowBlockModal(false); setBlockSearch(""); setSelectedUserId(null); setSelectedUserName(""); }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleBlock} disabled={!selectedUserId || blockUser.isPending}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {blockUser.isPending ? "A bloquear…" : "Bloquear"}
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
                Gestão avançada de bloqueios · {isLoading ? "…" : blockedList.length} activos
              </p>
            </div>
          </div>
          <button onClick={() => setShowBlockModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 12px rgba(239,68,68,.35)" }}>
            <ShieldOff style={{ width: 14, height: 14 }} />
            Novo bloqueio
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Contas bloqueadas", value: isLoading ? "…" : blockedList.filter(u => u.blockType === "account").length, icon: UserX,        color: "#ef4444" },
          { label: "IPs bloqueados",    value: isLoading ? "…" : blockedList.filter(u => u.blockType === "ip").length,      icon: Globe,        color: "#f97316" },
          { label: "Dispositivos",      value: isLoading ? "…" : blockedList.filter(u => u.blockType === "device").length,  icon: Lock,         color: "#8b5cf6" },
          { label: "Total activos",     value: isLoading ? "…" : blockedList.length,                                         icon: AlertTriangle, color: V1       },
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar por nome ou telefone…"
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
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
            {isLoading ? "A carregar…" : `${filtered.length} bloqueio${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.05)" }}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 h-16 animate-pulse m-2 rounded-2xl" style={{ background: "var(--gz-bg-subtle)" }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <UserX style={{ width: 28, height: 28, color: "var(--gz-text-tertiary)", margin: "0 auto 8px", strokeWidth: 1.3 }} />
              <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum bloqueio activo</div>
              <div className="text-[11.5px] mt-1" style={{ color: "var(--gz-text-muted)" }}>Clica em "Novo bloqueio" para bloquear um utilizador</div>
            </div>
          ) : filtered.map(u => (
            <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-red-50/20 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,.08)" }}>
                {u.blockType === "ip" ? <Globe style={{ width: 16, height: 16, color: "#ef4444" }} /> : u.blockType === "device" ? <Lock style={{ width: 16, height: 16, color: "#ef4444" }} /> : <UserX style={{ width: 16, height: 16, color: "#ef4444" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{u.name}</span>
                  <TypeBadge type={u.blockType} />
                  <SeverityBadge severity={u.severity} />
                </div>
                <div className="text-[11.5px] flex items-center gap-3 flex-wrap" style={{ color: "var(--gz-text-muted)" }}>
                  {u.phone !== "—" && <span>{u.phone}</span>}
                  <span className="flex items-center gap-1"><Clock style={{ width: 9, height: 9 }} />
                    {new Date(u.blockedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
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
