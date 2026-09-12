import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Mic, Users, CheckCheck, Info, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";
import { BrandMark } from "@/components/BrandLogo";

const BRAND_BLUE = "#1d4ed8";
const CHANNEL_NAME = "group_chat_v1";
/* As mensagens sobrevivem à navegação dentro da plataforma (sessionStorage
   dura até fechar o separador / sair da app) */
const MESSAGES_KEY = "wm_group_chat_msgs";

/* Grupo oficial da comunidade no WhatsApp */
const WHATSAPP_GROUP = "https://chat.whatsapp.com/IreRFFLnFSKIEFNzjmKLv2";

type Msg = {
  id: string;
  user: string;
  initials: string;
  avatarBg: string;
  text?: string;
  image?: string;
  time: string;
  isMe?: boolean;
  userId?: string;
};

/* ── Chat Bots ──────────────────────────────────────────────────────────── */

interface ChatBot {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
}

const CHAT_BOTS: ChatBot[] = [
  { id: "bot_carlos", name: "Carlos Matsinhe", initials: "CM", avatarBg: "linear-gradient(135deg, #10b981, #065f46)" },
  { id: "bot_fatima", name: "Fátima Guambe", initials: "FG", avatarBg: "linear-gradient(135deg, #ec4899, #9d174d)" },
  { id: "bot_joao", name: "João Macamo", initials: "JM", avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { id: "bot_ana", name: "Ana Sitoe", initials: "AS", avatarBg: "linear-gradient(135deg, #f59e0b, #b45309)" },
  { id: "bot_pedro", name: "Pedro Cossa", initials: "PC", avatarBg: "linear-gradient(135deg, #8b5cf6, #4c1d95)" },
  { id: "bot_maria", name: "Maria Nhantumbo", initials: "MN", avatarBg: "linear-gradient(135deg, #ef4444, #b91c1c)" },
  { id: "bot_ricardo", name: "Ricardo Mavie", initials: "RM", avatarBg: "linear-gradient(135deg, #06b6d4, #0e7490)" },
  { id: "bot_sofia", name: "Sofia Munguambe", initials: "SM", avatarBg: "linear-gradient(135deg, #d946ef, #a21caf)" },
];

/* Conversational threads — realistic Mozambican chat messages */
const BOT_CONVERSATIONS: string[][] = [
  ["Kmk malta, alguém para jogar comigo? 😄", "Bora lá, eu tou disponível!", "Qual jogo queres? Damas ou Ludo?"],
  ["Alguém já ganhou hoje? Eu perdi 200MT 😅", "Paciência mano, amanhã recuperas!", "É verdade, o importante é não desistir"],
  ["Boa noite pessoal! Quem está online?", "Eu estou aqui! A jogar Damas 😊", "Também estou! Boa noite a todos"],
  ["Qual é a sena people, alguém animado para jogar?", "Eu tou sempre pronto para um desafio!", "Bora marcar uma partida então"],
  ["Acabei de ganhar 500MT na roleta! 🔥", "Parabéns mano! Sorte grande!", "Manda aí uma parte do dinheiro 😂"],
  ["Pessoal, recomendo o jogo de Damas, é muito bom", "Concordo! Já joguei ontem e ganhei", "Damas é o melhor jogo mesmo"],
  ["Alguém quer jogar Ludo? 50MT?", "Eu aceito! Manda o código da sala", "Vamos lá, adoro Ludo!"],
  ["Ei malta, como é que se cria sala privada?", "Vai no separador Sala e clica em Criar Sala", "É fácil mano, depois partilha o código"],
  ["Quem vai jogar hoje à noite?", "Eu vou! Às 21h estou disponível", "Conta comigo também!"],
  ["Ganhei 3 partidas seguidas! 🏆", "Isso aí! És o campeão!", "Parabéns! Ensina-me a jogar melhor"],
  ["Boa tarde pessoal! Tudo bem?", "Tudo bom e tu? Vamos jogar?", "Boa tarde! Tou a ver o jogo ao vivo"],
  ["Quem é bom em Xadrez aqui?", "Eu jogo há anos! Aceitas um desafio?", "Xadrez é para os fortes 💪"],
  ["Malta, cuidado com os bots, eles são espertos 😂", "É verdade! Perdi contra um ontem", "Os bots estão cada vez melhores"],
  ["Alguém sabe quando é o próximo torneio?", "Acho que é no fim-de-semana, vê no separador Novidades", "Espero que sim, tou preparado!"],
  ["Km tá a correr o jogo? Alguém recomenda?", "Damas MZ é o melhor na minha opinião", "Ludo Cash também é fixe!"],
];

/* Random non-reply: sometimes a bot doesn't respond */
const SHOULD_SKIP_CHANCE = 0.25;

/* ── End Bots ──────────────────────────────────────────────────────────── */

function loadStoredMessages(): Msg[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return seedBotMessages();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-200) : seedBotMessages();
  } catch { return seedBotMessages(); }
}

