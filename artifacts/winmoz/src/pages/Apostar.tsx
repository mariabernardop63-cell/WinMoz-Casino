import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation, Link } from "wouter";
import {
  ChevronLeft, Star, Wifi, Gamepad2, Zap, Trophy,
  XCircle, RotateCcw, AlertTriangle, Swords, Users,
  CreditCard, Smartphone, CheckCircle2, Clock, X, Pencil, Phone, Copy, Hash, Loader2,
} from "lucide-react";
import { supabase, getSessionWithRefresh, isSessionExpiredError } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getLivePlayerCount, getSalaOnlineCount } from "@/lib/simulation";
import { API_BASE } from "@/lib/apiBase";
import AdBanner from "@/components/AdBanner";

/* ── Theme ── */
const VIOLET = "#7c3aed";
const CYAN = "#00D4B4";

/* ── Game Data ── */
type GameInfo = {
  name: string;
  sub: string;
  description: string;
  image: string;
  imagePos: string;
  imageFit?: string;
  cardBg?: string;
  rating: string;
  online: number;
  playing: number;
};

const GAMES_DATA: Record<string, GameInfo> = {
  damas: {
    name: "DAMAS MZ",
    sub: "Jogo de Tabuleiro",
    description: "Elimina todas as peças do adversário com movimentos estratégicos no tabuleiro clássico.",
    image: "/damas-mz.png",
    imagePos: "center",
    rating: "4.8",
    online: 3847,
    playing: 2412,
  },
  ludo: {
    name: "LUDO CASH",
    sub: "Jogo de Dados",
    description: "Corrida épica de peças. Leva todas ao centro antes do adversário com dados e estratégia.",
    image: "/ludo-cash.jpg",
    imagePos: "center 65%",
    rating: "4.9",
    online: 6124,
    playing: 4118,
  },
  xadrez: {
    name: "XADREZ MZ",
    sub: "Estratégia Real",
    description: "O jogo eterno da inteligência. Controla o tabuleiro e dá Xeque-Mate ao adversário.",
    image: "/xadrez-mz.jpg",
    imagePos: "center 30%",
    rating: "4.7",
    online: 1843,
    playing: 1207,
  },
  bilhar: {
    name: "BILHAR",
    sub: "Jogo de Mesa",
    description: "Precisão e ângulos perfeitos. Encaça todas as bolas na sequência correta para vencer.",
    image: "/bilhar-card.webp",
    imagePos: "center",
    rating: "4.6",
    online: 1289,
    playing: 891,
  },
  roleta: {
    name: "ROLETA",
    sub: "Roleta da Sorte",
    description: "A fortuna sorri aos audazes. Aposta no número ou cor certos e deixa a roda decidir.",
    image: "/roleta-card.jpg",
    imagePos: "center",
    imageFit: "cover",
    cardBg: "#2d0a1e",
    rating: "4.5",
    online: 2156,
    playing: 1502,
  },
};

const FALLBACK_GAME: GameInfo = {
  name: "JOGO",
  sub: "Jogo Apostado",
  description: "Jogue e multiplica o teu saldo com apostas seguras e emocionantes.",
  image: "/damas-mz.png",
  imagePos: "center",
  rating: "4.8",
  online: 2500,
  playing: 1800,
};

const BET_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];

const ALL_GAMES = [
  { id: "damas",  name: "Damas MZ",   image: "/damas-mz.png",    imagePos: "center",     rating: "4.8", players: "2.4K" },
  { id: "ludo",   name: "Ludo Cash",  image: "/ludo-cash.jpg",   imagePos: "center 65%", rating: "4.9", players: "4.1K" },
  { id: "xadrez", name: "Xadrez MZ",  image: "/xadrez-mz.jpg",   imagePos: "center 30%", rating: "4.7", players: "1.2K" },
  { id: "bilhar", name: "Bilhar",     image: "/bilhar-card.webp", imagePos: "center",     rating: "4.6", players: "890"  },
  { id: "roleta", name: "Roleta",     image: "/roleta-card.jpg",  imagePos: "center",     rating: "4.5", players: "1.5K" },
];

function fmtMT(v: number) {
  return v >= 1000 ? `${v.toLocaleString("pt-PT")} MT` : `${v} MT`;
}

function fmtBalance(v: number) {
  const str = v.toFixed(2);
  const [i, d] = str.split(".");
  return `${Number(i).toLocaleString("pt-PT")},${d}`;
}

type GameMode  = "solo" | "squad";
type PayMethod = "poker" | "carteira";
type Screen    = "bet" | "processing" | "rejected" | "matchmaking" | "matched" | "timeout" | "pin-confirmation" | "sala-menu" | "sala-aguardar" | "sala-entrar";

/* ── Processing Screen (Conta Poker only) ── */
function ProcessingScreen() {
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#F4F6FB" }}>
      <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
        <motion.div className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}>

          {/* Icon card */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{ width: 96, height: 96, borderRadius: 30, background: "#fff",
              boxShadow: "0 6px 32px rgba(124,58,237,0.14), 0 1px 4px rgba(0,0,0,0.06)",
              border: "1.5px solid rgba(124,58,237,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 34 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%",
              border: `3.5px solid rgba(124,58,237,0.15)`, borderTopColor: VIOLET }}
              className="animate-spin" />
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#0D0D0D",
              marginBottom: 10, textAlign: "center" }}>
            A verificar saldo…
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            style={{ fontSize: 13.5, color: "#64748B", textAlign: "center", lineHeight: 1.65, maxWidth: 270 }}>
            A validar o saldo da tua Conta Poker. Este processo é rápido e seguro.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.46 }}
            style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 8, padding: "9px 20px",
              background: "rgba(124,58,237,0.07)", borderRadius: 99,
              border: "1px solid rgba(124,58,237,0.2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 11, color: VIOLET, fontWeight: 700, letterSpacing: "0.6px" }}>PROCESSAMENTO SEGURO</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Debito Pay Betting Screen (Carteira Móvel) ── */
