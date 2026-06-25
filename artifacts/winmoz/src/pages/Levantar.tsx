import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, Clock,
  CheckCircle2, XCircle, AlertTriangle, Smartphone, Pencil, Info, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/apiBase";

const CYAN = "#00D4B4";
const METHOD_NAME = "M-Pesa";

function fmtMZN(val: number) {
  const str = val.toFixed(2);
  const [int, dec] = str.split(".");
  return `${Number(int).toLocaleString("pt-PT")},${dec}`;
}

type Screen = "amount" | "confirm" | "pending" | "approved" | "rejected";

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SwipeToConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef}
      className="relative overflow-hidden flex items-center"
      style={{ height: 64, background: "#f8fafc", border: "1px solid #e5e7eb", margin: "0 0" }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p style={{ color: "#9ca3af", fontSize: 13, fontWeight: 500, letterSpacing: "0.3px" }} className="select-none">
          Deslizar para confirmar
        </p>
        <span className="absolute right-5 select-none" style={{ color: "#d1d5db", fontWeight: 700 }}>»</span>
      </div>
      <motion.div
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x, marginLeft: 6, width: 52, height: 52, background: "#0a0a0a", borderRadius: 0 }}
        onDragEnd={(_, info) => {
          const cw = containerRef.current?.offsetWidth ?? 340;
          if (info.offset.x > cw * 0.65) { if (!disabled) onConfirm(); }
          else { x.set(0); }
        }}
        onClick={() => !disabled && onConfirm()}
        className="flex items-center justify-center cursor-grab active:cursor-grabbing z-10 flex-shrink-0"
        whileTap={{ scale: 0.92 }}>
        <ChevronRightIcon className="w-6 h-6 text-white" />
      </motion.div>
    </div>
  );
}

