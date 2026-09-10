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
import {
  PageHeader, Card, SectionHeader, KpiTile, KpiGrid, EmptyState, Modal, StatusPill,
} from "@/admin/components/ui";

const V1 = "#18181b";
type BlockType = "account" | "ip" | "device";

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { color: string; label: string }> = {
    high:   { color: "#b91c1c", label: "Alto risco"   },
    medium: { color: "#a16207", label: "Médio risco"  },
    low:    { color: "#2563eb", label: "Baixo risco"  },
  };
  const item = map[severity] ?? map.medium;
  return <StatusPill label={item.label} color={item.color} />;
}

function TypeBadge({ type }: { type: BlockType }) {
  const map: Record<BlockType, { color: string; label: string; icon: React.ElementType }> = {
    account: { color: "#52525b", label: "Conta",         icon: UserX },
    ip:      { color: "#b91c1c", label: "Endereço IP",   icon: Globe },
    device:  { color: "#c2410c", label: "Dispositivo",   icon: Lock  },
  };
  const item = map[type] ?? map.account;
  const Icon = item.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `${item.color}16`, color: item.color, border: `1px solid ${item.color}30` }}>
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
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">

      {/* Toasts */}
      {showSuccess && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-[13px] font-bold text-white animate-float-up"
          style={{ background: "#15803d", maxWidth: 320 }}>
          <CheckCircle2 style={{ width: 16, height: 16 }} />
          {showSuccess}
        </div>
      )}
      {showError && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-[13px] font-bold text-white animate-float-up"
          style={{ background: "#b91c1c", maxWidth: 320 }}>
          <AlertTriangle style={{ width: 16, height: 16 }} />
          {showError}
        </div>
      )}

      <PageHeader
        icon={UserX}
        title="Bloquear"
        titleAccent="Utilizadores"
        subtitle={`Gestão avançada de bloqueios · ${isLoading ? "..." : blockedList.length} activos`}
      >
        <button onClick={() => setShowBlockModal(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
          style={{ background: "#b91c1c", boxShadow: "0 4px 12px rgba(185,28,28,.3)" }}>
          <ShieldOff style={{ width: 14, height: 14 }} />
          Novo bloqueio
        </button>
      </PageHeader>

      <div className="space-y-5">
        {/* KPIs */}
        <Card>
          <SectionHeader icon={UserX} title="Resumo de Bloqueios" />
          <KpiGrid cols={4}>
            <KpiTile label="Contas"        value={isLoading ? "..." : blockedList.filter(u => u.blockType === "account").length} icon={UserX}        accent="#b91c1c" />
            <KpiTile label="IPs"           value={isLoading ? "..." : blockedList.filter(u => u.blockType === "ip").length}      icon={Globe}        accent="#c2410c" />
            <KpiTile label="Dispositivos"  value={isLoading ? "..." : blockedList.filter(u => u.blockType === "device").length}  icon={Lock}         accent="#3f3f46" />
            <KpiTile label="Total Activos" value={isLoading ? "..." : blockedList.length}                                        icon={AlertTriangle} accent={V1} />
          </KpiGrid>
        </Card>

        {/* Search + filter */}
        <Card>
          <div className="p-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-1 min-w-[200px] px-3.5 rounded-xl"
              style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)" }}>
              <Search style={{ width: 14, height: 14, color: "var(--gz-text-tertiary)", flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar por nome ou telefone..."
                className="flex-1 bg-transparent outline-none text-[13px] py-2.5" style={{ color: "var(--gz-text-primary)" }} />
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)" }}>
              <Filter style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as "all" | BlockType)}
                className="text-[12px] font-semibold bg-transparent outline-none"
                style={{ color: "var(--gz-text-secondary)" }}>
                <option value="all">Todos os tipos</option>
                <option value="account">Conta</option>
                <option value="ip">IP</option>
                <option value="device">Dispositivo</option>
              </select>
              <ChevronDown style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
            </div>
          </div>
        </Card>

        {/* Blocked list */}
        <Card>
          <SectionHeader
            icon={UserX}
            title="Bloqueios Activos"
            action={
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
                {isLoading ? "A carregar..." : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
              </span>
            }
          />
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={UserX} title="Nenhum bloqueio activo" subtitle={'Clica em "Novo bloqueio" para bloquear um utilizador'} />
          ) : (
            <div>
              {filtered.map((u, idx) => (
                <div key={u.id} className="px-5 py-4 flex items-center gap-4 gz-tr"
                  style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gz-border-subtle)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(185,28,28,.08)" }}>
                    {u.blockType === "ip" ? <Globe style={{ width: 16, height: 16, color: "#b91c1c" }} /> : u.blockType === "device" ? <Lock style={{ width: 16, height: 16, color: "#b91c1c" }} /> : <UserX style={{ width: 16, height: 16, color: "#b91c1c" }} />}
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
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{ background: "rgba(21,128,61,.1)", color: "#059669", border: "1px solid rgba(21,128,61,.2)" }}>
                    <Unlock style={{ width: 12, height: 12 }} />
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Confirm unblock modal */}
      <Modal
        open={confirmUnblockId !== null}
        onClose={() => setConfirmUnblockId(null)}
        title="Desbloquear utilizador?"
        icon={Unlock}
        maxWidth={420}
      >
        <p className="text-[12.5px] leading-relaxed mb-6" style={{ color: "var(--gz-text-muted)" }}>
          O utilizador voltará a ter acesso à plataforma imediatamente.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmUnblockId(null)}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
            Cancelar
          </button>
          <button onClick={() => confirmUnblockId && handleUnblock(confirmUnblockId)} disabled={unblockUser.isPending}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: "#15803d" }}>
            {unblockUser.isPending ? "A desbloquear..." : "Desbloquear"}
          </button>
        </div>
      </Modal>

      {/* Block modal */}
      <Modal
        open={showBlockModal}
        onClose={() => { setShowBlockModal(false); setBlockSearch(""); setSelectedUserId(null); setSelectedUserName(""); }}
        title="Novo bloqueio"
        icon={UserX}
        maxWidth={520}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>Tipo de bloqueio</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "account" as BlockType, icon: UserX,  label: "Conta"       },
                { id: "ip"      as BlockType, icon: Globe,  label: "IP"          },
                { id: "device"  as BlockType, icon: Lock,   label: "Dispositivo" },
              ].map(t => (
                <button key={t.id} onClick={() => setBlockType(t.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-[12px] font-bold transition-all"
                  style={{
                    border: blockType === t.id ? `1.5px solid ${V1}` : "1px solid var(--gz-border-subtle)",
                    background: blockType === t.id ? "var(--gz-bg-subtle)" : "var(--gz-bg-card-btn)",
                    color: blockType === t.id ? "var(--gz-text-primary)" : "var(--gz-text-muted)",
                  }}>
                  <t.icon style={{ width: 16, height: 16 }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>
              Procurar utilizador por nome ou telefone
            </label>
            <div className="relative">
              <Search style={{ width: 13, height: 13, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gz-text-tertiary)" }} />
              <input
                value={blockSearch}
                onChange={e => { setBlockSearch(e.target.value); setSelectedUserId(null); setSelectedUserName(""); }}
                placeholder="Nome ou número de telefone..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl outline-none text-[13px]"
                style={{ background: "var(--gz-bg-subtle)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-primary)" }}
              />
            </div>

            {blockSearch.trim().length >= 2 && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--gz-border-subtle)", background: "var(--gz-bg-card)" }}>
                {searching && (
                  <div className="px-4 py-3 text-[12px] flex items-center gap-2" style={{ color: "var(--gz-text-muted)" }}>
                    <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--gz-text-tertiary)", borderTopColor: "transparent" }} />
                    A procurar...
                  </div>
                )}
                {!searching && searchResults.length === 0 && (
                  <div className="px-4 py-3 text-[12px]" style={{ color: "var(--gz-text-muted)" }}>Nenhum utilizador encontrado</div>
                )}
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => { setSelectedUserId(r.id); setSelectedUserName(r.name); setBlockSearch(r.name); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-[var(--gz-bg-subtle)]"
                    style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--gz-bg-subtle)" }}>
                      <User style={{ width: 13, height: 13, color: "var(--gz-text-secondary)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{r.name}</div>
                      {r.phone !== "—" && <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{r.phone}</div>}
                    </div>
                    {r.isBlocked && <StatusPill label="Já bloqueado" color="#dc2626" />}
                    {selectedUserId === r.id && <CheckCircle2 style={{ width: 14, height: 14, color: "#15803d", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}

            {selectedUserId && (
              <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(21,128,61,.08)", border: "1px solid rgba(21,128,61,.2)" }}>
                <CheckCircle2 style={{ width: 13, height: 13, color: "#059669" }} />
                <span className="text-[12px] font-bold" style={{ color: "#15803d" }}>Selecionado: {selectedUserName}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>Duração</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "permanent" as const, label: "Permanente" },
                { id: "30d"       as const, label: "30 dias"    },
                { id: "7d"        as const, label: "7 dias"     },
              ].map(d => (
                <button key={d.id} onClick={() => setBlockDuration(d.id)}
                  className="py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={{
                    border: blockDuration === d.id ? "1.5px solid #b91c1c" : "1px solid var(--gz-border-subtle)",
                    background: blockDuration === d.id ? "rgba(185,28,28,.08)" : "var(--gz-bg-card-btn)",
                    color: blockDuration === d.id ? "#b91c1c" : "var(--gz-text-muted)",
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => { setShowBlockModal(false); setBlockSearch(""); setSelectedUserId(null); setSelectedUserName(""); }}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
            style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
            Cancelar
          </button>
          <button onClick={handleBlock} disabled={!selectedUserId || blockUser.isPending}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: "#b91c1c" }}>
            {blockUser.isPending ? "A bloquear..." : "Bloquear"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
