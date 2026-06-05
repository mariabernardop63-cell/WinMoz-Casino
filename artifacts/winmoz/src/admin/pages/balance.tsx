import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, Plus, Minus, Search, TrendingUp, TrendingDown,
  AlertTriangle, Clock, CheckCircle2, X, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const V1 = "#6C5CE7";

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

interface PlayerResult {
  id: string;
  username: string;
  full_name: string | null;
  balance: number;
  avatar_url: string | null;
}

interface Adjustment {
  id: string;
  user_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string;
  note: string | null;
  created_at: string;
  player_name: string;
  avatar_url: string | null;
}

function PlayerAvatar({ username, avatarUrl, size = 36 }: { username: string; avatarUrl?: string | null; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(username || "?").charCodeAt(0) % palette.length];
  const initial = ((username || "?")[0] ?? "?").toUpperCase();
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={username}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(108,92,231,.12)" }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `#${color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38, border: "1.5px solid rgba(108,92,231,.12)" }}>
      {initial}
    </div>
  );
}

async function searchPlayers(q: string): Promise<PlayerResult[]> {
  if (q.length < 2) return [];
  const base = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/+$/, "");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const res = await fetch(`${base}/api/admin/players/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as Record<string, unknown>[];
  return data.map(p => ({
    id: p.id as string,
    username: ((p.username || p.full_name || "utilizador") as string),
    full_name: p.full_name as string | null,
    balance: Number(p.balance ?? 0),
    avatar_url: p.avatar_url as string | null,
  }));
}

async function fetchAdjustments(): Promise<Adjustment[]> {
  const base = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/+$/, "");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const res = await fetch(`${base}/api/admin/balance-adjustments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json() as Promise<Adjustment[]>;
}

