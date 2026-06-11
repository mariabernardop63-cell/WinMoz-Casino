import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation, Link } from "wouter";
import {
  ChevronLeft, Star, Wifi, Gamepad2, Zap, Trophy,
  XCircle, RotateCcw, AlertTriangle, Swords, Users,
  CreditCard, Smartphone, CheckCircle2, Clock, X, Pencil, Phone, Copy,
} from "lucide-react";
import { supabase, getSessionWithRefresh, isSessionExpiredError } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getLivePlayerCount, getSalaOnlineCount } from "@/lib/simulation";
import { API_BASE } from "@/lib/apiBase";

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
    name: "DAMAS",
    sub: "Jogo de Tabuleiro",
    description: "Elimina todas as peças do adversário com movimentos estratégicos no tabuleiro clássico.",
    image: "/damas-card.jpg",
    imagePos: "center",
    rating: "4.8",
    online: 3847,
    playing: 2412,
  },
  ludo: {
    name: "LUDO",
    sub: "Jogo de Dados",
    description: "Corrida épica de peças. Leva todas ao centro antes do adversário com dados e estratégia.",
    image: "/ludo-card2.png",
    imagePos: "center 65%",
    rating: "4.9",
    online: 6124,
    playing: 4118,
  },
  xadrez: {
    name: "XADREZ",
    sub: "Estratégia Real",
    description: "O jogo eterno da inteligência. Controla o tabuleiro e dá Xeque-Mate ao adversário.",
    image: "/xadrez-card.jpg",
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
  image: "/damas-card.jpg",
  imagePos: "center",
  rating: "4.8",
  online: 2500,
  playing: 1800,
};

const BET_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];

