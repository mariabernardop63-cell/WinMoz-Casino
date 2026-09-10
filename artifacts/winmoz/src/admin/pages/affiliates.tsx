import React, { useState, useEffect } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import {
  Star, Users, Wallet, AlertTriangle, Search, Check, X,
  TrendingUp, RefreshCw, Shield, Loader2,
} from "lucide-react";

/* ─── colour tokens ─── */
const V1 = "#18181b";
const V2 = "#71717a";
const V4 = "#a16207";
const VG = "#15803d";
const VR = "#b91c1c";

function fmtMZN(val: number) {
  return `MT ${Number(val.toFixed(2)).toLocaleString("pt-PT")}`;
}

/* ─── Detect auto-generated/placeholder avatar URLs ─── */
function isRealPhoto(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  const lower = url.toLowerCase();
  if (lower.includes("dicebear.com")) return false;
  if (lower.includes("ui-avatars.com")) return false;
  if (lower.includes("gravatar.com/avatar/0000")) return false;
  if (lower.includes("robohash.org")) return false;
  return true;
}

/* ─── Avatar ─── */
function Avatar({ seed, avatarUrl, size = 32 }: { seed: string; avatarUrl?: string | null; size?: number }) {
  if (isRealPhoto(avatarUrl)) {
    return (
      <img
        src={avatarUrl!}
        alt={seed}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{
          width: size, height: size, borderRadius: "50%", flexShrink: 0,
          objectFit: "cover", border: "1.5px solid rgba(0,0,0,.14)",
        }}
      />
    );
  }
  const palette = ["#18181b", "#18181b", "#4f46e5", "#52525b", "#15803d", "#a16207", "#71717a"];
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
        background: bg, border: "1.5px solid rgba(0,0,0,.14)",
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

/* ─── Section header (consistent with dashboard) ─── */
function SectionHeader({
  icon: Icon, title, action,
}: {
  icon: React.ElementType; title: string; action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 28, height: 28, borderRadius: 9,
            background: "var(--gz-bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon style={{ width: 14, height: 14, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
        </div>
        <span className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</span>
      </div>
      {action}
    </div>
  );
}

