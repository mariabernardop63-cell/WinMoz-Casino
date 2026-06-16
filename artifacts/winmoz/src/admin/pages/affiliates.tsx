import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { adminSupabase } from "@/admin/lib/supabase-api";
import {
  Star, Users, Wallet, AlertTriangle, Search, Check, X,
  TrendingUp, ChevronRight, RefreshCw, Shield, Loader2,
} from "lucide-react";

function fmtMZN(val: number) {
  return `${Number(val.toFixed(2)).toLocaleString("pt-PT")} MT`;
}

interface AffiliateSummary {
  id: string;
  full_name: string | null;
  phone: string | null;
  my_invite_code: string | null;
  is_affiliate: boolean;
  affiliate_pending_earnings: number;
  affiliate_milestone_500_claimed: boolean;
  affiliate_milestone_2000_claimed: boolean;
  referral_count: number;
  bets_credited: number;
  fraud_risk: "low" | "medium" | "high";
}

interface AllUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  my_invite_code: string | null;
  is_affiliate: boolean;
  affiliate_pending_earnings: number;
  affiliate_milestone_500_claimed: boolean;
  affiliate_milestone_2000_claimed: boolean;
}

export default function AffiliatesPage() {
  const [users, setUsers] = useState<AffiliateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"affiliates" | "all">("affiliates");
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, totalReferrals: 0 });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const isAffiliate = tab === "affiliates";
      const query = adminSupabase
        .from("profiles")
        .select("id, full_name, phone, my_invite_code, is_affiliate, affiliate_pending_earnings, affiliate_milestone_500_claimed, affiliate_milestone_2000_claimed")
        .order("full_name", { ascending: true });

      if (isAffiliate) query.eq("is_affiliate", true);

      const { data: profilesData } = await query;
      if (!profilesData) { setLoading(false); return; }

      // Load referral counts and bet credits in parallel
      const enriched: AffiliateSummary[] = await Promise.all(
        profilesData.map(async (p: AllUser) => {
          const [{ count: refCount }, { data: betsData }] = await Promise.all([
            adminSupabase
              .from("referrals")
              .select("id", { count: "exact", head: true })
              .eq("referrer_id", p.id),
            adminSupabase
              .from("affiliate_bets")
              .select("bet_count")
              .eq("affiliate_id", p.id),
          ]);

          const totalBets = (betsData || []).reduce((s: number, r: any) => s + (r.bet_count || 0), 0);
          const refs = refCount ?? 0;

          // Fraud heuristic: many referrals but 0 bets = suspicious
          let fraud_risk: "low" | "medium" | "high" = "low";
          if (refs > 10 && totalBets === 0) fraud_risk = "high";
          else if (refs > 5 && totalBets < refs * 0.1) fraud_risk = "medium";

          return {
            ...p,
            referral_count: refs,
            bets_credited: totalBets,
            fraud_risk,
            affiliate_pending_earnings: Number(p.affiliate_pending_earnings ?? 0),
            affiliate_milestone_500_claimed: !!p.affiliate_milestone_500_claimed,
            affiliate_milestone_2000_claimed: !!p.affiliate_milestone_2000_claimed,
          };
        })
      );

      setUsers(enriched);

      // Summary stats (affiliates only for overview)
      const affiliates = enriched.filter(u => u.is_affiliate);
      setStats({
        total: affiliates.length,
        pending: affiliates.reduce((s, u) => s + u.affiliate_pending_earnings, 0),
        totalReferrals: affiliates.reduce((s, u) => s + u.referral_count, 0),
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [tab]);

  const toggleAffiliate = async (userId: string, current: boolean) => {
    setToggling(userId);
    try {
      const { error } = await adminSupabase
        .from("profiles")
        .update({ is_affiliate: !current })
        .eq("id", userId);
      if (error) throw error;
      showToast(!current ? "Utilizador promovido a afiliado!" : "Estatuto de afiliado removido.");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_affiliate: !current } : u));
    } catch {
      showToast("Erro ao actualizar estatuto.", false);
    }
    setToggling(null);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name?.toLowerCase().includes(q)) || (u.phone?.includes(q)) || (u.my_invite_code?.toLowerCase().includes(q));
  });

  const fraudRiskColor = (r: "low" | "medium" | "high") =>
    r === "high" ? "#ef4444" : r === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <div className="gz-page flex flex-col gap-6 pb-8">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.ok ? "#22c55e" : "#ef4444", color: "#fff" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="gz-card flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star style={{ width: 18, height: 18, color: "#f59e0b" }} />
            <h1 className="gz-h1" style={{ fontSize: 20 }}>Gestão de Afiliados</h1>
          </div>
          <p className="gz-muted text-xs">Gerir parceiros, estatísticas e detecção de fraude</p>
        </div>
        <button onClick={loadData} className="gz-btn-ghost p-2 rounded-xl" title="Actualizar">
          <RefreshCw style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Star,      label: "Afiliados", val: stats.total.toString(),                 color: "#f59e0b" },
          { icon: Users,     label: "Referidos",  val: stats.totalReferrals.toString(),        color: "#a78bfa" },
          { icon: Wallet,    label: "Pendente",   val: fmtMZN(stats.pending),                 color: "#22c55e" },
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="gz-card flex flex-col gap-2">
            <Icon style={{ width: 16, height: 16, color }} />
            <p className="gz-h1" style={{ fontSize: 18, color }}>{val}</p>
            <p className="gz-muted" style={{ fontSize: 10 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["affiliates", "all"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === t ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)",
              border: tab === t ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: tab === t ? "#f59e0b" : "rgba(255,255,255,0.5)",
            }}>
            {t === "affiliates" ? "Afiliados Activos" : "Todos os Utilizadores"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, telemóvel ou código…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }} />
      </div>

      {/* Fraud legend */}
      <div className="gz-card">
        <div className="flex items-center gap-2 mb-2">
          <Shield style={{ width: 13, height: 13, color: "#a78bfa" }} />
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>Detecção de Fraude</p>
        </div>
        <div className="flex gap-4">
          {[["low", "#22c55e", "Baixo risco"], ["medium", "#f59e0b", "Suspeito"], ["high", "#ef4444", "Alto risco"]].map(([r, c, l]) => (
            <div key={r} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c as string }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{l}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
          Alto risco: +10 referidos com 0 apostas creditadas. Suspeito: rácio de apostas abaixo de 10%.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 style={{ width: 22, height: 22, color: "#f59e0b", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div className="gz-card flex flex-col items-center gap-2 py-8">
          <Star style={{ width: 24, height: 24, color: "rgba(255,255,255,0.15)" }} />
          <p className="gz-muted text-sm">Nenhum resultado encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(u => (
            <div key={u.id} className="gz-card flex flex-col gap-3">
              <div className="flex items-start gap-3">
                {/* Fraud indicator */}
                <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: fraudRiskColor(u.fraud_risk), boxShadow: `0 0 6px ${fraudRiskColor(u.fraud_risk)}60` }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="gz-h2 text-sm">{u.full_name ?? "Sem nome"}</p>
                    {u.is_affiliate && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                        style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                        AFILIADO
                      </span>
                    )}
                    {u.fraud_risk === "high" && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                        <AlertTriangle style={{ width: 9, height: 9 }} /> FRAUDE
                      </span>
                    )}
                    {u.fraud_risk === "medium" && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                        style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <AlertTriangle style={{ width: 9, height: 9 }} /> SUSPEITO
                      </span>
                    )}
                  </div>
                  <p className="gz-muted text-[11px]">{u.phone ? `+258 ${u.phone}` : "—"} · Código: {u.my_invite_code ?? "—"}</p>
                </div>

                {/* Toggle button */}
                <button onClick={() => toggleAffiliate(u.id, u.is_affiliate)} disabled={toggling === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
                  style={{
                    background: u.is_affiliate ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                    border: u.is_affiliate ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,158,11,0.3)",
                    color: u.is_affiliate ? "#ef4444" : "#f59e0b",
                  }}>
                  {toggling === u.id
                    ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} />
                    : u.is_affiliate
                      ? <><X style={{ width: 11, height: 11 }} /> Remover</>
                      : <><Check style={{ width: 11, height: 11 }} /> Promover</>
                  }
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Referidos",   val: u.referral_count.toString(),           color: "#a78bfa" },
                  { label: "Apostas",     val: u.bets_credited.toString(),            color: "#22c55e" },
                  { label: "Pendente",    val: fmtMZN(u.affiliate_pending_earnings),  color: "#f59e0b" },
                  { label: "Marcos",      val: `${u.affiliate_milestone_500_claimed ? "500✓ " : ""}${u.affiliate_milestone_2000_claimed ? "2K✓" : ""}` || "—", color: "#f59e0b" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="font-bold text-[11px]" style={{ color }}>{val || "—"}</p>
                    <p className="gz-muted" style={{ fontSize: 9 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
