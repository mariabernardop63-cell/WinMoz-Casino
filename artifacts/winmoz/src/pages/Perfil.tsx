import { useState } from "react";
import { motion } from "framer-motion";
import { User, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, RefreshCcw } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const TRANSACTIONS = [
  { id: 1, name: "Para Sarah",    type: "Transferência", date: "27 Jan", amount: "+589 $MT", icon: ArrowUpRight  },
  { id: 2, name: "De John Dack", type: "Transferência", date: "27 Jan", amount: "+150 $MT", icon: ArrowDownLeft },
  { id: 3, name: "De John Dack", type: "Transferência", date: "23 Jan", amount: "+457 $MT", icon: RefreshCcw    },
];

export default function Perfil() {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#111111" }}>
      <div className="w-full max-w-[430px] flex flex-col relative">

        {/* ── DARK TOP SECTION ── */}
        <div className="px-5 pt-6 pb-0">

          {/* Profile row */}
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div
              className="relative flex-shrink-0 overflow-hidden"
              style={{
                width: 62,
                height: 62,
                borderRadius: 999,
                background: "#2a2a2a",
                border: "2.5px solid rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User style={{ width: 30, height: 30, color: "#94a3b8" }} />
            </div>

            {/* Name + phone */}
            <div className="flex flex-col gap-0.5">
              <p
                className="text-white font-syne font-bold leading-tight"
                style={{ fontSize: "15px", letterSpacing: "0.3px" }}
              >
                SONIA DAUSSE F.
              </p>
              <p style={{ fontSize: "12px", color: "#71717a", fontWeight: 400, letterSpacing: "0.2px" }}>
                +258 845 678 893
              </p>
            </div>
          </div>

          {/* Saldo */}
          <div className="mb-1">
            <p style={{ fontSize: "11px", color: "#71717a", fontWeight: 500, letterSpacing: "0.5px", marginBottom: 6 }}>
              Saldo disponivel
            </p>
            <div className="flex items-center gap-4">
              <p
                className="text-white leading-none"
                style={{
                  fontSize: "2.6rem",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  filter: balanceVisible ? "none" : "blur(10px)",
                  transition: "filter 0.3s ease",
                  userSelect: "none",
                }}
              >
                00,00 <span style={{ fontSize: "1.5rem", color: "#94a3b8" }}>$MT</span>
              </p>

              {/* Eye toggle */}
              <button
                onClick={() => setBalanceVisible(v => !v)}
                className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {balanceVisible ? (
                  <Eye style={{ width: 17, height: 17, color: "#a1a1aa" }} />
                ) : (
                  <EyeOff style={{ width: 17, height: 17, color: "#7c3aed" }} />
                )}
              </button>
            </div>
          </div>

          {/* Spacer before white sheet */}
          <div style={{ height: 28 }} />
        </div>

        {/* ── WHITE BOTTOM SHEET ── */}
        <div
          className="flex-1 px-5 pt-5 pb-32"
          style={{ background: "#ffffff", borderRadius: "28px 28px 0 0" }}
        >
          {/* Transações header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-slate-900" style={{ fontSize: 16 }}>
              Transações
            </h2>
            <button className="font-medium text-slate-400 hover:text-slate-700 transition-colors" style={{ fontSize: 12 }}>
              Ver todas
            </button>
          </div>

          {/* Transaction rows */}
          <div className="flex flex-col gap-2.5">
            {TRANSACTIONS.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.38 }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-slate-100"
                style={{ background: "#f7f8fa" }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 38, height: 38,
                    borderRadius: 999,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <tx.icon style={{ width: 15, height: 15, color: "#64748b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate" style={{ fontSize: 13 }}>{tx.name}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{tx.type} · {tx.date}</p>
                </div>
                <p className="font-bold flex-shrink-0" style={{ fontSize: 13, color: "#10b981" }}>
                  {tx.amount}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
