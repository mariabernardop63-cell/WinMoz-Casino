import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  User, Eye, EyeOff,
  ArrowDownToLine, Plus, RefreshCw, MoreHorizontal,
  ArrowUpRight, ArrowDownLeft,
  X, UserCog, UserPlus, FileText, Flag, Lock, HelpCircle, Settings, LogOut, ChevronRight, Shield, ScanLine,
  Gamepad2, CreditCard, Star,
} from "lucide-react";

function AffiliateBadge() {
  return (
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <defs>
        <linearGradient id="ab-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#d97706"/>
        </linearGradient>
      </defs>
      <path d="M32 4L38.5 14.5L51 11L48.5 23.5L59 30L48.5 36.5L51 49L38.5 45.5L32 56L25.5 45.5L13 49L15.5 36.5L5 30L15.5 23.5L13 11L25.5 14.5Z" fill="url(#ab-bg)"/>
      <text x="32" y="35" textAnchor="middle" fontFamily="sans-serif" fontWeight="800" fontSize="18" fill="#fff">A</text>
    </svg>
  );
}
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

function fmtMZN(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) || 0 : (isFinite(val) ? val : 0);
  const str = n.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}
function formatPhone(digits: string) {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

type TxIcon = typeof ArrowUpRight;
interface Tx {
  id: string;
  name: string;
  type: string;
  date: string;
  amount: string;
  icon: TxIcon;
  color: string;
}

function mapTxType(dbType: string): string {
  const m: Record<string, string> = {
    deposit: "Depósito", withdrawal: "Levamento", bet: "Aposta",
    win: "Vitória", recharge: "Recarga", referral_bonus: "Bónus",
    manual_deposit: "Depósito", manual_bet: "Aposta",
  };
  return m[dbType] || "Transação";
}

function mapTxSign(dbType: string): "+" | "-" {
  return ["withdrawal", "bet", "manual_bet"].includes(dbType) ? "-" : "+";
}

function mapTxIcon(dbType: string): { icon: TxIcon; color: string } {
  if (dbType === "deposit" || dbType === "manual_deposit") return { icon: ArrowDownLeft, color: "#22c55e" };
  if (dbType === "withdrawal") return { icon: ArrowUpRight, color: "#ef4444" };
  if (dbType === "recharge") return { icon: RefreshCw, color: "#00D4B4" };
  if (dbType === "win") return { icon: Gamepad2, color: "#f59e0b" };
  if (dbType === "bet" || dbType === "manual_bet") return { icon: Gamepad2, color: "#a78bfa" };
  if (dbType === "referral_bonus") return { icon: ArrowDownLeft, color: "#22c55e" };
  return { icon: CreditCard, color: "#94a3b8" };
}

function stripBotMarkers(s: string): string {
  return s.replace(/\s*\[bot\]\s*/gi, " ").replace(/\s*\[bot-fim\]\s*/gi, "").trim();
}

function parseTxDescription(raw: string | null, type: string): string {
  if (!raw) return mapTxType(type);
  try {
    const p = JSON.parse(raw);
    if (p.mode === "deposit") return "Depósito via M-Pesa/e-Mola";
    if (p.mode === "bet")     return "Aposta via Carteira Móvel";
    if (p.confirmationMsg)   return mapTxType(type) + " manual";
    if (type === "withdrawal" && p.method) {
      const phone = p.phone ? String(p.phone) : null;
      return phone ? `Levamento via ${p.method} · ${phone}` : `Levamento via ${p.method}`;
    }
  } catch { /* not JSON — use raw text */ }
  return stripBotMarkers(raw);
}

const FERRAMENTAS_BASE = [
  { icon: UserCog,    label: "Editar Perfil",    desc: "Altera o teu nome, foto e dados",   route: "/editar-perfil"   },
  { icon: UserPlus,   label: "Convidar Amigos",  desc: "Convida e ganha bónus especiais",   route: "/convidar-amigos" },
  { icon: FileText,   label: "Extratos",         desc: "Histórico completo de transações",  route: "/extratos"        },
  { icon: Flag,       label: "Reportar",         desc: "Reporta um problema ou utilizador", route: "/reportar"        },
  { icon: Lock,       label: "Privacidade",      desc: "Gerir dados e permissões",          route: "/privacidade"     },
  { icon: HelpCircle, label: "Suporte",          desc: "Fala com a nossa equipa 24/7",      route: "/suporte"         },
  { icon: Settings,   label: "Definições",       desc: "Notificações, idioma e mais",       route: "/definicoes"      },
  { icon: LogOut,     label: "Sair",             desc: "Terminar sessão da conta",          route: null, danger: true },
];

export default function Perfil() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [ferramentasOpen, setFerramentasOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { profile, signOut, user, sessionReady } = useAuth();

  const FERRAMENTAS = [
    ...FERRAMENTAS_BASE.slice(0, 1),
    ...(profile?.is_affiliate ? [{ icon: Star, label: "Programa de Afiliados", desc: "Painel oficial de afiliado MozBet", route: "/afiliados", affiliate: true }] : []),
    ...FERRAMENTAS_BASE.slice(1),
  ];

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const displayName = profile?.full_name ?? profile?.email?.split("@")[0] ?? "Utilizador";
  const displayPhone = profile?.phone ?? "";
  const displayAvatar = profile?.avatar_url ?? "";
  const balance = profile?.balance ?? 0;

  // Use user.id (primitive) as dependency — avoids re-running when user object reference
  // changes but the id stays the same (which happened on every auth state event)
  const userId = user?.id ?? null;

  useEffect(() => {
    // Wait until Supabase session is confirmed before fetching — prevents
    // the query firing before the auth token is loaded (causes RLS to reject on refresh)
    if (!sessionReady) return;
    if (!userId) { setTxLoading(false); return; }

    let cancelled = false;
    setTxLoading(true);

    // 8-second hard timeout so the spinner never hangs forever
    const timer = setTimeout(() => {
      if (!cancelled) { setTransactions([]); setTxLoading(false); }
    }, 8000);

    Promise.resolve(
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3)
    ).then(({ data }) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (data && data.length > 0) {
          const mapped: Tx[] = data.map((t: any) => {
            const { icon, color } = mapTxIcon(t.type);
            const sign = mapTxSign(t.type);
            const amt = Math.abs(parseFloat(String(t.amount)));
            return {
              id: t.id,
              name: parseTxDescription(t.description, t.type),
              type: mapTxType(t.type),
              date: new Date(t.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }),
              amount: `${sign}${amt.toLocaleString("pt-PT")} MZN`,
              icon,
              color,
            };
          });
          setTransactions(mapped);
        } else {
          setTransactions([]);
        }
        setTxLoading(false);
      })
      .catch(() => {
        if (!cancelled) { clearTimeout(timer); setTransactions([]); setTxLoading(false); }
      });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId, sessionReady]);

  const handleAction = (label: string) => {
    if (label === "Levantar")  setLocation("/levantar");
    if (label === "Depositar") setLocation("/depositar");
    if (label === "Recaregar") setLocation("/recarga");
    if (label === "Mais")      setFerramentasOpen(true);
  };

  const handleFerramentaClick = async (label: string, route: string | null) => {
    if (label === "Sair") {
      await signOut();
      setLocation("/");
      return;
    }
    if (route) setLocation(route);
  };

  const ACTIONS = [
    { icon: ArrowDownToLine, label: "Levantar"  },
    { icon: Plus,            label: "Depositar" },
    { icon: RefreshCw,       label: "Recaregar" },
    { icon: MoreHorizontal,  label: "Mais"      },
  ];

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#111111" }}>
      <div className="w-full max-w-[430px] flex flex-col relative">

        {/* ── DARK TOP SECTION ── */}
        <div className="px-5 pt-6 pb-0 relative">
          <div className="absolute top-6 right-5 flex items-center gap-2">
            <button onClick={() => setLocation("/scanner-qr")} className="flex items-center justify-center rounded-full transition-all"
              style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <ScanLine style={{ width: 16, height: 16, color: "#a1a1aa" }} />
            </button>
            <button onClick={() => setBalanceVisible(v => !v)}
              className="flex items-center justify-center rounded-full transition-all"
              style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {balanceVisible
                ? <Eye   style={{ width: 16, height: 16, color: "#a1a1aa" }} />
                : <EyeOff style={{ width: 16, height: 16, color: "#a1a1aa" }} />
              }
            </button>
          </div>

          {/* Avatar + Name + Phone */}
          <button onClick={() => setLocation("/editar-perfil")} className="flex items-center gap-4 mb-5 group">
            <div style={{
              width: 62, height: 62, borderRadius: 999,
              background: "#2a2a2a", border: "2.5px solid rgba(124,58,237,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              overflow: "hidden",
            }}>
              {displayAvatar
                ? <img src={displayAvatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <User style={{ width: 30, height: 30, color: "#94a3b8" }} />
              }
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, alignItems: "flex-start" }}>
              <span className="text-white font-syne font-bold group-hover:opacity-80 transition-opacity"
                style={{ fontSize: 15, letterSpacing: "0.3px", lineHeight: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {displayName.toUpperCase()}
                {profile?.is_affiliate && <AffiliateBadge />}
              </span>
              <span style={{ fontSize: 12, color: "#71717a", fontWeight: 400, lineHeight: 1, display: "block" }}>
                {displayPhone ? `+258 ${formatPhone(displayPhone)}` : "Telemóvel não definido"}
              </span>
            </div>
          </button>

          {/* Balance */}
          <div className="mb-5">
            <p style={{ fontSize: 11, color: "#71717a", fontWeight: 500, letterSpacing: "0.5px", marginBottom: 4 }}>
              Saldo disponível
            </p>
            <p className="text-white leading-none"
              style={{
                fontSize: "2.55rem", fontWeight: 800, letterSpacing: "-0.5px",
                fontFamily: "'Inter', system-ui, sans-serif",
                filter: balanceVisible ? "none" : "blur(10px)",
                transition: "filter 0.3s ease", userSelect: "none",
              }}>
              {fmtMZN(balance)}{" "}
              <span style={{ fontSize: "1.5rem", color: "#94a3b8" }}>$MZN</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-start justify-between mb-6 px-1">
            {ACTIONS.map(({ icon: Icon, label }) => (
              <button key={label} onClick={() => handleAction(label)}
                className="flex flex-col items-center gap-2 group">
                <div className="flex items-center justify-center group-hover:bg-[#333] transition-colors"
                  style={{ width: 52, height: 52, borderRadius: 999, background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Icon style={{ width: 18, height: 18, color: "#fff" }} />
                </div>
                <span style={{ fontSize: 10.5, color: "#a1a1aa", fontWeight: 500 }} className="font-syne">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── WHITE BOTTOM SHEET ── */}
        <div className="flex-1 px-5 pt-5 pb-32" style={{ background: "#ffffff", borderRadius: "28px 28px 0 0" }}>
          {!ferramentasOpen ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-syne font-bold text-slate-900" style={{ fontSize: 16 }}>Transações</h2>
                <button onClick={() => setLocation("/extratos")}
                  className="font-medium text-slate-400 hover:text-slate-700 transition-colors" style={{ fontSize: 12 }}>
                  Ver todas
                </button>
              </div>

              {txLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <p className="text-slate-400 text-sm font-semibold">Sem transações ainda</p>
                  <p className="text-slate-300 text-xs text-center" style={{ maxWidth: 220 }}>
                    As tuas transações aparecerão aqui após o primeiro movimento.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {transactions.map((tx) => (
                    <div key={tx.id}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-slate-100"
                      style={{ background: "#f7f8fa" }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 999, background: "#fff",
                        border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <tx.icon style={{ width: 15, height: 15, color: tx.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate" style={{ fontSize: 13 }}>{tx.name}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>{tx.type} · {tx.date}</p>
                      </div>
                      <p className="font-bold flex-shrink-0"
                        style={{ fontSize: 13, color: tx.amount.startsWith("+") ? "#22c55e" : "#ef4444" }}>
                        {tx.amount}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button onClick={() => setFerramentasOpen(true)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100"
                  style={{ background: "#f7f8fa" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center">
                      <Settings style={{ width: 14, height: 14, color: "#64748b" }} />
                    </div>
                    <span className="font-syne font-semibold text-slate-700 text-sm">Ferramentas da conta</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>

                <button
                  onClick={async () => { await signOut(); setLocation("/"); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-red-100 transition-all hover:bg-red-50 hover:border-red-200"
                  style={{ background: "#fff5f5" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <LogOut style={{ width: 14, height: 14, color: "#dc2626" }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-syne font-bold text-sm text-red-600">Terminar Sessão</p>
                    <p className="text-[11px] text-red-400 mt-0.5">Sair da conta actual</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-300" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-syne font-bold text-slate-900" style={{ fontSize: 16 }}>Ferramentas</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Gerir a tua conta e preferências</p>
                </div>
                <button onClick={() => setFerramentasOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {FERRAMENTAS.map(({ icon: Icon, label, desc, route, danger, ...rest }) => {
                  const isAffiliate = (rest as any).affiliate;
                  return (
                  <button key={label}
                    onClick={() => handleFerramentaClick(label, route ?? null)}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 text-left w-full group ${
                      danger
                        ? "border-red-100 bg-red-50/50 hover:bg-red-50 hover:border-red-200"
                        : isAffiliate
                          ? "border-amber-100 bg-amber-50/40 hover:bg-amber-50"
                          : "border-slate-100 bg-white hover:bg-slate-50"
                    }`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: danger ? "#fef2f2" : isAffiliate ? "rgba(245,158,11,0.12)" : "#f7f8fa",
                        border: danger ? "1px solid #fecaca" : isAffiliate ? "1px solid rgba(245,158,11,0.35)" : "1px solid #e2e8f0",
                      }}>
                      <Icon style={{ width: 18, height: 18, color: danger ? "#dc2626" : isAffiliate ? "#d97706" : "#111" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-syne font-bold text-sm ${danger ? "text-red-600" : isAffiliate ? "text-amber-700" : "text-slate-800"}`}>{label}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{desc}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${danger ? "text-red-300" : isAffiliate ? "text-amber-300" : "text-slate-300"}`} />
                  </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-[11px] text-slate-400">A tua conta está protegida com encriptação de 256-bit.</p>
              </div>
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
