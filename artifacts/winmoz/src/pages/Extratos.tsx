import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Gamepad2, CreditCard,
  ChevronRight, Search, SlidersHorizontal,
} from "lucide-react";

const CYAN = "#00D4B4";

type TxType = "Todos" | "Depósitos" | "Levamentos" | "Apostas" | "Recargas";

interface Tx {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  date: string;
  rawDate: Date;
  amount: number;
  sign: "+" | "-";
  state: "Aprovado" | "Pendente" | "Recusado";
  method?: string;
}

const DEMO_TXS: Tx[] = [
  { id: "WM001", type: "Depósito",  name: "Depósito M-Pesa",     date: "28 Maio 2026", rawDate: new Date("2026-05-28"), amount: 500,   sign: "+", state: "Aprovado",  method: "M-Pesa" },
  { id: "WM002", type: "Aposta",    name: "Damas — Partida #44", date: "28 Maio 2026", rawDate: new Date("2026-05-28"), amount: 50,    sign: "-", state: "Recusado" },
  { id: "WM003", type: "Aposta",    name: "Ludo — Torneio",      date: "27 Maio 2026", rawDate: new Date("2026-05-27"), amount: 100,   sign: "-", state: "Aprovado" },
  { id: "WM004", type: "Levamento", name: "Levamento M-Pesa",    date: "27 Maio 2026", rawDate: new Date("2026-05-27"), amount: 200,   sign: "-", state: "Aprovado",  method: "M-Pesa" },
  { id: "WM005", type: "Recarga",   name: "Recarga Conta",       date: "26 Maio 2026", rawDate: new Date("2026-05-26"), amount: 1000,  sign: "+", state: "Aprovado" },
  { id: "WM006", type: "Aposta",    name: "Xadrez — Amigável",   date: "25 Maio 2026", rawDate: new Date("2026-05-25"), amount: 75,    sign: "-", state: "Aprovado" },
  { id: "WM007", type: "Aposta",    name: "Damas — Clássico",    date: "25 Maio 2026", rawDate: new Date("2026-05-25"), amount: 200,   sign: "+", state: "Aprovado" },
  { id: "WM008", type: "Depósito",  name: "Depósito M-Pesa",     date: "24 Maio 2026", rawDate: new Date("2026-05-24"), amount: 2000,  sign: "+", state: "Aprovado",  method: "M-Pesa" },
  { id: "WM009", type: "Levamento", name: "Levamento M-Pesa",    date: "23 Maio 2026", rawDate: new Date("2026-05-23"), amount: 500,   sign: "-", state: "Pendente",  method: "M-Pesa" },
  { id: "WM010", type: "Recarga",   name: "Bónus de Convite",    date: "22 Maio 2026", rawDate: new Date("2026-05-22"), amount: 5,     sign: "+", state: "Aprovado" },
];

function getIcon(type: string) {
  if (type === "Depósito") return { Icon: ArrowDownLeft, color: "#22c55e" };
  if (type === "Levamento") return { Icon: ArrowUpRight, color: "#ef4444" };
  if (type === "Recarga") return { Icon: RefreshCw, color: CYAN };
  if (type === "Aposta") return { Icon: Gamepad2, color: "#a78bfa" };
  return { Icon: CreditCard, color: "#94a3b8" };
}

function stateColor(state: string) {
  if (state === "Aprovado") return "#22c55e";
  if (state === "Pendente") return "#f59e0b";
  return "#ef4444";
}

function fmtMZN(val: number) {
  return `${Number(val).toLocaleString("pt-PT")} MZN`;
}

const FILTERS: TxType[] = ["Todos", "Depósitos", "Levamentos", "Apostas", "Recargas"];

const filterMap: Record<TxType, string | null> = {
  "Todos": null,
  "Depósitos": "Depósito",
  "Levamentos": "Levamento",
  "Apostas": "Aposta",
  "Recargas": "Recarga",
};

