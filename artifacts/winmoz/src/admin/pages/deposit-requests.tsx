import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Clock, Wallet, Gamepad2, RefreshCw, User, Phone, MessageSquare, Inbox,
} from "lucide-react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { playAdminNotificationSound } from "@/admin/hooks/useAdminNotificationSound";
import {
  PageHeader, Card, SectionHeader, KpiTile, KpiGrid, RefreshButton, EmptyState, StatusPill,
} from "@/admin/components/ui";

const CYAN = "#0d9488";
const GREEN = "#15803d";
const RED = "#b91c1c";

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
  const prevCount = useRef<number | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const { data, error } = await adminSupabase
        .from("transactions")
        .select("id, user_id, type, amount, description, status, created_at")
        .in("type", ["manual_deposit", "manual_bet"])
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched = (data ?? []).map((row: any) => {
        let _meta = { phone: "", confirmationMsg: "", userName: "Utilizador", mode: "deposit" };
        try { _meta = { ..._meta, ...JSON.parse(row.description ?? "{}") }; } catch { /* noop */ }
        return { ...row, _meta } as DepositRequest;
      });

      setRequests(enriched);

      if (prevCount.current !== null && enriched.length > prevCount.current) {
        playAdminNotificationSound("deposit");
      }
      prevCount.current = enriched.length;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((txData as any).status !== "pending") throw new Error("Pedido já processado");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((txData as any).type === "manual_deposit" || (txData as any).type === "manual_bet") {
        const { data: profile, error: profErr } = await adminSupabase
          .from("profiles")
          .select("balance")
          .eq("id", (txData as any).user_id)
          .single();

        if (profErr) throw new Error("Erro ao obter saldo do utilizador");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = Number((profile as any)?.balance ?? 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    } catch (err) {
      console.error("[Admin] Approve error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar pedido");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((txData as any).status !== "pending") throw new Error("Pedido já processado");

      const { error: upErr } = await adminSupabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", req.id);

      if (upErr) throw new Error("Erro ao rejeitar: " + upErr.message);

      toast.success("Pedido rejeitado");
      loadRequests();
    } catch (err) {
      console.error("[Admin] Reject error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao rejeitar pedido");
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = requests.filter(r =>
    filter === "all" ? true :
    filter === "deposit" ? r.type === "manual_deposit" :
    r.type === "manual_bet"
  );

  const depositCount = requests.filter(r => r.type === "manual_deposit").length;
  const betCount = requests.filter(r => r.type === "manual_bet").length;
  const totalValue = requests.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="px-4 sm:px-5 pb-8 pt-5 max-w-[1400px] mx-auto">
      <PageHeader
        icon={Inbox}
        title="Gestão de"
        titleAccent="Depósitos"
        subtitle="Pedidos manuais de depósito e aposta pendentes de aprovação"
      >
        <RefreshButton onClick={() => { setLoading(true); loadRequests(); }} loading={loading} />
      </PageHeader>

      <div className="space-y-5">
        {/* KPI panel */}
        <Card>
          <SectionHeader
            icon={Clock}
            title="Resumo de Pedidos"
            subtitle="Actualiza em tempo real"
            action={
              <StatusPill label="AO VIVO" color="#0d9488" />
            }
          />
          <KpiGrid>
            <KpiTile label="Pendentes" value={requests.length} icon={Clock} accent="#52525b" hint="aguardando acção" />
            <KpiTile label="Depósitos" value={depositCount} icon={Wallet} accent={CYAN} hint="pedidos de depósito" />
            <KpiTile label="Apostas" value={betCount} icon={Gamepad2} accent="#71717a" hint="pedidos de aposta" />
          </KpiGrid>
        </Card>

        {/* Filter tabs */}
        <Card>
          <div className="flex items-center gap-2 p-4 flex-wrap">
            {[
              { key: "all", label: `Todos (${requests.length})` },
              { key: "deposit", label: `Depósitos (${depositCount})` },
              { key: "bet", label: `Apostas (${betCount})` },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setFilter(tab.key as "all" | "deposit" | "bet")}
                className="px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all"
                style={{
                  background: filter === tab.key ? CYAN : "var(--gz-bg-subtle)",
                  color: filter === tab.key ? "#fff" : "var(--gz-text-muted)",
                  border: `1px solid ${filter === tab.key ? CYAN : "var(--gz-border-subtle)"}`,
                }}>
                {tab.label}
              </button>
            ))}
            <div className="ml-auto text-[12px] font-semibold" style={{ color: "var(--gz-text-muted)" }}>
              Total pendente: <span style={{ color: "var(--gz-text-primary)" }}>{fmtMZN(totalValue)} MZN</span>
            </div>
          </div>
        </Card>

        {/* List */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: "var(--gz-border-subtle)", borderTopColor: "var(--gz-text-muted)" }} />
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState icon={CheckCircle2} title="Nenhum pedido pendente" subtitle="Tudo em dia!" />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {filtered.map(req => {
                const meta = req._meta!;
                const isDeposit = req.type === "manual_deposit";
                const isExpanded = expandedId === req.id;
                const isProcessing = processingId === req.id;
                const accent = isDeposit ? CYAN : "#71717a";

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="gz-card overflow-hidden">

                    {/* Type badge */}
                    <div className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${accent}18` }}>
                          {isDeposit
                            ? <Wallet style={{ width: 13, height: 13, color: accent }} />
                            : <Gamepad2 style={{ width: 13, height: 13, color: accent }} />}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                          {isDeposit ? "Depósito" : "Aposta"}
                        </span>
                        <StatusPill label="Pendente" color="#a16207" />
                      </div>
                      <span className="text-[11.5px] font-medium" style={{ color: "var(--gz-text-tertiary)" }}>{timeAgo(req.created_at)}</span>
                    </div>

                    {/* Main info */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-[24px] font-black tracking-tight tabular-nums" style={{ color: "var(--gz-text-primary)" }}>
                            {fmtMZN(Number(req.amount))} <span className="text-[14px] font-semibold" style={{ color: "var(--gz-text-tertiary)" }}>MZN</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <User style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
                              <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{meta.userName}</span>
                            </div>
                            {meta.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone style={{ width: 12, height: 12, color: "var(--gz-text-tertiary)" }} />
                                <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{meta.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          {isProcessing ? (
                            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                              style={{ borderColor: "var(--gz-border-subtle)", borderTopColor: "var(--gz-text-muted)" }} />
                          ) : (
                            <>
                              <motion.button
                                onClick={() => handleApprove(req)}
                                whileTap={{ scale: 0.93 }}
                                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12.5px] font-bold"
                                style={{ background: "rgba(21,128,61,.1)", border: "1px solid rgba(21,128,61,.22)", color: GREEN }}
                                title="Aprovar">
                                <CheckCircle2 style={{ width: 15, height: 15 }} />
                                Aprovar
                              </motion.button>
                              <motion.button
                                onClick={() => handleReject(req)}
                                whileTap={{ scale: 0.93 }}
                                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12.5px] font-bold"
                                style={{ background: "rgba(185,28,28,.08)", border: "1px solid rgba(185,28,28,.2)", color: RED }}
                                title="Rejeitar">
                                <XCircle style={{ width: 15, height: 15 }} />
                                Rejeitar
                              </motion.button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expand/collapse confirmation message */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className="flex items-center gap-1.5 text-[11.5px] font-semibold mt-4 transition-colors"
                        style={{ color: "var(--gz-text-tertiary)" }}>
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
                            <div className="mt-3 p-3.5 rounded-xl text-[12px] leading-relaxed break-words"
                              style={{
                                background: "var(--gz-bg-subtle)",
                                border: "1px solid var(--gz-border-subtle)",
                                color: "var(--gz-text-secondary)",
                              }}>
                              {meta.confirmationMsg || <span style={{ color: "var(--gz-text-tertiary)", fontStyle: "italic" }}>Sem mensagem</span>}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
