import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Minus, Search, TrendingUp, TrendingDown, User, CheckCircle2, X } from "lucide-react";
import { searchPlayersForBalance, adjustPlayerBalance, listTransactions, type AdminTransaction } from "@/lib/supabase-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const V1 = "#6C5CE7";

const REASONS = ["bonus_win", "bonus_signup", "correction", "referral", "promotion", "fee_refund", "penalty", "manual_adjustment"];
const REASON_LABELS: Record<string, string> = {
  bonus_win: "Bónus de vitória", bonus_signup: "Bónus de registo", correction: "Correcção",
  referral: "Referência", promotion: "Promoção", fee_refund: "Reembolso de taxa",
  penalty: "Penalização", manual_adjustment: "Ajuste manual",
};

function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(seed?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`} alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.12)" }} />
  );
}

interface PlayerResult { id: string; full_name: string | null; email: string | null; balance: number; avatar_url: string | null; is_blocked: boolean }

export default function BalancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [adjType, setAdjType] = useState<"add" | "subtract">("add");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("manual_adjustment");
  const [formNote, setFormNote] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["balance-search", debouncedQuery],
    queryFn: () => debouncedQuery.length >= 2 ? searchPlayersForBalance(debouncedQuery) : Promise.resolve([]),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: recentTx = [], isLoading: txLoading } = useQuery({
    queryKey: ["admin-balance-tx"],
    queryFn: () => listTransactions({ limit: 50 }),
    refetchInterval: 30000,
  });

  async function handleAdjust() {
    if (!selectedPlayer || !formAmount || !user) return;
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Valor inválido" }); return; }
    const delta = adjType === "add" ? amount : -amount;
    setProcessing(true);
    try {
      const newBalance = await adjustPlayerBalance(selectedPlayer.id, delta, REASON_LABELS[formReason], formNote.trim() || undefined);
      toast({ title: "Saldo ajustado", description: `${selectedPlayer.full_name ?? selectedPlayer.email} → MT ${newBalance.toFixed(2)}` });
      qc.invalidateQueries({ queryKey: ["admin-balance-tx"] });
      setShowForm(false);
      setSelectedPlayer(null);
      setSearchQuery(""); setFormAmount(""); setFormNote("");
    } catch {
      toast({ title: "Erro", description: "Falha ao ajustar saldo", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  const creditTx = recentTx.filter(t => ["credit", "deposit", "win", "refund"].includes(t.type));
  const debitTx  = recentTx.filter(t => ["debit", "withdrawal", "penalty"].includes(t.type));
  const totalCredit = creditTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDebit  = debitTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Saldos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajustar saldo de jogadores manualmente</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setSelectedPlayer(null); setSearchQuery(""); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.3)" }}>
          <Plus style={{ width: 16, height: 16 }} />
          Novo Ajuste
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total Créditos",    value: `MT ${totalCredit.toFixed(2)}`, color: "text-green-600", icon: TrendingUp },
          { label: "Total Débitos",     value: `MT ${totalDebit.toFixed(2)}`,  color: "text-red-500",   icon: TrendingDown },
        ].map(s => (
          <div key={s.label} className="gz-card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${s.color === "text-green-600" ? "bg-green-50" : "bg-red-50"}`}>
              <s.icon style={{ width: 18, height: 18, color: s.color === "text-green-600" ? "#10b981" : "#ef4444" }} />
            </div>
            <div>
              <div className="text-xs uppercase font-medium tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{s.label}</div>
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Adjustment form */}
      {showForm && (
        <div className="gz-card p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-black" style={{ color: "var(--gz-text-primary)" }}>Ajustar Saldo</h2>
            <button onClick={() => { setShowForm(false); setSelectedPlayer(null); setSearchQuery(""); }}>
              <X style={{ width: 18, height: 18, color: "var(--gz-text-muted)" }} />
            </button>
          </div>

          {/* Search */}
          {!selectedPlayer ? (
            <div className="mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: "var(--gz-text-muted)" }}>Pesquisar Jogador</label>
              <div className="relative">
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gz-text-muted)" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Nome ou email…"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>
              {debouncedQuery.length >= 2 && (
                <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: "rgba(108,92,231,.1)" }}>
                  {searching ? (
                    <div className="px-4 py-3 text-sm text-center" style={{ color: "var(--gz-text-muted)" }}>A pesquisar…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-center" style={{ color: "var(--gz-text-muted)" }}>Nenhum jogador encontrado</div>
                  ) : (searchResults as PlayerResult[]).map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors">
                      <Avatar seed={p.full_name ?? p.email ?? p.id} size={32} />
                      <div className="text-left">
                        <div className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{p.full_name ?? "—"}</div>
                        <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>{p.email} · MT {Number(p.balance).toFixed(2)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-5">
              <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "rgba(108,92,231,.06)", border: "1px solid rgba(108,92,231,.12)" }}>
                <div className="flex items-center gap-3">
                  <Avatar seed={selectedPlayer.full_name ?? selectedPlayer.email ?? selectedPlayer.id} />
                  <div>
                    <div className="font-semibold text-[13px]" style={{ color: "var(--gz-text-primary)" }}>{selectedPlayer.full_name ?? "—"}</div>
                    <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>Saldo actual: <strong>MT {Number(selectedPlayer.balance).toFixed(2)}</strong></div>
                  </div>
                </div>
                <button onClick={() => { setSelectedPlayer(null); setSearchQuery(""); }} className="p-1.5 rounded-lg hover:bg-gray-200">
                  <X style={{ width: 14, height: 14, color: "var(--gz-text-muted)" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {([["add", "Adicionar", Plus, "rgba(16,185,129,.1)", "#10b981"], ["subtract", "Subtrair", Minus, "rgba(239,68,68,.08)", "#ef4444"]] as const).map(([val, label, IconComp, bg, color]) => {
                  const I = IconComp as React.ElementType;
                  return (
                    <button key={val} onClick={() => setAdjType(val as "add" | "subtract")}
                      className="p-3 rounded-xl border flex items-center gap-2 transition-all"
                      style={{ border: adjType === val ? `2px solid ${color}` : "1px solid #e5e7eb", background: adjType === val ? bg : "#fff" }}>
                      <I style={{ width: 16, height: 16, color }} />
                      <span className="text-[13px] font-semibold" style={{ color: adjType === val ? color : "#6b7280" }}>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Valor (MT)</label>
                  <input type="number" min={0} step={0.01} value={formAmount} onChange={e => setFormAmount(e.target.value)}
                    placeholder="0.00" className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                    style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Razão</label>
                  <select value={formReason} onChange={e => setFormReason(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                    style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)", background: "white" }}>
                    {REASONS.map(r => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-muted)" }}>Nota (opcional)</label>
                <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Explicação adicional…"
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-indigo-400"
                  style={{ borderColor: "rgba(108,92,231,.2)", color: "var(--gz-text-primary)" }} />
              </div>

              <button onClick={handleAdjust} disabled={!formAmount || processing}
                className="w-full mt-4 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: !formAmount ? "#e5e7eb" : `linear-gradient(135deg, ${V1}, #4f46e5)`, color: !formAmount ? "#9ca3af" : "#fff" }}>
                {processing ? "A processar…" : <><CheckCircle2 style={{ width: 16, height: 16 }} /> Confirmar Ajuste</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent transactions */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <span className="text-[14px] font-black" style={{ color: "var(--gz-text-primary)" }}>Transacções Recentes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(108,92,231,.06)" }}>
                {["Utilizador", "Tipo", "Valor (MT)", "Descrição", "Data"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-5 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} /></td></tr>
                ))
              ) : recentTx.map((t: AdminTransaction) => {
                const amount = Number(t.amount);
                const isIncoming = ["deposit", "win", "credit", "refund"].includes(t.type);
                const userProfile = (t as any).profiles;
                return (
                  <tr key={t.id} className="hover:bg-indigo-50/10 transition-colors" style={{ borderBottom: "1px solid rgba(108,92,231,.04)" }}>
                    <td className="px-5 py-3.5 text-[13px] font-medium" style={{ color: "var(--gz-text-primary)" }}>
                      {userProfile?.full_name ?? userProfile?.email ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{t.type}</span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[13px]" style={{ color: isIncoming ? "#10b981" : "#ef4444" }}>
                      {isIncoming ? "+" : "−"}MT {Math.abs(amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--gz-text-secondary)" }}>
                      <span className="line-clamp-1">{t.description ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                      {new Date(t.created_at).toLocaleDateString("pt-PT")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