export default function Extratos() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<TxType>("Todos");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("winmoz_transactions") || "[]");
    const mapped: Tx[] = stored.map((t: any, i: number) => ({
      id: t.id || `TX${i}`,
      type: t.type || "Depósito",
      name: `${t.type || "Depósito"} ${t.method ? `(${t.method})` : ""}`.trim(),
      date: t.date || new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }),
      rawDate: new Date(t.date || Date.now()),
      amount: Math.abs(t.amount || 0),
      sign: t.type === "Levamento" || t.type === "Aposta" ? "-" : "+",
      state: t.state || "Aprovado",
      method: t.method,
    }));
    setTransactions([...mapped, ...DEMO_TXS]);
  }, []);

  const filtered = transactions.filter(tx => {
    const typeMatch = !filterMap[activeFilter] || tx.type === filterMap[activeFilter];
    const searchMatch = !search || tx.name.toLowerCase().includes(search.toLowerCase()) || tx.id.toLowerCase().includes(search.toLowerCase());
    return typeMatch && searchMatch;
  });

  const grouped = filtered.reduce((acc, tx) => {
    const key = tx.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {} as Record<string, Tx[]>);

  const totalIn  = filtered.filter(t => t.sign === "+").reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.sign === "-").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f0f" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">

        {/* Header */}
        <div className="px-5 pt-12 pb-4">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setLocation("/perfil")}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1c" }}>
              <ArrowLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <div className="text-center">
              <p className="font-syne font-bold text-white text-base">Extratos</p>
              <p className="text-white/40 text-xs">Histórico de movimentos</p>
            </div>
            <button onClick={() => setSearchOpen(v => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: searchOpen ? CYAN : "#1c1c1c" }}>
              <Search style={{ width: 16, height: 16, color: searchOpen ? "#000" : "#fff" }} />
            </button>
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar transações…"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: "#1c1c1c", color: "#fff", border: `1px solid ${CYAN}40`, caretColor: CYAN }}
                  autoFocus />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Total entradas",  val: fmtMZN(totalIn),  color: "#22c55e", sign: "+" },
              { label: "Total saídas",    val: fmtMZN(totalOut), color: "#ef4444", sign: "-" },
            ].map(({ label, val, color, sign }) => (
              <div key={label} className="p-3.5 rounded-2xl" style={{ background: "#1c1c1c" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                <p className="font-syne font-bold text-sm" style={{ color }}>
                  <span className="text-xs mr-0.5">{sign}</span>{val}
                </p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className="flex-shrink-0 px-4 h-8 rounded-full font-semibold text-xs transition-all"
                style={{
                  background: activeFilter === f ? CYAN : "#1c1c1c",
                  color: activeFilter === f ? "#000" : "#8e8e93",
                  border: activeFilter === f ? "none" : "1px solid #2a2a2a",
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions list */}
        <div className="flex-1 px-5 pb-10 overflow-y-auto">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <SlidersHorizontal style={{ width: 40, height: 40, color: "#3a3a3a" }} />
              <p className="text-white/30 text-sm mt-3">Nenhuma transação encontrada</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, txs]) => (
              <div key={date} className="mb-5">
                <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">{date}</p>
                <div className="flex flex-col gap-2">
                  {txs.map((tx, i) => {
                    const { Icon, color } = getIcon(tx.type);
                    const expanded = expandedId === tx.id;
                    return (
                      <motion.div key={tx.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.28 }}>
                        <button onClick={() => setExpandedId(expanded ? null : tx.id)}
                          className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                          style={{ background: "#1c1c1c", border: expanded ? `1px solid ${color}40` : "1px solid transparent" }}>
                          {/* Icon */}
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: color + "15", border: `1px solid ${color}30` }}>
                            <Icon style={{ width: 18, height: 18, color }} />
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{tx.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: stateColor(tx.state) + "20", color: stateColor(tx.state) }}>
                                {tx.state}
                              </span>
                              <span className="text-white/30 text-[10px]">{tx.id}</span>
                            </div>
                          </div>
                          {/* Amount */}
                          <div className="flex flex-col items-end flex-shrink-0 gap-1">
                            <p className="font-bold text-sm" style={{ color: tx.sign === "+" ? "#22c55e" : "#ef4444" }}>
                              {tx.sign}{fmtMZN(tx.amount)}
                            </p>
                            <ChevronRight style={{ width: 14, height: 14, color: "#3a3a3a", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                          </div>
                        </button>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                              className="overflow-hidden">
                              <div className="mx-1 mb-1 p-3.5 rounded-b-2xl"
                                style={{ background: "#161616", border: `1px solid ${color}20`, borderTop: "none" }}>
                                {[
                                  { label: "ID",       val: tx.id },
                                  { label: "Tipo",     val: tx.type },
                                  { label: "Data",     val: tx.date },
                                  tx.method ? { label: "Método", val: tx.method } : null,
                                  { label: "Montante", val: `${tx.sign}${fmtMZN(tx.amount)}` },
                                  { label: "Estado",   val: tx.state },
                                ].filter(Boolean).map(row => (
                                  <div key={row!.label} className="flex items-center justify-between py-1.5">
                                    <span className="text-xs" style={{ color: "#636366" }}>{row!.label}</span>
                                    <span className="text-xs font-medium text-white">{row!.val}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