const ALL_GAMES = [
  { id: "damas",  name: "Damas",  image: "/damas-card.jpg",   imagePos: "center",     rating: "4.8", players: "2.4K" },
  { id: "ludo",   name: "Ludo",   image: "/ludo-card2.png",   imagePos: "center 65%", rating: "4.9", players: "4.1K" },
  { id: "xadrez", name: "Xadrez", image: "/xadrez-card.jpg",  imagePos: "center 30%", rating: "4.7", players: "1.2K" },
  { id: "bilhar", name: "Bilhar", image: "/bilhar-card.webp", imagePos: "center",     rating: "4.6", players: "890"  },
  { id: "roleta", name: "Roleta", image: "/roleta-card.jpg",  imagePos: "center",     rating: "4.5", players: "1.5K" },
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
type Screen    = "bet" | "processing" | "rejected" | "matchmaking" | "matched" | "timeout" | "pin-confirmation";

/* ── Processing Screen (Conta Poker only) ── */
function ProcessingScreen() {
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
        <motion.div className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}>
          <div className="relative flex items-center justify-center mb-10" style={{ width: 120, height: 120 }}>
            {[1, 0.7, 0.45].map((scale, i) => (
              <motion.div key={i}
                animate={{ scale: [scale, scale + 0.18, scale], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: "easeOut" }}
                style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%",
                  border: `1.5px solid ${VIOLET}`, transformOrigin: "center" }} />
            ))}
            <div style={{ width: 72, height: 72, borderRadius: "50%",
              background: `linear-gradient(135deg, ${VIOLET}22, ${VIOLET}44)`,
              border: `1.5px solid ${VIOLET}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%",
                border: `3px solid ${VIOLET}33`, borderTopColor: VIOLET }} className="animate-spin" />
            </div>
          </div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff",
              marginBottom: 10, textAlign: "center" }}>
            A verificar saldo…
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            style={{ fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.6, maxWidth: 260 }}>
            A validar o saldo da tua Conta Poker. Este processo é rápido e seguro.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              background: "rgba(124,58,237,0.12)", borderRadius: 99, border: `1px solid ${VIOLET}33` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 11, color: VIOLET, fontWeight: 600, letterSpacing: "0.5px" }}>PROCESSAMENTO SEGURO</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Manual Betting Screen (Carteira Móvel) ── */
function SMSBettingScreen({
  amount, onCancel, onSuccess, userPhone: initialPhone,
}: {
  amount: number;
  onCancel: () => void;
  onSuccess: (txId: string | null) => void;
  userPhone?: string;
}) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"info" | "processing" | "rejected">("info");
  const [confirmMsg, setConfirmMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mpesaNum, setMpesaNum] = useState("848519858");
  const [emolaNum, setEmolaNum] = useState("869189457");
  const [mpesaName, setMpesaName] = useState("Celso Cristiano");
  const [emolaName, setEmolaName] = useState("Celso Cristiano");

  useEffect(() => {
    const fetchPaySettings = async () => {
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          fetch("/api/admin/settings/get?key=sms_mpesa_number"),
          fetch("/api/admin/settings/get?key=sms_emola_number"),
          fetch("/api/admin/settings/get?key=sms_mpesa_name"),
          fetch("/api/admin/settings/get?key=sms_emola_name"),
        ]);
        const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()]);
        if (d1?.setting?.value) setMpesaNum(d1.setting.value);
        if (d2?.setting?.value) setEmolaNum(d2.setting.value);
        if (d3?.setting?.value) setMpesaName(d3.setting.value);
        if (d4?.setting?.value) setEmolaName(d4.setting.value);
      } catch { /* use defaults */ }
    };
    fetchPaySettings();
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const copyNum = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleContinuar = async () => {
    if (!confirmMsg.trim()) { setError("Introduz a mensagem de confirmação da transferência"); return; }
    setError("");
    setStep("processing");

    try {
      const session = await getSessionWithRefresh();
      if (!session) {
        setError("Sessão expirada. Volta a entrar na tua conta.");
        setStep("info");
        setLocation("/login");
        return;
      }

      const { data: txRow, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: session.user.id,
          type: "manual_bet",
          amount,
          description: JSON.stringify({
            confirmationMsg: confirmMsg.trim(),
            phone: initialPhone ?? "",
            mode: "bet",
          }),
          status: "pending",
        })
        .select("id")
        .single();

      if (txError || !txRow) {
        console.error("[Apostar] Supabase insert error:", txError);
        if (isSessionExpiredError(txError)) {
          await supabase.auth.signOut();
          setError("Sessão expirada. Volta a entrar na tua conta.");
          setStep("info");
          setLocation("/login");
          return;
        }
        const msg = txError?.message ? `Erro: ${txError.message}` : "Erro ao enviar pedido. Tenta de novo.";
        setError(msg);
        setStep("info");
        return;
      }

      const pid = (txRow as any).id as string;
      let count = 0;
      pollRef.current = setInterval(async () => {
        count++;
        try {
          const { data: pollData } = await supabase
            .from("transactions")
            .select("status")
            .eq("id", pid)
            .single();
          const status = (pollData as any)?.status as string | undefined;
          if (status === "approved") {
            clearInterval(pollRef.current!);
            onSuccess(null);
          } else if (status === "rejected") {
            clearInterval(pollRef.current!);
            setStep("rejected");
          }
          // "pending" → keep polling
          if (count >= 600) { clearInterval(pollRef.current!); setStep("rejected"); }
        } catch {
          if (count >= 600) { clearInterval(pollRef.current!); setStep("rejected"); }
        }
      }, 3000);
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        await supabase.auth.signOut().catch(() => {});
        setError("Sessão expirada. Volta a entrar na tua conta.");
        setLocation("/login");
      } else {
        setError("Erro de ligação. Tenta de novo.");
      }
      setStep("info");
    }
  };

  if (step === "processing") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
        <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
          <motion.div className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}>
            <div className="relative flex items-center justify-center mb-10" style={{ width: 120, height: 120 }}>
              {[1, 0.7, 0.45].map((scale, i) => (
                <motion.div key={i}
                  animate={{ scale: [scale, scale + 0.18, scale], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: "easeOut" }}
                  style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%",
                    border: `1.5px solid ${CYAN}`, transformOrigin: "center" }} />
              ))}
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: `rgba(0,212,180,0.08)`,
                border: `1.5px solid ${CYAN}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `3px solid ${CYAN}33`, borderTopColor: CYAN }} className="animate-spin" />
              </div>
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff",
              marginBottom: 10, textAlign: "center" }}>
              A processar pedido…
            </p>
            <p style={{ fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
              O teu pedido foi enviado à equipa WinMoz. Aguarda a confirmação — normalmente demora apenas alguns minutos.
            </p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                background: `rgba(0,212,180,0.12)`, borderRadius: 99, border: `1px solid ${CYAN}33` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN }} className="animate-pulse" />
              <span style={{ fontSize: 11, color: CYAN, fontWeight: 600, letterSpacing: "0.5px" }}>A AGUARDAR APROVAÇÃO</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === "rejected") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-6">
            <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Pedido Rejeitado</p>
            <div className="w-10" />
          </div>
          <motion.div className="flex flex-col items-center pt-4 mb-8"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl mb-6"
              style={{ background: "linear-gradient(135deg, #c0392b, #e74c3c)" }}>
              <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
            <p style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 600, textAlign: "center", fontFamily: "'Syne', sans-serif" }}>
              Pedido não aprovado
            </p>
            <p style={{ fontSize: 13, color: "#71717a", textAlign: "center", marginTop: 8, lineHeight: 1.6, maxWidth: 260 }}>
              A tua transferência não foi validada pela equipa. Verifica os dados e tenta novamente.
            </p>
          </motion.div>
          <div className="flex flex-col gap-3 mt-auto pb-10">
            <button onClick={() => { setConfirmMsg(""); setError(""); setStep("info"); }}
              className="w-full h-14 rounded-full font-bold flex items-center justify-center gap-2"
              style={{ background: CYAN, color: "#000", fontFamily: "'Syne', sans-serif" }}>
              <RotateCcw style={{ width: 18, height: 18 }} /> Tentar Novamente
            </button>
            <button onClick={onCancel}
              className="w-full h-14 rounded-full"
              style={{ background: "#1c1c1e", color: "#8e8e93", fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>
              Cancelar Aposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#1c1c1e" }}>
            <X style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>
            Carteira Móvel
          </p>
          <div className="w-10" />
        </div>

        <div className="flex-1 px-5 pb-10 overflow-y-auto">
          {/* Amount badge */}
          <div className="flex items-center justify-center mb-5">
            <div className="px-5 py-2 rounded-full" style={{ background: "#1c1c1e", border: `1.5px solid ${CYAN}22` }}>
              <span style={{ fontSize: 13, color: "#8e8e93" }}>Aposta: </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: CYAN }}>{fmtMT(amount)} MZN</span>
            </div>
          </div>

          {/* Notice */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: "linear-gradient(135deg, #1a1a0a, #18180f)", border: "1.5px solid #f59e0b55" }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.2)" }}>
                <AlertTriangle style={{ width: 17, height: 17, color: "#f59e0b" }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#f59e0b", marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>
                  Apostas instantâneas desativadas
                </p>
                <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.65 }}>
                  De momento, as apostas com Carteira Móvel requerem uma transferência manual. A nossa equipa valida e confirma em poucos minutos.
                </p>
              </div>
            </div>
            <div className="mt-1 pt-3" style={{ borderTop: "1px solid #f59e0b22" }}>
              <p style={{ fontSize: 11.5, color: "#d97706", lineHeight: 1.6, fontWeight: 500 }}>
                ✦ Transfere exactamente {fmtMT(amount)} MZN para um dos números abaixo, depois cola a mensagem de confirmação.
              </p>
            </div>
          </div>

          {/* M-Pesa */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: "#1c1c1e", border: "1px solid #2c2c2e" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(231,76,60,0.15)" }}>
                  <Smartphone style={{ width: 19, height: 19, color: "#e74c3c" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#e74c3c", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>M-Pesa</p>
                  <p style={{ fontWeight: 800, color: "#fff", fontFamily: "system-ui", fontSize: 17, letterSpacing: "0.5px" }}>
                    +258 {mpesaNum.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                  </p>
                  <p style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{mpesaName}</p>
                </div>
              </div>
              <button onClick={() => copyNum(`+258${mpesaNum}`, "mpesa")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: copied === "mpesa" ? "rgba(0,212,180,0.2)" : "#2c2c2e",
                  color: copied === "mpesa" ? CYAN : "#8e8e93", cursor: "pointer" }}>
                {copied === "mpesa" ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                <span style={{ fontSize: 12, fontWeight: 600 }}>{copied === "mpesa" ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* e-Mola */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: "#1c1c1e", border: "1px solid #2c2c2e" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(52,211,153,0.15)" }}>
                  <Smartphone style={{ width: 19, height: 19, color: "#34d399" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>e-Mola</p>
                  <p style={{ fontWeight: 800, color: "#fff", fontFamily: "system-ui", fontSize: 17, letterSpacing: "0.5px" }}>
                    +258 {emolaNum.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
                  </p>
                  <p style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{emolaName}</p>
                </div>
              </div>
              <button onClick={() => copyNum(`+258${emolaNum}`, "emola")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: copied === "emola" ? "rgba(0,212,180,0.2)" : "#2c2c2e",
                  color: copied === "emola" ? CYAN : "#8e8e93", cursor: "pointer" }}>
                {copied === "emola" ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                <span style={{ fontSize: 12, fontWeight: 600 }}>{copied === "emola" ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* Confirmation message */}
          <div className="mb-6">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#636366", textTransform: "uppercase",
              letterSpacing: "0.6px", marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>
              Mensagem de Confirmação
            </p>
            <div className="rounded-2xl overflow-hidden" style={{
              background: "#1c1c1e",
              border: confirmMsg.trim() ? `1.5px solid ${CYAN}` : "1.5px solid #2c2c2e",
              transition: "border-color 0.2s",
            }}>
              <textarea
                value={confirmMsg}
                onChange={e => { setConfirmMsg(e.target.value); setError(""); }}
                placeholder="Cola aqui a mensagem SMS de confirmação M-Pesa ou e-Mola após a transferência…"
                rows={4}
                style={{ width: "100%", background: "transparent", outline: "none", padding: 16,
                  fontSize: 13, color: "#fff", caretColor: CYAN, lineHeight: 1.6,
                  resize: "none", fontFamily: "system-ui" }}
              />
              {confirmMsg.trim() && (
                <div className="flex items-center justify-between px-4 pb-3">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN }} className="animate-pulse" />
                    <span style={{ fontSize: 11, color: CYAN, fontWeight: 600 }}>Mensagem detectada</span>
                  </div>
                  <button onClick={() => setConfirmMsg("")}
                    style={{ fontSize: 11, color: "#636366", background: "#2c2c2e",
                      padding: "3px 10px", borderRadius: 8, border: "none", cursor: "pointer" }}>
                    Limpar
                  </button>
                </div>
              )}
            </div>
            {error && <p style={{ fontSize: 12, color: "#e74c3c", marginTop: 6 }}>⚠ {error}</p>}
          </div>

          {/* Continue button */}
          <motion.button
            onClick={handleContinuar}
            disabled={!confirmMsg.trim()}
            whileTap={confirmMsg.trim() ? { scale: 0.97 } : {}}
            style={{
              width: "100%", height: 58, borderRadius: 99, fontWeight: 800, fontSize: 15,
              background: confirmMsg.trim() ? `linear-gradient(135deg, ${CYAN}, #00b89c)` : "#1c1c1e",
              color: confirmMsg.trim() ? "#000" : "#3a3a3c",
              fontFamily: "'Syne', sans-serif", border: "none",
              cursor: confirmMsg.trim() ? "pointer" : "default",
              transition: "background 0.2s",
              boxShadow: confirmMsg.trim() ? `0 8px 24px ${CYAN}44` : "none",
            }}>
            Continuar
          </motion.button>
        </div>
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
  const [botOffered, setBotOffered] = useState(false);
  const [botInfo, setBotInfo] = useState<{ name: string; balance: number } | null>(null);
  const matchedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const BOT_ELIGIBLE = gameType === "damas" && [10, 20, 50].includes(betAmount);

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
        // Announce immediately and start the periodic re-announce ONLY after subscribed
        setTimeout(announcePresence, 100);
        if (!poll && !matchedRef.current) {
          poll = setInterval(announcePresence, 2500);
        }
      }
    });

    return () => {
      if (poll) { clearInterval(poll); poll = null; }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (found) return;
    if (remaining <= 0) { onCancel(); return; }
    if (BOT_ELIGIBLE && !botOffered && (TOTAL - remaining) >= 45) {
      const info = pickBotInfo();
      setBotInfo(info);
      setBotOffered(true);
    }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, found]);

  const mins     = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs     = String(remaining % 60).padStart(2, "0");
  const progress = ((TOTAL - remaining) / TOTAL) * 100;

  if (found) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#080810" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 32px", width: "100%", maxWidth: 400 }}>

          {/* Success badge */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 22 }}
            style={{ width: 88, height: 88, borderRadius: "50%", marginBottom: 28,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 12px rgba(34,197,94,0.12), 0 8px 32px rgba(34,197,94,0.4)" }}>
            <CheckCircle2 style={{ width: 44, height: 44, color: "#fff" }} strokeWidth={2.5}/>
          </motion.div>

          {/* Title */}
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 26,
            color: "#fff", marginBottom: 6, textAlign: "center", whiteSpace: "nowrap" }}>
            Adversário Encontrado!
          </p>
          <p style={{ fontSize: 13.5, color: "#71717a", marginBottom: 32, textAlign: "center" }}>
            A sincronizar os jogadores…
          </p>

          {/* Players bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, width: "100%",
            background: "#131320", borderRadius: 20, padding: "18px 24px",
            border: "1px solid #1e1e3a", marginBottom: 28 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%",
                background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 18px ${VIOLET}44` }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#fff" }}>
                  {displayName.charAt(0).toUpperCase() || "T"}
                </span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#a1a1aa", maxWidth: 80,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                Tu
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 18,
                color: "#fff", letterSpacing: "2px", textShadow: `0 0 20px ${VIOLET}88` }}>VS</span>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} className="animate-pulse"/>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%",
                background: "linear-gradient(135deg, #1c1c2e, #2c2c3e)",
                border: "2px solid #3c3c4e",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 style={{ width: 22, height: 22, color: "#22c55e" }}/>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#22c55e" }}>
                Pronto
              </span>
            </div>
          </div>

          {/* Loading indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%",
              border: "2.5px solid rgba(34,197,94,0.25)", borderTopColor: "#22c55e" }}
              className="animate-spin"/>
            <span style={{ fontSize: 12.5, color: "#52525b" }}>A iniciar o jogo…</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-4">
          <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#1c1c1e" }}>
            <X style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>A Procurar Adversário</p>
          <div className="w-10" />
        </div>

        <motion.div className="flex flex-col items-center pt-6 pb-8"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="relative" style={{ width: 88, height: 88, marginBottom: 12 }}>
            <svg width={88} height={88} style={{ position: "absolute", inset: 0 }}>
              <circle cx={44} cy={44} r={38} fill="none" stroke="#1c1c1e" strokeWidth={5} />
              <motion.circle cx={44} cy={44} r={38} fill="none"
                stroke={remaining < 30 ? "#e74c3c" : VIOLET}
                strokeWidth={5} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - progress / 100)}
                transform="rotate(-90 44 44)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18,
                color: remaining < 30 ? "#e74c3c" : "#fff", lineHeight: 1 }}>{mins}:{secs}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: VIOLET }} />
            <span style={{ fontSize: 12, color: "#71717a", letterSpacing: "0.5px" }}>A procurar em tempo real</span>
          </div>
        </motion.div>

        <motion.div className="flex items-center justify-center gap-6 py-8"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 18 }}>
          <div className="flex flex-col items-center gap-2">
            <div style={{ width: 80, height: 80, borderRadius: "50%",
              background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`,
              border: `3px solid ${VIOLET}66`, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", boxShadow: `0 0 28px ${VIOLET}44` }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>
                {displayName.charAt(0).toUpperCase() || "E"}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600 }}>Tu</span>
          </div>
          <div className="flex flex-col items-center">
            <motion.div animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 26, color: "#fff",
                letterSpacing: "2px", textShadow: `0 0 24px ${VIOLET}88` }}>
              VS
            </motion.div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div style={{ position: "relative", width: 80, height: 80 }}>
              <motion.div animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px dashed #71717a" }} />
              <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "#1c1c1e",
                border: "1px solid #2c2c2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%",
                  border: "2.5px solid #71717a33", borderTopColor: "#71717a" }} className="animate-spin" />
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600 }}>Adversário</span>
          </div>
        </motion.div>

        <motion.div className="flex flex-col items-center gap-3 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
            background: "rgba(124,58,237,0.1)", borderRadius: 99, border: `1px solid ${VIOLET}33` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 12, color: VIOLET, fontWeight: 600 }}>A procurar jogadores com o mesmo valor…</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#52525b", textAlign: "center", lineHeight: 1.6 }}>
            Se nenhum adversário for encontrado em {mins}:{secs}, o teu valor será devolvido automaticamente.
          </p>
        </motion.div>

        {/* Bot offer — shown after 45s for eligible damas bets */}
        {botOffered && botInfo && !found && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ margin: "8px 20px 0",
              background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(109,40,217,0.12))",
              borderRadius: 20, border: `1.5px solid ${VIOLET}44`, padding: "18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                🤖
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13.5, color: "#fff", marginBottom: 2 }}>
                  Sem adversário após 45s
                </p>
                <p style={{ fontSize: 11.5, color: "#71717a" }}>Queres jogar contra a IA?</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)",
              borderRadius: 13, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #2c1810, #4a1a05)",
                border: "2px solid rgba(255,200,50,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: "#FFD700" }}>
                {botInfo.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {botInfo.name}
                </p>
                <p style={{ fontSize: 11, color: "#71717a" }}>
                  {botInfo.balance} MT · <span style={{ color: "#ef4444", fontWeight: 700 }}>Nível Ultra Difícil</span>
                </p>
              </div>
              <div style={{ background: "rgba(239,68,68,0.15)", borderRadius: 7, padding: "3px 8px",
                border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#ef4444" }}>IA</span>
              </div>
            </div>
            <button
              onClick={() => onBotMatch && onBotMatch(botInfo.name, botInfo.balance)}
              style={{ width: "100%", height: 44, borderRadius: 13, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, color: "#fff",
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              🎮 Jogar contra a IA
            </button>
          </motion.div>
        )}

        <div className="flex-1" />

        <div className="pb-10">
          <button onClick={onCancel}
            className="w-full h-14 rounded-full flex items-center justify-center gap-2"
            style={{ background: "#1c1c1e", color: "#8e8e93",
              fontFamily: "'Syne', sans-serif", fontSize: 14, border: "1px solid #2c2c2e", cursor: "pointer" }}>
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
    <div style={{ display: "flex", background: "#1c1c1e", borderRadius: 99, padding: 4 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <motion.button key={opt.value} onClick={() => onChange(opt.value)} layout
            style={{
              flex: 1, height: 42, borderRadius: 99, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
              color: active ? "#0a0a14" : "#71717a",
              background: active ? "#ffffff" : "transparent",
              boxShadow: active ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
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
      style={{ background: "#1c1c1e", borderRadius: 16, border: "1px solid #2c2c2e",
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>

      <div style={{ width: 38, height: 38, borderRadius: "50%",
        background: `rgba(0,212,180,0.12)`, border: `1px solid ${CYAN}33`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Smartphone style={{ width: 17, height: 17, color: CYAN }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, color: "#52525b", fontWeight: 600,
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
              color: CYAN, width: "100%" }} />
        ) : (
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15,
            color: phone ? "#fff" : "#52525b" }}>
            {phone ? `+258 ${formatted}` : "Adicionar número"}
          </p>
        )}
      </div>

      <button onClick={() => setEditing(v => !v)}
        style={{ width: 34, height: 34, borderRadius: 10,
          background: editing ? `${CYAN}22` : "rgba(255,255,255,0.06)",
          border: editing ? `1px solid ${CYAN}55` : "1px solid #3c3c3e",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0 }}>
        <Pencil style={{ width: 14, height: 14, color: editing ? CYAN : "#8e8e93" }} />
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
  const { user, profile } = useAuth();

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
      setScreen(fallback >= (selectedBet ?? 0) ? "matchmaking" : "rejected");
    }
  };

  const recommendedGames = ALL_GAMES.filter(g => g.id !== gameId);

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
          const dest = `/damas-jogo?gameId=${botGameId}&color=w&bet=${selectedBet ?? 0}&opp=${oppEnc}&myname=${myEnc}&bot=1&botbalance=${botBalance}`;
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
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setScreen("bet")} className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "#1c1c1e" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Sem Adversário</p>
            <div className="w-10" />
          </div>
          <div className="flex flex-col items-center pt-8 pb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl"
              style={{ background: "linear-gradient(135deg, #1c1c2e, #2c2c3e)", border: "1.5px solid #3c3c4e" }}>
              <Clock style={{ width: 36, height: 36, color: "#71717a" }} />
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff",
              marginBottom: 10, textAlign: "center" }}>Tempo Esgotado</p>
            <p style={{ fontSize: 13.5, color: "#71717a", lineHeight: 1.65, textAlign: "center",
              maxWidth: 280, marginBottom: 28 }}>
              Não foi possível encontrar um adversário. O teu valor de{" "}
              <span style={{ color: "#fff", fontWeight: 700 }}>{fmtMT(selectedBet ?? 0)}</span>{" "}
              foi devolvido à tua conta.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "rgba(0,212,180,0.1)", borderRadius: 99, border: `1px solid ${CYAN}33`, marginBottom: 36 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: CYAN }} />
              <span style={{ fontSize: 12, color: CYAN, fontWeight: 600 }}>Valor devolvido com sucesso</span>
            </div>
            <button onClick={() => setScreen("bet")}
              className="w-full h-14 rounded-full flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, color: "#fff",
                fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
                maxWidth: 340, cursor: "pointer" }}>
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
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#080810" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center",
            padding: "0 32px", width: "100%", maxWidth: 400 }}>

          {/* Glow ring + check */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 300, damping: 22 }}
            style={{ width: 96, height: 96, borderRadius: "50%", marginBottom: 30,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 14px rgba(34,197,94,0.10), 0 10px 40px rgba(34,197,94,0.45)" }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: "#fff" }} strokeWidth={2.5}/>
          </motion.div>

          {/* Heading */}
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 26,
              color: "#fff", marginBottom: 8, textAlign: "center", whiteSpace: "nowrap" }}>
            Partida Encontrada!
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            style={{ fontSize: 13.5, color: "#52525b", marginBottom: 36, textAlign: "center" }}>
            Preparar o tabuleiro…
          </motion.p>

          {/* Pulsing dots loader */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }}/>
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
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0">
          <button onClick={() => window.history.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#1c1c1e" }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Fazer Aposta</p>
          <div className="w-10" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10" style={{ scrollbarWidth: "none" }}>

          {/* Game Info Card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px",
              background: "#1c1c1e", borderRadius: 20, marginBottom: 16,
              border: "1px solid #2c2c2e", position: "relative" }}>
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 4,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
              borderRadius: 99, padding: "4px 9px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Star style={{ width: 11, height: 11, color: "#f59e0b", fill: "#f59e0b" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{game.rating}</span>
            </div>
            <div style={{ width: 86, height: 86, borderRadius: 14, overflow: "hidden",
              flexShrink: 0, background: game.cardBg || "#2c2c2e" }}>
              <img src={game.image} alt={game.name}
                style={{ width: "100%", height: "100%",
                  objectFit: (game.imageFit as any) || "cover", objectPosition: game.imagePos }} />
            </div>
            <div className="flex-1 min-w-0" style={{ paddingRight: 52 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 20,
                color: "#fff", letterSpacing: "1px", marginBottom: 2 }}>{game.name}</p>
              <p style={{ fontSize: 12, color: VIOLET, fontWeight: 600, marginBottom: 6 }}>{game.sub}</p>
              <p style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.55 }}>{game.description}</p>
            </div>
          </motion.div>

          {/* Live Stats */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            {[
              { icon: <Users   style={{ width: 15, height: 15, color: "#e4e4e7" }} />, count: liveOnline.toLocaleString("pt-PT"),  label: "Jogadores online" },
              { icon: <Gamepad2 style={{ width: 15, height: 15, color: "#e4e4e7" }} />, count: livePlaying.toLocaleString("pt-PT"), label: "Jogando agora" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "#1c1c1e", border: "1px solid #2c2c2e",
                borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{stat.icon}</div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1.1 }}>{stat.count}</p>
                <p style={{ fontSize: 11, color: "#71717a" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Bet Amounts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.4 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa",
              letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Valor da Aposta</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              {BET_AMOUNTS.slice(0, 4).map(amt => {
                const active = selectedBet === amt;
                return (
                  <motion.button key={amt} onClick={() => setSelectedBet(active ? null : amt)}
                    whileTap={{ scale: 0.94 }}
                    style={{ height: 46, borderRadius: 12,
                      border: active ? `1.5px solid ${VIOLET}` : "1.5px solid #2c2c2e",
                      background: active ? `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}22)` : "#1c1c1e",
                      cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12.5,
                      color: active ? "#fff" : "#71717a",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 1, transition: "all 0.2s",
                      boxShadow: active ? `0 0 16px ${VIOLET}33` : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#fff" : "#a1a1aa" }}>{amt}</span>
                    <span style={{ fontSize: 9, color: active ? `${VIOLET}cc` : "#52525b", letterSpacing: "0.5px" }}>MT</span>
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
                    style={{ height: 46, borderRadius: 12,
                      border: active ? `1.5px solid ${VIOLET}` : "1.5px solid #2c2c2e",
                      background: active ? `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}22)` : "#1c1c1e",
                      cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12.5,
                      color: active ? "#fff" : "#71717a",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 1, transition: "all 0.2s",
                      boxShadow: active ? `0 0 16px ${VIOLET}33` : "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: active ? "#fff" : "#a1a1aa" }}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </span>
                    <span style={{ fontSize: 9, color: active ? `${VIOLET}cc` : "#52525b", letterSpacing: "0.5px" }}>MT</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Game Mode */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }} style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa",
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
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa",
              letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Método de Pagamento</p>
            <SegmentedToggle
              value={payMethod}
              onChange={(v) => setPayMethod(v as PayMethod)}
              options={[
                { value: "carteira", label: "Carteira Móvel", icon: <Smartphone style={{ width: 14, height: 14 }} /> },
                { value: "poker",    label: "Conta Poker",    icon: <CreditCard  style={{ width: 14, height: 14 }} /> },
              ]}
            />

            {/* Phone number field when Carteira Móvel is selected */}
            <AnimatePresence>
              {payMethod === "carteira" && (
                <motion.div
                  key="phone-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden" }}>
                  <MobileWalletPhoneField phone={mobilePhone} onChange={setMobilePhone} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Start Button */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }} style={{ marginBottom: 32 }}>
            <motion.button onClick={handleStart} disabled={!canStart}
              whileTap={canStart ? { scale: 0.97 } : {}}
              style={{
                width: "100%", height: 60, borderRadius: 99,
                border: canStart ? "none" : "1.5px solid #2c2c2e",
                cursor: canStart ? "pointer" : "not-allowed",
                background: canStart
                  ? `linear-gradient(135deg, ${VIOLET} 0%, #5b21b6 100%)`
                  : "#141418",
                color: canStart ? "#fff" : "#3f3f46",
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 18px", transition: "all 0.25s",
                boxShadow: canStart ? `0 8px 32px ${VIOLET}55, inset 0 1px 0 rgba(255,255,255,0.15)` : "none",
                letterSpacing: "0.4px",
              }}>
              {canStart ? (
                <>
                  <div style={{ width: 38, height: 38, borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Swords style={{ width: 17, height: 17, color: "#fff" }} />
                  </div>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: "0.5px" }}>
                    COMEÇAR PARTIDA
                  </span>
                  <div style={{ background: "rgba(0,0,0,0.28)", borderRadius: 99, padding: "7px 13px", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
                      {fmtMT(selectedBet!)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 38, height: 38, borderRadius: "50%",
                    background: "rgba(255,255,255,0.04)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Zap style={{ width: 16, height: 16, color: "#3f3f46" }} />
                  </div>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 13.5 }}>Escolhe o valor da aposta</span>
                  <div style={{ width: 38 }} />
                </>
              )}
            </motion.button>
            {!canStart && (
              <p style={{ textAlign: "center", fontSize: 11.5, color: "#52525b", marginTop: 8 }}>
                Seleciona um valor de aposta para continuar
              </p>
            )}
          </motion.div>

          {/* Recommended Games */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Jogos Recomendados</p>
              <Trophy style={{ width: 14, height: 14, color: VIOLET }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {recommendedGames.map(g => (
                <Link key={g.id} href={g.id === "roleta" ? "/roleta" : `/apostar/${g.id}`}>
                  <motion.div whileTap={{ scale: 0.96 }}
                    style={{ minWidth: 110, background: "#1c1c1e", borderRadius: 16,
                      overflow: "hidden", border: "1px solid #2c2c2e", cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ height: 72, overflow: "hidden", position: "relative" }}>
                      <img src={g.image} alt={g.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.imagePos }} />
                      <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
                      <div style={{ position: "absolute", bottom: 6, left: 8,
                        display: "flex", alignItems: "center", gap: 3 }}>
                        <Star style={{ width: 9, height: 9, color: "#f59e0b", fill: "#f59e0b" }} />
                        <span style={{ fontSize: 9.5, color: "#fff", fontWeight: 700 }}>{g.rating}</span>
                      </div>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11.5, color: "#fff", marginBottom: 2 }}>{g.name}</p>
                      <p style={{ fontSize: 10, color: "#71717a" }}>{g.players} jogando</p>
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
