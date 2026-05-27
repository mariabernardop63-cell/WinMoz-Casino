import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Home as HomeIcon, Gamepad2, Pause, User,
  Bell, Search, ArrowDownToLine, Plus, RefreshCw, Settings,
  ArrowUpRight, ArrowDownLeft, RefreshCcw,
} from "lucide-react";

function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full max-w-[430px] bg-[#1a1a1a]/95 backdrop-blur-md border-t border-white/10 px-6 py-3 z-50">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
          <HomeIcon className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Home</span>
        </Link>
        <Link href="/explorar" className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Explorar</span>
        </Link>
        <Link href="/carteira" className="flex flex-col items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
          <Pause className="w-6 h-6" />
          <span className="text-[9px] font-medium font-syne tracking-wide">Carteira</span>
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-1 text-white">
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
    positive: true,
    icon: ArrowUpRight,
    iconBg: "#2a2a2a",
    iconColor: "#34d399",
  },
  {
    id: 2,
    name: "De John Dack",
    type: "Transferência",
    date: "27 Jan",
    amount: "+150 $MT",
    positive: true,
    icon: ArrowDownLeft,
    iconBg: "#2a2a2a",
    iconColor: "#34d399",
  },
  {
    id: 3,
    name: "De John Dack",
    type: "Transferência",
    date: "23 Jan",
    amount: "+457 $MT",
    positive: true,
    icon: RefreshCcw,
    iconBg: "#2a2a2a",
    iconColor: "#34d399",
  },
];

const GANHOS = [
  {
    id: "ludo",
    icon: "/ludo-card.jpg",
    label: "Ludo online",
    value: "00,00 $MT",
    sub: "$0 $MT",
  },
  {
    id: "damas",
    icon: "/damas-board.png",
    label: "Damas",
    value: "00,00 $MT",
    sub: "$0 $MT",
  },
  {
    id: "xadrez",
    icon: null,
    label: "Xadrez",
    value: "00,00 $MT",
    sub: "$0 $MT",
  },
];

function XadrezIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#3b3b3b" />
      <text x="14" y="20" textAnchor="middle" fontSize="16" fill="white">♟</text>
    </svg>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.42, ease: [0.22, 1, 0.36, 1] }
  }),
};

export default function Perfil() {
  return (
    <div className="min-h-screen bg-[#111111] text-white w-full flex justify-center selection:bg-blue-800/30">
      <div className="w-full max-w-[430px] flex flex-col relative pb-28">

        {/* ── HEADER ── */}
        <header className="flex items-center gap-3 px-5 pt-5 pb-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#111111]" />
          </div>

          {/* Search bar */}
          <div className="flex-1 flex items-center gap-2 bg-[#222222] rounded-2xl px-3 py-2 border border-white/8">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-sm text-slate-500 font-medium">Pesquisar</span>
          </div>

          {/* Bell */}
          <button className="w-9 h-9 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4.5 h-4.5 text-slate-300" style={{ width: 18, height: 18 }} />
          </button>
        </header>

        {/* ── SALDO DISPONIVEL ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="px-5 pt-2 pb-5"
        >
          <p className="text-[12px] text-slate-400 font-medium mb-1 tracking-wide">Saldo disponivel</p>
          <p className="text-[2.2rem] font-extrabold tracking-tight leading-tight text-white font-syne">
            00,00 <span className="text-[1.4rem] text-slate-300">$MT</span>
          </p>
        </motion.section>

        {/* ── ACTION BUTTONS ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start justify-between px-7 pb-7"
        >
          {[
            { icon: ArrowDownToLine, label: "Levantar" },
            { icon: Plus, label: "Depositar" },
            { icon: RefreshCw, label: "Recaregar" },
            { icon: Settings, label: "Definições" },
          ].map(({ icon: Icon, label }) => (
            <button key={label} className="flex flex-col items-center gap-2.5 group">
              <div className="w-14 h-14 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center group-hover:bg-[#333333] transition-colors shadow-md">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] text-slate-300 font-medium font-syne tracking-wide">{label}</span>
            </button>
          ))}
        </motion.div>

        {/* ── GANHOS NO GERAL ── */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-white font-syne">Ganhos no geral</h2>
          <button className="text-[12px] text-slate-400 font-medium hover:text-white transition-colors">Pesquisar</button>
        </div>

        {/* ── CARDS DE GANHOS ── */}
        <div className="flex gap-3 overflow-x-auto px-5 pb-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {GANHOS.map((g, i) => (
            <motion.div
              key={g.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="min-w-[155px] flex-shrink-0 bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm"
            >
              {/* Icon + Label */}
              <div className="flex items-center gap-2">
                {g.icon ? (
                  <img
                    src={g.icon}
                    alt={g.label}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <XadrezIcon />
                )}
                <span className="text-[13px] font-semibold text-slate-800 font-syne">{g.label}</span>
              </div>
              {/* Value */}
              <div>
                <p className="text-[1.15rem] font-bold text-slate-900 font-syne leading-tight">{g.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{g.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── TRANSAÇÕES ── */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-white font-syne">Transações</h2>
          <button className="text-[12px] text-slate-400 font-medium hover:text-white transition-colors">Ver todas</button>
        </div>

        <div className="px-5 flex flex-col gap-1">
          {TRANSACTIONS.map((tx, i) => (
            <motion.div
              key={tx.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-3 bg-[#1c1c1c] rounded-2xl px-4 py-3.5 border border-white/5"
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tx.iconBg }}
              >
                <tx.icon style={{ width: 16, height: 16, color: tx.iconColor }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{tx.name}</p>
                <p className="text-[11px] text-slate-500">{tx.type} · {tx.date}</p>
              </div>

              {/* Amount */}
              <p className="text-[13px] font-bold text-emerald-400 flex-shrink-0">{tx.amount}</p>
            </motion.div>
          ))}
        </div>

        {/* ── BOTTOM NAV ── */}
        <BottomNav />

      </div>
    </div>
  );
}
