import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Mic, Users, CheckCheck, Info, X, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";
import { BrandMark } from "@/components/BrandLogo";

const CHANNEL_NAME = "group_chat_v1";
const MESSAGES_KEY = "wm_group_chat_msgs";
const CHAT_SEEN_KEY = "wm_group_chat_seen_v1";
const MAX_NEWCOMER_MESSAGES = 20;
const MAX_LIVE_MESSAGES = 200;

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
  "linear-gradient(135deg, #374151, #111827)",
  "linear-gradient(135deg, #4b5563, #1f2937)",
  "linear-gradient(135deg, #10b981, #065f46)",
  "linear-gradient(135deg, #8b5cf6, #4c1d95)",
  "linear-gradient(135deg, #f59e0b, #b45309)",
];

function loadStoredMessages(): Msg[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Filtrar mensagens antigas de bots (IDs começam com "seed_" ou "bot_") */
    const cleaned = parsed.filter((m: Msg) => !m.id.startsWith("seed_") && !m.id.startsWith("bot_"));
    if (cleaned.length === 0) { sessionStorage.removeItem(MESSAGES_KEY); return []; }
    const limit = sessionStorage.getItem(CHAT_SEEN_KEY) === "1"
      ? MAX_LIVE_MESSAGES
      : MAX_NEWCOMER_MESSAGES;
    sessionStorage.setItem(CHAT_SEEN_KEY, "1");
    /* Guardar versão limpa */
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(cleaned.slice(-MAX_LIVE_MESSAGES)));
    return cleaned.slice(-limit);
  } catch { return []; }
}

function storeMessages(msgs: Msg[]) {
  try {
    sessionStorage.setItem(CHAT_SEEN_KEY, "1");
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs.slice(-MAX_LIVE_MESSAGES)));
  } catch { /* quota — ignora */ }
}