function SMSBettingScreen({
  amount, onCancel, onSuccess, userPhone: initialPhone,
}: {
  amount: number;
  onCancel: () => void;
  onSuccess: (txId: string | null) => void;
  userPhone?: string;
}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<"wallet" | "phone" | "verifying" | "rejected">("wallet");
  const [provider, setProvider] = useState<"emola" | "mpesa">("emola");
  const [phoneInput, setPhoneInput] = useState(initialPhone?.replace(/\D/g, "").replace(/^258/, "") || "");
  const [phoneError, setPhoneError] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [initError, setInitError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [countdown, setCountdown] = useState(120);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  const cleanPhone = phoneInput.replace(/\D/g, "").replace(/^258/, "");
  const isPhoneValid = cleanPhone.length === 9;

  const handleInitiate = async () => {
    if (!isPhoneValid) { setPhoneError("Número inválido — deve ter 9 dígitos"); return; }
    if (!user) { setPhoneError("Sessão inválida"); return; }
    setPhoneError("");
    setInitError("");
    setInitiating(true);

    try {
      const session = await getSessionWithRefresh();
      if (!session) {
        setPhoneError("Sessão expirada. Volta a entrar na tua conta.");
        setLocation("/login");
        setInitiating(false);
        return;
      }

      const res = await fetch("/api/debito/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: cleanPhone,
          provider,
          type: "bet",
          userId: session.user.id,
        }),
      });

      const resData = await res.json() as any;

      if (!res.ok) {
        setInitError(resData?.error || "Erro ao iniciar pagamento. Tenta novamente.");
        setInitiating(false);
        return;
      }

      const pid = resData?.txId as string;
      setInitiating(false);
      setStep("verifying");
      setCountdown(300);

      const TIMEOUT_SECS = 300; // 5 min — e-Mola pode demorar a entregar o USSD
      let count = 0;

      const stopAll = (ch: ReturnType<typeof supabase.channel>) => {
        clearInterval(pollRef.current!);
        clearInterval(countdownRef.current!);
        supabase.removeChannel(ch);
      };

      // Realtime — deteção instantânea quando o webhook atualizar o registo
      const channel = supabase
        .channel(`bet-${pid}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${pid}` },
          (payload) => {
            const newStatus = (payload.new as any)?.status as string | undefined;
            if (newStatus === "approved") {
              stopAll(channel);
              onSuccess(null);
            } else if (newStatus === "rejected") {
              stopAll(channel);
              try {
                const desc = JSON.parse((payload.new as any)?.description || "{}");
                setRejectReason(desc.failReason || "");
              } catch { setRejectReason(""); }
              setStep("rejected");
            }
          }
        )
        .subscribe();
      realtimeRef.current = channel;

      // countdown timer — ao chegar a 0 cancela automaticamente (USSD expira em 2 min)
      let timedOut = false;
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          const next = prev > 1 ? prev - 1 : 0;
          if (prev === 1 && !timedOut) {
            timedOut = true;
            clearInterval(pollRef.current!);
            clearInterval(countdownRef.current!);
            supabase.removeChannel(channel);
            setTimeout(() => {
              setRejectReason("Tempo esgotado. O pedido USSD expirou. Tenta novamente.");
              setStep("rejected");
            }, 0);
          }
          return next;
        });
      }, 1000);

      // Polling a cada 3s via /api/debito/check-status (máx 40 ciclos = 2 min)
      const maxCycles = Math.ceil(TIMEOUT_SECS / 3);
      pollRef.current = setInterval(async () => {
        if (timedOut) return;
        count++;
        try {
          const csRes = await fetch("/api/debito/check-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txId: pid }),
          });
          if (csRes.ok) {
            const csData = await csRes.json() as { status: string; reason?: string };
            if (csData.status === "approved") {
              timedOut = true;
              stopAll(channel);
              onSuccess(null);
              return;
            }
            if (csData.status === "rejected") {
              timedOut = true;
              stopAll(channel);
              setRejectReason(csData.reason || "");
              setStep("rejected");
              return;
            }
          }
        } catch { /* erro de rede — tenta no próximo ciclo */ }

        if (count >= maxCycles && !timedOut) {
          timedOut = true;
          stopAll(channel);
          setRejectReason("Tempo de espera esgotado. Não respondeste ao USSD a tempo.");
          setStep("rejected");
        }
      }, 3000);
    } catch {
      setInitError("Erro de ligação. Verifica a internet e tenta de novo.");
      setInitiating(false);
    }
  };

  // Tela de seleção de carteira
  if (step === "wallet") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
            <button onClick={() => { onCancel(); }}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft style={{ width: 18, height: 18, color: "#111" }} />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Escolher Carteira</p>
            <div className="w-9" />
          </div>

          <motion.div className="flex-1 px-5 pt-6 pb-10"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}>

            <div className="flex items-center justify-center mb-7">
              <div className="px-5 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12.5, color: "#6b7280" }}>A apostar: </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0a0a0a" }}>{fmtMT(amount)} MZN</span>
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Selecciona a tua carteira móvel
            </p>

            {/* e-Mola — ACTIVO */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setProvider("emola"); setStep("phone"); }}
              className="w-full p-5 mb-3 flex items-center justify-between transition-all"
              style={{
                background: "#fff",
                border: "1.5px solid #16a34a",
                borderRadius: 0,
                cursor: "pointer",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <img src="/emola-logo.png" alt="e-Mola" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: "#16a34a", fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>e-Mola</p>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Pagamento instantâneo via USSD</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#f0fdf4", color: "#16a34a", letterSpacing: "0.5px" }}>
                  ACTIVO
                </span>
                <CheckCircle2 style={{ width: 16, height: 16, color: "#16a34a" }} />
              </div>
            </motion.button>

            {/* M-Pesa — EM BREVE */}
            <div
              className="w-full p-5 mb-8 flex items-center justify-between"
              style={{
                background: "#fafafa",
                border: "1.5px solid #e5e7eb",
                borderRadius: 0,
                opacity: 0.5,
                cursor: "not-allowed",
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <img src="/mpesa-logo.jpg" alt="M-Pesa" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontWeight: 700, color: "#dc2626", fontSize: 15, letterSpacing: "0.5px", fontFamily: "'Syne', sans-serif" }}>M-Pesa</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Brevemente disponível</p>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "#f1f5f9", color: "#9ca3af", letterSpacing: "0.5px" }}>
                EM BREVE
              </span>
            </div>

            <div className="p-4" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                  O pagamento é processado pelo gateway seguro <strong style={{ color: "#374151" }}>Debito Pay</strong>.
                  Receberás um pedido USSD no teu telemóvel para confirmar com o teu PIN e-Mola.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === "verifying") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-6">
          <motion.div className="flex flex-col items-center w-full"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}>

            <div className="relative flex items-center justify-center mb-8" style={{ width: 96, height: 96 }}>
              <div className="absolute inset-0 rounded-full border animate-spin"
                style={{ borderColor: "#e5e7eb", borderTopColor: "#0a0a0a" }} />
              <div className="w-16 h-16 flex items-center justify-center"
                style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <Phone style={{ width: 22, height: 22, color: "#374151" }} />
              </div>
            </div>

            <h1 className="font-syne font-bold text-[22px] text-[#0a0a0a] text-center mb-2">
              Aguarda o USSD
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.65, maxWidth: 300, marginBottom: 24 }}>
              Um pedido USSD foi enviado para{" "}
              <strong style={{ color: "#0a0a0a" }}>+258 {cleanPhone}</strong>.
              Introduz o teu <strong style={{ color: "#0a0a0a" }}>PIN {provider === "emola" ? "e-Mola" : "M-Pesa"}</strong> para confirmar a aposta.
            </p>

            <div className="w-full p-4 mb-4" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-3 justify-center mb-3">
                <div className="w-2 h-2 bg-[#0a0a0a] animate-pulse" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.8px" }}>A AGUARDAR CONFIRMAÇÃO DO PIN…</span>
              </div>
              {countdown > 0 ? (
                <div className="flex items-center gap-2 justify-center">
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Expira em</span>
                  <span style={{
                    fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                    color: countdown <= 30 ? "#ef4444" : "#0a0a0a",
                    minWidth: 36, textAlign: "center",
                  }}>
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 bg-amber-500 animate-pulse" />
                  <span style={{ fontSize: 12, color: "#f59e0b" }}>A verificar confirmação do banco…</span>
                </div>
              )}
            </div>

            <p style={{ fontSize: 11.5, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
              Não feches esta janela. O processo é automático após confirmares o PIN.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === "rejected") {
    return (
      <div className="min-h-screen bg-white w-full flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-6">
            <button onClick={onCancel}
              className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ChevronLeft style={{ width: 18, height: 18, color: "#111" }} />
            </button>
            <p className="font-syne font-bold text-[#0a0a0a] text-base">Pagamento Falhado</p>
            <div className="w-9" />
          </div>
          <motion.div className="flex flex-col items-center pt-4 mb-8"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-20 h-20 flex items-center justify-center mb-6"
              style={{ background: "#fef2f2", border: "1.5px solid #fecaca" }}>
              <XCircle className="w-10 h-10" style={{ color: "#dc2626" }} strokeWidth={2.5} />
            </div>
            <p className="font-syne font-bold text-[22px] text-[#0a0a0a] text-center mb-2">Pagamento não concluído</p>
            {rejectReason ? (
              <p style={{ fontSize: 13, color: "#f59e0b", textAlign: "center", marginTop: 4, lineHeight: 1.6, maxWidth: 280, fontWeight: 500 }}>
                {rejectReason}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 4, lineHeight: 1.6, maxWidth: 280 }}>
                PIN incorrecto, saldo insuficiente ou tempo esgotado. Verifica e tenta novamente.
              </p>
            )}
          </motion.div>
          <div className="flex flex-col gap-3 mt-auto pb-10">
            <button onClick={() => { setInitError(""); setRejectReason(""); setStep("wallet"); }}
              className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: "#0a0a0a", color: "#fff", border: "none", borderRadius: 0 }}>
              <RotateCcw style={{ width: 16, height: 16 }} /> Tentar Novamente
            </button>
            <button onClick={onCancel}
              className="w-full h-14 font-syne font-semibold text-sm"
              style={{ background: "#f8fafc", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 0, cursor: "pointer" }}>
              Cancelar Aposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const providerColor = provider === "emola" ? "#16a34a" : "#dc2626";
  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">
        <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
          <button onClick={() => { setInitError(""); setStep("wallet"); }}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronLeft style={{ width: 18, height: 18, color: "#111" }} />
          </button>
          <p className="font-syne font-bold text-[#0a0a0a] text-base">
            Número {provider === "emola" ? "e-Mola" : "M-Pesa"}
          </p>
          <div className="w-9" />
        </div>

        <motion.div className="flex-1 px-5 pt-6 pb-10"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}>

          <div className="flex items-center justify-center mb-7">
            <div className="px-5 py-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 12.5, color: "#6b7280" }}>A apostar: </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0a0a0a" }}>{fmtMT(amount)} MZN</span>
            </div>
          </div>

          <div className="mb-5 p-5" style={{ border: `1.5px solid ${providerColor}22`, background: "#fafafa" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 flex items-center justify-center"
                style={{ background: provider === "emola" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${providerColor}33` }}>
                <Phone style={{ width: 16, height: 16, color: providerColor }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: providerColor, fontFamily: "'Syne', sans-serif" }}>
                  Número de {provider === "emola" ? "e-Mola" : "M-Pesa"}
                </p>
                <p style={{ fontSize: 11.5, color: "#9ca3af" }}>O número que vai efectuar o pagamento</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5 bg-white"
              style={{ border: isPhoneValid ? `1.5px solid ${providerColor}` : "1.5px solid #d1d5db" }}>
              <div className="flex items-center gap-2 flex-shrink-0 border-r pr-3" style={{ borderColor: "#e5e7eb" }}>
                <span style={{ fontSize: 16 }}>🇲🇿</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>+258</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneInput}
                onChange={e => { setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 9)); setPhoneError(""); setInitError(""); }}
                placeholder="8X XXX XXXX"
                autoFocus
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
                style={{ color: "#0a0a0a", caretColor: providerColor, letterSpacing: "1px", fontFamily: "system-ui" }}
              />
              {isPhoneValid && (
                <CheckCircle2 style={{ width: 16, height: 16, color: providerColor, flexShrink: 0 }} />
              )}
            </div>
            {phoneError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 8 }}>⚠ {phoneError}</p>}
            {initError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 8, lineHeight: 1.5 }}>⚠ {initError}</p>}
          </div>

          <div className="p-4 mb-7" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>Como funciona</p>
            {[
              "Introduz o teu número e-Mola e prime «Pagar»",
              "Recebes um pedido USSD no teu telemóvel",
              "Confirma com o teu PIN e-Mola",
              "A aposta é registada automaticamente",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3 mb-2.5 last:mb-0">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "#0a0a0a" }}>
                  <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{s}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleInitiate}
            disabled={!isPhoneValid || initiating}
            className="w-full h-14 font-syne font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: isPhoneValid && !initiating ? "#0a0a0a" : "#f1f5f9",
              color: isPhoneValid && !initiating ? "#fff" : "#9ca3af",
              borderRadius: 0,
              border: "none",
              letterSpacing: "0.3px",
            }}>
            {initiating
              ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /><span>A iniciar pagamento…</span></>
              : `Pagar com ${provider === "emola" ? "e-Mola" : "M-Pesa"}`
            }
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Rejected Screen ── */
function RejectedScreen({
  amount, balance, onRetry, onRecharge,
}: { amount: number; balance: number; onRetry: () => void; onRecharge: () => void }) {
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <button onClick={onRetry} className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#1c1c1e" }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Aposta Recusada</p>
          <div className="w-10" />
        </div>

        <motion.div className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
            <XCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600,
            letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Recusado</p>
          <p style={{ color: "#fff", fontFamily: "system-ui", fontWeight: 200, fontSize: "2.6rem", lineHeight: 1.1 }}>
            {fmtMT(amount)}<span style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>MZN</span>
          </p>
        </motion.div>

        <motion.div className="rounded-2xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ background: "#1c1c1e" }}>
          <div className="px-4 py-4 border-b" style={{ borderColor: "#2c2c2e" }}>
            <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Motivo da Recusa</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3.5">
            {[
              { label: "Causa",             val: "Saldo Insuficiente" },
              { label: "Saldo Actual",       val: `${fmtBalance(balance)} MZN` },
              { label: "Aposta Solicitada",  val: `${fmtMT(amount)}` },
              { label: "Diferença",          val: `${fmtBalance(Math.max(0, amount - balance))} MZN`, err: true },
              { label: "Estado",             val: "Recusado ✗",                                       err: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span style={{ fontSize: 13, color: "#8e8e93" }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: (row as any).err ? "#e74c3c" : "#fff" }}>{row.val}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex items-start gap-3 p-3.5 rounded-2xl mb-6" style={{ background: "#1c1c1e" }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#f39c12", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.6 }}>
            O valor da aposta excede o teu saldo disponível. Recarrega a conta ou escolhe um valor menor.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={onRetry}
            className="w-full h-14 rounded-full flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, color: "#fff",
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            <RotateCcw style={{ width: 17, height: 17 }} /> Tentar Novamente
          </button>
          <button onClick={onRecharge}
            className="w-full h-14 rounded-full"
            style={{ background: "#1c1c1e", color: "#8e8e93",
              fontFamily: "'Syne', sans-serif", fontSize: 14, cursor: "pointer" }}>
            Recarregar Saldo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bot names pool ── */
const BOT_NAMES_POOL = [
  "Anita Joaquim","Eduardo Viegas","Fátima Cossa","Manuel Sitoe",
  "Isabel Nhantumbo","Carlos Tembe","Rosa Mucavel","António Bila",
  "Conceição Machava","Hélder Muianga","Lurdes Maluana","Pedro Tivane",
  "Sofia Cuna","Domingos Chissano","Graça Macuácua","Filipe Zunguze",
  "Beatriz Munguambe","Tomás Guambe","Adélia Nhatave","Augusto Chabane",
  "Celeste Baloi","Ernesto Macuácua","Maria Mondlane","Vítor Sitoe",
  "Amélia Zitha","Jacinto Cumbe","Felicidade Ubisse","Olívia Tembe",
  "Renato Mabunda","Noémia Inguane",
];

function pickBotInfo(): { name: string; balance: number } {
  try {
    const used = JSON.parse(sessionStorage.getItem("_wmz_bot_names") ?? "[]") as string[];
    const pool = BOT_NAMES_POOL.filter(n => !used.includes(n));
    const src  = pool.length > 0 ? pool : BOT_NAMES_POOL;
    const name = src[Math.floor(Math.random() * src.length)];
    sessionStorage.setItem("_wmz_bot_names", JSON.stringify([...used.slice(-9), name]));
    return { name, balance: Math.floor(Math.random() * 400) + 100 };
  } catch {
    return { name: BOT_NAMES_POOL[0], balance: 200 };
  }
}

/* ── Matchmaking Screen ── */
function MatchmakingScreen({
  onCancel, onMatched, onBotMatch, userId, displayName, betAmount, gameType,
}: {
  onCancel: () => void;
  onMatched: (gameId: string, color: string, oppName: string) => void;
  onBotMatch?: (botName: string, botBalance: number) => void;
  userId: string;
  displayName: string;
  betAmount: number;
  gameType: string;
}) {
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const [found, setFound] = useState(false);
  const [botInfo, setBotInfo] = useState<{ name: string; balance: number } | null>(null);
  const matchedRef = useRef(false);
  const botMatchRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const BOT_ELIGIBLE = (gameType === "damas" || gameType === "xadrez") && [10, 20, 50].includes(betAmount);
  const botThresholdRef = useRef(Math.floor(Math.random() * (45 - 18 + 1)) + 18);

  async function joinQueue() {
    try {
      await supabase.from("matchmaking_queue")
        .delete().eq("user_id", userId).eq("game_type", gameType);
      const { data } = await supabase
        .from("matchmaking_queue")
        .insert({ user_id: userId, display_name: displayName, game_type: gameType, bet_amount: betAmount })
        .select("id").single();
      if (data) queueIdRef.current = (data as { id: string }).id;
    } catch { /* ignore */ }
  }

  async function leaveQueue() {
    try {
      await supabase.from("matchmaking_queue")
        .delete().eq("user_id", userId).eq("game_type", gameType);
      queueIdRef.current = null;
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const channelName = `matchmaking_${gameType}_${betAmount}`;
    let poll: ReturnType<typeof setInterval> | null = null;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    const announcePresence = () => {
      if (matchedRef.current) return;
      channel.send({ type: "broadcast", event: "looking", payload: { userId, displayName } })
        .catch(() => { /* ignore send errors */ });
    };

    channel.on("broadcast", { event: "match_found" }, ({ payload }) => {
      if (matchedRef.current) return;
      if (payload.blue !== userId && payload.green !== userId) return;
      matchedRef.current = true;
      if (poll) { clearInterval(poll); poll = null; }
      leaveQueue();
      const myColor: string = payload.blue === userId ? "blue" : "green";
      const oppName: string =
        myColor === "green"
          ? (payload.blueName  as string) ?? "Adversário"
          : (payload.greenName as string) ?? "Adversário";
      setFound(true);
      setTimeout(() => { onMatched(payload.gameId as string, myColor, oppName); supabase.removeChannel(channel); }, 1500);
    });

    channel.on("broadcast", { event: "looking" }, ({ payload }) => {
      const oppId   = payload.userId   as string;
      const oppName = payload.displayName as string;
      if (!oppId || oppId === userId || matchedRef.current) return;
      const firstId = [userId, oppId].sort()[0];
      if (firstId !== userId) return;
      matchedRef.current = true;
      if (poll) { clearInterval(poll); poll = null; }
      leaveQueue();
      const gameId = `${[userId, oppId].sort().join("_")}_${Date.now()}`;
      channel.send({
        type: "broadcast",
        event: "match_found",
        payload: { gameId, blue: userId, green: oppId, blueName: displayName, greenName: oppName },
      }).catch(() => { /* ignore */ });
      setFound(true);
      setTimeout(() => { onMatched(gameId, "blue", oppName); supabase.removeChannel(channel); }, 1500);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        joinQueue();
        setTimeout(announcePresence, 100);
        if (!poll && !matchedRef.current) {
          poll = setInterval(announcePresence, 2500);
        }
      }
    });

    return () => {
      leaveQueue();
      if (poll) { clearInterval(poll); poll = null; }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (found) return;
    if (remaining <= 0) { leaveQueue(); onCancel(); return; }
    if (BOT_ELIGIBLE && !botMatchRef.current && (TOTAL - remaining) >= botThresholdRef.current) {
      const botsDisabled = localStorage.getItem("wm_bots_disabled") === "true";
      if (!botsDisabled) {
        botMatchRef.current = true;
        matchedRef.current = true;
        leaveQueue();
        const info = pickBotInfo();
        setBotInfo(info);
        setFound(true);
        setTimeout(() => { onBotMatch && onBotMatch(info.name, info.balance); }, 2000);
      }
    }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, found]);

  const mins     = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs     = String(remaining % 60).padStart(2, "0");
  const progress = ((TOTAL - remaining) / TOTAL) * 100;

  if (found) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#F4F6FB" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 28px", width: "100%", maxWidth: 400 }}>

          {/* Success icon */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 320, damping: 24 }}
            style={{ width: 96, height: 96, borderRadius: 30, marginBottom: 30, background: "#fff",
              boxShadow: "0 6px 32px rgba(34,197,94,0.18), 0 2px 8px rgba(0,0,0,0.06)",
              border: "2px solid rgba(34,197,94,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: "#22c55e" }} strokeWidth={2.2}/>
          </motion.div>

          {/* Title */}
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 24,
              color: "#0D0D0D", marginBottom: 6, textAlign: "center" }}>
            Adversário Encontrado!
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            style={{ fontSize: 13.5, color: "#64748B", marginBottom: 32, textAlign: "center" }}>
            A sincronizar os jogadores…
          </motion.p>

          {/* Players card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: "flex", alignItems: "center", gap: 18, width: "100%",
              background: "#fff", borderRadius: 22, padding: "20px 24px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.07)", marginBottom: 26 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%",
                background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 16px ${VIOLET}30` }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>
                  {displayName.charAt(0).toUpperCase() || "T"}
                </span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", maxWidth: 80,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                {displayName}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 19,
                color: "#0D0D0D", letterSpacing: "2px" }}>VS</span>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} className="animate-pulse"/>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%",
                background: botInfo
                  ? "linear-gradient(135deg, #F59E0B, #D97706)"
                  : "linear-gradient(135deg, #22c55e, #16a34a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: botInfo ? "0 4px 16px rgba(245,158,11,0.3)" : "0 4px 16px rgba(34,197,94,0.3)" }}>
                {botInfo
                  ? <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>{botInfo.name.charAt(0)}</span>
                  : <CheckCircle2 style={{ width: 26, height: 26, color: "#fff" }}/>
                }
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: botInfo ? "#D97706" : "#22c55e", maxWidth: 80,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                {botInfo ? botInfo.name.split(" ")[0] : "Pronto!"}
              </span>
            </div>
          </motion.div>

          {/* Loading row */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%",
              border: "2.5px solid rgba(34,197,94,0.2)", borderTopColor: "#22c55e" }}
              className="animate-spin"/>
            <span style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 500 }}>A iniciar o jogo…</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#F4F6FB" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-12 pb-4">
          <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.10)", border: "1px solid rgba(0,0,0,0.07)" }}>
            <X style={{ width: 18, height: 18, color: "#374151" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#0D0D0D" }}>A Procurar Adversário</p>
          <div className="w-10" />
        </div>

        {/* Timer */}
        <motion.div className="flex flex-col items-center pt-8 pb-6"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ width: 110, height: 110, position: "relative", marginBottom: 14 }}>
            <svg width={110} height={110} style={{ position: "absolute", inset: 0 }}>
              <circle cx={55} cy={55} r={46} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={6} />
              <motion.circle cx={55} cy={55} r={46} fill="none"
                stroke={remaining < 30 ? "#ef4444" : VIOLET}
                strokeWidth={6} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={2 * Math.PI * 46 * (1 - progress / 100)}
                transform="rotate(-90 55 55)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22,
                color: remaining < 30 ? "#ef4444" : "#0D0D0D", lineHeight: 1 }}>{mins}:{secs}</span>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, marginTop: 2 }}>restante</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 12, color: "#6B7280", letterSpacing: "0.4px", fontWeight: 500 }}>A procurar em tempo real</span>
          </div>
        </motion.div>

        {/* VS card */}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22, type: "spring", stiffness: 220, damping: 20 }}
          style={{ background: "#fff", borderRadius: 22, padding: "24px 20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 20 }}>
          {/* Me */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%",
              background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 18px ${VIOLET}30` }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff" }}>
                {displayName.charAt(0).toUpperCase() || "E"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>Tu</span>
          </div>

          {/* VS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <motion.span animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 20,
                color: "#0D0D0D", letterSpacing: "2px" }}>
              VS
            </motion.span>
          </div>

          {/* Searching */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 68, height: 68 }}>
              <motion.div animate={{ rotate: 360 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%",
                  border: "2px dashed rgba(0,0,0,0.15)" }} />
              <div style={{ position: "absolute", inset: 8, borderRadius: "50%",
                background: "#F4F6FB", border: "1px solid rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%",
                  border: `3px solid rgba(124,58,237,0.15)`, borderTopColor: VIOLET }}
                  className="animate-spin" />
              </div>
            </div>
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Adversário</span>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "0 8px" }}>
          <AdBanner />
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", lineHeight: 1.65 }}>
            Se nenhum adversário for encontrado em {mins}:{secs}, o teu valor será devolvido automaticamente.
          </p>
        </motion.div>

        <div className="flex-1" />

        <div className="pb-10">
          <button onClick={onCancel}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2"
            style={{ background: "#fff", color: "#374151", fontFamily: "'Syne', sans-serif",
              fontSize: 14, fontWeight: 600, border: "1px solid rgba(0,0,0,0.10)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer" }}>
            <X style={{ width: 16, height: 16 }} /> Cancelar e Devolver Valor
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Segmented Toggle ── */
function SegmentedToggle<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; icon: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", background: "#f8fafc", border: "1px solid #e5e7eb", padding: 3 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <motion.button key={opt.value} onClick={() => onChange(opt.value)} layout
            style={{
              flex: 1, height: 42, border: active ? "1px solid #e5e7eb" : "1px solid transparent",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
              color: active ? "#0a0a0a" : "#9ca3af",
              background: active ? "#ffffff" : "transparent",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              transition: "color 0.2s, background 0.2s",
            }}
            whileTap={{ scale: 0.97 }}>
            <span style={{ display: "flex", alignItems: "center", opacity: active ? 1 : 0.5 }}>{opt.icon}</span>
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Mobile Wallet Phone Input ── */
function MobileWalletPhoneField({
  phone, onChange,
}: { phone: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const formatted = phone
    ? phone.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : "Sem número";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: "#fff", border: "1px solid #e5e7eb",
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>

      <div style={{ width: 38, height: 38,
        background: "#f0fdf9", border: `1px solid ${CYAN}55`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Smartphone style={{ width: 17, height: 17, color: CYAN }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600,
          letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 2 }}>
          Número Registado
        </p>
        {editing ? (
          <input ref={inputRef} value={phone}
            onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === "Enter") setEditing(false); }}
            placeholder="845 000 000"
            style={{ background: "none", border: "none", outline: "none",
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15,
              color: "#111", width: "100%" }} />
        ) : (
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15,
            color: phone ? "#111" : "#9ca3af" }}>
            {phone ? `+258 ${formatted}` : "Adicionar número"}
          </p>
        )}
      </div>

      <button onClick={() => setEditing(v => !v)}
        style={{ width: 34, height: 34,
          background: editing ? "#f0fdf9" : "#f8fafc",
          border: editing ? `1px solid ${CYAN}55` : "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0 }}>
        <Pencil style={{ width: 14, height: 14, color: editing ? CYAN : "#6b7280" }} />
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════ */
export default function Apostar() {
  const [, params]   = useRoute("/apostar/:gameId");
  const [, setLocation] = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  const gameId = params?.gameId ?? "damas";

  useEffect(() => {
    if (gameId === "roleta") setLocation("/roleta");
  }, [gameId]);

  const game = GAMES_DATA[gameId] ?? FALLBACK_GAME;

  /* Bet State */
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [gameMode,    setGameMode]    = useState<GameMode>("solo");
  const [payMethod,   setPayMethod]   = useState<PayMethod>("carteira");   // default: carteira
  const [screen,      setScreen]      = useState<Screen>("bet");

  /* Phone for Carteira Móvel — initialized from profile */
  const [mobilePhone, setMobilePhone] = useState<string>("");
  useEffect(() => {
    if (profile?.phone) setMobilePhone(profile.phone.replace(/\D/g, ""));
  }, [profile?.phone]);

  /* Verified deposit txId (for crediting back on bet cancel) */
  const [verifiedDepositTxId, setVerifiedDepositTxId] = useState<string | null>(null);

  /* ── Sala Privada state ── */
  const [salaCode, setSalaCode]     = useState<string | null>(null);
  const [salaRoomId, setSalaRoomId] = useState<string | null>(null);
  const [salaInput, setSalaInput]   = useState("");
  const [salaError, setSalaError]   = useState("");
  const [salaLoading, setSalaLoading] = useState(false);
  const salaChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cancellingRef  = useRef(false);
  useEffect(() => () => {
    if (salaChannelRef.current) { supabase.removeChannel(salaChannelRef.current); salaChannelRef.current = null; }
  }, []);

  /* ── Recover abandoned sala on page load ── */
  useEffect(() => {
    if (!user?.id || !gameId) return;
    let alive = true;
    (async () => {
      try {
        const { data: rooms } = await supabase
          .from("game_rooms")
          .select("id, code, bet_amount, status")
          .eq("creator_id", user.id)
          .eq("game_type", gameId)
          .eq("status", "waiting")
          .order("created_at", { ascending: false })
          .limit(1);
        if (!alive || !rooms || rooms.length === 0) return;
        const room = rooms[0];
        const bet = Number(room.bet_amount);
        setSalaCode(room.code);
        setSalaRoomId(room.id);
        setSelectedBet(bet);
        const ch = supabase.channel(`sala:${room.code}`);
        ch.on("broadcast", { event: "joiner_ready" }, ({ payload }) => {
          supabase.removeChannel(ch); salaChannelRef.current = null;
          const gId   = payload.gameId as string;
          const jName = payload.joinerName as string;
          const myEnc  = encodeURIComponent(profile?.full_name ?? "Jogador");
          const oppEnc = encodeURIComponent(jName);
          try { sessionStorage.setItem(`wm_bet_deducted_ludo_${gId}`,  "1"); } catch {}
          try { sessionStorage.setItem(`wm_bet_deducted_damas_${gId}`, "1"); } catch {}
          try { sessionStorage.setItem(`wm_bet_deducted_chess_${gId}`, "1"); } catch {}
          setScreen("matched");
          let dest = "/";
          if (gameId === "ludo")   dest = `/ludo-jogo?gameId=${gId}&color=blue&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
          else if (gameId === "xadrez") dest = `/xadrez-jogo?gameId=${gId}&color=white&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
          else if (gameId === "damas")  dest = `/damas-jogo?gameId=${gId}&color=w&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
          setTimeout(() => setLocation(dest), 2200);
        });
        ch.subscribe();
        salaChannelRef.current = ch;
        setScreen("sala-aguardar");
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, gameId]);

  function generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function handleCriarSala() {
    if (!user?.id || !selectedBet || salaLoading) return;
    setSalaLoading(true); setSalaError("");
    try {
      const { data: pd } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
      const bal = parseFloat(String(pd?.balance ?? "0"));
      if (bal < selectedBet) { setSalaError("Saldo insuficiente."); setSalaLoading(false); return; }
      const code = generateRoomCode();
      await supabase.from("profiles").update({ balance: bal - selectedBet }).eq("id", user.id);
      await supabase.from("transactions").insert({
        user_id: user.id, type: "bet", amount: -selectedBet,
        description: `Sala privada (${gameId}) — código ${code}`, status: "approved",
      });
      const { data: room, error: rErr } = await supabase.from("game_rooms")
        .insert({ code, creator_id: user.id, game_type: gameId, bet_amount: selectedBet, status: "waiting" })
        .select("id").single();
      if (rErr || !room) {
        await supabase.from("profiles").update({ balance: bal }).eq("id", user.id);
        setSalaError("Erro ao criar sala. Tenta de novo."); setSalaLoading(false); return;
      }
      setSalaCode(code); setSalaRoomId(room.id);
      const ch = supabase.channel(`sala:${code}`);
      ch.on("broadcast", { event: "joiner_ready" }, ({ payload }) => {
        supabase.removeChannel(ch); salaChannelRef.current = null;
        const gId      = payload.gameId as string;
        const jName    = payload.joinerName as string;
        const myEnc    = encodeURIComponent(profile?.full_name ?? "Jogador");
        const oppEnc   = encodeURIComponent(jName);
        const bet      = selectedBet;
        try { sessionStorage.setItem(`wm_bet_deducted_ludo_${gId}`,  "1"); } catch {}
        try { sessionStorage.setItem(`wm_bet_deducted_damas_${gId}`, "1"); } catch {}
        try { sessionStorage.setItem(`wm_bet_deducted_chess_${gId}`, "1"); } catch {}
        setScreen("matched");
        let dest = "/";
        if (gameId === "ludo")   dest = `/ludo-jogo?gameId=${gId}&color=blue&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
        else if (gameId === "xadrez") dest = `/xadrez-jogo?gameId=${gId}&color=white&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
        else if (gameId === "damas")  dest = `/damas-jogo?gameId=${gId}&color=w&bet=${bet}&opp=${oppEnc}&myname=${myEnc}`;
        setTimeout(() => setLocation(dest), 2200);
      });
      ch.subscribe();
      salaChannelRef.current = ch;
      await refreshProfile?.();
      setSalaLoading(false);
      setScreen("sala-aguardar");
    } catch { setSalaError("Erro inesperado. Tenta de novo."); setSalaLoading(false); }
  }

  async function handleCancelarSala() {
    if (!user?.id || cancellingRef.current) return;
    cancellingRef.current = true;
    setSalaLoading(true);
    try {
      if (salaRoomId) {
        /* Delete first — only refund if delete succeeds and row was in "waiting" */
        const { data: room } = await supabase
          .from("game_rooms")
          .select("status, bet_amount")
          .eq("id", salaRoomId)
          .single();
        if (room?.status === "waiting") {
          const { error: delErr } = await supabase
            .from("game_rooms")
            .delete()
            .eq("id", salaRoomId)
            .eq("status", "waiting"); /* atomic guard — only deletes if still waiting */
          if (!delErr) {
            const { data: pd } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
            const refund = Number(room.bet_amount) || selectedBet || 0;
            await supabase.from("profiles").update({ balance: parseFloat(String(pd?.balance ?? "0")) + refund }).eq("id", user.id);
            await supabase.from("transactions").insert({
              user_id: user.id, type: "win", amount: refund,
              description: `Reembolso: sala cancelada (${gameId})`, status: "approved",
            });
            await refreshProfile?.();
          }
        }
      }
      if (salaChannelRef.current) { supabase.removeChannel(salaChannelRef.current); salaChannelRef.current = null; }
      setSalaCode(null); setSalaRoomId(null);
    } catch { /* ignore */ }
    cancellingRef.current = false;
    setSalaLoading(false);
    setScreen("bet");
  }

  async function handleEntrarSala() {
    if (!user?.id || !salaInput.trim() || salaLoading) return;
    setSalaLoading(true); setSalaError("");
    const code = salaInput.trim().toUpperCase();
    try {
      const { data: room } = await supabase.from("game_rooms").select("*").eq("code", code).eq("status", "waiting").maybeSingle();
      if (!room) { setSalaError("Sala não encontrada ou já preenchida."); setSalaLoading(false); return; }
      if (room.creator_id === user.id) { setSalaError("Não podes entrar na tua própria sala."); setSalaLoading(false); return; }
      if (room.game_type !== gameId) { setSalaError(`Esta sala é de ${room.game_type}. Muda o jogo.`); setSalaLoading(false); return; }
      if (Number(room.bet_amount) !== selectedBet) {
        setSalaError(`Esta sala tem aposta de ${room.bet_amount} MT. Seleciona esse valor.`);
        setSalaLoading(false); return;
      }
      const { data: pd } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
      const bal = parseFloat(String(pd?.balance ?? "0"));
      if (bal < Number(room.bet_amount)) { setSalaError("Saldo insuficiente."); setSalaLoading(false); return; }
      const gId = `sala_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await supabase.from("profiles").update({ balance: bal - Number(room.bet_amount) }).eq("id", user.id);
      await supabase.from("transactions").insert({
        user_id: user.id, type: "bet", amount: -Number(room.bet_amount),
        description: `Sala privada (${room.game_type}) — código ${code}`, status: "approved",
      });
      await supabase.from("game_rooms").update({ status: "matched", joiner_id: user.id }).eq("id", room.id);
      try { sessionStorage.setItem(`wm_bet_deducted_ludo_${gId}`,  "1"); } catch {}
      try { sessionStorage.setItem(`wm_bet_deducted_damas_${gId}`, "1"); } catch {}
      try { sessionStorage.setItem(`wm_bet_deducted_chess_${gId}`, "1"); } catch {}
      const joinerName = profile?.full_name ?? "Jogador";
      const ch = supabase.channel(`sala:${code}`);
      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.send({ type: "broadcast", event: "joiner_ready", payload: { gameId: gId, joinerName } });
          supabase.removeChannel(ch);
        }
      });
      await refreshProfile?.();
      const myEnc  = encodeURIComponent(joinerName);
      const oppEnc = encodeURIComponent("Adversário");
      let dest = "/";
      if (room.game_type === "ludo")   dest = `/ludo-jogo?gameId=${gId}&color=green&bet=${room.bet_amount}&opp=${oppEnc}&myname=${myEnc}`;
      else if (room.game_type === "xadrez") dest = `/xadrez-jogo?gameId=${gId}&color=black&bet=${room.bet_amount}&opp=${oppEnc}&myname=${myEnc}`;
      else if (room.game_type === "damas")  dest = `/damas-jogo?gameId=${gId}&color=b&bet=${room.bet_amount}&opp=${oppEnc}&myname=${myEnc}`;
      setSalaLoading(false);
      setScreen("matched");
      setTimeout(() => setLocation(dest), 2200);
    } catch { setSalaError("Erro ao entrar na sala. Tenta de novo."); setSalaLoading(false); }
  }

  /* Live player counts */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const liveOnline  = getSalaOnlineCount(tick);
  const livePlaying =
    getLivePlayerCount(0, tick) + getLivePlayerCount(1, tick) + getLivePlayerCount(2, tick);

  const canStart = selectedBet !== null;

  const handleStart = async () => {
    if (!canStart) return;

    if (payMethod === "carteira") {
      /* Carteira Móvel → PIN confirmation screen, no balance debit here (deducted in game) */
      setScreen("pin-confirmation");
      return;
    }

    /* Conta Poker → verify Supabase balance is sufficient */
    setScreen("processing");
    try {
      let freshBalance = 0;
      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user.id)
          .single();
        freshBalance = parseFloat(String(data?.balance ?? profile?.balance ?? "0"));
      } else {
        freshBalance = parseFloat(String(profile?.balance ?? "0"));
      }
      await new Promise(res => setTimeout(res, 1200));
      if (freshBalance < (selectedBet ?? 0)) {
        setScreen("rejected");
        return;
      }
      setScreen("matchmaking");
    } catch {
      await new Promise(res => setTimeout(res, 1200));
      const fallback = parseFloat(String(profile?.balance ?? "0"));
      if (fallback >= (selectedBet ?? 0)) {
        setScreen("matchmaking");
      } else {
        setScreen("rejected");
      }
    }
  };

  const recommendedGames = ALL_GAMES.filter(g => g.id !== gameId);

  /* ── Sala Menu ── */
  if (screen === "sala-menu") {
    const gameName = ALL_GAMES.find(g => g.id === gameId)?.name ?? gameId;
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", minHeight: "100vh", padding: "0 20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 48, paddingBottom: 28, borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
            <button onClick={() => setScreen("bet")} style={{ width: 36, height: 36, background: "none", border: "1px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#111" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#0a0a0a" }}>Sala Privada</p>
            <div style={{ width: 36 }} />
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px 18px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Jogo · Aposta</p>
              <p style={{ fontSize: 16, color: "#0a0a0a", fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{gameName} · {fmtMT(selectedBet ?? 0)}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            Joga com quem quiseres. Cria uma sala e partilha o código, ou entra num jogo com o código de um amigo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button onClick={() => { setSalaError(""); setScreen("sala-entrar"); }} style={{ width: "100%", height: 68, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", textAlign: "left" }}>
              <div style={{ width: 44, height: 44, background: "#f0fdf9", border: "1px solid rgba(0,212,180,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Hash style={{ width: 20, height: 20, color: "#00D4B4" }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#0a0a0a", marginBottom: 2 }}>Entrar numa Sala</p>
                <p style={{ fontSize: 12, color: "#9ca3af" }}>Tens um código? Entra no jogo do teu amigo.</p>
              </div>
            </button>
            <button onClick={() => { if (!selectedBet) return; setSalaError(""); handleCriarSala(); }} disabled={salaLoading || !selectedBet} style={{ width: "100%", height: 68, background: "#000", border: "none", cursor: salaLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", opacity: salaLoading ? 0.7 : 1, textAlign: "left" }}>
              <div style={{ width: 44, height: 44, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Users style={{ width: 20, height: 20, color: "#fff" }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 2 }}>{salaLoading ? "A criar sala…" : "Criar Sala"}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Gera um código e convida um amigo.</p>
              </div>
            </button>
          </div>
          {salaError ? <p style={{ marginTop: 14, fontSize: 13, color: "#ef4444", textAlign: "center" }}>{salaError}</p> : null}
        </div>
      </div>
    );
  }

  /* ── Sala Aguardar (creator waiting) ── */
  if (screen === "sala-aguardar") {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 40px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: 48, paddingBottom: 20, borderBottom: "1px solid #e5e7eb", marginBottom: 32 }}>
            <div style={{ width: 40 }} />
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#0a0a0a" }}>Sala Criada</p>
            <div style={{ width: 40 }} />
          </div>
          <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }}
            style={{ width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${VIOLET}55, transparent 70%)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Users style={{ width: 36, height: 36, color: VIOLET }} />
          </motion.div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>Partilha este código com o teu amigo</p>
          <div style={{ background: "#1c1c1e", border: `2px solid ${VIOLET}66`, borderRadius: 20, padding: "20px 28px", marginBottom: 12, width: "100%" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 36, color: "#fff", letterSpacing: 8 }}>{salaCode}</p>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>O código expira em 30 minutos · Aposta: {fmtMT(selectedBet ?? 0)}</p>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D4B4" }} />
            <p style={{ fontSize: 13, color: "#00D4B4" }}>À espera que o teu amigo entre…</p>
          </motion.div>
          <button onClick={handleCancelarSala} disabled={salaLoading} style={{ width: "100%", height: 52, borderRadius: 99, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: salaLoading ? "wait" : "pointer" }}>
            {salaLoading ? "A cancelar…" : "Cancelar e Devolver Aposta"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Sala Entrar (join with code) ── */
  if (screen === "sala-entrar") {
    return (
      <div style={{ minHeight: "100vh", background: "#080810", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", minHeight: "100vh", padding: "0 20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 48, paddingBottom: 28 }}>
            <button onClick={() => { setSalaError(""); setScreen("sala-menu"); }} style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c1c1e", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>Entrar na Sala</p>
            <div style={{ width: 40 }} />
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.6 }}>
            Insere o código de 6 caracteres que o teu amigo te enviou.
          </p>
          <input
            value={salaInput}
            onChange={e => setSalaInput(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="XXXXXX"
            maxLength={6}
            style={{ width: "100%", height: 64, borderRadius: 18, background: "#1c1c1e", border: `1.5px solid ${salaError ? "#f87171" : "#3a3a3c"}`, color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 28, textAlign: "center", letterSpacing: 10, outline: "none", boxSizing: "border-box" }}
          />
          {salaError ? <p style={{ marginTop: 10, fontSize: 13, color: "#f87171", textAlign: "center" }}>{salaError}</p> : null}
          <div style={{ flex: 1 }} />
          <button
            onClick={handleEntrarSala}
            disabled={salaInput.length !== 6 || salaLoading || !selectedBet}
            style={{ width: "100%", height: 60, borderRadius: 99, background: salaInput.length === 6 && selectedBet ? `linear-gradient(135deg, ${VIOLET}, #5b21b6)` : "#1c1c1e", border: "none", color: salaInput.length === 6 && selectedBet ? "#fff" : "#52525b", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, cursor: salaInput.length === 6 && !salaLoading && selectedBet ? "pointer" : "not-allowed", marginTop: 24 }}>
            {salaLoading ? "A entrar…" : "Entrar na Sala"}
          </button>
        </div>
      </div>
    );
  }

  /* ── SMS Wallet Confirmation ── */
  if (screen === "pin-confirmation") {
    return (
      <SMSBettingScreen
        amount={selectedBet ?? 0}
        userPhone={mobilePhone}
        onCancel={() => { setVerifiedDepositTxId(null); setScreen("bet"); }}
        onSuccess={(txId) => { setVerifiedDepositTxId(txId ?? null); setScreen("matchmaking"); }}
      />
    );
  }

  /* ── Processing (Conta Poker) ── */
  if (screen === "processing") return <ProcessingScreen />;

  /* ── Rejected ── */
  if (screen === "rejected") {
    return (
      <RejectedScreen
        amount={selectedBet ?? 0}
        balance={parseFloat(String(profile?.balance ?? "0")) || 0}
        onRetry={() => setScreen("bet")}
        onRecharge={() => setLocation("/recarga")}
      />
    );
  }

  /* ── Matchmaking ── */
  if (screen === "matchmaking") {
    return (
      <MatchmakingScreen
        onCancel={() => {
          setVerifiedDepositTxId(null);
          setScreen("bet");
        }}
        onMatched={(gId, color, oppName) => {
          setScreen("matched");
          const myEnc  = encodeURIComponent(profile?.full_name ?? "Jogador");
          const oppEnc = encodeURIComponent(oppName);
          let dest = "/";
          if (gameId === "ludo" || gameId === "ludo-classic") {
            dest = `/ludo-jogo?gameId=${gId}&color=${color}&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}`;
          } else if (gameId === "xadrez") {
            const chessColor = color === "blue" ? "white" : "black";
            dest = `/xadrez-jogo?gameId=${gId}&color=${chessColor}&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}`;
          } else if (gameId === "damas") {
            const damasColor = color === "blue" ? "w" : "b";
            dest = `/damas-jogo?gameId=${gId}&color=${damasColor}&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}`;
          }
          setTimeout(() => setLocation(dest), 2200);
        }}
        onBotMatch={(botName, botBalance) => {
          setScreen("matched");
          const myEnc  = encodeURIComponent(profile?.full_name ?? "Jogador");
          const oppEnc = encodeURIComponent(botName);
          const botGameId = `bot_${Date.now()}`;
          let dest: string;
          if (gameId === "xadrez") {
            dest = `/xadrez-jogo?gameId=${botGameId}&color=white&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}&bot=1&botbalance=${botBalance}`;
          } else {
            dest = `/damas-jogo?gameId=${botGameId}&color=w&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}&bot=1&botbalance=${botBalance}`;
          }
          setTimeout(() => setLocation(dest), 2200);
        }}
        userId={user?.id ?? ""}
        displayName={profile?.full_name ?? "Jogador"}
        betAmount={selectedBet ?? 0}
        gameType={gameId}
      />
    );
  }

  /* ── Timeout ── */
  if (screen === "timeout") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#fff" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-6 border-b border-slate-100">
            <button onClick={() => setScreen("bet")}
              style={{ width: 36, height: 36, background: "none", border: "1px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#111" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#0a0a0a" }}>Sem Adversário</p>
            <div className="w-9" />
          </div>
          <div className="flex flex-col items-center pt-10 pb-6">
            <div className="w-20 h-20 flex items-center justify-center mb-5"
              style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
              <Clock style={{ width: 36, height: 36, color: "#9ca3af" }} />
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#0a0a0a",
              marginBottom: 10, textAlign: "center" }}>Tempo Esgotado</p>
            <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.65, textAlign: "center",
              maxWidth: 280, marginBottom: 28 }}>
              Não foi possível encontrar um adversário. O teu valor de{" "}
              <span style={{ color: "#111", fontWeight: 700 }}>{fmtMT(selectedBet ?? 0)}</span>{" "}
              foi devolvido à tua conta.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "#f0fdf4", border: "1px solid #86efac", marginBottom: 36 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: "#22c55e" }} />
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Valor devolvido com sucesso</span>
            </div>
            <button onClick={() => setScreen("bet")}
              className="w-full h-14 flex items-center justify-center gap-2"
              style={{ background: "#000", color: "#fff",
                fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
                maxWidth: 340, cursor: "pointer", border: "none" }}>
              <RotateCcw style={{ width: 17, height: 17 }} /> Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Matched ── */
  if (screen === "matched") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#F4F6FB" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center",
            padding: "0 32px", width: "100%", maxWidth: 400 }}>

          {/* Icon card */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.06, type: "spring", stiffness: 320, damping: 24 }}
            style={{ width: 100, height: 100, borderRadius: 30, marginBottom: 32, background: "#fff",
              boxShadow: "0 6px 36px rgba(34,197,94,0.18), 0 2px 8px rgba(0,0,0,0.06)",
              border: "2px solid rgba(34,197,94,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 50, height: 50, color: "#22c55e" }} strokeWidth={2.2}/>
          </motion.div>

          {/* Heading */}
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 26,
              color: "#0D0D0D", marginBottom: 8, textAlign: "center" }}>
            Partida Encontrada!
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }}
            style={{ fontSize: 13.5, color: "#64748B", marginBottom: 40, textAlign: "center", lineHeight: 1.6 }}>
            A preparar o tabuleiro…
          </motion.p>

          {/* Pulsing dots loader */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }}
            style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.35, 1, 0.35] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.22 }}
                style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e" }}/>
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     Bet Screen
  ══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#fff" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0 border-b border-slate-100">
          <button onClick={() => window.history.back()}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{ border: "1px solid #e5e7eb", background: "none", borderRadius: 0, cursor: "pointer" }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#111" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#0a0a0a" }}>Fazer Aposta</p>
          <div className="w-9" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10" style={{ scrollbarWidth: "none" }}>

          {/* Game Info Card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px",
              background: "#fff", marginBottom: 16, marginTop: 16,
              border: "1px solid #e5e7eb", position: "relative" }}>
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 4,
              background: "#f8fafc", borderRadius: 99, padding: "4px 9px", border: "1px solid #e5e7eb" }}>
              <Star style={{ width: 11, height: 11, color: "#f59e0b", fill: "#f59e0b" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{game.rating}</span>
            </div>
            <div style={{ width: 86, height: 86, overflow: "hidden",
              flexShrink: 0, background: game.cardBg || "#f1f5f9" }}>
              <img src={game.image} alt={game.name}
                style={{ width: "100%", height: "100%",
                  objectFit: (game.imageFit as any) || "cover", objectPosition: game.imagePos }} />
            </div>
            <div className="flex-1 min-w-0" style={{ paddingRight: 52 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 20,
                color: "#0a0a0a", letterSpacing: "1px", marginBottom: 2 }}>{game.name}</p>
              <p style={{ fontSize: 12, color: VIOLET, fontWeight: 600, marginBottom: 6 }}>{game.sub}</p>
              <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>{game.description}</p>
            </div>
          </motion.div>

          {/* Live Stats */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            {[
              { icon: <Users   style={{ width: 15, height: 15, color: "#374151" }} />, count: liveOnline.toLocaleString("pt-PT"),  label: "Jogadores online" },
              { icon: <Gamepad2 style={{ width: 15, height: 15, color: "#374151" }} />, count: livePlaying.toLocaleString("pt-PT"), label: "Jogando agora" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb",
                padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{stat.icon}</div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#0a0a0a", lineHeight: 1.1 }}>{stat.count}</p>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Bet Amounts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.4 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#374151",
              letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Valor da Aposta</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              {BET_AMOUNTS.slice(0, 4).map(amt => {
                const active = selectedBet === amt;
                return (
                  <motion.button key={amt} onClick={() => setSelectedBet(active ? null : amt)}
                    whileTap={{ scale: 0.94 }}
                    style={{ height: 46,
                      border: active ? "1.5px solid #000" : "1.5px solid #e5e7eb",
                      background: active ? "#000" : "#fff",
                      cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12.5,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 1, transition: "all 0.2s" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#fff" : "#374151" }}>{amt}</span>
                    <span style={{ fontSize: 9, color: active ? "rgba(255,255,255,0.6)" : "#9ca3af", letterSpacing: "0.5px" }}>MT</span>
                  </motion.button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
              {BET_AMOUNTS.slice(4).map(amt => {
                const active = selectedBet === amt;
                return (
                  <motion.button key={amt} onClick={() => setSelectedBet(active ? null : amt)}
                    whileTap={{ scale: 0.94 }}
                    style={{ height: 46,
                      border: active ? "1.5px solid #000" : "1.5px solid #e5e7eb",
                      background: active ? "#000" : "#fff",
                      cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12.5,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 1, transition: "all 0.2s" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: active ? "#fff" : "#374151" }}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </span>
                    <span style={{ fontSize: 9, color: active ? "rgba(255,255,255,0.6)" : "#9ca3af", letterSpacing: "0.5px" }}>MT</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Game Mode */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }} style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#374151",
              letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Modo de Jogo</p>
            <SegmentedToggle
              value={gameMode}
              onChange={(v) => { if (v === "squad") return; setGameMode(v as GameMode); }}
              options={[
                { value: "solo",  label: "1VS1 Solo",     icon: <Swords style={{ width: 14, height: 14 }} /> },
                { value: "squad", label: "2VS2 Em Breve", icon: <Users  style={{ width: 14, height: 14 }} /> },
              ]}
            />
          </motion.div>

          {/* Payment Method */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.4 }} style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#374151",
              letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Método de Pagamento</p>
            <SegmentedToggle
              value={payMethod}
              onChange={(v) => setPayMethod(v as PayMethod)}
              options={[
                { value: "carteira", label: "Carteira Móvel", icon: <Smartphone style={{ width: 14, height: 14 }} /> },
                { value: "poker",    label: "Conta Poker",    icon: <CreditCard  style={{ width: 14, height: 14 }} /> },
              ]}
            />

            {/* Ad banner below payment toggle */}
            <div style={{ marginTop: 12 }}>
              <AdBanner />
            </div>
          </motion.div>

          {/* Start Button */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }} style={{ marginBottom: 32 }}>
            <motion.button onClick={handleStart} disabled={!canStart}
              whileTap={canStart ? { scale: 0.97 } : {}}
              style={{
                width: "100%", height: 58,
                border: canStart ? "none" : "1.5px solid #e5e7eb",
                cursor: canStart ? "pointer" : "not-allowed",
                background: canStart ? "#000" : "#f8fafc",
                color: canStart ? "#fff" : "#9ca3af",
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 18px", transition: "all 0.25s",
                letterSpacing: "0.4px", borderRadius: 0,
              }}>
              {canStart ? (
                <>
                  <div style={{ width: 36, height: 36, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)" }}>
                    <Swords style={{ width: 16, height: 16, color: "#fff" }} />
                  </div>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 800, letterSpacing: "0.5px" }}>
                    COMEÇAR PARTIDA
                  </span>
                  <div style={{ background: "rgba(255,255,255,0.12)", padding: "6px 12px", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                      {fmtMT(selectedBet!)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 36, height: 36, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                    border: "1px solid #e5e7eb" }}>
                    <Zap style={{ width: 16, height: 16, color: "#d1d5db" }} />
                  </div>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 13.5 }}>Escolhe o valor da aposta</span>
                  <div style={{ width: 36 }} />
                </>
              )}
            </motion.button>
            {!canStart && (
              <p style={{ textAlign: "center", fontSize: 11.5, color: "#9ca3af", marginTop: 8 }}>
                Seleciona um valor de aposta para continuar
              </p>
            )}
          </motion.div>

  
          {/* Recommended Games */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#0a0a0a" }}>Jogos Recomendados</p>
              <Trophy style={{ width: 14, height: 14, color: "#374151" }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {recommendedGames.map(g => (
                <Link key={g.id} href={g.id === "roleta" ? "/roleta" : `/apostar/${g.id}`}>
                  <motion.div whileTap={{ scale: 0.96 }}
                    style={{ minWidth: 110, background: "#fff",
                      overflow: "hidden", border: "1px solid #e5e7eb", cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ height: 72, overflow: "hidden", position: "relative" }}>
                      <img src={g.image} alt={g.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.imagePos }} />
                      <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)" }} />
                      <div style={{ position: "absolute", bottom: 6, left: 8,
                        display: "flex", alignItems: "center", gap: 3 }}>
                        <Star style={{ width: 9, height: 9, color: "#f59e0b", fill: "#f59e0b" }} />
                        <span style={{ fontSize: 9.5, color: "#fff", fontWeight: 700 }}>{g.rating}</span>
                      </div>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11.5, color: "#0a0a0a", marginBottom: 2 }}>{g.name}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af" }}>{g.players} jogando</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
