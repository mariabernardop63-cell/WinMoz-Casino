import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserX, Search, RefreshCw, Unlock, Shield, Plus, X } from "lucide-react";
import { listBlockedUsers, blockUser, unblockUser, searchPlayersForBalance, type AdminBlockedUser } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

const BLOCK_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  account: { label: "Conta",     bg: "bg-red-100",    text: "text-red-600"    },
  ip:      { label: "IP",        bg: "bg-orange-100", text: "text-orange-600" },
  full:    { label: "Total",     bg: "bg-purple-100", text: "text-purple-600" },
};

export default function BlockUsers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerDebounced, setPlayerDebounced] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [blockType, setBlockType] = useState<"account" | "ip" | "full">("account");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPlayerDebounced(playerSearch), 350);
    return () => clearTimeout(t);
  }, [playerSearch]);

  const { data: blockedUsers = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-blocked-users"],
    queryFn: listBlockedUsers,
    refetchInterval: 30000,
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["block-search", playerDebounced],
    queryFn: () => playerDebounced.length >= 2 ? searchPlayersForBalance(playerDebounced) : Promise.resolve([]),
    enabled: playerDebounced.length >= 2,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-blocked-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_users" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const filtered = blockedUsers.filter(b =>
    search === "" ||
    (b.user_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (b.reason ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleBlock() {
    if (!selectedPlayer || !reason.trim() || !user) return;
    setProcessing(true);
    try {
      await blockUser({
        userId: selectedPlayer.id,
        userName: selectedPlayer.full_name ?? selectedPlayer.email ?? "Usuário",
        blockType,
        reason: reason.trim(),
        adminId: user.id,
      });
      toast({ title: "Conta bloqueada", description: selectedPlayer.full_name ?? selectedPlayer.email ?? "" });
      qc.invalidateQueries({ queryKey: ["admin-blocked-users"] });
      setShowForm(false);
      setSelectedPlayer(null);
      setPlayerSearch(""); setReason("");
    } catch {
      toast({ title: "Erro", description: "Falha ao bloquear conta", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  async function handleUnblock(b: AdminBlockedUser) {
    try {
      await unblockUser(b.id, b.user_id);
      toast({ title: "Conta desbloqueada", description: b.user_name ?? "" });
      qc.invalidateQueries({ queryKey: ["admin-blocked-users"] });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bloqueio de Utilizadores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerir contas e acessos bloqueados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
          </button>
          <button onClick={() => { setShowForm(v => !v); setSelectedPlayer(null); setPlayerSearch(""); setReason(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>
            <Plus style={{ width: 15, height: 15 }} /> Bloquear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Bloqueados",  value: blockedUsers.length, color: "text-red-600" },
          { label: "Por Conta",         value: blockedUsers.filter(b => b.block_type === "account").length, color: "text-orange-600" },
          { label: "Total (Completo)",  value: blockedUsers.filter(b => b.block_type === "full").length, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Block form */}
      {showForm && (
        <div className="gz-card p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Shield style={{ width: 18, height: 18, color: V1 }} />
              <span className="font-black text-[15px]" style={{ color: "var(--gz-text-primary)" }}>Bloquear Utilizador</span>
            </div>
            <button onClick={() => setShowForm(false)}><X style={{ width: 16, height: 16, color: "var(--gz-text-muted)" }} /></button>
          </div>

          {!selectedPlayer ? (
            <div className="mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Pesquisar Utilizador</label>
              <div className="relative">
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--gz-text-muted)" }} />
                <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Nome ou email…"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>
              {playerDebounced.length >= 2 && (
                <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: "rgba(108,92,231,.1)" }}>
                  {searching ? <div className="px-4 py-3 text-sm text-center" style={{ color: "var(--gz-text-muted)" }}>A pesquisar…</div>
                    : (searchResults as any[]).length === 0 ? <div className="px-4 py-3 text-sm text-center" style={{ color: "var(--gz-text-muted)" }}>Nenhum utilizador encontrado</div>
                      : (searchResults as any[]).map(p => (
                        <button key={p.id} onClick={() => setSelectedPlayer(p)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left">
                          <div>
                            <div className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{p.full_name ?? "—"}</div>
                            <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{p.email}</div>
                          </div>
                        </button>
                      ))
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(108,92,231,.06)" }}>
                <span className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{selectedPlayer.full_name ?? selectedPlayer.email}</span>
                <button onClick={() => { setSelectedPlayer(null); setPlayerSearch(""); }}><X style={{ width: 14, height: 14, color: "var(--gz-text-muted)" }} /></button>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: "var(--gz-text-muted)" }}>Tipo de Bloqueio</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["account", "ip", "full"] as const).map(bt => (
                    <button key={bt} onClick={() => setBlockType(bt)}
                      className={`p-2.5 rounded-xl border text-[12px] font-bold transition-all ${blockType === bt ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}>
                      {BLOCK_TYPE_CONFIG[bt].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Motivo *</label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Fraude, comportamento abusivo…"
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>

              <button onClick={handleBlock} disabled={!reason.trim() || processing}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: !reason.trim() ? "#e5e7eb" : "linear-gradient(135deg, #ef4444, #dc2626)", color: !reason.trim() ? "#9ca3af" : "#fff" }}>
                {processing ? "A processar…" : <><UserX style={{ width: 15, height: 15 }} /> Confirmar Bloqueio</>}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="relative flex-1 max-w-xs">
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--gz-text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar bloqueados…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: "var(--gz-bg-subtle)", borderColor: "rgba(108,92,231,.1)", color: "var(--gz-text-primary)" }} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Utilizador", "Tipo", "Motivo", "Bloqueado em", "Acções"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
                  Nenhum utilizador bloqueado
                </td></tr>
              ) : filtered.map((b: AdminBlockedUser) => {
                const tc = BLOCK_TYPE_CONFIG[b.block_type] ?? BLOCK_TYPE_CONFIG.account;
                return (
                  <tr key={b.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserX style={{ width: 16, height: 16, color: "#ef4444" }} />
                        <span className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{b.user_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>{tc.label}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--gz-text-secondary)" }}>{b.reason ?? "—"}</td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      {new Date(b.created_at).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleUnblock(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                        style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}>
                        <Unlock style={{ width: 11, height: 11 }} /> Desbloquear
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
