import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Copy, Check, Share2, TrendingUp, Users, Wallet,
  Gift, ChevronRight, Star, Zap, ArrowUpRight, Trophy, Info,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function fmtMZN(val: number) {
  return `${Number(val.toFixed(2)).toLocaleString("pt-PT")} MT`;
}

function AffiliateBadgeLarge() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-lg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#d97706"/>
        </linearGradient>
        <linearGradient id="shine-lg" x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M32 4L38.5 14.5L51 11L48.5 23.5L59 30L48.5 36.5L51 49L38.5 45.5L32 56L25.5 45.5L13 49L15.5 36.5L5 30L15.5 23.5L13 11L25.5 14.5Z" fill="url(#bg-lg)"/>
      <path d="M32 4L38.5 14.5L51 11L48.5 23.5L59 30L48.5 36.5L51 49L38.5 45.5L32 56L25.5 45.5L13 49L15.5 36.5L5 30L15.5 23.5L13 11L25.5 14.5Z" fill="url(#shine-lg)"/>
      <circle cx="32" cy="30" r="16" fill="rgba(0,0,0,0.15)"/>
      <circle cx="32" cy="30" r="14" fill="rgba(255,255,255,0.12)"/>
      <text x="32" y="35" textAnchor="middle" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="13" fill="#fff" letterSpacing="1">AF</text>
    </svg>
  );
}

interface AffiliateStats {
  referralCount: number;
  betsCredited: number;
  pendingEarnings: number;
  milestone500Claimed: boolean;
  milestone2000Claimed: boolean;
}