/* ─── KPI tile ─── */
function KpiTile({ label, value, icon: Icon, accent, hint }: {
  label: string; value: string; icon: React.ElementType; accent: string; hint?: string;
}) {
  return (
    <div className="relative px-5 py-4" style={{ background: "var(--gz-bg-card-btn)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          style={{
            width: 30, height: 30, borderRadius: 10, flexShrink: 0,
            background: `${accent}16`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon style={{ width: 15, height: 15, color: accent, strokeWidth: 1.9 }} />
        </div>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] truncate" style={{ color: "var(--gz-text-muted)" }}>
          {label}
        </span>
      </div>
      <div className="text-[21px] font-black tracking-[-0.03em] tabular-nums truncate" style={{ color: "var(--gz-text-primary)" }}>
        {value}
      </div>
      {hint && <div className="text-[11px] font-medium mt-1" style={{ color: "var(--gz-text-muted)" }}>{hint}</div>}
    </div>
  );
}

/* ─── Risk badge ─── */
function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const map = {
    low:    { label: "Baixo Risco",  bg: "rgba(21,128,61,.12)", color: VG, border: "rgba(21,128,61,.3)" },
    medium: { label: "Suspeito",     bg: "rgba(161,98,7,.12)", color: V4, border: "rgba(161,98,7,.3)" },
    high:   { label: "Alto Risco",   bg: "rgba(185,28,28,.12)",  color: VR, border: "rgba(185,28,28,.3)" },
  }[risk];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
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
  affiliate_invite_code: string | null;
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
      const FULL_SELECT =
        "id, full_name, phone, avatar_url, my_invite_code, affiliate_invite_code, is_affiliate, " +
        "affiliate_pending_earnings, affiliate_milestone_500_claimed, " +
        "affiliate_milestone_2000_claimed";
      const BASE_SELECT = "id, full_name, phone, avatar_url, my_invite_code, affiliate_invite_code, is_affiliate";

      const buildQuery = (select: string) => {
        let q = adminSupabase
          .from("profiles")
          .select(select)
          .order("full_name", { ascending: true });
        if (tab === "affiliates") q = q.eq("is_affiliate", true);
        return q;
      };

      let { data: profilesData, error: profilesError } = await buildQuery(FULL_SELECT);

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

      const enriched: UserRow[] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            affiliate_invite_code:            (p.affiliate_invite_code as string | null) ?? null,
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (!current) {
        try {
          await adminSupabase.rpc("generate_affiliate_code", { p_user_id: userId });
        } catch {
          /* Non-critical — code can be generated later */
        }
      }

      showToast(!current ? "Utilizador promovido a afiliado! Código de afiliado gerado." : "Estatuto de afiliado removido.");
      await loadData();
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

  const riskCounts = {
    high: users.filter(u => u.fraud_risk === "high").length,
    medium: users.filter(u => u.fraud_risk === "medium").length,
  };

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1600px] mx-auto">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-float-up"
          style={{ background: toast.ok ? VG : VR, color: "#fff", minWidth: 220 }}>
          {toast.ok ? <Check style={{ width: 15, height: 15 }} /> : <X style={{ width: 15, height: 15 }} />}
          {toast.msg}
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.035em] leading-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
            <Star style={{ width: 22, height: 22, color: V4, strokeWidth: 2 }} />
            Gestão de <span className="gz-gradient-text">Afiliados</span>
          </h1>
          <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
            Gerir parceiros, comissões e detecção de fraude
          </p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
          style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-secondary)" }}
          title="Actualizar">
          <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin 1s linear infinite" : undefined }} />
          Actualizar
        </button>
      </div>

      <div className="space-y-5">

        {/* ── KPI panel ── */}
        <section className="gz-card overflow-hidden animate-float-up">
          <SectionHeader
            icon={TrendingUp}
            title="Visão Geral"
            action={
              <div className="flex items-center gap-1.5">
                <LiveDot color={V4} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: V4 }}>afiliados</span>
              </div>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: "var(--gz-border-subtle)" }}>
            <KpiTile label="Afiliados Activos"   value={String(stats.total)}            icon={Star}   accent={V4} hint="parceiros promovidos" />
            <KpiTile label="Total de Referidos"  value={String(stats.totalReferrals)}   icon={Users}  accent={V2} hint="na rede de afiliados" />
            <KpiTile label="Pendente de Pagar"   value={fmtMZN(stats.pending)}          icon={Wallet} accent={VG} hint="comissões acumuladas" />
          </div>
        </section>

        {/* ── Toolbar: tabs + search ── */}
        <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <div className="flex gap-2">
              {(["affiliates", "all"] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setSearch(""); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all"
                  style={{
                    background: tab === t ? `${V4}1c` : "var(--gz-bg-subtle)",
                    border: `1px solid ${tab === t ? `${V4}44` : "transparent"}`,
                    color: tab === t ? V4 : "var(--gz-text-muted)",
                  }}>
                  {t === "affiliates"
                    ? <><Star style={{ width: 12, height: 12 }} /> Afiliados Activos</>
                    : <><Users style={{ width: 12, height: 12 }} /> Todos os Utilizadores</>}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gz-text-tertiary)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, telemóvel ou código de convite..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-[13px]"
                style={{
                  background: "var(--gz-bg-subtle)",
                  border: "1px solid var(--gz-border-subtle)",
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
          </div>

          {/* Fraud legend strip */}
          <div className="flex items-center gap-5 flex-wrap px-4 py-3" style={{ borderTop: "1px solid var(--gz-border-subtle)", background: "var(--gz-bg-subtle)" }}>
            <div className="flex items-center gap-2">
              <Shield style={{ width: 13, height: 13, color: V2, strokeWidth: 1.9 }} />
              <span className="text-[11.5px] font-bold" style={{ color: "var(--gz-text-secondary)" }}>Detecção de Fraude</span>
            </div>
            {([
              { color: VG, label: "Baixo risco" },
              { color: V4, label: `Suspeito (${riskCounts.medium})` },
              { color: VR, label: `Alto risco (${riskCounts.high})` },
            ] as const).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[11px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>{label}</span>
              </div>
            ))}
            <p className="text-[10.5px] font-medium ml-auto hidden md:block" style={{ color: "var(--gz-text-tertiary)" }}>
              Alto risco: +10 referidos sem apostas · Suspeito: rácio &lt;10%
            </p>
          </div>
        </section>

        {/* ── List ── */}
        {loading ? (
          <div className="gz-card flex flex-col items-center gap-3 py-16">
            <Loader2 style={{ width: 28, height: 28, color: V4, animation: "spin 1s linear infinite" }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--gz-text-muted)" }}>A carregar utilizadores...</p>
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
          <section className="gz-card overflow-hidden animate-float-up" style={{ animationDelay: "120ms" }}>
            <SectionHeader
              icon={Users}
              title="Utilizadores"
              action={
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </span>
              }
            />

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ background: "var(--gz-bg-subtle)" }}>
                    {["Utilizador", "Código", "Referidos", "Apostas", "Pendente", "Conversão", "Risco", ""].map((h, i) => (
                      <th key={i}
                        className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${i >= 2 && i <= 5 ? "text-right" : "text-left"}`}
                        style={{ color: "var(--gz-text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const conv = u.referral_count > 0 ? Math.round((u.bets_credited / u.referral_count) * 100) : 0;
                    const busy = toggling === u.id;
                    return (
                      <tr key={u.id} className="gz-tr" style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Avatar seed={u.full_name ?? u.id} avatarUrl={u.avatar_url} size={36} />
                              {u.is_affiliate && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ background: V4, border: "2px solid var(--gz-bg-card-btn)" }}>
                                  <Star style={{ width: 8, height: 8, color: "#fff", strokeWidth: 2.5 }} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>
                                  {u.full_name ?? "Sem nome"}
                                </span>
                                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{
                                    background: u.is_affiliate ? `${V4}20` : "var(--gz-bg-subtle)",
                                    color: u.is_affiliate ? V4 : "var(--gz-text-tertiary)",
                                    letterSpacing: "0.05em",
                                  }}>
                                  {u.is_affiliate ? "AFILIADO" : "USER"}
                                </span>
                              </div>
                              <div className="text-[11px] font-medium truncate" style={{ color: "var(--gz-text-muted)" }}>
                                {u.phone ? `+258 ${u.phone}` : "Sem telemóvel"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-[11.5px] font-mono font-semibold" style={{ color: "var(--gz-text-secondary)" }}>
                            {u.affiliate_invite_code ?? u.my_invite_code ?? "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--gz-text-primary)" }}>
                          {u.referral_count}
                        </td>
                        <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--gz-text-primary)" }}>
                          {u.bets_credited}
                        </td>
                        <td className="px-5 py-3 text-right text-[13px] font-bold tabular-nums" style={{ color: V4 }}>
                          {fmtMZN(u.affiliate_pending_earnings)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="gz-progress-track h-1.5 w-14">
                              <div style={{ width: `${Math.min(100, conv)}%`, height: "100%", borderRadius: 100, background: V1 }} />
                            </div>
                            <span className="text-[11.5px] font-bold tabular-nums w-9 text-right" style={{ color: "var(--gz-text-muted)" }}>
                              {u.referral_count > 0 ? `${conv}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <RiskBadge risk={u.fraud_risk} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => toggleAffiliate(u.id, u.is_affiliate)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
                            style={{
                              background: u.is_affiliate ? `${VR}12` : `${V4}18`,
                              border: `1px solid ${u.is_affiliate ? `${VR}33` : `${V4}44`}`,
                              color: u.is_affiliate ? VR : V4,
                            }}>
                            {busy
                              ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                              : u.is_affiliate
                                ? <><X style={{ width: 12, height: 12 }} /> Remover</>
                                : <><Check style={{ width: 12, height: 12 }} /> Promover</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y" style={{ borderColor: "var(--gz-border-subtle)" }}>
              {filtered.map(u => {
                const conv = u.referral_count > 0 ? Math.round((u.bets_credited / u.referral_count) * 100) : 0;
                const busy = toggling === u.id;
                const fraudColor = u.fraud_risk === "high" ? VR : u.fraud_risk === "medium" ? V4 : VG;
                return (
                  <div key={u.id} className="p-4" style={{ borderTop: "1px solid var(--gz-border-subtle)" }}>
                    <div className="flex items-center gap-3">
                      <Avatar seed={u.full_name ?? u.id} avatarUrl={u.avatar_url} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>
                            {u.full_name ?? "Sem nome"}
                          </span>
                          {u.is_affiliate && (
                            <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: `${V4}20`, color: V4 }}>AFILIADO</span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium truncate" style={{ color: "var(--gz-text-muted)" }}>
                          {u.phone ? `+258 ${u.phone}` : "Sem telemóvel"}
                          {u.affiliate_invite_code && <span> · {u.affiliate_invite_code}</span>}
                        </div>
                      </div>
                      <span className="w-1.5 h-10 rounded-full flex-shrink-0"
                        style={{ background: fraudColor, opacity: u.fraud_risk === "low" ? 0.25 : 1 }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {[
                        { label: "Referidos", val: String(u.referral_count) },
                        { label: "Apostas", val: String(u.bets_credited) },
                        { label: "Pendente", val: fmtMZN(u.affiliate_pending_earnings) },
                        { label: "Conversão", val: u.referral_count > 0 ? `${conv}%` : "—" },
                      ].map(s => (
                        <div key={s.label} className="p-2 rounded-xl text-center" style={{ background: "var(--gz-bg-subtle)" }}>
                          <div className="text-[11.5px] font-extrabold tabular-nums truncate" style={{ color: "var(--gz-text-primary)" }}>{s.val}</div>
                          <div className="text-[9.5px] font-semibold mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <RiskBadge risk={u.fraud_risk} />
                      <button
                        onClick={() => toggleAffiliate(u.id, u.is_affiliate)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all active:scale-95 disabled:opacity-60"
                        style={{
                          background: u.is_affiliate ? `${VR}12` : `${V4}18`,
                          border: `1px solid ${u.is_affiliate ? `${VR}33` : `${V4}44`}`,
                          color: u.is_affiliate ? VR : V4,
                        }}>
                        {busy
                          ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                          : u.is_affiliate
                            ? <><X style={{ width: 12, height: 12 }} /> Remover</>
                            : <><Check style={{ width: 12, height: 12 }} /> Promover</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
