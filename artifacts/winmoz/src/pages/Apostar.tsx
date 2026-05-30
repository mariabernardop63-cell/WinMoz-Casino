import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation, Link } from "wouter";
import {
  ChevronLeft, Star, Wifi, Gamepad2, Zap, Trophy,
  XCircle, RotateCcw, AlertTriangle, Swords, Users,
  CreditCard, Smartphone, CheckCircle2, Clock, X
} from "lucide-react";

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
  { id: "damas", name: "Damas", image: "/damas-card.jpg", imagePos: "center", rating: "4.8", players: "2.4K" },
  { id: "ludo", name: "Ludo", image: "/ludo-card2.png", imagePos: "center 65%", rating: "4.9", players: "4.1K" },
  { id: "xadrez", name: "Xadrez", image: "/xadrez-card.jpg", imagePos: "center 30%", rating: "4.7", players: "1.2K" },
  { id: "bilhar", name: "Bilhar", image: "/bilhar-card.webp", imagePos: "center", rating: "4.6", players: "890" },
  { id: "roleta", name: "Roleta", image: "/roleta-card.jpg", imagePos: "center", rating: "4.5", players: "1.5K" },
];

function fmtMT(v: number) {
  return v >= 1000 ? `${v.toLocaleString("pt-PT")} MT` : `${v} MT`;
}

function fmtBalance(v: number) {
  const str = v.toFixed(2);
  const [i, d] = str.split(".");
  return `${Number(i).toLocaleString("pt-PT")},${d}`;
}

type GameMode = "solo" | "squad";
type PayMethod = "poker" | "carteira";
type Screen = "bet" | "processing" | "rejected" | "matchmaking" | "matched" | "timeout";