function seedBotMessages(): Msg[] {
  const now = Date.now();
  const msgs: Msg[] = [];
  const seedBots = [
    { bot: CHAT_BOTS[0], text: "Kmk malta! Alguém para jogar Damas? 😄", offset: -180_000 },
    { bot: CHAT_BOTS[1], text: "Boa noite pessoal! Tudo bem?", offset: -150_000 },
    { bot: CHAT_BOTS[2], text: "Eu tou disponível! Bora jogar 🎮", offset: -120_000 },
    { bot: CHAT_BOTS[3], text: "Acabei de ganhar 200MT na roleta 🔥", offset: -90_000 },
    { bot: CHAT_BOTS[4], text: "Parabéns! Sorte boa!", offset: -60_000 },
    { bot: CHAT_BOTS[5], text: "Qual é a sena people, alguém animado?", offset: -30_000 },
  ];

  for (const s of seedBots) {
    msgs.push({
      id: `seed_${s.bot.id}_${now + s.offset}`,
      user: s.bot.name,
      initials: s.bot.initials,
      avatarBg: s.bot.avatarBg,
      text: s.text,
      time: new Date(now + s.offset).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  return msgs;
}

function storeMessages(msgs: Msg[]) {
  try {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs.slice(-200)));
  } catch { /* quota — ignora */ }
}

/* WhatsApp icon (official glyph) */
function WhatsAppIcon({ size = 16, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  "linear-gradient(135deg, #0ea5e9, #0369a1)",
  "linear-gradient(135deg, #10b981, #065f46)",
  "linear-gradient(135deg, #8b5cf6, #4c1d95)",
  "linear-gradient(135deg, #f59e0b, #b45309)",
];

export default function GrupoChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(() => {
    const msgs = loadStoredMessages();
    if (msgs.length > 0) storeMessages(msgs);
    return msgs;
  });
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(39);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { user, profile } = useAuth();
  const { brandName } = useBrand();

  const myName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Jogador";
  const myInitials = getInitials(myName);
  const myAvatarBg = AVATAR_PALETTES[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Bot chat engine (AI-powered via b.ia mimo v2.5) ─────────────────────
  const botStateRef = useRef({
    nextBotTime: Date.now() + 20_000 + Math.random() * 40_000,
    recentBotMessages: [] as string[],
    fetching: false,
  });

  useEffect(() => {
    const BOT_CHECK_INTERVAL = 8_000;

    const fetchBotMessage = async () => {
      if (botStateRef.current.fetching) return;
      botStateRef.current.fetching = true;

      try {
        // Send recent bot messages as context to avoid repetition
        const context = botStateRef.current.recentBotMessages.slice(-6).join("\n");
        const res = await fetch(`/api/chat-bots?context=${encodeURIComponent(context)}`);
        if (!res.ok) throw new Error("Bot API error");

        const data = await res.json() as { name: string; initials: string; avatarBg: string; message: string };

        const botMsg: Msg = {
          id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          user: data.name,
          initials: data.initials,
          avatarBg: data.avatarBg,
          text: data.message,
          time: nowTime(),
        };

        setMessages(prev => {
          const next = [...prev, botMsg];
          storeMessages(next);
          return next;
        });

        // Track recent messages to avoid repetition
        botStateRef.current.recentBotMessages.push(data.message);
        if (botStateRef.current.recentBotMessages.length > 10) {
          botStateRef.current.recentBotMessages.shift();
        }
      } catch {
        // Silently fail — next interval will retry
      } finally {
        botStateRef.current.fetching = false;
      }
    };

    const interval = setInterval(() => {
      const now = Date.now();
      if (now < botStateRef.current.nextBotTime) return;

      // 30% chance to skip (not always respond)
      if (Math.random() < 0.3) {
        botStateRef.current.nextBotTime = now + 25_000 + Math.random() * 50_000;
        return;
      }

      fetchBotMessage();

      // Next message: 25-90s (realistic human delay)
      botStateRef.current.nextBotTime = now + 25_000 + Math.random() * 65_000;
    }, BOT_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime channel
  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        const next = [...prev, { ...(payload as Msg), isMe: false }];
        storeMessages(next);
        return next;
      });
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      setOnlineCount(Math.max(39, count + 38));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user?.id) {
        await channel.track({ userId: user.id, name: myName });
      }
    });

    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [user?.id, myName]);

  const sendMsg = (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;
    const msg: Msg = {
      id: `${Date.now()}_${user?.id ?? "anon"}`,
      user: myName,
      initials: myInitials,
      avatarBg: myAvatarBg,
      text: msgText.trim() || undefined,
      image: img,
      time: nowTime(),
      isMe: true,
      userId: user?.id,
    };
    setMessages(prev => {
      const next = [...prev, msg];
      storeMessages(next);
      return next;
    });
    setText("");
    channelRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
  };

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => sendMsg("", ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#f4f5f7" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #1a0533 0%, #3b1080 100%)",
          paddingTop: 44, paddingBottom: 12, paddingLeft: 14, paddingRight: 14, flexShrink: 0,
          boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
        }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 16, height: 16, color: "#e2e8f0" }} />
            </button>
            <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2.5 flex-1 min-w-0">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <BrandMark size={22} variant="light" />
                <span style={{ position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2px solid #2a0e5c" }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Grupo {brandName}</p>
                <p style={{ fontSize: 10.5, color: "rgba(241,245,249,0.55)", marginTop: 1 }}>
                  Comunidade oficial · <span style={{ color: "#4ade80", fontWeight: 600 }}>{onlineCount} online</span>
                </p>
              </div>
            </button>
            {/* Grupo oficial no WhatsApp */}
            <a href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer"
              title="Entrar no grupo oficial do WhatsApp"
              style={{
                width: 36, height: 36, borderRadius: 999,
                background: "#25D366",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, cursor: "pointer",
                boxShadow: "0 3px 12px rgba(37,211,102,0.4)",
                border: "none",
              }}>
              <WhatsAppIcon size={17} />
            </a>
          </div>
        </div>

        {/* ── Info panel ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ background: "#fff", borderBottom: "1px solid rgba(15,23,42,0.06)", overflow: "hidden", flexShrink: 0 }}>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>Sobre o grupo</p>
                  <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    <X style={{ width: 14, height: 14, color: "#94a3b8" }} />
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
                  Espaço oficial da comunidade {brandName}: dicas de jogo, sorteios, avisos e conversa entre jogadores.
                  Para suporte directo usa o chat de suporte ou o WhatsApp oficial.
                </p>
                <a href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "#25D366", borderRadius: 12, padding: "11px 0",
                    boxShadow: "0 4px 14px rgba(37,211,102,0.35)",
                  }}>
                    <WhatsAppIcon size={16} />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
                      Entrar no grupo oficial
                    </span>
                  </div>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{
          background: "radial-gradient(120% 60% at 50% 0%, #eceef2 0%, #f4f5f7 60%)",
          padding: "16px 12px 10px", display: "flex", flexDirection: "column", gap: 10,
        }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-14 gap-3">
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "#fff", boxShadow: "0 4px 16px rgba(15,23,42,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users style={{ width: 26, height: 26, color: BRAND_BLUE }} />
              </div>
              <p style={{ color: "#334155", fontSize: 13.5, fontWeight: 700 }}>Sem mensagens ainda</p>
              <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", maxWidth: 230, lineHeight: 1.6 }}>
                Sê o primeiro a cumprimentar a comunidade {brandName}! 👋
              </p>
              <a href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#25D366", borderRadius: 999, padding: "8px 16px", boxShadow: "0 3px 10px rgba(37,211,102,0.3)" }}>
                  <WhatsAppIcon size={13} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff" }}>Entrar no grupo oficial</span>
                </div>
              </a>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const sameUser = prev && !prev.id.startsWith("sys") && prev.user === msg.user && !msg.isMe && !prev.isMe;
              const isSystem = msg.id.startsWith("sys");

              if (isSystem) return (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  <span style={{ fontSize: 11, color: "#94a3b8", background: "#ffffff", borderRadius: 99, padding: "5px 14px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>{msg.text}</span>
                </motion.div>
              );

              /* ── Minha mensagem (direita) ── */
              if (msg.isMe) return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}
                >
                  <div style={{
                    background: "linear-gradient(135deg, #1d4ed8 0%, #172554 100%)",
                    borderRadius: "16px 4px 16px 16px",
                    padding: "10px 14px",
                    minWidth: 150,
                    maxWidth: "78%",
                    boxShadow: "0 4px 14px rgba(29,78,216,0.28)",
                  }}>
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                    {msg.text && <p style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>{msg.text}</p>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 5 }}>
                      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)" }}>{msg.time}</span>
                      <CheckCheck style={{ width: 13, height: 13, color: "#93c5fd" }} />
                    </div>
                  </div>
                </motion.div>
              );

              /* ── Mensagem de outro utilizador (esquerda) ── */
              return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
                >
                  {!sameUser && (
                    <div style={{
                      width: 30, height: 30, borderRadius: 999, background: msg.avatarBg || AVATAR_PALETTES[1],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, boxShadow: "0 2px 6px rgba(15,23,42,0.18)", marginBottom: 2,
                    }}>
                      <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11 }}>{msg.initials}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, maxWidth: "78%" }}>
                    {!sameUser && (
                      <span style={{ fontSize: 10.5, color: "#64748b", marginLeft: 4, fontWeight: 700, letterSpacing: "0.2px" }}>{msg.user}</span>
                    )}
                    <div style={{
                      background: "#ffffff",
                      borderRadius: sameUser ? "4px 16px 16px 16px" : "4px 16px 16px 16px",
                      padding: "10px 14px",
                      minWidth: 120,
                      boxShadow: "0 1px 6px rgba(15,23,42,0.07)",
                      border: "1px solid rgba(15,23,42,0.05)",
                    }}>
                      {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                      {msg.text && <p style={{ fontSize: 13.5, color: "#1e293b", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>{msg.text}</p>}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <span style={{ fontSize: 9.5, color: "#94a3b8" }}>{msg.time}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ background: "#fff", borderTop: "1px solid rgba(15,23,42,0.06)", padding: "10px 12px", paddingBottom: "max(22px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => setShowInfo(v => !v)} title="Sobre o grupo"
              style={{ width: 40, height: 40, borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <Info style={{ width: 17, height: 17, color: "#64748b" }} />
            </button>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, minHeight: 44, border: "1px solid #e2e8f0" }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve uma mensagem..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#1e293b", fontFamily: "inherit" }}
              />
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? `linear-gradient(135deg, ${BRAND_BLUE}, #172554)` : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", boxShadow: text.trim() ? "0 4px 14px rgba(29,78,216,0.35)" : "none", transition: "background 0.2s, box-shadow 0.2s" }}
            >
              {text.trim()
                ? <Send style={{ width: 17, height: 17, color: "#fff" }} />
                : <Mic style={{ width: 17, height: 17, color: "#94a3b8" }} />
              }
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
