import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Ban, CheckCircle } from "lucide-react";
import { listPlayers, blockUser, unblockUser, type AdminProfile } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(seed?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`} alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.12)" }} />
  );
}

function StatusBadge({ player }: { player: AdminProfile }) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  const isOnline = player.last_seen_at && new Date(player.last_seen_at).getTime() > cutoff;
  if (player.is_blocked) return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Bloqueado</span>;
  if (isOnline) return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">● Online</span>;
  return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Offline</span>;
}

export default function Players() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: players = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-players", debouncedSearch],
    queryFn: () => listPlayers({ search: debouncedSearch || undefined, limit: 100 }),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-players-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const totalOnline = players.filter(p => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return p.last_seen_at && new Date(p.last_seen_at).getTime() > cutoff;
  }).length;
  const totalBlocked = players.filter(p => p.is_blocked).length;

  async function handleBlock(p: AdminProfile) {
    if (!user) return;
    try {
      await blockUser({ userId: p.id, userName: p.full_name ?? p.email ?? "Usuário", blockType: "account", reason: "Bloqueado pelo admin", adminId: user.id });
      toast({ title: "Conta bloqueada", description: `${p.full_name ?? p.email}` });
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    } catch {
      toast({ title: "Erro", description: "Falha ao bloquear conta", variant: "destructive" });
    }
  }

  async function handleUnblock(p: AdminProfile) {
    const { data: blocks } = await supabase.from("blocked_users").select("id").eq("user_id", p.id).eq("is_active", true).limit(1);
    const blockId = blocks?.[0]?.id;
    if (!blockId) { toast({ title: "Erro", description: "Registo de bloqueio não encontrado" }); return; }
    try {
      await unblockUser(blockId, p.id);
      toast({ title: "Conta desbloqueada", description: `${p.full_name ?? p.email}` });
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    } catch {
      toast({ title: "Erro", description: "Falha ao desbloquear", variant: "destructive" });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jogadores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Todos os utilizadores registados</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Registados", value: players.length,  color: "text-indigo-600" },
          { label: "Online Agora",     value: totalOnline,     color: "text-green-600" },
          { label: "Bloqueados",       value: totalBlocked,    color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="gz-card p-5">
            <div className="text-xs mb-1 uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="relative max-w-xs">
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gz-text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome, email…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: "var(--gz-bg-subtle)", borderColor: "rgba(108,92,231,.1)", color: "var(--gz-text-primary)" }} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Jogador", "Email", "Saldo (MT)", "Jogos", "Vitórias", "Estado", "Registado", "Acções"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : players.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>Nenhum jogador encontrado</td></tr>
              ) : players.map((p: AdminProfile) => (
                <tr key={p.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar seed={p.full_name ?? p.email ?? p.id} />
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{p.full_name ?? "—"}</div>
                        <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{p.phone ?? ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--gz-text-secondary)" }}>{p.email ?? "—"}</td>
                  <td className="px-5 py-3.5 font-bold text-[13px]" style={{ color: V1 }}>MT {Number(p.balance).toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--gz-text-secondary)" }}>{p.total_games ?? 0}</td>
                  <td className="px-5 py-3.5 text-[12px] text-green-600 font-semibold">{p.total_wins ?? 0}</td>
                  <td className="px-5 py-3.5"><StatusBadge player={p} /></td>
                  <td className="px-5 py-3.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString("pt-PT") : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.is_blocked ? (
                      <button onClick={() => handleUnblock(p)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                        style={{ background: "rgba(16,185,129,.08)", color: "#059669", border: "1px solid rgba(16,185,129,.2)" }}>
                        <CheckCircle style={{ width: 11, height: 11 }} /> Desbloquear
                      </button>
                    ) : (
                      <button onClick={() => handleBlock(p)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                        style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>
                        <Ban style={{ width: 11, height: 11 }} /> Bloquear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