/* ── Processing Screen ── */
function ProcessingScreen({ method }: { method: PayMethod }) {
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
        <motion.div className="flex flex-col items-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          {/* Pulsing rings */}
          <div className="relative flex items-center justify-center mb-10" style={{ width: 120, height: 120 }}>
            {[1, 0.7, 0.45].map((scale, i) => (
              <motion.div
                key={i}
                animate={{ scale: [scale, scale + 0.18, scale], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: "easeOut" }}
                style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: `1.5px solid ${VIOLET}`, transformOrigin: "center" }}
              />
            ))}
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${VIOLET}22, ${VIOLET}44)`, border: `1.5px solid ${VIOLET}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${VIOLET}33`, borderTopColor: VIOLET }} className="animate-spin" />
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 10, textAlign: "center" }}
          >
            A verificar saldo…
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            style={{ fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.6, maxWidth: 260 }}
          >
            {method === "poker" ? "A validar o saldo da tua Conta Poker." : "A verificar a tua Carteira Móvel."} Este processo é rápido e seguro.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(124,58,237,0.12)", borderRadius: 99, border: `1px solid ${VIOLET}33` }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 11, color: VIOLET, fontWeight: 600, letterSpacing: "0.5px" }}>PROCESSAMENTO SEGURO</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Rejected Screen ── */
function RejectedScreen({ amount, onRetry, onRecharge }: { amount: number; onRetry: () => void; onRecharge: () => void }) {
  const balance = parseFloat(localStorage.getItem("winmoz_balance") || "0");
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        <div className="flex items-center justify-between pt-12 pb-8">
          <button onClick={onRetry} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
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
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Recusado</p>
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
              { label: "Causa", val: "Saldo Insuficiente" },
              { label: "Saldo Actual", val: `${fmtBalance(balance)} MZN` },
              { label: "Aposta Solicitada", val: `${fmtMT(amount)}` },
              { label: "Diferença", val: `${fmtBalance(Math.max(0, amount - balance))} MZN`, err: true },
              { label: "Estado", val: "Recusado ✗", err: true },
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
          <button onClick={onRetry} className="w-full h-14 rounded-full font-semibold text-base flex items-center justify-center gap-2 text-black"
            style={{ background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>
            <RotateCcw style={{ width: 17, height: 17 }} /> Tentar Novamente
          </button>
          <button onClick={onRecharge} className="w-full h-14 rounded-full font-medium text-sm"
            style={{ background: "#1c1c1e", color: "#8e8e93", fontFamily: "'Syne', sans-serif" }}>
            Recarregar Saldo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Matchmaking Screen ── */
function MatchmakingScreen({
  onTimeout,
  onCancel,
  onMatched,
}: {
  onTimeout: () => void;
  onCancel: () => void;
  onMatched: () => void;
}) {
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const [found, setFound] = useState(false);
  const avatar = typeof window !== "undefined" ? localStorage.getItem("winmoz_user_avatar") : null;

  /* Random match time: 8–18 seconds */
  const matchTimeRef = useRef(8000 + Math.random() * 10000);

  useEffect(() => {
    const matchTimer = setTimeout(() => {
      setFound(true);
      setTimeout(() => onMatched(), 2000);
    }, matchTimeRef.current);
    return () => clearTimeout(matchTimer);
  }, []);

  useEffect(() => {
    if (found) return;
    if (remaining <= 0) { onTimeout(); return; }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, found]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  const progress = ((TOTAL - remaining) / TOTAL) * 100;

  if (found) {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
        <div className="w-full max-w-[430px] flex flex-col items-center justify-center min-h-screen px-8">
          <motion.div className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
              style={{ background: `linear-gradient(135deg, #22c55e, #16a34a)` }}>
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", marginBottom: 8 }}>Partida Encontrada!</p>
            <p style={{ fontSize: 13, color: "#71717a" }}>A iniciar o jogo…</p>
            <div style={{ marginTop: 24, width: 36, height: 36, borderRadius: "50%", border: "3px solid #22c55e33", borderTopColor: "#22c55e" }} className="animate-spin" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
        {/* Header */}
        <div className="flex items-center justify-between pt-12 pb-4">
          <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <X style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>A Procurar Adversário</p>
          <div className="w-10" />
        </div>

        {/* Timer */}
        <motion.div className="flex flex-col items-center pt-6 pb-8"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="relative" style={{ width: 88, height: 88, marginBottom: 12 }}>
            <svg width={88} height={88} style={{ position: "absolute", inset: 0 }}>
              <circle cx={44} cy={44} r={38} fill="none" stroke="#1c1c1e" strokeWidth={5} />
              <motion.circle
                cx={44} cy={44} r={38} fill="none"
                stroke={remaining < 30 ? "#e74c3c" : VIOLET}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - progress / 100)}
                transform="rotate(-90 44 44)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: remaining < 30 ? "#e74c3c" : "#fff", lineHeight: 1 }}>{mins}:{secs}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: VIOLET }} />
            <span style={{ fontSize: 12, color: "#71717a", letterSpacing: "0.5px" }}>A procurar em tempo real</span>
          </div>
        </motion.div>

        {/* VS Section */}
        <motion.div className="flex items-center justify-center gap-6 py-8"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 18 }}>

          {/* User avatar */}
          <div className="flex flex-col items-center gap-2">
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, border: `3px solid ${VIOLET}66`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: `0 0 28px ${VIOLET}44` }}>
              {avatar
                ? <img src={avatar} alt="Tu" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>EU</span>
              }
            </div>
            <span style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600 }}>Tu</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 26, color: "#fff", letterSpacing: "2px", textShadow: `0 0 24px ${VIOLET}88` }}
            >
              VS
            </motion.div>
          </div>

          {/* Searching opponent */}
          <div className="flex flex-col items-center gap-2">
            <div style={{ position: "relative", width: 80, height: 80 }}>
              {/* Spinning dashed border */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px dashed #71717a" }}
              />
              {/* Inner circle */}
              <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "#1c1c1e", border: "1px solid #2c2c2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #71717a33", borderTopColor: "#71717a" }} className="animate-spin" />
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600 }}>Adversário</span>
          </div>
        </motion.div>

        {/* Status */}
        <motion.div className="flex flex-col items-center gap-3 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(124,58,237,0.1)", borderRadius: 99, border: `1px solid ${VIOLET}33` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: VIOLET }} className="animate-pulse" />
            <span style={{ fontSize: 12, color: VIOLET, fontWeight: 600 }}>A procurar jogadores com o mesmo valor…</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#52525b", textAlign: "center", lineHeight: 1.6 }}>
            Se nenhum adversário for encontrado em {mins}:{secs}, o teu valor será devolvido automaticamente.
          </p>
        </motion.div>

        <div className="flex-1" />

        {/* Cancel */}
        <div className="pb-10 px-0">
          <button onClick={onCancel} className="w-full h-14 rounded-full font-medium text-sm flex items-center justify-center gap-2"
            style={{ background: "#1c1c1e", color: "#8e8e93", fontFamily: "'Syne', sans-serif", border: "1px solid #2c2c2e" }}>
            <X style={{ width: 16, height: 16 }} /> Cancelar e Devolver Valor
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Segmented Toggle ── */
function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", background: "#1c1c1e", borderRadius: 99, padding: 4, gap: 0 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            layout
            style={{
              flex: 1,
              height: 42,
              borderRadius: 99,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: active ? "#0a0a14" : "#71717a",
              background: active ? "#ffffff" : "transparent",
              boxShadow: active ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
              transition: "color 0.2s, background 0.2s",
            }}
            whileTap={{ scale: 0.97 }}
          >
            <span style={{ display: "flex", alignItems: "center", opacity: active ? 1 : 0.5 }}>{opt.icon}</span>
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export default function Apostar() {
  const [, params] = useRoute("/apostar/:gameId");
  const [, setLocation] = useLocation();

  const gameId = params?.gameId ?? "damas";
  const game = GAMES_DATA[gameId] ?? FALLBACK_GAME;

  /* Bet State */
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [payMethod, setPayMethod] = useState<PayMethod>("poker");
  const [screen, setScreen] = useState<Screen>("bet");

  /* Live player counts */
  const [liveOnline, setLiveOnline] = useState(game.online);
  const [livePlaying, setLivePlaying] = useState(game.playing);

  useEffect(() => {
    const iv = setInterval(() => {
      setLiveOnline(v => Math.max(100, v + Math.floor(Math.random() * 9) - 4));
      setLivePlaying(v => Math.max(50, v + Math.floor(Math.random() * 7) - 3));
    }, 3200);
    return () => clearInterval(iv);
  }, []);

  const canStart = selectedBet !== null;

  const handleStart = () => {
    if (!canStart) return;
    setScreen("processing");
    setTimeout(() => {
      const balance = parseFloat(localStorage.getItem("winmoz_balance") || "0");
      if (balance >= (selectedBet ?? 0)) {
        setScreen("matchmaking");
      } else {
        setScreen("rejected");
      }
    }, 2400);
  };

  const recommendedGames = ALL_GAMES.filter(g => g.id !== gameId);

  /* ── Processing ── */
  if (screen === "processing") {
    return <ProcessingScreen method={payMethod} />;
  }

  /* ── Rejected ── */
  if (screen === "rejected") {
    return (
      <RejectedScreen
        amount={selectedBet ?? 0}
        onRetry={() => setScreen("bet")}
        onRecharge={() => setLocation("/recarga")}
      />
    );
  }

  /* ── Matchmaking ── */
  if (screen === "matchmaking") {
    return (
      <MatchmakingScreen
        onTimeout={() => setScreen("timeout")}
        onCancel={() => setScreen("bet")}
        onMatched={() => {
          setScreen("matched");
          const dest = (gameId === "ludo" || gameId === "ludo-classic") ? "/ludo-jogo" : "/";
          setTimeout(() => setLocation(dest), 2200);
        }}
      />
    );
  }

  /* ── Timeout ── */
  if (screen === "timeout") {
    return (
      <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
        <div className="w-full max-w-[430px] flex flex-col min-h-screen px-5">
          <div className="flex items-center justify-between pt-12 pb-8">
            <button onClick={() => setScreen("bet")} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
              <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Sem Adversário</p>
            <div className="w-10" />
          </div>
          <div className="flex flex-col items-center pt-8 pb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl" style={{ background: "linear-gradient(135deg, #1c1c2e, #2c2c3e)", border: "1.5px solid #3c3c4e" }}>
              <Clock style={{ width: 36, height: 36, color: "#71717a" }} />
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 10, textAlign: "center" }}>Tempo Esgotado</p>
            <p style={{ fontSize: 13.5, color: "#71717a", lineHeight: 1.65, textAlign: "center", maxWidth: 280, marginBottom: 28 }}>
              Não foi possível encontrar um adversário. O teu valor de <span style={{ color: "#fff", fontWeight: 700 }}>{fmtMT(selectedBet ?? 0)}</span> foi devolvido à tua conta.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "rgba(0,212,180,0.1)", borderRadius: 99, border: `1px solid ${CYAN}33`, marginBottom: 36 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: CYAN }} />
              <span style={{ fontSize: 12, color: CYAN, fontWeight: 600 }}>Valor devolvido com sucesso</span>
            </div>
            <button onClick={() => setScreen("bet")} className="w-full h-14 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${VIOLET}, #6d28d9)`, color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, maxWidth: 340 }}>
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
        <div className="flex flex-col items-center px-8">
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
          </motion.div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", marginBottom: 8 }}>Partida Encontrada!</p>
          <p style={{ fontSize: 13, color: "#71717a" }}>A iniciar o jogo…</p>
        </div>
      </div>
    );
  }

  /* ── Bet Screen ── */
  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#080810" }}>
      <div className="w-full max-w-[430px] flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0">
          <button onClick={() => setLocation(-1 as any)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1c1c1e" }}>
            <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
          </button>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>Fazer Aposta</p>
          <div className="w-10" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10" style={{ scrollbarWidth: "none" }}>

          {/* Game Info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px", background: "#1c1c1e", borderRadius: 20, marginBottom: 16, border: "1px solid #2c2c2e", position: "relative" }}
          >
            {/* Rating badge — top right */}
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", borderRadius: 99, padding: "4px 9px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Star style={{ width: 11, height: 11, color: "#f59e0b", fill: "#f59e0b" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{game.rating}</span>
            </div>
            {/* Image */}
            <div style={{ width: 86, height: 86, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: game.cardBg || "#2c2c2e" }}>
              <img src={game.image} alt={game.name} style={{ width: "100%", height: "100%", objectFit: (game.imageFit as any) || "cover", objectPosition: game.imagePos }} />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0" style={{ paddingRight: 52 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "1px", marginBottom: 2 }}>{game.name}</p>
              <p style={{ fontSize: 12, color: VIOLET, fontWeight: 600, marginBottom: 6 }}>{game.sub}</p>
              <p style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.55 }}>{game.description}</p>
            </div>
          </motion.div>

          {/* Live Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}
          >
            {[
              { icon: <Users style={{ width: 15, height: 15, color: "#e4e4e7" }} />, count: liveOnline.toLocaleString("pt-PT"), label: "Jogadores online" },
              { icon: <Gamepad2 style={{ width: 15, height: 15, color: "#e4e4e7" }} />, count: livePlaying.toLocaleString("pt-PT"), label: "Jogando agora" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "#1c1c1e", border: "1px solid #2c2c2e", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {stat.icon}
                </div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1.1 }}>{stat.count}</p>
                <p style={{ fontSize: 11, color: "#71717a" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Bet Amounts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Valor da Aposta</p>
            {/* Row 1: 10 20 50 100 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              {BET_AMOUNTS.slice(0, 4).map(amt => {
                const active = selectedBet === amt;
                return (
                  <motion.button
                    key={amt}
                    onClick={() => setSelectedBet(active ? null : amt)}
                    whileTap={{ scale: 0.94 }}
                    style={{
                      height: 46,
                      borderRadius: 12,
                      border: active ? `1.5px solid ${VIOLET}` : "1.5px solid #2c2c2e",
                      background: active ? `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}22)` : "#1c1c1e",
                      cursor: "pointer",
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: active ? "#fff" : "#71717a",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      transition: "all 0.2s",
                      boxShadow: active ? `0 0 16px ${VIOLET}33` : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#fff" : "#a1a1aa" }}>{amt}</span>
                    <span style={{ fontSize: 9, color: active ? `${VIOLET}cc` : "#52525b", letterSpacing: "0.5px" }}>MT</span>
                  </motion.button>
                );
              })}
            </div>
            {/* Row 2: 500 1000 5000 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
              {BET_AMOUNTS.slice(4).map(amt => {
                const active = selectedBet === amt;
                return (
                  <motion.button
                    key={amt}
                    onClick={() => setSelectedBet(active ? null : amt)}
                    whileTap={{ scale: 0.94 }}
                    style={{
                      height: 46,
                      borderRadius: 12,
                      border: active ? `1.5px solid ${VIOLET}` : "1.5px solid #2c2c2e",
                      background: active ? `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}22)` : "#1c1c1e",
                      cursor: "pointer",
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: active ? "#fff" : "#71717a",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      transition: "all 0.2s",
                      boxShadow: active ? `0 0 16px ${VIOLET}33` : "none",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: active ? "#fff" : "#a1a1aa" }}>{amt >= 1000 ? `${amt / 1000}K` : amt}</span>
                    <span style={{ fontSize: 9, color: active ? `${VIOLET}cc` : "#52525b", letterSpacing: "0.5px" }}>MT</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Game Mode Toggle */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Modo de Jogo</p>
            <SegmentedToggle
              value={gameMode}
              onChange={(v) => setGameMode(v as GameMode)}
              options={[
                { value: "solo", label: "1VS1 Solo", icon: <Swords style={{ width: 14, height: 14 }} /> },
                { value: "squad", label: "2VS2 Squad", icon: <Users style={{ width: 14, height: 14 }} /> },
              ]}
            />
          </motion.div>

          {/* Payment Method Toggle */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.4 }} style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#a1a1aa", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>Método de Pagamento</p>
            <SegmentedToggle
              value={payMethod}
              onChange={(v) => setPayMethod(v as PayMethod)}
              options={[
                { value: "poker", label: "Conta Poker", icon: <CreditCard style={{ width: 14, height: 14 }} /> },
                { value: "carteira", label: "Carteira Móvel", icon: <Smartphone style={{ width: 14, height: 14 }} /> },
              ]}
            />
          </motion.div>

          {/* Start Button */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.4 }} style={{ marginBottom: 32 }}>
            <motion.button
              onClick={handleStart}
              disabled={!canStart}
              whileTap={canStart ? { scale: 0.97 } : {}}
              style={{
                width: "100%",
                height: 60,
                borderRadius: 99,
                border: canStart ? "none" : "1.5px solid #2c2c2e",
                cursor: canStart ? "pointer" : "not-allowed",
                background: canStart
                  ? `linear-gradient(135deg, ${VIOLET} 0%, #5b21b6 100%)`
                  : "#141418",
                color: canStart ? "#fff" : "#3f3f46",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                transition: "all 0.25s",
                boxShadow: canStart ? `0 8px 32px ${VIOLET}55, inset 0 1px 0 rgba(255,255,255,0.15)` : "none",
                letterSpacing: "0.4px",
              }}
            >
              {canStart ? (
                <>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Swords style={{ width: 17, height: 17, color: "#fff" }} />
                  </div>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: "0.5px" }}>COMEÇAR PARTIDA</span>
                  <div style={{ background: "rgba(0,0,0,0.28)", borderRadius: 99, padding: "7px 13px", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{fmtMT(selectedBet!)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Jogos Recomendados</p>
              <Trophy style={{ width: 14, height: 14, color: VIOLET }} />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {recommendedGames.map(g => (
                <Link key={g.id} href={`/apostar/${g.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.96 }}
                    style={{ minWidth: 110, background: "#1c1c1e", borderRadius: 16, overflow: "hidden", border: "1px solid #2c2c2e", cursor: "pointer", flexShrink: 0 }}
                  >
                    <div style={{ height: 72, overflow: "hidden", position: "relative" }}>
                      <img src={g.image} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.imagePos }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
                      <div style={{ position: "absolute", bottom: 6, left: 8, display: "flex", alignItems: "center", gap: 3 }}>
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