export default function GrupoChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(() => {
    const msgs = loadStoredMessages();
    if (msgs.length > 0) storeMessages(msgs);
    return msgs;
  });
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(() => 20 + Math.floor(Math.random() * 11));
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesRef = useRef<Msg[]>(messages);
  const { user, profile } = useAuth();
  const { brandName } = useBrand();

  const randomOnlineCount = () => 20 + Math.floor(Math.random() * 11);

  const myName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Jogador";
  const myInitials = getInitials(myName);
  const myAvatarBg = AVATAR_PALETTES[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Supabase Realtime channel
  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        const next = [...prev, { ...(payload as Msg), isMe: false }].slice(-MAX_LIVE_MESSAGES);
        storeMessages(next);
        return next;
      });
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      setOnlineCount(Math.min(30, Math.max(20, count + 19 + Math.floor(Math.random() * 5))));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user?.id) {
        await channel.track({ userId: user.id, name: myName });
      }
    });

    const onlineTicker = setInterval(() => setOnlineCount(randomOnlineCount()), 30_000);

    return () => {
      clearInterval(onlineTicker);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
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
      const next = [...prev, msg].slice(-MAX_LIVE_MESSAGES);
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
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0c0c10" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{
          background: "#0c0c10",
          paddingTop: 44, paddingBottom: 14, paddingLeft: 16, paddingRight: 16, flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 17, height: 17, color: "#e2e8f0" }} />
            </button>
            <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2.5 flex-1 min-w-0">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <BrandMark size={22} variant="light" />
                <span style={{ position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2px solid #0c0c10" }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Grupo {brandName}</p>
                <p style={{ fontSize: 10.5, color: "rgba(241,245,249,0.45)", marginTop: 1 }}>
                  Comunidade oficial · <span style={{ color: "#4ade80", fontWeight: 600 }}>{onlineCount} online</span>
                </p>
              </div>
            </button>
            <button onClick={() => setLocation("/suporte")} title="Chat de suporte"
              style={{
                width: 36, height: 36, borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, cursor: "pointer",
              }}>
              <MessageCircle style={{ width: 17, height: 17, color: "#e2e8f0" }} />
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ background: "#161618", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>Sobre o grupo</p>
                  <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    <X style={{ width: 14, height: 14, color: "#6b7280" }} />
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, marginBottom: 12 }}>
                  Espaço oficial da comunidade {brandName}: dicas de jogo, sorteios, avisos e conversa entre jogadores.
                  Para suporte directo usa o chat de suporte.
                </p>
                <button onClick={() => setLocation("/suporte")} style={{ textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "#111827", borderRadius: 12, padding: "11px 0",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <MessageCircle size={16} color="#e2e8f0" />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0", fontFamily: "'Syne', sans-serif" }}>
                      Chat de suporte
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{
          background: "#0c0c10",
          padding: "16px 14px 10px", display: "flex", flexDirection: "column", gap: 10,
        }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-14 gap-3">
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "#161618", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users style={{ width: 26, height: "26", color: "#6b7280" }} />
              </div>
              <p style={{ color: "#e5e7eb", fontSize: 13.5, fontWeight: 700 }}>Sem mensagens ainda</p>
              <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center", maxWidth: 230, lineHeight: 1.6 }}>
                Sê o primeiro a cumprimentar a comunidade {brandName}! 👋
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const sameUser = prev && !prev.id.startsWith("sys") && prev.user === msg.user && !msg.isMe && !prev.isMe;
              const isSystem = msg.id.startsWith("sys");

              if (isSystem) return (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  <span style={{ fontSize: 11, color: "#6b7280", background: "#161618", borderRadius: 99, padding: "5px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>{msg.text}</span>
                </motion.div>
              );

              /* Minha mensagem (direita) */
              if (msg.isMe) return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}
                >
                  <div style={{
                    background: "#111827",
                    borderRadius: "16px 4px 16px 16px",
                    padding: "10px 14px",
                    minWidth: 150,
                    maxWidth: "78%",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}>
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                    {msg.text && <p style={{ fontSize: 13.5, color: "#f3f4f6", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>{msg.text}</p>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 5 }}>
                      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{msg.time}</span>
                      <CheckCheck style={{ width: 13, height: 13, color: "#6b7280" }} />
                    </div>
                  </div>
                </motion.div>
              );

              /* Mensagem de outro utilizador (esquerda) */
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
                      flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.3)", marginBottom: 2,
                    }}>
                      <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11 }}>{msg.initials}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, maxWidth: "78%" }}>
                    {!sameUser && (
                      <span style={{ fontSize: 10.5, color: "#6b7280", marginLeft: 4, fontWeight: 700, letterSpacing: "0.2px" }}>{msg.user}</span>
                    )}
                    <div style={{
                      background: "#1a1a1e",
                      borderRadius: "4px 16px 16px 16px",
                      padding: "10px 14px",
                      minWidth: 120,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                      {msg.text && <p style={{ fontSize: 13.5, color: "#d1d5db", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>{msg.text}</p>}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <span style={{ fontSize: 9.5, color: "#4b5563" }}>{msg.time}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: "#0c0c10", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", paddingBottom: "max(22px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => setShowInfo(v => !v)} title="Sobre o grupo"
              style={{ width: 42, height: 42, borderRadius: 999, background: "#161618", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <Info style={{ width: 17, height: 17, color: "#6b7280" }} />
            </button>
            <div style={{ flex: 1, background: "#161618", borderRadius: 22, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, minHeight: 46, border: "1px solid rgba(255,255,255,0.08)" }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve uma mensagem..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#f3f4f6", fontFamily: "inherit" }}
              />
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              style={{ width: 46, height: 46, borderRadius: 999, background: text.trim() ? "#111827" : "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", boxShadow: text.trim() ? "0 4px 14px rgba(0,0,0,0.3)" : "none", transition: "background 0.2s, box-shadow 0.2s" }}
            >
              {text.trim()
                ? <Send style={{ width: 18, height: 18, color: "#f3f4f6" }} />
                : <Mic style={{ width: 18, height: 18, color: "#6b7280" }} />
              }
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
