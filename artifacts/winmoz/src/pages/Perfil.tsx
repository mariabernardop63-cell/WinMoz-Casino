import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  User, Eye, EyeOff,
  ArrowDownToLine, Plus, RefreshCw, MoreHorizontal,
  ArrowUpRight, ArrowDownLeft, RefreshCcw,
  X, UserCog, UserPlus, FileText, Flag, Lock, HelpCircle, Settings, LogOut, ChevronRight, Shield, ScanLine,
  Gamepad2, CreditCard,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

function getBalance(): number {
  return parseFloat(localStorage.getItem("winmoz_balance") || "0");
}
function fmtMZN(val: number): string {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}
function getProfile() {
  return {
    name:   localStorage.getItem("winmoz_user_name")  || "SONIA DAUSSE F.",
    phone:  localStorage.getItem("winmoz_user_phone") || "845678893",
    avatar: localStorage.getItem("winmoz_user_avatar") || "",
  };
}
function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

type TxIcon = typeof ArrowUpRight;
interface Tx { id: number; name: string; type: string; date: string; amount: string; icon: TxIcon; color: string }

function getRecentTransactions(): Tx[] {
  const stored = JSON.parse(localStorage.getItem("winmoz_transactions") || "[]");
  if (stored.length === 0) {
    return [
      { id: 1, name: "Para Sarah",    type: "Transferência", date: "27 Jan", amount: "+589 MZN", icon: ArrowUpRight,  color: "#22c55e" },
      { id: 2, name: "De John Dack",  type: "Transferência", date: "27 Jan", amount: "+150 MZN", icon: ArrowDownLeft, color: "#22c55e" },
      { id: 3, name: "Torneio Ludo",  type: "Aposta",        date: "23 Jan", amount: "+457 MZN", icon: Gamepad2,      color: "#a78bfa" },
    ];
  }
  return stored.slice(0, 3).map((t: any, i: number) => ({
    id: i,
    name: t.name || t.type || "Transação",
    type: t.type || "Movimento",
    date: (t.date || "").split(" ").slice(0, 2).join(" "),
    amount: `${t.sign || (t.type === "Depósito" || t.type === "Recarga" ? "+" : "-")}${t.amount || 0} MZN`,
    icon: t.type === "Depósito" ? ArrowDownLeft : t.type === "Levamento" ? ArrowUpRight : t.type === "Aposta" ? Gamepad2 : CreditCard,
    color: (t.type === "Depósito" || t.type === "Recarga") ? "#22c55e" : t.type === "Aposta" ? "#a78bfa" : "#ef4444",
  }));
}

const FERRAMENTAS = [
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
  const [balance, setBalanceState] = useState(0);
  const [profile, setProfile] = useState({ name: "SONIA DAUSSE F.", phone: "845678893", avatar: "" });
  const [, setLocation] = useLocation();

  useEffect(() => {
    setBalanceState(getBalance());
    setProfile(getProfile());
    const interval = setInterval(() => {
      setBalanceState(getBalance());
      setProfile(getProfile());
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const transactions = getRecentTransactions();

  const handleAction = (label: string) => {
    if (label === "Levantar")  setLocation("/levantar");
    if (label === "Depositar") setLocation("/depositar");
    if (label === "Recaregar") setLocation("/recarga");
    if (label === "Mais")      setFerramentasOpen(true);
  };

  const handleFerramentaClick = (label: string, route: string | null) => {
    if (label === "Sair") {
      localStorage.removeItem("winmoz_logged_in");
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
          {/* Top right buttons */}
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

          {/* Avatar + Name */}
          <button onClick={() => setLocation("/editar-perfil")} className="flex items-center gap-4 mb-5 group">
            <div style={{
              width: 62, height: 62, borderRadius: 999,
              background: "#2a2a2a", border: "2.5px solid rgba(124,58,237,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              overflow: "hidden",
            }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <User style={{ width: 30, height: 30, color: "#94a3b8" }} />
              }
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-white font-syne font-bold group-hover:opacity-80 transition-opacity" style={{ fontSize: 15, letterSpacing: "0.3px" }}>
                {profile.name}
              </p>
              <p style={{ fontSize: 12, color: "#71717a", fontWeight: 400 }}>
                +258 {formatPhone(profile.phone)}
              </p>
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
          <AnimatePresence mode="wait">
            {!ferramentasOpen ? (
              <motion.div key="transacoes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-syne font-bold text-slate-900" style={{ fontSize: 16 }}>Transações</h2>
                  <button onClick={() => setLocation("/extratos")}
                    className="font-medium text-slate-400 hover:text-slate-700 transition-colors" style={{ fontSize: 12 }}>
                    Ver todas
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {transactions.map((tx, i) => (
                    <motion.div key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.38 }}
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
                      <p className="font-bold flex-shrink-0" style={{ fontSize: 13, color: tx.color }}>{tx.amount}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Quick access ferramentas */}
                <div className="mt-5">
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
                </div>
              </motion.div>
            ) : (
              <motion.div key="ferramentas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
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
                  {FERRAMENTAS.map(({ icon: Icon, label, desc, route, danger }, i) => (
                    <motion.button key={label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.28 }}
                      onClick={() => handleFerramentaClick(label, route ?? null)}
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 text-left w-full group ${
                        danger
                          ? "border-red-100 bg-red-50/50 hover:bg-red-50 hover:border-red-200"
                          : "border-slate-100 bg-white hover:bg-slate-50"
                      }`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: danger ? "#fef2f2" : "#f7f8fa",
                          border: danger ? "1px solid #fecaca" : "1px solid #e2e8f0",
                        }}>
                        <Icon style={{ width: 18, height: 18, color: danger ? "#dc2626" : "#111" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-syne font-bold text-sm ${danger ? "text-red-600" : "text-slate-800"}`}>{label}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${danger ? "text-red-300" : "text-slate-300"}`} />
                    </motion.button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-[11px] text-slate-400">A tua conta está protegida com encriptação de 256-bit.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
