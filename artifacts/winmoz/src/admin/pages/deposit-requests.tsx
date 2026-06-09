import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Clock, Wallet, Gamepad2, RefreshCw, User, Phone, MessageSquare,
} from "lucide-react";
import { adminSupabase } from "@/admin/lib/supabase-api";

const CYAN = "#00D4B4";

function fmtMZN(val: number) {
  return val.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

interface DepositRequest {
  id: string;
  user_id: string;
  type: "manual_deposit" | "manual_bet";
  amount: number;
  description: string;
  status: string;
  created_at: string;
  _meta?: { phone: string; confirmationMsg: string; userName: string; mode: string };
}

export default function DepositRequests() {
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "deposit" | "bet">("all");

  const loadRequests = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase
        .from("transactions")
        .select("id, user_id, type, amount, description, status, created_at")
        .in("type", ["manual_deposit", "manual_bet"])
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data ?? []).map((row: any) => {
        let _meta = { phone: "", confirmationMsg: "", userName: "Utilizador", mode: "deposit" };
        try { _meta = { ..._meta, ...JSON.parse(row.description ?? "{}") }; } catch { /* noop */ }
        return { ...row, _meta } as DepositRequest;
      });

      setRequests(enriched);
    } catch (err) {
      console.error("Error loading deposit requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const channel = adminSupabase
      .channel("deposit-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        loadRequests();
      })
      .subscribe();

    return () => { adminSupabase.removeChannel(channel); };
  }, [loadRequests]);

  const handleApprove = async (req: DepositRequest) => {
    if (processingId) return;
    setProcessingId(req.id);

    try {
      const { data: txData, error: txErr } = await adminSupabase
        .from("transactions")
        .select("id, amount, user_id, type, status")
        .eq("id", req.id)
        .single();

      if (txErr || !txData) throw new Error("Pedido não encontrado");
      if ((txData as any).status !== "pending") throw new Error("Pedido já processado");

      // Credit balance for both manual deposits AND manual bets (carteira móvel)
      if ((txData as any).type === "manual_deposit" || (txData as any).type === "manual_bet") {
        const { data: profile, error: profErr } = await adminSupabase
          .from("profiles")
          .select("balance")
          .eq("id", (txData as any).user_id)
          .single();

        if (profErr) throw new Error("Erro ao obter saldo do utilizador");

        const current = Number((profile as any)?.balance ?? 0);
        const newBalance = Math.round((current + Number((txData as any).amount)) * 100) / 100;

        const { error: balErr } = await adminSupabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", (txData as any).user_id);

        if (balErr) throw new Error("Erro ao creditar saldo: " + balErr.message);
      }

      const { error: upErr } = await adminSupabase
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", req.id);

      if (upErr) throw new Error("Erro ao aprovar: " + upErr.message);

      toast.success(
        req.type === "manual_deposit"
          ? `Depósito de ${fmtMZN(req.amount)} MZN aprovado — saldo creditado`
          : `Aposta de ${fmtMZN(req.amount)} MZN aprovada — saldo creditado`
      );
      loadRequests();
    } catch (err: any) {
      console.error("[Admin] Approve error:", err);
      toast.error(err?.message ?? "Erro ao aprovar pedido");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: DepositRequest) => {
    if (processingId) return;
    setProcessingId(req.id);

    try {
      const { data: txData, error: txErr } = await adminSupabase
        .from("transactions")
        .select("id, status")
        .eq("id", req.id)
        .single();

      if (txErr || !txData) throw new Error("Pedido não encontrado");
      if ((txData as any).status !== "pending") throw new Error("Pedido já processado");

      const { error: upErr } = await adminSupabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", req.id);

      if (upErr) throw new Error("Erro ao rejeitar: " + upErr.message);

      toast.success("Pedido rejeitado");
      loadRequests();
    } catch (err: any) {
      console.error("[Admin] Reject error:", err);
      toast.error(err?.message ?? "Erro ao rejeitar pedido");
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = requests.filter(r =>
    filter === "all" ? true :
    filter === "deposit" ? r.type === "manual_deposit" :
    r.type === "manual_bet"
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestão de Depósitos</h1>
          <p className="text-sm text-white/40 mt-1">
            Pedidos manuais de depósito e aposta pendentes de aprovação
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadRequests(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "#1c1c1e", color: "#8e8e93" }}>
          <RefreshCw style={{ width: 14, height: 14 }} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Pendentes", val: requests.length, icon: Clock, color: "#f59e0b" },
          { label: "Depósitos", val: requests.filter(r => r.type === "manual_deposit").length, icon: Wallet, color: CYAN },
          { label: "Apostas", val: requests.filter(r => r.type === "manual_bet").length, icon: Gamepad2, color: "#a78bfa" },
        ].map(stat => (
          <div key={stat.label}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "#1c1c1e", border: "1px solid #2c2c2e" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${stat.color}18` }}>
              <stat.icon style={{ width: 18, height: 18, color: stat.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.val}</p>
              <p className="text-xs text-white/40">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: "all", label: "Todos" },
          { key: "deposit", label: "Depósitos" },
          { key: "bet", label: "Apostas" },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setFilter(tab.key as "all" | "deposit" | "bet")}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: filter === tab.key ? CYAN : "#1c1c1e",
              color: filter === tab.key ? "#000" : "#8e8e93",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "#1c1c1e" }}>
            <CheckCircle2 style={{ width: 28, height: 28, color: "#3a3a3c" }} />
          </div>
          <p className="text-white/40 text-sm">Nenhum pedido pendente</p>
          <p className="text-white/20 text-xs mt-1">Tudo em dia!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {filtered.map(req => {
              const meta = req._meta!;
              const isDeposit = req.type === "manual_deposit";
              const isExpanded = expandedId === req.id;
              const isProcessing = processingId === req.id;

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#1c1c1e", border: "1px solid #2c2c2e" }}>

                  {/* Type badge */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3"
                    style={{ borderBottom: "1px solid #2c2c2e" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: isDeposit ? `${CYAN}18` : "rgba(167,139,250,0.15)" }}>
                        {isDeposit
                          ? <Wallet style={{ width: 13, height: 13, color: CYAN }} />
                          : <Gamepad2 style={{ width: 13, height: 13, color: "#a78bfa" }} />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: isDeposit ? CYAN : "#a78bfa" }}>
                        {isDeposit ? "Depósito" : "Aposta"}
                      </span>
                    </div>
                    <span className="text-xs text-white/30">{timeAgo(req.created_at)}</span>
                  </div>

                  {/* Main info */}
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {fmtMZN(Number(req.amount))} <span className="text-base font-medium text-white/30">MZN</span>
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <User style={{ width: 11, height: 11, color: "#71717a" }} />
                            <span className="text-xs text-white/40">{meta.userName}</span>
                          </div>
                          {meta.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone style={{ width: 11, height: 11, color: "#71717a" }} />
                              <span className="text-xs text-white/40">{meta.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                        ) : (
                          <>
                            <motion.button
                              onClick={() => handleApprove(req)}
                              whileTap={{ scale: 0.93 }}
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.25)" }}
                              title="Aprovar">
                              <CheckCircle2 style={{ width: 18, height: 18, color: "#22c55e" }} />
                            </motion.button>
                            <motion.button
                              onClick={() => handleReject(req)}
                              whileTap={{ scale: 0.93 }}
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
                              title="Rejeitar">
                              <XCircle style={{ width: 18, height: 18, color: "#ef4444" }} />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expand/collapse confirmation message */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                      <MessageSquare style={{ width: 12, height: 12 }} />
                      {isExpanded ? "Ocultar mensagem" : "Ver mensagem de confirmação"}
                      {isExpanded
                        ? <ChevronUp style={{ width: 12, height: 12 }} />
                        : <ChevronDown style={{ width: 12, height: 12 }} />}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden">
                          <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed text-white/50 break-words"
                            style={{ background: "#111", border: "1px solid #2c2c2e", fontFamily: "system-ui" }}>
                            {meta.confirmationMsg || <span className="text-white/20 italic">Sem mensagem</span>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
