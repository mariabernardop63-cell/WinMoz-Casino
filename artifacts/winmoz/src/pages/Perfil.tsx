import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Home as HomeIcon, Gamepad2, Pause, User,
  Bell, Search, ArrowDownToLine, Plus, RefreshCw, Settings,
  ArrowUpRight, ArrowDownLeft, RefreshCcw,
} from "lucide-react";

function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
          <HomeIcon className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Home</span>
        </Link>
        <Link href="/explorar" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Explorar</span>
        </Link>
        <Link href="/carteira" className="flex flex-col items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors">
          <Pause className="w-6 h-6" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Carteira</span>
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-1 text-blue-700">
          <User className="w-5 h-5" />
          <span className="text-[9px] font-semibold font-syne tracking-wide">Perfil</span>
        </Link>
      </div>
    </nav>
  );
}

const TRANSACTIONS = [
  {
    id: 1,
    name: "Para Sarah",
    type: "Transferência",
    date: "27 Jan",
    amount: "+589 $MT",
    icon: ArrowUpRight,
    color: "#6b7280",
  },
  {
    id: 2,
    name: "De John Dack",
    type: "Transferência",
    date: "27 Jan",
    amount: "+150 $MT",
    icon: ArrowDownLeft,
    color: "#6b7280",
  },
  {
    id: 3,
    name: "De John Dack",
    type: "Transferência",
    date: "23 Jan",
    amount: "+457 $MT",
    icon: RefreshCcw,
    color: "#6b7280",
  },
];

const GANHOS = [
  { id: "ludo",   icon: "/ludo-card.jpg",   label: "Ludo online", value: "00,00 $MT", sub: "$0 $MT" },
  { id: "damas",  icon: "/damas-board.png", label: "Damas",       value: "00,00 $MT", sub: "$0 $MT" },
  { id: "xadrez", icon: null,               label: "Xadrez",      value: "00,00 $MT", sub: "$0 $MT" },
];

function XadrezIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
      <span style={{ fontSize: 16, lineHeight: 1, color: "white" }}>♟</span>
    </div>
  );
}

export default function Perfil() {
  return (
    <div
      className="min-h-screen w-full flex justify-center"
      style={{ background: "#111111" }}
    >
      <div className="w-full max-w-[430px] flex flex-col relative">

        {/* ── DARK TOP SECTION ── */}
        <div className="px-5 pt-5 pb-0">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-300" />
              </div>
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#111]" />
            </div>
            <div className="flex-1 flex items-center gap-2 bg-[#222] rounded-2xl px-3 py-2 border border-white/8">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-500 font-medium">Pesquisar</span>
            </div>
            <button className="w-9 h-9 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center flex-shrink-0">
              <Bell style={{ width: 18, height: 18 }} className="text-slate-300" />
            </button>
          </div>

          {/* Saldo */}
          <div className="mb-5">
            <p className="text-[11px] text-slate-400 font-medium mb-1 tracking-wide">Saldo disponivel</p>
            <p
              className="text-white leading-none"
              style={{
                fontSize: "2.6rem",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
              }}
            >
              00,00 <span style={{ fontSize: "1.6rem", color: "#94a3b8" }}>$MT</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-start justify-between mb-5 px-1">
            {[
              { icon: ArrowDownToLine, label: "Levantar" },
              { icon: Plus,            label: "Depositar" },
              { icon: RefreshCw,       label: "Recaregar" },
              { icon: Settings,        label: "Definições" },
            ].map(({ icon: Icon, label }) => (
              <button key={label} className="flex flex-col items-center gap-2 group">
                <div className="w-13 h-13 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center group-hover:bg-[#333] transition-colors shadow"
                  style={{ width: 52, height: 52 }}>
                  <Icon className="w-[18px] h-[18px] text-white" />
                </div>
                <span className="text-[10.5px] text-slate-300 font-medium font-syne">{label}</span>
              </button>
            ))}
          </div>

          {/* Ganhos no geral header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold text-white font-syne">Ganhos no geral</h2>
            <button className="text-[12px] text-slate-400 hover:text-white transition-colors">Pesquisar</button>
          </div>

          {/* Cards — straddle boundary */}
          <div className="flex gap-3 overflow-x-auto pb-0 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {GANHOS.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="min-w-[148px] flex-shrink-0 bg-white rounded-2xl px-4 pt-3.5 pb-4 flex flex-col gap-2.5 shadow-md"
              >
                <div className="flex items-center gap-2">
                  {g.icon ? (
                    <img src={g.icon} alt={g.label} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <XadrezIcon />
                  )}
                  <span className="text-[12px] font-semibold text-slate-800 font-syne">{g.label}</span>
                </div>
                <div>
                  <p className="text-[1.05rem] font-bold text-slate-900 font-syne leading-tight">{g.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{g.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── WHITE BOTTOM SHEET ── */}
        <div
          className="flex-1 mt-4 px-5 pt-4 pb-28"
          style={{
            background: "#ffffff",
            borderRadius: "28px 28px 0 0",
          }}
        >
          {/* Transações header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-900 font-syne">Transações</h2>
            <button className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors font-medium">Ver todas</button>
          </div>

          {/* Transaction rows */}
          <div className="flex flex-col gap-2.5">
            {TRANSACTIONS.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.38 }}
                className="flex items-center gap-3 bg-[#f7f8fa] rounded-2xl px-4 py-3 border border-slate-100"
              >
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <tx.icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{tx.name}</p>
                  <p className="text-[10.5px] text-slate-400">{tx.type} · {tx.date}</p>
                </div>
                <p className="text-[13px] font-bold text-emerald-500 flex-shrink-0">{tx.amount}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM NAV ── */}
        <BottomNav />

      </div>
    </div>
  );
}