export default function ProgramaAfiliados() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<AffiliateStats>({
    referralCount: 0,
    betsCredited: 0,
    pendingEarnings: 0,
    milestone500Claimed: false,
    milestone2000Claimed: false,
  });
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [claiming, setClaiming] = useState<"500" | "2000" | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [{ count: refCount }, { data: betsData }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("referrer_id", profile.id),
        supabase
          .from("affiliate_bets")
          .select("bet_count")
          .eq("affiliate_id", profile.id),
      ]);

      const totalBets = (betsData || []).reduce((s, r: any) => s + (r.bet_count || 0), 0);

      setStats({
        referralCount: refCount ?? 0,
        betsCredited: totalBets,
        pendingEarnings: Number((profile as any).affiliate_pending_earnings ?? 0),
        milestone500Claimed: !!(profile as any).affiliate_milestone_500_claimed,
        milestone2000Claimed: !!(profile as any).affiliate_milestone_2000_claimed,
      });
    } catch {}
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const code = (profile as any)?.affiliate_invite_code ?? profile?.my_invite_code ?? "";
  const shareLink = `https://mozbet.site/${code}`;
  const shareText = `🎮 Junta-te ao MozBet e ganha bónus! Usa o meu link: ${shareLink}`;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareLink); }
    catch { const ta = document.createElement("textarea"); ta.value = shareLink; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "MozBet — Convite", text: shareText, url: shareLink }); } catch {}
    } else { handleCopy(); }
  };

  const handleTransfer = async () => {
    if (stats.pendingEarnings <= 0) { showToast("Não tens saldo pendente para transferir.", false); return; }
    setTransferring(true);
    try {
      const { error } = await supabase.rpc("affiliate_transfer_to_balance", {
        p_user_id: profile!.id,
        p_amount: stats.pendingEarnings,
      });
      if (error) throw error;
      showToast(`${fmtMZN(stats.pendingEarnings)} transferidos para a tua conta!`);
      await refreshProfile();
      await loadStats();
    } catch {
      showToast("Erro ao transferir. Tenta novamente.", false);
    }
    setTransferring(false);
  };

  const handleClaimMilestone = async (milestone: "500" | "2000") => {
    const amount = milestone === "500" ? 500 : 2000;
    const threshold = milestone === "500" ? 500 : 2000;
    if (stats.referralCount < threshold) { showToast(`Ainda precisas de ${threshold - stats.referralCount} referidos.`, false); return; }
    setClaiming(milestone);
    try {
      const col = milestone === "500" ? "affiliate_milestone_500_claimed" : "affiliate_milestone_2000_claimed";
      const { error } = await supabase.rpc("affiliate_claim_milestone", {
        p_user_id: profile!.id,
        p_milestone: milestone,
        p_amount: amount,
      });
      if (error) throw error;
      showToast(`${fmtMZN(amount)} adicionados ao teu saldo pendente!`);
      await refreshProfile();
      await loadStats();
    } catch {
      showToast("Erro ao reclamar bónus. Tenta novamente.", false);
    }
    setClaiming(null);
  };

  const milestone500Unlocked = stats.referralCount >= 500 && !stats.milestone500Claimed;
  const milestone2000Unlocked = stats.referralCount >= 2000 && !stats.milestone2000Claimed;

  const progress500 = Math.min((stats.referralCount / 500) * 100, 100);
  const progress2000 = Math.min((stats.referralCount / 2000) * 100, 100);

  if (!(profile as any)?.is_affiliate) {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f0f" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <Star style={{ width: 28, height: 28, color: "#f59e0b" }} />
            </div>
            <h1 className="font-syne font-bold text-white text-2xl">Programa de Afiliados</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Ainda não és um afiliado oficial da MozBet. Contacta o suporte para te tornares um parceiro e começares a ganhar comissões.
            </p>
            <button onClick={() => setLocation("/suporte")}
              className="mt-2 px-6 py-3 rounded-2xl font-syne font-bold text-sm"
              style={{ background: "#f59e0b", color: "#000" }}>
              Contactar Suporte
            </button>
            <button onClick={() => setLocation("/perfil")}
              className="flex items-center gap-1.5 text-white/30 text-sm mt-1 hover:text-white/60 transition-colors">
              <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar ao Perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f0f" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen relative overflow-x-hidden">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="fixed top-4 left-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-2xl"
              style={{ transform: "translateX(-50%)", background: toast.ok ? "#22c55e" : "#ef4444", color: "#fff", maxWidth: 320, textAlign: "center" }}>
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="relative px-5 pt-12 pb-8 overflow-hidden"
          style={{ background: "linear-gradient(145deg, #92400e 0%, #d97706 40%, #f59e0b 80%, #fbbf24 100%)" }}>
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10" style={{ background: "#fff" }} />
          <div className="absolute top-20 -left-8 w-28 h-28 rounded-full opacity-10" style={{ background: "#fff" }} />

          <button onClick={() => setLocation("/perfil")}
            className="flex items-center gap-2 mb-5 opacity-80 hover:opacity-100 transition-opacity">
            <ArrowLeft style={{ width: 20, height: 20, color: "#fff" }} />
            <span className="text-white text-sm font-medium">Voltar</span>
          </button>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex items-start gap-4">
            <AffiliateBadgeLarge />
            <div>
              <p className="text-amber-200 text-xs font-semibold uppercase tracking-widest mb-0.5">Afiliado Oficial</p>
              <h1 className="font-syne font-bold text-white leading-tight" style={{ fontSize: "1.5rem" }}>
                Programa de<br />Afiliados MozBet
              </h1>
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <div className="flex" style={{ background: "#1a1a1a" }}>
          {[
            { label: "Referidos", val: stats.referralCount.toString() },
            { label: "Apostas", val: stats.betsCredited.toString() },
            { label: "Pendente", val: fmtMZN(stats.pendingEarnings) },
          ].map(({ label, val }, i) => (
            <div key={label} className={`flex-1 flex flex-col items-center py-3 ${i < 2 ? "border-r border-white/10" : ""}`}>
              <p className="text-amber-400 font-bold text-lg font-syne">{loading ? "…" : val}</p>
              <p className="text-white/40 text-[10px] font-medium mt-0.5 text-center">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 px-5 py-5 pb-10 overflow-y-auto flex flex-col gap-5">

          {/* Pending balance + transfer */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet style={{ width: 15, height: 15, color: "#f59e0b" }} />
                  <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Saldo Pendente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400" style={{ animation: "pulse 2s infinite" }} />
                  <span className="text-amber-400 text-[10px] font-semibold">Por colectar</span>
                </div>
              </div>
              <p className="font-syne font-bold text-white mb-4" style={{ fontSize: "2rem" }}>
                {loading ? "…" : fmtMZN(stats.pendingEarnings)}
              </p>
              <button onClick={handleTransfer} disabled={transferring || stats.pendingEarnings <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-syne font-bold text-sm transition-all"
                style={{
                  background: stats.pendingEarnings > 0 ? "#f59e0b" : "rgba(245,158,11,0.15)",
                  color: stats.pendingEarnings > 0 ? "#000" : "rgba(245,158,11,0.4)",
                  cursor: stats.pendingEarnings > 0 ? "pointer" : "default",
                }}>
                {transferring
                  ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> A transferir…</>
                  : <><ArrowUpRight style={{ width: 15, height: 15 }} /> Transferir para Saldo Principal</>
                }
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </div>
            <div className="px-4 pb-3">
              <p className="text-white/25 text-[10px] leading-relaxed">
                Ganhas 5 MT por cada aposta dos teus referidos (máx. 5 apostas por utilizador).
              </p>
            </div>
          </motion.div>

          {/* Invite link */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "2px dashed rgba(245,158,11,0.4)" }}>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2">O teu link de afiliado</p>
            <p className="font-syne font-bold text-amber-400 mb-3 break-all" style={{ fontSize: 13 }}>
              mozbet.site/<span className="text-white">{code}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: copied ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                  border: copied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(245,158,11,0.3)",
                  color: copied ? "#22c55e" : "#f59e0b",
                }}>
                {copied ? <><Check style={{ width: 13, height: 13 }} /> Copiado</> : <><Copy style={{ width: 13, height: 13 }} /> Copiar Link</>}
              </button>
              <button onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
                <Share2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <p className="text-white font-syne font-bold mb-3" style={{ fontSize: 15 }}>Como ganhas</p>
            <div className="flex flex-col gap-2">
              {[
                { icon: Share2, title: "Partilha o teu link", desc: "mozbet.site/" + code, color: "#f59e0b" },
                { icon: Users,  title: "Amigo regista-se", desc: "Com o teu link de afiliado", color: "#a78bfa" },
                { icon: Zap,    title: "+5 MT por aposta", desc: "Máximo 5 apostas por referido", color: "#22c55e" },
                { icon: Trophy, title: "Marcos de bónus", desc: "500 + 2000 referidos = bónus extra", color: "#f59e0b" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <div key={title} className="flex items-center gap-3.5 p-3.5 rounded-2xl"
                  style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color + "18", border: `1px solid ${color}35` }}>
                    <Icon style={{ width: 16, height: 16, color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-white/35 text-xs mt-0.5">{desc}</p>
                  </div>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#2a2a2a", fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Milestones */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy style={{ width: 15, height: 15, color: "#f59e0b" }} />
              <p className="text-white font-syne font-bold" style={{ fontSize: 15 }}>Marcos de Bónus</p>
            </div>

            {/* Milestone 500 */}
            <div className="rounded-2xl p-4 mb-3" style={{
              background: stats.milestone500Claimed ? "#1a2a1a" : "#1c1c1c",
              border: `1px solid ${stats.milestone500Claimed ? "rgba(34,197,94,0.3)" : "#2a2a2a"}`,
            }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-syne font-bold text-sm">500 Referidos</p>
                  <p className="text-white/40 text-xs mt-0.5">Bónus de 500 MT</p>
                </div>
                {stats.milestone500Claimed ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <Check style={{ width: 12, height: 12, color: "#22c55e" }} />
                    <span className="text-green-400 text-xs font-semibold">Colectado</span>
                  </div>
                ) : milestone500Unlocked ? (
                  <button onClick={() => handleClaimMilestone("500")} disabled={claiming === "500"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all"
                    style={{ background: "#f59e0b", color: "#000" }}>
                    {claiming === "500" ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Gift style={{ width: 11, height: 11 }} />}
                    Colectar
                  </button>
                ) : null}
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress500}%` }}
                  transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                  style={{ background: stats.milestone500Claimed ? "#22c55e" : "linear-gradient(90deg, #d97706, #f59e0b)" }} />
              </div>
              <p className="text-white/30 text-[10px] mt-1.5 text-right">{loading ? "…" : `${stats.referralCount} / 500`}</p>
            </div>

            {/* Milestone 2000 */}
            <div className="rounded-2xl p-4" style={{
              background: stats.milestone2000Claimed ? "#1a2a1a" : "#1c1c1c",
              border: `1px solid ${stats.milestone2000Claimed ? "rgba(34,197,94,0.3)" : "#2a2a2a"}`,
            }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-syne font-bold text-sm">2000 Referidos</p>
                  <p className="text-white/40 text-xs mt-0.5">Bónus de 2.000 MT</p>
                </div>
                {stats.milestone2000Claimed ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <Check style={{ width: 12, height: 12, color: "#22c55e" }} />
                    <span className="text-green-400 text-xs font-semibold">Colectado</span>
                  </div>
                ) : milestone2000Unlocked ? (
                  <button onClick={() => handleClaimMilestone("2000")} disabled={claiming === "2000"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all"
                    style={{ background: "#f59e0b", color: "#000" }}>
                    {claiming === "2000" ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Gift style={{ width: 11, height: 11 }} />}
                    Colectar
                  </button>
                ) : null}
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress2000}%` }}
                  transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                  style={{ background: stats.milestone2000Claimed ? "#22c55e" : "linear-gradient(90deg, #7c3aed, #a78bfa)" }} />
              </div>
              <p className="text-white/30 text-[10px] mt-1.5 text-right">{loading ? "…" : `${stats.referralCount} / 2000`}</p>
            </div>
          </motion.div>

          {/* Info */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <Info style={{ width: 14, height: 14, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <p className="text-white/40 text-xs leading-relaxed">
              Os créditos são processados automaticamente quando os teus referidos fazem apostas. Cada referido pode gerar no máximo 5 créditos de 5 MT (25 MT por referido).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