export default function Levantar() {
  const [, setLocation] = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  const [freshBalance, setFreshBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const balance = (freshBalance ?? parseFloat(String(profile?.balance ?? "0"))) || 0;
  const userPhone = profile?.phone ? `+258 ${profile.phone.slice(0, 3)} ${profile.phone.slice(3, 6)} ${profile.phone.slice(6)}` : "";

  const [screen, setScreen] = useState<Screen>("amount");
  const [amountStr, setAmountStr] = useState("");
  const [processingConfirm, setProcessingConfirm] = useState(false);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [txId] = useState(() => "TX" + Date.now().toString(36).toUpperCase());
  const [txDate] = useState(() => new Date().toLocaleString("pt-PT"));
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhoneVal, setEditPhoneVal] = useState(profile?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);

  const amountVal = parseFloat(amountStr) || 0;
  const phoneDisplay = userPhone || "+258 8XX XXX XXX";

  const MIN_WITHDRAW = 50;
  const MAX_WITHDRAW = Math.max(0, balance - 5);

  const handleDigit = (d: string) => {
    if (d === ".") {
      if (amountStr.includes(".")) return;
      setAmountStr(prev => (prev === "" ? "0." : prev + "."));
      return;
    }
    setAmountStr(prev => {
      const next = prev === "" || prev === "0" ? d : prev + d;
      if (next.includes(".")) {
        const [, dec] = next.split(".");
        if (dec && dec.length > 2) return prev;
      }
      if (next.replace(".", "").length > 8) return prev;
      return next;
    });
  };

  const handleDelete = () => setAmountStr(prev => prev.length <= 1 ? "" : prev.slice(0, -1));

  const handleSetPercent = (pct: number) => {
    const val = Math.round(balance * pct * 100) / 100;
    setAmountStr(val > 0 ? val.toString() : "");
  };

  const canProceed = amountVal >= MIN_WITHDRAW && amountVal <= MAX_WITHDRAW;

  const startPolling = (wId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("transactions")
          .select("status")
          .eq("id", wId)
          .single();
        if (data?.status === "approved") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          await refreshProfile();
          setScreen("approved");
        } else if (data?.status === "rejected") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          await refreshProfile();
          setScreen("rejected");
        }
      } catch { /* silently ignore */ }
    }, 3000);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setBalanceLoading(true);
      try {
        if (user?.id) {
          const { data } = await supabase
            .from("profiles").select("balance, phone").eq("id", user.id).single();
          if (active && data) {
            const freshBal = parseFloat(String(data.balance ?? "0")) || 0;
            setFreshBalance(freshBal);
            await refreshProfile();
          }
        } else {
          await refreshProfile();
          setFreshBalance(parseFloat(String(profile?.balance ?? "0")) || 0);
        }
      } catch { /* use context fallback */ }
      if (active) setBalanceLoading(false);
    };
    load();
    return () => {
      active = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleConfirm = async () => {
    if (processingConfirm) return;
    setProcessingConfirm(true);

    try {
      if (!user?.id) {
        setProcessingConfirm(false);
        setScreen("rejected");
        return;
      }

      let withdrawalId: string | null = null;
      let apiSuccess = false;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`${API_BASE}/withdraw`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: amountVal, phone: profile?.phone }),
          });
          if (res.ok) {
            const json = await res.json() as { success?: boolean; withdrawalId?: string };
            if (json.success && json.withdrawalId) {
              withdrawalId = json.withdrawalId;
              apiSuccess = true;
            }
          }
        }
      } catch { /* fall through to direct Supabase */ }

      if (!apiSuccess) {
        const { data: profileData } = await supabase
          .from("profiles").select("balance").eq("id", user.id).single();
        const currentBalance = parseFloat(String(profileData?.balance ?? "0")) || 0;

        if (currentBalance < amountVal + 5) {
          setProcessingConfirm(false);
          setScreen("rejected");
          return;
        }

        const newBalance = Math.round((currentBalance - amountVal - 5) * 100) / 100;
        const { error: balErr } = await supabase
          .from("profiles").update({ balance: newBalance }).eq("id", user.id);
        if (balErr) { setProcessingConfirm(false); setScreen("rejected"); return; }

        const { data: txRow, error: txErr } = await supabase
          .from("transactions").insert({
            user_id: user.id,
            type: "withdrawal",
            amount: -(amountVal + 5),
            description: JSON.stringify({
              method: "M-Pesa",
              phone: profile?.phone ?? null,
              userName: profile?.full_name ?? "utilizador",
            }),
            status: "pending",
            created_at: new Date().toISOString(),
          }).select("id").single();

        if (txErr || !txRow) {
          await supabase.from("profiles").update({ balance: amountVal + 5 + (parseFloat(String((await supabase.from("profiles").select("balance").eq("id", user.id).single()).data?.balance ?? "0")) || 0) }).eq("id", user.id);
          setProcessingConfirm(false);
          setScreen("rejected");
          return;
        }
        withdrawalId = txRow.id;
      }

      await refreshProfile();
      setProcessingConfirm(false);

      if (withdrawalId) {
        setWithdrawalId(withdrawalId);
        startPolling(withdrawalId);
      }
      setScreen("pending");
    } catch {
      setProcessingConfirm(false);
      setScreen("rejected");
    }
  };

  // ─── Amount Screen ────────────────────────────────────────────────────────
  if (screen === "amount") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen bg-white">

          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => setLocation("/perfil")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Levantamento</p>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4 text-[#374151]" />
            </button>
          </div>

          <div className="flex flex-col gap-2 px-5 pt-4 mb-2">
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-2">
                <Smartphone style={{ width: 15, height: 15, color: "#374151" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{METHOD_NAME}</span>
              </div>
              <div className="flex items-center gap-2">
                {!editingPhone && <span style={{ fontSize: 13, color: "#9ca3af" }}>{phoneDisplay}</span>}
                <button onClick={() => { setEditingPhone(e => !e); setEditPhoneVal(profile?.phone ?? ""); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <Pencil style={{ width: 13, height: 13, color: "#374151" }} />
                </button>
              </div>
            </div>
            {editingPhone && (
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0 }}>+258</span>
                <input
                  type="tel" inputMode="numeric" maxLength={9}
                  value={editPhoneVal}
                  onChange={e => setEditPhoneVal(e.target.value.replace(/\D/g, ""))}
                  placeholder="84XXXXXXX"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "#0a0a0a", caretColor: "#0a0a0a" }}
                />
                <button
                  disabled={savingPhone || editPhoneVal.length < 9}
                  onClick={async () => {
                    if (!user?.id || editPhoneVal.length < 9) return;
                    setSavingPhone(true);
                    try {
                      await supabase.from("profiles").update({ phone: editPhoneVal }).eq("id", user.id);
                      await refreshProfile();
                      setEditingPhone(false);
                    } catch { /* silently ignore */ }
                    setSavingPhone(false);
                  }}
                  className="px-3 py-1 text-xs font-bold transition-all"
                  style={{ background: editPhoneVal.length >= 9 ? "#0a0a0a" : "#e5e7eb", color: editPhoneVal.length >= 9 ? "#fff" : "#9ca3af", cursor: editPhoneVal.length >= 9 ? "pointer" : "default", borderRadius: 0 }}>
                  {savingPhone ? "…" : "Guardar"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center px-5 py-6 border-b border-slate-100">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Valor a Levantar
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span style={{ fontSize: "3.8rem", lineHeight: 1, fontFamily: "system-ui", fontWeight: 200, color: "#0a0a0a" }}>
                {amountStr || "0"}
              </span>
              <span style={{ fontSize: 18, color: "#9ca3af", marginBottom: 8 }}>MZN</span>
            </div>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
              Saldo disponível:{" "}
              {balanceLoading
                ? <span style={{ color: "#374151" }}>a carregar…</span>
                : <span style={{ color: "#0a0a0a", fontWeight: 600 }}>{fmtMZN(balance)} MZN</span>
              }
            </p>

            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <button key={pct} onClick={() => handleSetPercent(pct)}
                  className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{ background: "#f8fafc", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 0 }}>
                  {pct * 100}%
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 pt-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(d => (
                <button key={d}
                  onClick={() => d === "⌫" ? handleDelete() : handleDigit(d)}
                  className="h-14 font-syne font-bold text-xl flex items-center justify-center transition-all active:scale-95"
                  style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 0, color: "#0a0a0a" }}>
                  {d === "⌫" ? <span style={{ fontSize: 18, color: "#374151" }}>⌫</span> : d}
                </button>
              ))}
            </div>

            {amountVal > 0 && amountVal < MIN_WITHDRAW && (
              <div className="flex items-center gap-2 p-3 mb-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <Info style={{ width: 13, height: 13, color: "#d97706" }} />
                <p style={{ fontSize: 12, color: "#92400e" }}>Valor mínimo de levantamento: {fmtMZN(MIN_WITHDRAW)} MZN</p>
              </div>
            )}
            {amountVal > MAX_WITHDRAW && amountVal > 0 && (
              <div className="flex items-center gap-2 p-3 mb-3" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <Info style={{ width: 13, height: 13, color: "#dc2626" }} />
                <p style={{ fontSize: 12, color: "#dc2626" }}>Saldo insuficiente</p>
              </div>
            )}

            <button
              onClick={() => !balanceLoading && canProceed && setScreen("confirm")}
              disabled={balanceLoading || !canProceed}
              className="w-full h-14 font-syne font-bold text-sm transition-all mb-8"
              style={{
                background: (!balanceLoading && canProceed) ? "#0a0a0a" : "#f1f5f9",
                color: (!balanceLoading && canProceed) ? "#fff" : "#9ca3af",
                borderRadius: 0,
                border: "none",
                cursor: (!balanceLoading && canProceed) ? "pointer" : "default",
                letterSpacing: "0.3px",
              }}>
              {balanceLoading ? "A verificar saldo…" : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Confirm Screen ───────────────────────────────────────────────────────
  if (screen === "confirm") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 bg-white">

          <div className="flex items-center justify-between pt-12 pb-6 border-b border-slate-100">
            <button onClick={() => setScreen("amount")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Confirmar</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex flex-col items-center py-8"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>
              Levantamento
            </p>
            <p className="font-syne font-bold text-center" style={{ fontSize: "2.8rem", lineHeight: 1.1, color: "#0a0a0a" }}>
              {fmtMZN(amountVal)}<span style={{ fontSize: "1.4rem", color: "#9ca3af", marginLeft: 6 }}>MZN</span>
            </p>
            <div className="flex items-center gap-2 mt-3 px-4 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <Smartphone style={{ width: 13, height: 13, color: "#374151" }} />
              <span style={{ fontSize: 12.5, color: "#6b7280" }}>{METHOD_NAME} · {phoneDisplay}</span>
            </div>
          </motion.div>

          <motion.div className="mb-6" style={{ border: "1px solid #e5e7eb" }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.32 }}>
            <div className="px-4 py-3.5 border-b border-slate-100">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                Detalhes do Levantamento
              </p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "De",               val: "Saldo Disponível" },
                { label: "Método",           val: METHOD_NAME },
                { label: "Estado Estimado",  val: "Pendente (análise manual)" },
                { label: "Valor a Receber",  val: `${fmtMZN(amountVal)} MZN` },
                { label: "Taxa de Serviço",  val: amountVal >= MIN_WITHDRAW ? "5,00 MZN" : "0,00 MZN" },
                { label: "Total Debitado",   val: `${fmtMZN(amountVal >= MIN_WITHDRAW ? amountVal + 5 : amountVal)} MZN` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0a0a0a" }}>{row.val}</span>
                </div>
              ))}
              <div className="border-t border-slate-100" />
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Você Recebe</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                  {fmtMZN(amountVal)} MZN
                </span>
              </div>
            </div>
          </motion.div>

          {processingConfirm ? (
            <div className="h-14 flex items-center justify-center gap-3" style={{ background: "#0a0a0a" }}>
              <Loader2 style={{ width: 16, height: 16, color: "#fff" }} className="animate-spin" />
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>A confirmar…</span>
            </div>
          ) : (
            <SwipeToConfirm onConfirm={handleConfirm} />
          )}
        </div>
      </div>
    );
  }

  // ─── Pending Screen ────────────────────────────────────────────────────────
  if (screen === "pending") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 bg-white">
          <div className="flex items-center justify-between pt-12 pb-6 border-b border-slate-100">
            <div className="w-9" />
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Levantamento</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex flex-col items-center py-8"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-20 h-20 flex items-center justify-center mb-5 relative"
              style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="absolute inset-0 border-2 border-transparent animate-spin"
                style={{ borderTopColor: "#0a0a0a" }} />
              <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 animate-spin" style={{ borderRadius: 0 }} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
              A Processar
            </p>
            <p className="font-syne font-bold text-center" style={{ fontSize: "2.6rem", lineHeight: 1.1, color: "#0a0a0a" }}>
              {fmtMZN(amountVal)}<span style={{ fontSize: "1.2rem", color: "#9ca3af", marginLeft: 6 }}>MZN</span>
            </p>
          </motion.div>

          <motion.div className="mb-5" style={{ border: "1px solid #e5e7eb" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}>
            <div className="px-4 py-3.5 border-b border-slate-100">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>Detalhes</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID",       val: txId },
                { label: "Data",     val: txDate },
                { label: "Carteira", val: `${METHOD_NAME} · ${phoneDisplay}` },
                { label: "Valor",    val: `${fmtMZN(amountVal)} MZN` },
                { label: "Estado",   val: "Em verificação…", highlight: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: (row as any).highlight ? "#374151" : "#0a0a0a", maxWidth: 200, textAlign: "right", fontStyle: (row as any).highlight ? "italic" : "normal" }}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-start gap-2 p-3.5 mb-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <Info style={{ width: 13, height: 13, color: "#374151", marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              O teu pedido foi recebido e está a ser verificado. Aguarda a confirmação — esta página actualiza automaticamente em tempo real.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3.5 mb-4" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
            <Clock style={{ width: 13, height: 13, color: "#d97706", marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
              O levantamento pode demorar entre <strong>5 a 50 minutos</strong> após a submissão, dependendo do volume de pedidos. Não precisas de ficar nesta página — serás notificado quando aprovado.
            </p>
          </div>

          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center justify-center gap-2 py-3 mb-5"
            style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <div className="w-2 h-2 bg-slate-400 animate-pulse" style={{ borderRadius: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>A aguardar aprovação do administrador…</span>
          </motion.div>

          <button
            onClick={() => setLocation("/perfil")}
            className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{ background: "#0a0a0a", color: "#fff", border: "none", borderRadius: 0 }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
            Voltar ao Perfil
          </button>
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
            O pedido continua em processo mesmo saindo desta página.
          </p>
        </div>
      </div>
    );
  }

  // ─── Approved Screen ──────────────────────────────────────────────────────
  if (screen === "approved") {
    const fee = amountVal >= MIN_WITHDRAW ? 5 : 0;
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 pb-10 bg-white">
          <div className="flex items-center justify-between pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => setLocation("/perfil")}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#111]" />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Levantamento</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex flex-col items-center py-8"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="w-20 h-20 flex items-center justify-center mb-5"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: "#16a34a" }} strokeWidth={2} />
            </motion.div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
              Pagamento Aprovado
            </p>
            <p className="font-syne font-bold text-center" style={{ fontSize: "2.6rem", lineHeight: 1.1, color: "#0a0a0a" }}>
              {fmtMZN(amountVal)}<span style={{ fontSize: "1.2rem", color: "#9ca3af", marginLeft: 6 }}>MZN</span>
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8, textAlign: "center" }}>
              O valor foi enviado para o teu {METHOD_NAME}.
            </p>
          </motion.div>

          <motion.div className="mb-5" style={{ border: "1px solid #e5e7eb" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}>
            <div className="px-4 py-3.5 border-b border-slate-100">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                Recibo do Levantamento
              </p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3.5">
              {[
                { label: "ID de Transação",  val: txId },
                { label: "Data",             val: txDate },
                { label: "Método",           val: `${METHOD_NAME} · ${phoneDisplay}` },
                { label: "Valor Enviado",    val: `${fmtMZN(amountVal)} MZN` },
                { label: "Taxa de Serviço",  val: fee > 0 ? `${fmtMZN(fee)} MZN` : "Sem taxa" },
                { label: "Total Debitado",   val: `${fmtMZN(amountVal + fee)} MZN` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0a0a0a", textAlign: "right", maxWidth: 200 }}>
                    {row.val}
                  </span>
                </div>
              ))}
              <div className="border-t border-slate-100" />
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Você Recebeu</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>
                  {fmtMZN(amountVal)} MZN
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex items-center gap-2 p-3.5 mb-6" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <CheckCircle2 style={{ width: 13, height: 13, color: "#16a34a", flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
              Transação concluída com sucesso. Guarda este recibo para referência futura.
            </p>
          </motion.div>

          <button onClick={() => setLocation("/perfil")}
            className="w-full h-14 font-syne font-bold text-sm text-white transition-all"
            style={{ background: "#0a0a0a", borderRadius: 0, border: "none", letterSpacing: "0.3px" }}>
            Voltar ao Perfil
          </button>
        </div>
      </div>
    );
  }

  // ─── Rejected Screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5 bg-white">
        <div className="flex items-center justify-between pt-12 pb-4 border-b border-slate-100">
          <button onClick={() => setScreen("amount")}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#111]" />
          </button>
          <p className="font-syne font-bold text-[#0a0a0a] text-base">Levantamento</p>
          <div className="w-9" />
        </div>

        <motion.div className="flex flex-col items-center py-8"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-20 h-20 flex items-center justify-center mb-5"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <XCircle style={{ width: 36, height: 36, color: "#dc2626" }} strokeWidth={2} />
          </motion.div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
            Recusado
          </p>
          <p className="font-syne font-bold text-center" style={{ fontSize: "2.6rem", lineHeight: 1.1, color: "#0a0a0a" }}>
            {fmtMZN(amountVal)}<span style={{ fontSize: "1.2rem", color: "#9ca3af", marginLeft: 6 }}>MZN</span>
          </p>
        </motion.div>

        <div className="flex items-start gap-3 p-3.5 mb-6" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertTriangle style={{ width: 14, height: 14, color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
            O teu pedido de levantamento foi recusado pelo administrador. O valor foi devolvido ao teu saldo.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { setAmountStr(""); setScreen("amount"); }}
            className="w-full h-14 font-syne font-bold text-sm text-white transition-all"
            style={{ background: "#0a0a0a", borderRadius: 0, border: "none", letterSpacing: "0.3px" }}>
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
