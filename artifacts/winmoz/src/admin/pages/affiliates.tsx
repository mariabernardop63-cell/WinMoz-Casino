import React, { useState, useEffect } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import {
  Star, Users, Wallet, AlertTriangle, Search, Check, X,
  TrendingUp, RefreshCw, Shield, Loader2, Award,
  MoreHorizontal, ChevronRight, Zap,
} from "lucide-react";

/* ─── colour tokens (mirror dashboard) ─── */
const V1 = "#6C5CE7";
const V2 = "#a78bfa";
const V4 = "#f59e0b";
const VG = "#10b981";
const VR = "#ef4444";

function fmtMZN(val: number) {
  return `MT ${Number(val.toFixed(2)).toLocaleString("pt-PT")}`;
}

/* ─── Detect auto-generated/placeholder avatar URLs (DiceBear, etc.) ─── */
function isRealPhoto(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  const lower = url.toLowerCase();
  if (lower.includes("dicebear.com")) return false;
  if (lower.includes("ui-avatars.com")) return false;
  if (lower.includes("gravatar.com/avatar/0000")) return false;
  if (lower.includes("robohash.org")) return false;
  return true;
}

/* ─── Avatar (real photo first, initials fallback) ─── */
function Avatar({ seed, avatarUrl, size = 32 }: { seed: string; avatarUrl?: string | null; size?: number }) {
  if (isRealPhoto(avatarUrl)) {
    return (
      <img
        src={avatarUrl!}
        alt={seed}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{
          width: size, height: size, borderRadius: "50%", flexShrink: 0,
          objectFit: "cover", border: "1.5px solid rgba(108,92,231,.14)",
        }}
      />
    );
  }
  const palette = ["#6C5CE7", "#7c3aed", "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
  const bg = palette[seed.charCodeAt(0) % palette.length];
  const initials = seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("") || seed.slice(0, 2).toUpperCase();
  return (
    <div
      aria-label={seed}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: bg, border: "1.5px solid rgba(108,92,231,.14)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.38), fontWeight: 700, color: "#fff",
        lineHeight: 1, userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Live pulse dot ─── */
function LiveDot({ color = VG }: { color?: string }) {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0">
      <span className="animate-pulse-ring absolute inset-0 rounded-full" style={{ background: `${color}44` }} />
      <span className="animate-pulse-dot relative w-2 h-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

/* ─── MacOS dots ─── */
function MacOSCircles() {
  return (
    <div className="flex items-center gap-1.5">
      {["#FF5F56", "#FFBD2E", "#27C93F"].map((c, i) => (
        <div key={i} className="gz-macos-circle" style={{ background: c, boxShadow: `0 1px 3px ${c}66` }} />
      ))}
    </div>
  );
}

/* ─── Stat card (mirrors dashboard StatCard) ─── */
function StatCard({ label, value, icon: Icon, color, badge }: {
  label: string; value: string | number; icon: React.ElementType; color: string; badge?: string;
}) {
  return (
    <div className="gz-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div style={{ width: 38, height: 38, borderRadius: 13, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 17, height: 17, color, strokeWidth: 1.9 }} />
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--gz-text-primary)" }}>
          {value}
        </div>
        <div className="text-[12px] font-semibold mt-1" style={{ color: "var(--gz-text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Risk badge ─── */
function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const map = {
    low:    { label: "Baixo Risco",  bg: "rgba(16,185,129,.12)", color: VG, border: "rgba(16,185,129,.3)" },
    medium: { label: "Suspeito",     bg: "rgba(245,158,11,.12)", color: V4, border: "rgba(245,158,11,.3)" },
    high:   { label: "Alto Risco",   bg: "rgba(239,68,68,.12)",  color: VR, border: "rgba(239,68,68,.3)" },
  }[risk];
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: map.bg, color: map.color, border: `1px solid ${map.border}` }}>
      {risk !== "low" && <AlertTriangle style={{ width: 9, height: 9 }} />}
      {map.label}
    </span>
  );
}

/* ─── Types ─── */
interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  my_invite_code: string | null;
  is_affiliate: boolean;
  affiliate_pending_earnings: number;
  affiliate_milestone_500_claimed: boolean;
  affiliate_milestone_2000_claimed: boolean;
  referral_count: number;
  bets_credited: number;
  fraud_risk: "low" | "medium" | "high";
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function AffiliatesPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState<"affiliates" | "all">("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [stats, setStats]       = useState({ total: 0, pending: 0, totalReferrals: 0 });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── load ── */
  const loadData = async () => {
    setLoading(true);
    try {
      /*
       * Strategy: try the full SELECT first (all affiliate columns).
       * If it fails (columns not yet created in Supabase), fall back
       * to the minimal SELECT that we know always works.
       */
      const FULL_SELECT =
        "id, full_name, phone, avatar_url, my_invite_code, is_affiliate, " +
        "affiliate_pending_earnings, affiliate_milestone_500_claimed, " +
        "affiliate_milestone_2000_claimed";
      const BASE_SELECT = "id, full_name, phone, avatar_url, my_invite_code, is_affiliate";

      /* Build query — use let so we can chain .eq() and reassign */
      const buildQuery = (select: string) => {
        let q = adminSupabase
          .from("profiles")
          .select(select)
          .order("full_name", { ascending: true });
        if (tab === "affiliates") q = q.eq("is_affiliate", true);
        return q;
      };

      let { data: profilesData, error: profilesError } = await buildQuery(FULL_SELECT);

      /* If full SELECT failed (missing columns), retry with base columns */
      if (profilesError) {
        console.warn("[affiliates] full SELECT failed, retrying with base columns:", profilesError.message);
        const fallback = await buildQuery(BASE_SELECT);
        profilesData  = fallback.data;
        profilesError = fallback.error;
      }

      if (profilesError) {
        console.error("[affiliates] profiles query error:", profilesError);
        setLoading(false);
        return;
      }
      if (!profilesData || profilesData.length === 0) {
        setUsers([]);
        setStats({ total: 0, pending: 0, totalReferrals: 0 });
        setLoading(false);
        return;
      }

      /* Enrich each profile — resilient: never let one failure block all */
      const enriched: UserRow[] = await Promise.all(
        profilesData.map(async (p: any) => {
          let referral_count = 0;
          let bets_credited  = 0;

          try {
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
            referral_count = refCount ?? 0;
            bets_credited  = (betsData ?? []).reduce((s: number, r: any) => s + (r.bet_count || 0), 0);
          } catch {
            /* tables may not exist yet — safe to skip */
          }

          let fraud_risk: "low" | "medium" | "high" = "low";
          if (referral_count > 10 && bets_credited === 0) fraud_risk = "high";
          else if (referral_count > 5 && bets_credited < referral_count * 0.1) fraud_risk = "medium";

          return {
            id:                               p.id,
            full_name:                        p.full_name ?? null,
            phone:                            p.phone ?? null,
            avatar_url:                       (p.avatar_url as string | null) ?? null,
            my_invite_code:                   p.my_invite_code ?? null,
            is_affiliate:                     !!p.is_affiliate,
            affiliate_pending_earnings:       Number(p.affiliate_pending_earnings ?? 0),
            affiliate_milestone_500_claimed:  !!p.affiliate_milestone_500_claimed,
            affiliate_milestone_2000_claimed: !!p.affiliate_milestone_2000_claimed,
            referral_count,
            bets_credited,
            fraud_risk,
          };
        })
      );

      setUsers(enriched);

      const affiliates = enriched.filter(u => u.is_affiliate);
      setStats({
        total:          affiliates.length,
        pending:        affiliates.reduce((s, u) => s + u.affiliate_pending_earnings, 0),
        totalReferrals: affiliates.reduce((s, u) => s + u.referral_count, 0),
      });
    } catch (e) {
      console.error("[affiliates] unexpected error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [tab]);

  /* ── toggle affiliate ── */
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
      /* update summary stats */
      setStats(prev => ({
        ...prev,
        total: !current ? prev.total + 1 : prev.total - 1,
      }));
    } catch {
      showToast("Erro ao actualizar estatuto.", false);
    }
    setToggling(null);
  };

  /* ── filter ── */
  const filtered = users.filter(u => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.my_invite_code?.toLowerCase().includes(q)
    );
  });

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-4">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-float-up"
          style={{ background: toast.ok ? VG : VR, color: "#fff", minWidth: 220 }}>
          {toast.ok ? <Check style={{ width: 15, height: 15 }} /> : <X style={{ width: 15, height: 15 }} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header card ── */}
      <div className="gz-card p-5 animate-float-up" style={{ animationDelay: "0ms" }}>
        <MacOSCircles />
        <div className="flex items-end justify-between mt-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div style={{ width: 34, height: 34, borderRadius: 12, background: `linear-gradient(135deg, ${V4}, #d97706)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 16px ${V4}44` }}>
                <Star style={{ width: 16, height: 16, color: "#fff", strokeWidth: 2 }} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, color: "var(--gz-text-primary)" }}>
                Gestão de{" "}
                <span className="gz-gradient-text">Afiliados</span>
              </h1>
            </div>
            <p className="text-[13px] font-medium mt-1" style={{ color: "var(--gz-text-accent)" }}>
              Gerir parceiros, comissões e detecção de fraude
            </p>
          </div>
          <button onClick={loadData} disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 active:scale-95"
            style={{ background: "rgba(108,92,231,.07)", border: "1px solid rgba(108,92,231,.12)" }}
            title="Actualizar">
            <RefreshCw style={{ width: 14, height: 14, color: V1, animation: loading ? "spin 1s linear infinite" : undefined }} />
          </button>
        </div>
      </div>

      {/* ── 3 Stat cards ── */}
      <div className="grid grid-cols-3 gap-4 animate-float-up" style={{ animationDelay: "40ms" }}>
        <StatCard label="Afiliados Activos" value={stats.total}                icon={Star}       color={V4} badge="total" />
        <StatCard label="Total de Referidos" value={stats.totalReferrals}       icon={Users}      color={V2} badge="rede" />
        <StatCard label="Pendente de Pagar"  value={fmtMZN(stats.pending)}      icon={Wallet}     color={VG} badge="ganhos" />
      </div>

      {/* ── Tabs + Search ── */}
      <div className="gz-card p-4 flex flex-col gap-3 animate-float-up" style={{ animationDelay: "80ms" }}>
        {/* Tabs */}
        <div className="flex gap-2">
          {(["affiliates", "all"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all"
              style={{
                background: tab === t ? `${V4}22` : "rgba(0,0,0,.04)",
                border: `1px solid ${tab === t ? `${V4}44` : "transparent"}`,
                color: tab === t ? V4 : "var(--gz-text-muted)",
              }}>
              {t === "affiliates"
                ? <><Star style={{ width: 12, height: 12 }} /> Afiliados Activos</>
                : <><Users style={{ width: 12, height: 12 }} /> Todos os Utilizadores</>}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gz-text-tertiary)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, telemóvel ou código de convite…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px]"
            style={{
              background: "rgba(0,0,0,.04)",
              border: "1px solid rgba(0,0,0,.06)",
              color: "var(--gz-text-primary)",
              outline: "none",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,.08)" }}>
              <X style={{ width: 10, height: 10, color: "var(--gz-text-muted)" }} />
            </button>
          )}
        </div>

        {/* Result count */}
        {!loading && (
          <div className="text-[11px] font-medium" style={{ color: "var(--gz-text-tertiary)" }}>
            {filtered.length} utilizador{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            {search && ` para "${search}"`}
          </div>
        )}
      </div>

      {/* ── Fraud legend ── */}
      <div className="gz-glass p-4 flex items-center gap-6 flex-wrap animate-float-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(167,139,250,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield style={{ width: 13, height: 13, color: V2, strokeWidth: 1.9 }} />
          </div>
          <span className="text-[12px] font-bold" style={{ color: "var(--gz-text-secondary)" }}>Detecção de Fraude</span>
        </div>
        <div className="flex gap-4">
          {([
            { risk: "low",    color: VG, label: "Baixo risco" },
            { risk: "medium", color: V4, label: "Suspeito" },
            { risk: "high",   color: VR, label: "Alto risco" },
          ] as const).map(({ risk, color, label }) => (
            <div key={risk} className="flex items-center gap-1.5">
              <LiveDot color={color} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] font-medium ml-auto" style={{ color: "var(--gz-text-tertiary)" }}>
          Alto risco: +10 referidos com 0 apostas · Suspeito: rácio &lt;10%
        </p>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="gz-card flex flex-col items-center gap-3 py-16">
          <Loader2 style={{ width: 28, height: 28, color: V4, animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p className="text-[13px] font-medium" style={{ color: "var(--gz-text-muted)" }}>A carregar utilizadores…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="gz-card flex flex-col items-center gap-3 py-16">
          <div style={{ width: 52, height: 52, borderRadius: 18, background: `${V4}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Star style={{ width: 24, height: 24, color: V4, opacity: .4, strokeWidth: 1.5 }} />
          </div>
          <p className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
            {search ? "Nenhum resultado para a pesquisa" : tab === "affiliates" ? "Ainda não há afiliados" : "Sem utilizadores"}
          </p>
          <p className="text-[12px]" style={{ color: "var(--gz-text-muted)" }}>
            {tab === "affiliates"
              ? 'Muda para "Todos os Utilizadores" para promover alguém a afiliado.'
              : "Nenhum utilizador registado."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((u, idx) => (
            <UserCard
              key={u.id}
              user={u}
              toggling={toggling === u.id}
              onToggle={() => toggleAffiliate(u.id, u.is_affiliate)}
              delay={idx * 30}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── User card ── */
function UserCard({ user: u, toggling, onToggle, delay }: {
  user: UserRow;
  toggling: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const [open, setOpen] = useState(false);

  const milestones = [
    u.affiliate_milestone_500_claimed  && { label: "MT 500",  color: V4 },
    u.affiliate_milestone_2000_claimed && { label: "MT 2K",   color: V2 },
  ].filter(Boolean) as { label: string; color: string }[];

  const progressPct = Math.min(
    100,
    u.affiliate_pending_earnings > 0 && !u.affiliate_milestone_500_claimed
      ? Math.round((u.affiliate_pending_earnings / 500) * 100)
      : u.affiliate_pending_earnings > 500 && !u.affiliate_milestone_2000_claimed
        ? Math.round(((u.affiliate_pending_earnings - 500) / 1500) * 100)
        : 100
  );

  const fraudColor = u.fraud_risk === "high" ? VR : u.fraud_risk === "medium" ? V4 : VG;

  return (
    <div className="gz-card p-4 animate-float-up relative overflow-visible group" style={{ animationDelay: `${delay}ms` }}>
      {/* Fraud strip on left */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
        style={{ background: fraudColor, opacity: u.fraud_risk === "low" ? 0 : 1 }} />

      {/* Row 1: avatar + name + badges + action */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <Avatar seed={u.full_name ?? u.id} avatarUrl={u.avatar_url} size={40} />
          {u.is_affiliate && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: V4, border: "2px solid white" }}>
              <Star style={{ width: 8, height: 8, color: "#fff", strokeWidth: 2.5 }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>
              {u.full_name ?? "Sem nome"}
            </span>
            {u.is_affiliate && (
              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${V4}20`, color: V4, border: `1px solid ${V4}44` }}>
                AFILIADO
              </span>
            )}
            <RiskBadge risk={u.fraud_risk} />
            {milestones.map(m => (
              <span key={m.label} className="flex items-center gap-1 text-[9.5px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33` }}>
                <Award style={{ width: 8, height: 8 }} /> {m.label} ✓
              </span>
            ))}
          </div>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: "var(--gz-text-muted)" }}>
            {u.phone ? `+258 ${u.phone}` : "Sem telemóvel"}
            {u.my_invite_code && <span style={{ color: "var(--gz-text-tertiary)" }}> · Cód: <span style={{ color: V1, fontWeight: 700 }}>{u.my_invite_code}</span></span>}
          </p>
        </div>

        {/* Action + overflow */}
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          <button
            onClick={onToggle}
            disabled={toggling}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: u.is_affiliate ? `${VR}14` : `${V4}18`,
              border: `1px solid ${u.is_affiliate ? `${VR}33` : `${V4}44`}`,
              color: u.is_affiliate ? VR : V4,
              minWidth: 90,
              justifyContent: "center",
            }}>
            {toggling
              ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
              : u.is_affiliate
                ? <><X style={{ width: 12, height: 12 }} /> Remover</>
                : <><Check style={{ width: 12, height: 12 }} /> Promover</>
            }
          </button>

          <button
            onClick={() => setOpen(o => !o)}
            className="w-8 h-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "rgba(0,0,0,.04)" }}>
            <MoreHorizontal style={{ width: 14, height: 14, color: "var(--gz-text-muted)" }} />
          </button>
          {open && (
            <div className="absolute right-0 top-10 z-30 py-1.5 min-w-[160px] animate-float-up"
              style={{ background: "#ffffff", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,.1)" }}
              onMouseLeave={() => setOpen(false)}>
              {["Ver perfil completo", "Ver histórico", "Exportar dados"].map(a => (
                <button key={a} onClick={() => setOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-[12px] font-medium text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                  <ChevronRight style={{ width: 11, height: 11 }} /> {a}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: 4 stat mini-cards */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {([
          { icon: Users      as React.ElementType, label: "Referidos",   val: u.referral_count.toString(),         color: V2 },
          { icon: Zap        as React.ElementType, label: "Apostas",     val: u.bets_credited.toString(),           color: VG },
          { icon: Wallet     as React.ElementType, label: "Pendente",    val: fmtMZN(u.affiliate_pending_earnings), color: V4 },
          { icon: TrendingUp as React.ElementType, label: "Conversão",   val: u.referral_count > 0 ? `${Math.round((u.bets_credited / u.referral_count) * 100)}%` : "—", color: V1 },
        ]).map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
            style={{ background: `${color}0a`, border: `1px solid ${color}18` }}>
            <Icon style={{ width: 12, height: 12, color, strokeWidth: 2 }} />
            <p className="font-extrabold text-[12px] leading-none" style={{ color }}>{val}</p>
            <p className="text-[9.5px] font-semibold" style={{ color: "var(--gz-text-tertiary)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Row 3: milestone progress bar (only if affiliate) */}
      {u.is_affiliate && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,.05)" }}>
          <div className="flex justify-between text-[10.5px] font-semibold mb-1.5">
            <span style={{ color: "var(--gz-text-muted)" }}>
              {u.affiliate_milestone_2000_claimed ? "Todos os marcos atingidos 🎉" : `Progresso para ${u.affiliate_milestone_500_claimed ? "MT 2.000" : "MT 500"}`}
            </span>
            <span style={{ color: V4, fontWeight: 800 }}>{progressPct}%</span>
          </div>
          <div className="gz-progress-track h-1.5">
            <div style={{
              width: `${progressPct}%`, height: "100%", borderRadius: 100,
              background: `linear-gradient(90deg, ${V4}, ${V2})`,
              transition: "width 1.2s ease",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
