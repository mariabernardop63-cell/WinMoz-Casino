import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Gamepad2, CreditCard,
  ChevronRight, Search, SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CYAN = "#00D4B4";

type TxType = "Todos" | "Depósitos" | "Levamentos" | "Apostas" | "Recargas";

interface Tx {
  id: string;
  type: string;
  name: string;
  date: string;
  rawDate: Date;
  amount: number;
  sign: "+" | "-";
  state: "Aprovado" | "Pendente" | "Recusado";
  method?: string;
}

function mapType(dbType: string): string {
  const m: Record<string, string> = {
    deposit: "Depósito", withdrawal: "Levamento", bet: "Aposta",
    win: "Aposta", recharge: "Recarga", referral_bonus: "Bónus",
  };
  return m[dbType] || "Transação";
}

function mapSign(dbType: string): "+" | "-" {
  return ["withdrawal", "bet"].includes(dbType) ? "-" : "+";
}

function mapStatus(s: string): Tx["state"] {
  if (s === "approved") return "Aprovado";
  if (s === "pending") return "Pendente";
  return "Recusado";
}

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
  "Todos": null, "Depósitos": "Depósito", "Levamentos": "Levamento",
  "Apostas": "Aposta", "Recargas": "Recarga",
};

export default function Extratos() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<TxType>("Todos");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        const mapped: Tx[] = data.map((t: any) => {
          const displayType = mapType(t.type);
          const rawDate = new Date(t.created_at);
          return {
            id: t.id.slice(0, 8).toUpperCase(),
            type: displayType,
            name: t.description || displayType,
            date: rawDate.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }),
            rawDate,
            amount: Math.abs(parseFloat(t.amount)),
            sign: mapSign(t.type),
            state: mapStatus(t.status),
          };
        });
        setTransactions(mapped);
        setLoading(false);
      });
  }, [user]);

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

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Total entradas", val: fmtMZN(totalIn),  color: "#22c55e", sign: "+" },
              { label: "Total saídas",   val: fmtMZN(totalOut), color: "#ef4444", sign: "-" },
            ].map(({ label, val, color, sign }) => (
              <div key={label} className="p-3.5 rounded-2xl" style={{ background: "#1c1c1c" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                <p className="font-syne font-bold text-sm" style={{ color }}>
                  <span className="text-xs mr-0.5">{sign}</span>{val}
                </p>
              </div>
            ))}
          </div>

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

        <div className="flex-1 px-5 pb-10 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SlidersHorizontal style={{ width: 24, height: 24, color: "#3a3a3a" }} />
              </div>
              <p className="text-white/30 text-sm font-semibold font-syne">
                {activeFilter !== "Todos" || search ? "Nenhuma transação encontrada" : "Sem movimentos ainda"}
              </p>
              <p className="text-white/20 text-xs text-center" style={{ maxWidth: 220 }}>
                {activeFilter !== "Todos" || search
                  ? "Tente outro filtro ou termo de pesquisa."
                  : "As suas transações aparecerão aqui depois do primeiro depósito ou aposta."}
              </p>
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
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: color + "15", border: `1px solid ${color}30` }}>
                            <Icon style={{ width: 18, height: 18, color }} />
                          </div>
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
                          <div className="flex flex-col items-end flex-shrink-0 gap-1">
                            <p className="font-bold text-sm" style={{ color: tx.sign === "+" ? "#22c55e" : "#ef4444" }}>
                              {tx.sign}{fmtMZN(tx.amount)}
                            </p>
                            <ChevronRight style={{ width: 14, height: 14, color: "#3a3a3a", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                          </div>
                        </button>

                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                              className="overflow-hidden">
                              <div className="mx-1 mb-1 p-3.5 rounded-b-2xl"
                                style={{ background: "#161616", border: `1px solid ${color}20`, borderTop: "none" }}>
                                {[
                                  { label: "ID",        val: tx.id },
                                  { label: "Tipo",      val: tx.type },
                                  { label: "Data",      val: tx.date },
                                  { label: "Montante",  val: `${tx.sign}${fmtMZN(tx.amount)}` },
                                  { label: "Estado",    val: tx.state },
                                ].map(row => (
                                  <div key={row.label} className="flex items-center justify-between py-1.5">
                                    <span className="text-xs" style={{ color: "#636366" }}>{row.label}</span>
                                    <span className="text-xs font-medium text-white">{row.val}</span>
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
