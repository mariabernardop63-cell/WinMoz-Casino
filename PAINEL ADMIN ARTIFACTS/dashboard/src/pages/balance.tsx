import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, Plus, Minus, Search, TrendingUp, TrendingDown,
  AlertTriangle, Clock, User, CheckCircle2, X,
} from "lucide-react";
import { api, type BalanceAdjustment, type PaginatedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

interface PlayerResult {
  id: number;
  username: string;
  balance: number;
  status: string;
  avatarUrl: string | null;
}

function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return (
    <img
      src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`}
      alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.12)" }}
    />
  );
}

const REASONS = [
  "bonus_win", "bonus_signup", "correction", "referral",
  "promotion", "fee_refund", "penalty", "manual_adjustment",
];
const REASON_LABELS: Record<string, string> = {
  bonus_win: "Bónus de vitória", bonus_signup: "Bónus de registo",
  correction: "Correcção", referral: "Referência",
  promotion: "Promoção", fee_refund: "Reembolso de taxa",
  penalty: "Penalização", manual_adjustment: "Ajuste manual",
};

export default function BalancePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  /* ── New adjustment form state ── */
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [adjType, setAdjType] = useState<"add" | "subtract">("add");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("manual_adjustment");
  const [formNote, setFormNote] = useState("");

  /* ── Search players ── */
  const { data: searchResults = [], isFetching: searching } = useQuery<PlayerResult[]>({
    queryKey: ["player-search", searchQuery],
    queryFn: () =>
      searchQuery.length >= 2
        ? api.get<PlayerResult[]>(`/balance-adjustments/search?q=${encodeURIComponent(searchQuery)}`)
        : Promise.resolve([]),
    enabled: searchQuery.length >= 2,
  });

  /* ── List adjustments ── */
  const { data, isLoading } = useQuery<PaginatedResponse<BalanceAdjustment>>({
    queryKey: ["balance-adjustments", page, selectedPlayer?.id],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      return api.get<PaginatedResponse<BalanceAdjustment>>(`/balance-adjustments?${params}`);
    },
  });

  const createAdjustment = useMutation({
    mutationFn: (body: { playerId: number; amount: number; reason: string; note?: string; type?: "subtract" }) =>
      api.post<BalanceAdjustment>("/balance-adjustments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-adjustments"] });
      resetForm();
      toast({ title: "Ajuste criado", description: "O saldo foi ajustado com sucesso." });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setShowForm(false);
    setSearchQuery("");
    setSelectedPlayer(null);
    setAdjType("add");
    setFormAmount("");
    setFormNote("");
    setFormReason("manual_adjustment");
  }

  function handleSubmit() {
    if (!selectedPlayer) {
      toast({ title: "Seleccione um jogador", variant: "destructive" });
      return;
    }
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Valor inválido", description: "Introduza um valor positivo.", variant: "destructive" });
      return;
    }
    createAdjustment.mutate({
      playerId: selectedPlayer.id,
      amount: amt,
      reason: formReason,
      note: formNote || undefined,
      ...(adjType === "subtract" ? { type: "subtract" as const } : {}),
    });
  }

  const adjustments = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      {/* Header */}
      <div className="gz-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Gestão de Saldos</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Histórico de ajustes e créditos manuais
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.3)" }}>
            <Plus style={{ width: 13, height: 13 }} />
            Novo Ajuste
          </button>
        </div>
      </div>

      {/* Adjustment form */}
      {showForm && (
        <div className="gz-card p-5 animate-float-up space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Novo Ajuste de Saldo</div>
            <button onClick={resetForm} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <X style={{ width: 13, height: 13, color: "var(--gz-text-muted)" }} />
            </button>
          </div>

          {/* Step 1: Player search */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>
              Passo 1 — Procurar Jogador
            </label>
            {selectedPlayer ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(16,185,129,.06)", border: "1.5px solid rgba(16,185,129,.2)" }}>
                <Avatar seed={selectedPlayer.username} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{selectedPlayer.username}</div>
                  <div className="text-[11.5px] mt-0.5 font-medium" style={{ color: "#059669" }}>
                    Saldo actual: R$ {selectedPlayer.balance.toFixed(2)}
                  </div>
                </div>
                <CheckCircle2 style={{ width: 16, height: 16, color: "#10b981", strokeWidth: 2 }} />
                <button onClick={() => { setSelectedPlayer(null); setSearchQuery(""); }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                  <X style={{ width: 12, height: 12, color: "var(--gz-text-muted)" }} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
                  style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)" }}>
                  <Search style={{ width: 13, height: 13, color: "var(--gz-text-tertiary)" }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Procurar por nome ou ID..."
                    className="flex-1 bg-transparent outline-none text-[13.5px] font-medium"
                    style={{ color: "var(--gz-text-primary)" }}
                  />
                </div>
                {searchQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-2xl overflow-hidden"
                    style={{ background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)", border: "1px solid rgba(108,92,231,.08)" }}>
                    {searching ? (
                      <div className="px-4 py-3 text-[12.5px]" style={{ color: "var(--gz-text-muted)" }}>A procurar...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-[12.5px]" style={{ color: "var(--gz-text-muted)" }}>Nenhum jogador encontrado</div>
                    ) : (
                      searchResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPlayer(p); setSearchQuery(""); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                          <Avatar seed={p.username} size={30} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{p.username}</div>
                            <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>R$ {p.balance.toFixed(2)} · #{p.id}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Type + amount */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>
              Passo 2 — Tipo de Ajuste
            </label>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setAdjType("add")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-all"
                style={{
                  background: adjType === "add" ? "rgba(16,185,129,.08)" : "rgba(108,92,231,.05)",
                  border: `1.5px solid ${adjType === "add" ? "rgba(16,185,129,.3)" : "rgba(108,92,231,.12)"}`,
                  color: adjType === "add" ? "#059669" : "var(--gz-text-muted)",
                }}>
                <TrendingUp style={{ width: 14, height: 14 }} />
                Adicionar Crédito
              </button>
              <button onClick={() => setAdjType("subtract")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-all"
                style={{
                  background: adjType === "subtract" ? "rgba(239,68,68,.06)" : "rgba(108,92,231,.05)",
                  border: `1.5px solid ${adjType === "subtract" ? "rgba(239,68,68,.25)" : "rgba(108,92,231,.12)"}`,
                  color: adjType === "subtract" ? "#dc2626" : "var(--gz-text-muted)",
                }}>
                <TrendingDown style={{ width: 14, height: 14 }} />
                Debitar Saldo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>
                  Valor (R$)
                </label>
                <input value={formAmount} onChange={e => setFormAmount(e.target.value)}
                  placeholder="Ex: 50.00" type="number" step="0.01" min="0.01"
                  className="w-full px-3.5 py-2.5 rounded-2xl text-[13.5px] font-medium outline-none"
                  style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)", color: "var(--gz-text-primary)" }} />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Motivo</label>
                <select value={formReason} onChange={e => setFormReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-[13px] font-medium outline-none"
                  style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)", color: "var(--gz-text-primary)" }}>
                  {REASONS.map(r => <option key={r} value={r}>{REASON_LABELS[r] ?? r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Nota (opcional)</label>
            <textarea value={formNote} onChange={e => setFormNote(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-2xl text-[13.5px] font-medium outline-none resize-none"
              style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)", color: "var(--gz-text-primary)" }} />
          </div>

          {/* Preview */}
          {selectedPlayer && formAmount && parseFloat(formAmount) > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{
                background: adjType === "add" ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.06)",
                border: `1px solid ${adjType === "add" ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)"}`,
              }}>
              {adjType === "subtract"
                ? <AlertTriangle style={{ width: 13, height: 13, color: "#f59e0b", strokeWidth: 2 }} />
                : <CheckCircle2 style={{ width: 13, height: 13, color: "#10b981", strokeWidth: 2 }} />
              }
              <span className="text-[12px] font-medium" style={{ color: adjType === "add" ? "#059669" : "#dc2626" }}>
                {adjType === "add" ? "Adicionar" : "Debitar"} R$ {parseFloat(formAmount || "0").toFixed(2)} para{" "}
                <strong>{selectedPlayer.username}</strong>
                {" "}(saldo actual: R$ {selectedPlayer.balance.toFixed(2)})
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={resetForm}
              className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={createAdjustment.isPending || !selectedPlayer}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              style={{
                background: adjType === "add"
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : `linear-gradient(135deg, ${V1}, #4f46e5)`,
                boxShadow: "0 4px 14px rgba(108,92,231,.35)",
                opacity: (createAdjustment.isPending || !selectedPlayer) ? 0.6 : 1,
              }}>
              {adjType === "add" ? <Plus style={{ width: 13, height: 13 }} /> : <Minus style={{ width: 13, height: 13 }} />}
              {createAdjustment.isPending ? "A processar..." : adjType === "add" ? "Adicionar Crédito" : "Debitar Saldo"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <Wallet style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9 }} />
          <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
            {data?.total ?? 0} ajuste{(data?.total ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
            ))}
          </div>
        ) : adjustments.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet style={{ width: 32, height: 32, color: "var(--gz-text-tertiary)", strokeWidth: 1.3, margin: "0 auto 10px" }} />
            <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum ajuste encontrado</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.04)" }}>
            {adjustments.map(adj => {
              const isPositive = adj.amount >= 0;
              return (
                <div key={adj.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isPositive ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)" }}>
                    {isPositive
                      ? <TrendingUp style={{ width: 14, height: 14, color: "#10b981", strokeWidth: 1.9 }} />
                      : <TrendingDown style={{ width: 14, height: 14, color: "#ef4444", strokeWidth: 1.9 }} />}
                  </div>
                  <Avatar seed={adj.playerName} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{adj.playerName}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                      {REASON_LABELS[adj.reason] ?? adj.reason}
                      {adj.note && <span className="ml-1.5 italic">· {adj.note}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[14px] font-bold" style={{ color: isPositive ? "#10b981" : "#ef4444" }}>
                      {isPositive ? "+" : ""}R$ {adj.amount.toFixed(2)}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>
                      {adj.balanceBefore.toFixed(2)} → {adj.balanceAfter.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 text-[10.5px]" style={{ color: "var(--gz-text-tertiary)" }}>
                    <Clock style={{ width: 9, height: 9 }} />
                    {new Date(adj.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: page <= 1 ? "var(--gz-text-tertiary)" : V1 }}>
              Anterior
            </button>
            <span className="text-[12px] font-medium" style={{ color: "var(--gz-text-muted)" }}>
              Página {page} de {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: page >= totalPages ? "var(--gz-text-tertiary)" : V1 }}>
              Seguinte
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