async function applyAdjustment(params: {
  userId: string;
  amount: number;
  type: "add" | "subtract";
  reason: string;
  note: string;
}): Promise<void> {
  const base = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/+$/, "");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const res = await fetch(`${base}/api/admin/balance-adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      userId: params.userId, amount: params.amount,
      type: params.type, reason: params.reason, note: params.note,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? "Erro ao ajustar saldo");
  }
}

export default function BalancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [adjType, setAdjType] = useState<"add" | "subtract">("add");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("manual_adjustment");
  const [formNote, setFormNote] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: searchResults = [], isFetching: searching } = useQuery<PlayerResult[]>({
    queryKey: ["player-search", searchQuery],
    queryFn: () => searchPlayers(searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 5000,
  });

  const { data: adjustments = [], isLoading, refetch } = useQuery<Adjustment[]>({
    queryKey: ["balance-adjustments"],
    queryFn: fetchAdjustments,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-balance-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "balance_adjustments" }, () => {
        qc.invalidateQueries({ queryKey: ["balance-adjustments"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        if (selectedPlayer) {
          supabase.from("profiles").select("balance").eq("id", selectedPlayer.id).single().then(({ data }) => {
            if (data) setSelectedPlayer(prev => prev ? { ...prev, balance: Number(data.balance) } : prev);
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, selectedPlayer]);

  const doAdjust = useMutation({
    mutationFn: (p: { userId: string; amount: number; type: "add" | "subtract"; reason: string; note: string }) =>
      applyAdjustment(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-adjustments"] });
      showToast("Saldo ajustado com sucesso!", true);
      resetForm();
    },
    onError: (err: Error) => showToast(err.message, false),
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
    if (!selectedPlayer) { showToast("Selecciona um jogador primeiro.", false); return; }
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) { showToast("Introduz um valor positivo válido.", false); return; }
    doAdjust.mutate({ userId: selectedPlayer.id, amount: amt, type: adjType, reason: formReason, note: formNote });
  }

  const totalCredits  = adjustments.filter(a => a.amount > 0).reduce((s, a) => s + a.amount, 0);
  const totalDebits   = adjustments.filter(a => a.amount < 0).reduce((s, a) => s + Math.abs(a.amount), 0);

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-[13px] font-bold text-white animate-float-up"
          style={{ background: toast.ok ? "#10b981" : "#ef4444", maxWidth: 320 }}>
          {toast.ok ? <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0 }} /> : <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="gz-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: "var(--gz-text-primary)" }}>Gestão de Saldos</h1>
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: "var(--gz-text-accent)" }}>
              Crédito e débito manual · Realtime
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()}
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:bg-indigo-50"
              style={{ border: "1.5px solid rgba(108,92,231,.15)" }}>
              <RefreshCw style={{ width: 13, height: 13, color: V1 }} />
            </button>
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.3)" }}>
              <Plus style={{ width: 13, height: 13 }} />
              Novo Ajuste
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="gz-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,.08)" }}>
              <TrendingUp style={{ width: 14, height: 14, color: "#10b981", strokeWidth: 1.8 }} />
            </div>
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Total Creditado</span>
          </div>
          <div className="text-[22px] font-black" style={{ color: "#10b981" }}>MT {totalCredits.toFixed(2)}</div>
        </div>
        <div className="gz-card p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.06)" }}>
              <TrendingDown style={{ width: 14, height: 14, color: "#ef4444", strokeWidth: 1.8 }} />
            </div>
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--gz-text-muted)" }}>Total Debitado</span>
          </div>
          <div className="text-[22px] font-black" style={{ color: "#ef4444" }}>MT {totalDebits.toFixed(2)}</div>
        </div>
      </div>

      {/* Adjustment form */}
      {showForm && (
        <div className="gz-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Novo Ajuste de Saldo</div>
            <button onClick={resetForm} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <X style={{ width: 13, height: 13, color: "var(--gz-text-muted)" }} />
            </button>
          </div>

          {/* Step 1 – Player search */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>
              Passo 1 — Procurar Jogador
            </label>
            {selectedPlayer ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(16,185,129,.06)", border: "1.5px solid rgba(16,185,129,.2)" }}>
                <PlayerAvatar username={selectedPlayer.username} avatarUrl={selectedPlayer.avatar_url} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{selectedPlayer.username}</div>
                  <div className="text-[11.5px] mt-0.5 font-medium" style={{ color: "#059669" }}>
                    Saldo actual: MT {selectedPlayer.balance.toFixed(2)}
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
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Procurar por nome ou telefone..."
                    className="flex-1 bg-transparent outline-none text-[13.5px] font-medium"
                    style={{ color: "var(--gz-text-primary)" }} />
                  {searching && <RefreshCw style={{ width: 11, height: 11, color: "var(--gz-text-muted)", animation: "spin 1s linear infinite" }} />}
                </div>
                {searchQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-2xl overflow-hidden"
                    style={{ background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,.1)", border: "1px solid rgba(108,92,231,.08)" }}>
                    {searching ? (
                      <div className="px-4 py-3 text-[12.5px]" style={{ color: "var(--gz-text-muted)" }}>A procurar...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-[12.5px]" style={{ color: "var(--gz-text-muted)" }}>Nenhum jogador encontrado</div>
                    ) : (
                      searchResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPlayer(p); setSearchQuery(""); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                          <PlayerAvatar username={p.username} avatarUrl={p.avatar_url} size={30} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{p.username}</div>
                            <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>MT {p.balance.toFixed(2)}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 – Type + amount */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-2 block" style={{ color: "var(--gz-text-tertiary)" }}>
              Passo 2 — Tipo de Ajuste
            </label>
            <div className="flex gap-3 mb-4">
              {(["add", "subtract"] as const).map(t => (
                <button key={t} onClick={() => setAdjType(t)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-all"
                  style={{
                    background: adjType === t ? (t === "add" ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.06)") : "rgba(108,92,231,.05)",
                    border: `1.5px solid ${adjType === t ? (t === "add" ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.25)") : "rgba(108,92,231,.12)"}`,
                    color: adjType === t ? (t === "add" ? "#059669" : "#dc2626") : "var(--gz-text-muted)",
                  }}>
                  {t === "add" ? <TrendingUp style={{ width: 14, height: 14 }} /> : <TrendingDown style={{ width: 14, height: 14 }} />}
                  {t === "add" ? "Adicionar Crédito" : "Debitar Saldo"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Valor (MT)</label>
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

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.08em] mb-1.5 block" style={{ color: "var(--gz-text-tertiary)" }}>Nota (opcional)</label>
            <textarea value={formNote} onChange={e => setFormNote(e.target.value)}
              placeholder="Observações adicionais..." rows={2}
              className="w-full px-3.5 py-2.5 rounded-2xl text-[13.5px] font-medium outline-none resize-none"
              style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.12)", color: "var(--gz-text-primary)" }} />
          </div>

          {selectedPlayer && parseFloat(formAmount) > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{
                background: adjType === "add" ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.06)",
                border: `1px solid ${adjType === "add" ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)"}`,
              }}>
              {adjType === "subtract"
                ? <AlertTriangle style={{ width: 13, height: 13, color: "#f59e0b" }} />
                : <CheckCircle2 style={{ width: 13, height: 13, color: "#10b981" }} />}
              <span className="text-[12px] font-medium" style={{ color: adjType === "add" ? "#059669" : "#dc2626" }}>
                {adjType === "add" ? "Adicionar" : "Debitar"} MT {parseFloat(formAmount || "0").toFixed(2)} de{" "}
                <strong>{selectedPlayer.username}</strong>
                {adjType === "subtract" && selectedPlayer.balance < parseFloat(formAmount || "0") && (
                  <span className="text-amber-600"> · saldo insuficiente, ficará em MT 0.00</span>
                )}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={resetForm}
              className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all"
              style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
              Cancelar
            </button>
            <button onClick={handleSubmit}
              disabled={doAdjust.isPending || !selectedPlayer}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              style={{
                background: adjType === "add" ? "linear-gradient(135deg,#10b981,#059669)" : `linear-gradient(135deg,${V1},#4f46e5)`,
                opacity: (doAdjust.isPending || !selectedPlayer) ? 0.6 : 1,
              }}>
              {adjType === "add" ? <Plus style={{ width: 13, height: 13 }} /> : <Minus style={{ width: 13, height: 13 }} />}
              {doAdjust.isPending ? "A processar..." : adjType === "add" ? "Adicionar Crédito" : "Debitar Saldo"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="gz-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex items-center gap-2">
            <Wallet style={{ width: 14, height: 14, color: V1, strokeWidth: 1.9 }} />
            <span className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>
              {adjustments.length} ajuste{adjustments.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--gz-text-muted)" }}>Actualiza automaticamente</span>
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
            <div className="text-[13px] font-medium" style={{ color: "var(--gz-text-accent)" }}>Nenhum ajuste ainda</div>
            <div className="text-[11.5px] mt-1" style={{ color: "var(--gz-text-muted)" }}>Os ajustes que fizeres aparecerão aqui em tempo real</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(108,92,231,.04)" }}>
            {adjustments.map(adj => {
              const isPos = adj.amount > 0;
              return (
                <div key={adj.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isPos ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)" }}>
                    {isPos
                      ? <TrendingUp style={{ width: 14, height: 14, color: "#10b981", strokeWidth: 1.9 }} />
                      : <TrendingDown style={{ width: 14, height: 14, color: "#ef4444", strokeWidth: 1.9 }} />}
                  </div>
                  <PlayerAvatar username={adj.player_name} avatarUrl={adj.avatar_url} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{adj.player_name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--gz-text-muted)" }}>
                      {REASON_LABELS[adj.reason] ?? adj.reason}
                      {adj.note && <span className="ml-1.5 italic">· {adj.note}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[14px] font-bold" style={{ color: isPos ? "#10b981" : "#ef4444" }}>
                      {isPos ? "+" : ""}MT {Math.abs(adj.amount).toFixed(2)}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: "var(--gz-text-tertiary)" }}>
                      {adj.balance_before.toFixed(2)} → {adj.balance_after.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 text-[10.5px]" style={{ color: "var(--gz-text-tertiary)" }}>
                    <Clock style={{ width: 9, height: 9 }} />
                    {new Date(adj.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
