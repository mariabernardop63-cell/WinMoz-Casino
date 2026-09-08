import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ticket, Plus, Search, RefreshCw, Copy, Trash2, Ban, RotateCcw,
  CheckCircle2, XCircle, Users, Wallet, TrendingUp, ChevronDown, ChevronUp,
  AlertTriangle, ShieldCheck, Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const ACCENT = "#6C5CE7";

function fmtMZN(val: number) {
  return Number(val ?? 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCode(code: string) {
  return code.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── API helpers ─────────────────────────────────────────────────────────── */
async function getAdminToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function adminFetch<T>(action: string, init?: { method?: string; body?: unknown; query?: string }): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`/api/admin/${action}${init?.query ?? ""}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({})) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Erro na operação");
  return data;
}

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Redemption {
  userId: string;
  userName: string;
  amount: number;
  createdAt: string;
}

interface RechargeCode {
  id: string;
  code: string;
  amount: number;
  max_uses: number;
  used_count: number;
  status: string;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
  effectiveStatus: string;
  redemptions: Redemption[];
}

interface RechargeStats {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  totalValueActive: number;
  remainingUsesActive: number;
  redeemedTotal: number;
  redeemedCount: number;
}

interface ListResponse {
  items: RechargeCode[];
  total: number;
  page: number;
  limit: number;
  stats: RechargeStats;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: "Activa",           color: "#10b981", bg: "rgba(16,185,129,.12)" },
  expired: { label: "Expirada",         color: "#94a3b8", bg: "rgba(148,163,184,.14)" },
  revoked: { label: "Revogada",         color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all",     label: "Todas"     },
  { key: "active",  label: "Activas"   },
  { key: "expired", label: "Expiradas" },
  { key: "revoked", label: "Revogadas" },
];

export default function RechargeManagement() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createdCodes, setCreatedCodes] = useState<string[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RechargeCode | null>(null);

  // Form state
  const [fAmount, setFAmount] = useState("");
  const [fMaxUses, setFMaxUses] = useState("1");
  const [fQuantity, setFQuantity] = useState("1");
  const [fExpiry, setFExpiry] = useState("");
  const [fNote, setFNote] = useState("");

  const limit = 20;

  const { data, isLoading, refetch, isRefetching } = useQuery<ListResponse>({
    queryKey: ["recharge-codes", page, status, search],
    queryFn: () => adminFetch<ListResponse>("recharge/list", { query: `&page=${page}&limit=${limit}&status=${status}&search=${encodeURIComponent(search)}` }),
    staleTime: 5000,
  });

  const stats = data?.stats;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const createMutation = useMutation({
    mutationFn: (p: { amount: number; maxUses: number; quantity: number; expiresInDays: number | null; note: string | null }) =>
      adminFetch<{ ok: boolean; created: Array<{ id: string; code: string }> }>("recharge/create", { body: p }),
    onSuccess: (res) => {
      toast.success(`${res.created.length} recarga(s) criada(s) com sucesso`);
      setCreatedCodes(res.created.map((c) => c.code));
      setShowCreate(false);
      setFAmount(""); setFMaxUses("1"); setFQuantity("1"); setFExpiry(""); setFNote("");
      qc.invalidateQueries({ queryKey: ["recharge-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch<{ ok: boolean }>("recharge/delete", { body: { id } }),
    onSuccess: () => {
      toast.success("Recarga eliminada");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["recharge-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: { id: string; action: "disable" | "enable" }) => adminFetch<{ ok: boolean }>("recharge/toggle", { body: p }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "disable" ? "Recarga revogada — já não pode ser usada" : "Recarga reactivada");
      qc.invalidateQueries({ queryKey: ["recharge-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCreate() {
    const amount = parseFloat(fAmount);
    const maxUses = parseInt(fMaxUses, 10);
    const quantity = parseInt(fQuantity, 10);
    const expiresInDays = fExpiry ? parseInt(fExpiry, 10) : null;
    if (isNaN(amount) || amount <= 0) { toast.error("Introduz um valor válido"); return; }
    if (isNaN(maxUses) || maxUses < 1) { toast.error("Usos máximos deve ser pelo menos 1"); return; }
    if (isNaN(quantity) || quantity < 1 || quantity > 200) { toast.error("Quantidade deve estar entre 1 e 200"); return; }
    if (fExpiry && (isNaN(expiresInDays as number) || (expiresInDays as number) < 1)) { toast.error("Validade inválida"); return; }
    createMutation.mutate({ amount, maxUses, quantity, expiresInDays, note: fNote || null });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function downloadCodes(codes: string[]) {
    const text = codes.map((c) => formatCode(c)).join("\n");
    const blob = new Blob([`Códigos de Recarga MozBet\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codigos-recarga-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = useMemo(() => [
    { icon: Ticket,      label: "Total de Códigos",     value: String(stats?.total ?? 0),                      color: ACCENT },
    { icon: CheckCircle2,label: "Activas",              value: String(stats?.active ?? 0),                     color: "#10b981" },
    { icon: XCircle,     label: "Expiradas",            value: String(stats?.expired ?? 0),                    color: "#94a3b8" },
    { icon: Ban,         label: "Revogadas",            value: String(stats?.revoked ?? 0),                    color: "#ef4444" },
    { icon: Wallet,      label: "Valor Disponível",     value: `${fmtMZN(stats?.totalValueActive ?? 0)} MZN`,  color: "#00D4B4" },
    { icon: TrendingUp,  label: "Total Recarregado",    value: `${fmtMZN(stats?.redeemedTotal ?? 0)} MZN`,     color: "#f59e0b" },
  ], [stats]);

  return (
    <div className="px-5 pb-10 pt-4 space-y-5">

      {/* ── Header ── */}
      <div className="gz-card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-black tracking-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(108,92,231,.14)" }}>
                <Ticket style={{ width: 18, height: 18, color: ACCENT }} />
              </span>
              Gestão de Recargas
            </h1>
            <p className="text-[12.5px] font-medium mt-1 flex items-center gap-1.5" style={{ color: "var(--gz-text-accent)" }}>
              <ShieldCheck style={{ width: 13, height: 13 }} />
              Códigos de 12 dígitos · uso seguro e atómico · só tu geras recargas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="h-10 px-4 rounded-xl text-[12.5px] font-bold flex items-center gap-2 transition-all hover:opacity-80"
              style={{ background: "rgba(108,92,231,.1)", color: ACCENT }}>
              <RefreshCw style={{ width: 14, height: 14 }} className={isRefetching ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-10 px-5 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: ACCENT, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
              <Plus style={{ width: 15, height: 15 }} />
              Nova Recarga
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="gz-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--gz-text-accent)" }}>{s.label}</span>
              <s.icon style={{ width: 15, height: 15, color: s.color }} />
            </div>
            <span className="text-[19px] font-black leading-none" style={{ color: "var(--gz-text-primary)" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Create form ── */}
      {showCreate && (
        <div className="gz-card p-5" style={{ border: `1px solid rgba(108,92,231,.3)` }}>
          <div className="flex items-center gap-2 mb-4">
            <Plus style={{ width: 16, height: 16, color: ACCENT }} />
            <h2 className="text-[15px] font-black" style={{ color: "var(--gz-text-primary)" }}>Criar Novas Recargas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-accent)" }}>Valor (MZN) *</label>
              <input
                type="number" min="1" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                placeholder="ex: 20"
                className="gz-input w-full h-11 px-3.5 rounded-xl text-[13px] font-bold"
                style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-accent)" }}>Usos máximos</label>
              <input
                type="number" min="1" max="1000" value={fMaxUses} onChange={(e) => setFMaxUses(e.target.value)}
                placeholder="1"
                className="gz-input w-full h-11 px-3.5 rounded-xl text-[13px] font-bold"
                style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
              />
              <p className="text-[10.5px] mt-1 font-medium" style={{ color: "var(--gz-text-accent)" }}>
                1 = uso único · 5 = até 5 utilizadores diferentes
              </p>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-accent)" }}>Quantidade de códigos</label>
              <input
                type="number" min="1" max="200" value={fQuantity} onChange={(e) => setFQuantity(e.target.value)}
                placeholder="1"
                className="gz-input w-full h-11 px-3.5 rounded-xl text-[13px] font-bold"
                style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
              />
              <p className="text-[10.5px] mt-1 font-medium" style={{ color: "var(--gz-text-accent)" }}>Máximo 200 por lote</p>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-accent)" }}>Validade (dias, opcional)</label>
              <input
                type="number" min="1" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)}
                placeholder="sem prazo"
                className="gz-input w-full h-11 px-3.5 rounded-xl text-[13px] font-bold"
                style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: "var(--gz-text-accent)" }}>Nota interna (opcional)</label>
              <input
                type="text" value={fNote} onChange={(e) => setFNote(e.target.value)}
                placeholder="ex: campanha Setembro"
                className="gz-input w-full h-11 px-3.5 rounded-xl text-[13px] font-bold"
                style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--gz-text-accent)" }}>
              <ShieldCheck style={{ width: 12, height: 12, color: "#10b981" }} />
              Códigos gerados com aleatoriedade criptográfica — únicos, 12 dígitos, só números
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCreate(false)} className="h-10 px-4 rounded-xl text-[12.5px] font-bold" style={{ background: "rgba(255,255,255,.06)", color: "var(--gz-text-primary)" }}>
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="h-10 px-5 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: ACCENT, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
                {createMutation.isPending ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Plus style={{ width: 14, height: 14 }} />}
                Gerar Recargas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generated codes modal ── */}
      {createdCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}>
          <div className="gz-card p-6 w-full max-w-lg max-h-[80vh] overflow-auto" style={{ border: `1.5px solid rgba(16,185,129,.4)` }}>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,.14)" }}>
                <CheckCircle2 style={{ width: 18, height: 18, color: "#10b981" }} />
              </span>
              <h2 className="text-[16px] font-black" style={{ color: "var(--gz-text-primary)" }}>
                {createdCodes.length} recarga(s) criada(s)
              </h2>
            </div>
            <p className="text-[12px] font-medium mb-4" style={{ color: "var(--gz-text-accent)" }}>
              Guarda estes códigos num local seguro. Partilha-os apenas com os utilizadores.
            </p>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,.1)" }}>
              {createdCodes.map((c, i) => (
                <div key={c} className="flex items-center justify-between px-4 py-2.5" style={{ background: i % 2 === 0 ? "rgba(255,255,255,.03)" : "transparent", borderBottom: i < createdCodes.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                  <span className="font-mono text-[14px] font-bold tracking-wider" style={{ color: "var(--gz-text-primary)" }}>{formatCode(c)}</span>
                  <button onClick={() => copyCode(c)} className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ background: "rgba(108,92,231,.12)" }} title="Copiar código">
                    <Copy style={{ width: 13, height: 13, color: ACCENT }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(createdCodes.map(formatCode).join("\n")).then(() => toast.success("Todos os códigos copiados")); }}
                className="flex-1 h-11 rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "rgba(108,92,231,.12)", color: ACCENT }}>
                <Copy style={{ width: 14, height: 14 }} /> Copiar Todos
              </button>
              <button
                onClick={() => downloadCodes(createdCodes)}
                className="flex-1 h-11 rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "rgba(108,92,231,.12)", color: ACCENT }}>
                <Download style={{ width: 14, height: 14 }} /> Descarregar .txt
              </button>
              <button
                onClick={() => setCreatedCodes(null)}
                className="flex-1 h-11 rounded-xl text-[12.5px] font-bold text-white transition-all hover:opacity-90"
                style={{ background: ACCENT }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}>
          <div className="gz-card p-6 w-full max-w-md" style={{ border: "1.5px solid rgba(239,68,68,.4)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.12)" }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#ef4444" }} />
              </span>
              <h2 className="text-[16px] font-black" style={{ color: "var(--gz-text-primary)" }}>Eliminar recarga?</h2>
            </div>
            <p className="text-[12.5px] font-medium mb-1.5" style={{ color: "var(--gz-text-accent)" }}>
              Código <span className="font-mono font-bold" style={{ color: "var(--gz-text-primary)" }}>{formatCode(confirmDelete.code)}</span> — {fmtMZN(confirmDelete.amount)} MZN
            </p>
            <p className="text-[12px] font-medium mb-5" style={{ color: "#ef4444" }}>
              {confirmDelete.used_count > 0
                ? `Esta recarga já foi usada ${confirmDelete.used_count}x. O histórico de usos será removido; as transacções financeiras mantêm-se.`
                : "Esta acção é permanente e não pode ser revertida."}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 h-11 rounded-xl text-[12.5px] font-bold" style={{ background: "rgba(255,255,255,.06)", color: "var(--gz-text-primary)" }}>
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 h-11 rounded-xl text-[12.5px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#ef4444" }}>
                {deleteMutation.isPending ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="gz-card p-4 flex items-center gap-3 flex-wrap">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.replace(/\D/g, "").slice(0, 12)); }}
          className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search style={{ width: 14, height: 14, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gz-text-accent)" }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.replace(/[^\d ]/g, "").slice(0, 14))}
              placeholder="Procurar código (12 dígitos)…"
              className="gz-input w-full h-10 pl-9 pr-3 rounded-xl text-[12.5px] font-semibold"
              style={{ color: "var(--gz-text-primary)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
            />
          </div>
        </form>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatus(f.key); setPage(1); }}
              className="h-10 px-4 rounded-xl text-[12px] font-bold transition-all"
              style={status === f.key
                ? { background: ACCENT, color: "#fff", boxShadow: "0 3px 10px rgba(108,92,231,.3)" }
                : { background: "rgba(255,255,255,.05)", color: "var(--gz-text-accent)" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="gz-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                {["Código", "Valor", "Usos", "Estado", "Criada em", "Validade", "Acções"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--gz-text-accent)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] font-semibold" style={{ color: "var(--gz-text-accent)" }}>A carregar recargas…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] font-semibold" style={{ color: "var(--gz-text-accent)" }}>Nenhuma recarga encontrada</td></tr>
              ) : items.map((c) => {
                const meta = STATUS_META[c.effectiveStatus] ?? STATUS_META.expired;
                const pct = c.max_uses > 0 ? Math.min(100, (c.used_count / c.max_uses) * 100) : 0;
                const isExpanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }} className="transition-colors hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <button onClick={() => copyCode(c.code)} className="font-mono text-[13.5px] font-bold tracking-wider hover:opacity-75 flex items-center gap-2" style={{ color: "var(--gz-text-primary)" }} title="Copiar">
                          {formatCode(c.code)}
                          <Copy style={{ width: 11, height: 11, color: "var(--gz-text-accent)" }} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-black whitespace-nowrap" style={{ color: "#00D4B4" }}>{fmtMZN(c.amount)} MZN</td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: "var(--gz-text-primary)" }}>{c.used_count}/{c.max_uses}</span>
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#94a3b8" : ACCENT }} />
                          </div>
                        </div>
                        {c.redemptions.length > 0 && (
                          <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="text-[10.5px] font-bold mt-1 flex items-center gap-1" style={{ color: ACCENT }}>
                            {isExpanded ? <ChevronUp style={{ width: 10, height: 10 }} /> : <ChevronDown style={{ width: 10, height: 10 }} />}
                            ver usos
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wide whitespace-nowrap" style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-semibold whitespace-nowrap" style={{ color: "var(--gz-text-accent)" }}>{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-[12px] font-semibold whitespace-nowrap" style={{ color: c.expires_at && new Date(c.expires_at) < new Date() ? "#ef4444" : "var(--gz-text-accent)" }}>
                        {c.expires_at ? fmtDate(c.expires_at) : "sem prazo"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.effectiveStatus === "active" ? (
                            <button
                              onClick={() => toggleMutation.mutate({ id: c.id, action: "disable" })}
                              disabled={toggleMutation.isPending}
                              className="p-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-40" title="Revogar (impede uso)"
                              style={{ background: "rgba(239,68,68,.1)" }}>
                              <Ban style={{ width: 13, height: 13, color: "#ef4444" }} />
                            </button>
                          ) : c.effectiveStatus === "revoked" ? (
                            <button
                              onClick={() => toggleMutation.mutate({ id: c.id, action: "enable" })}
                              disabled={toggleMutation.isPending}
                              className="p-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-40" title="Reactivar"
                              style={{ background: "rgba(16,185,129,.1)" }}>
                              <RotateCcw style={{ width: 13, height: 13, color: "#10b981" }} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => setConfirmDelete(c)}
                            className="p-2 rounded-lg transition-all hover:opacity-80" title="Eliminar"
                            style={{ background: "rgba(148,163,184,.1)" }}>
                            <Trash2 style={{ width: 13, height: 13, color: "#94a3b8" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "rgba(108,92,231,.04)" }}>
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--gz-text-accent)" }}>
                            <Users style={{ width: 12, height: 12 }} /> Utilizadores que usaram ({c.redemptions.length})
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {c.redemptions.map((r) => (
                              <div key={r.userId} className="flex items-center justify-between text-[12px] font-semibold px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.03)" }}>
                                <span className="flex items-center gap-2" style={{ color: "var(--gz-text-primary)" }}>
                                  <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />
                                  {r.userName}
                                </span>
                                <span style={{ color: "var(--gz-text-accent)" }}>
                                  +{fmtMZN(r.amount)} MZN · {fmtDate(r.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="h-9 px-4 rounded-xl text-[12px] font-bold disabled:opacity-30 transition-all"
              style={{ background: "rgba(255,255,255,.05)", color: "var(--gz-text-primary)" }}>
              Anterior
            </button>
            <span className="text-[12px] font-bold" style={{ color: "var(--gz-text-accent)" }}>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="h-9 px-4 rounded-xl text-[12px] font-bold disabled:opacity-30 transition-all"
              style={{ background: "rgba(255,255,255,.05)", color: "var(--gz-text-primary)" }}>
              Seguinte
            </button>
          </div>
        )}
      </div>

      {/* ── Security note ── */}
      <div className="gz-card p-4 flex items-start gap-3" style={{ background: "rgba(16,185,129,.04)", border: "1px solid rgba(16,185,129,.15)" }}>
        <ShieldCheck style={{ width: 16, height: 16, color: "#10b981", flexShrink: 0, marginTop: 1 }} />
        <div className="text-[11.5px] font-medium leading-relaxed" style={{ color: "var(--gz-text-accent)" }}>
          <strong style={{ color: "#10b981" }}>Segurança:</strong> os códigos vivem numa tabela bloqueada por RLS — nenhum utilizador consegue ler, criar ou manipular recargas pelo browser.
          Cada uso é processado de forma atómica no servidor (impossível usar a mesma recarga duas vezes, mesmo em simultâneo), um utilizador nunca usa a mesma recarga duas vezes,
          tentativas falhadas são limitadas (anti brute-force) e cada uso fica registado no histórico acima e no extrato do utilizador.
        </div>
      </div>
    </div>
  );
}
