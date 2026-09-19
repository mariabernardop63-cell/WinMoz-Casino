import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Users, Info, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";

const CHANNEL_NAME = "group_chat_v1";
const MAX_MESSAGES = 40;

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

/** Load last 40 messages from Supabase */
async function loadMessagesFromDB(): Promise<Msg[]> {
  try {
    const session = await getSessionWithRefresh();
    if (!session?.access_token) return [];
    const res = await fetch("/api/chat-bots?action=group-history", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { messages?: any[] };
    if (!data.messages) return [];
    return data.messages.map((m: any) => ({
      id: m.id,
      user: m.user_name,
      initials: m.user_initials,
      avatarBg: m.avatar_bg,
      text: m.text || undefined,
      image: m.image || undefined,
      time: new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      isMe: false,
      userId: m.user_id,
    }));
  } catch { return []; }
}

/** Save a message to Supabase */
async function saveMessageToDB(msg: Msg, userId?: string) {
  try {
    const session = await getSessionWithRefresh();
    if (!session?.access_token) return;
    await fetch("/api/chat-bots?action=group-save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: userId,
        user_name: msg.user,
        user_initials: msg.initials,
        avatar_bg: msg.avatarBg,
        text: msg.text,
        image: msg.image,
      }),
    });
  } catch { /* ignore */ }
}

export default function GrupoChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(() => 20 + Math.floor(Math.random() * 11));
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesRef = useRef<Msg[]>(messages);
  const { user, profile } = useAuth();
  const { brandName } = useBrand();

  const randomOnlineCount = () => 20 + Math.floor(Math.random() * 11);

  const myName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Jogador";
  const myInitials = getInitials(myName);
  const myAvatarBg = AVATAR_PALETTES[0];

  // Load messages from DB on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      const dbMsgs = await loadMessagesFromDB();
      if (alive) {
        setMessages(dbMsgs);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
        const next = [...prev, { ...(payload as Msg), isMe: false }].slice(-MAX_MESSAGES);
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
    setMessages(prev => [...prev, msg].slice(-MAX_MESSAGES));
    setText("");
    // Broadcast to other users
    channelRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
    // Persist to DB
    saveMessageToDB(msg, user?.id);
  };

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0c0c10" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{
          background: "#0c0c10",
          paddingTop: 44, paddingBottom: 14, paddingLeft: 16, paddingRight: 16, flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => window.history.back()} className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer" }}>
                <ArrowLeft className="w-4 h-4 text-white/70" />
              </button>
              <div>
                <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: 1 }}>
                  GRUPO
                </p>
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>
                    {onlineCount} online
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInfo(!showInfo)}
                style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {showInfo ? <X className="w-4 h-4 text-white/50" /> : <Info className="w-4 h-4 text-white/50" />}
              </button>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="px-4 py-3">
                <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                  Chat da comunidade {brandName}. As mensagens são públicas e ficam guardadas para todos os membros.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-8">
              <p style={{ fontSize: 12, color: "#6b7280" }}>Nenhuma mensagem ainda. Sé o primeiro a falar!</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5 mb-3" style={{ flexDirection: msg.isMe ? "row-reverse" : "row" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: msg.avatarBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                }}>
                  {msg.initials}
                </div>
                <div style={{ maxWidth: "75%" }}>
                  {!msg.isMe && (
                    <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 2, fontWeight: 600 }}>{msg.user}</p>
                  )}
                  <div style={{
                    padding: "8px 12px", borderRadius: 14,
                    background: msg.isMe ? "#2563eb" : "rgba(255,255,255,0.06)",
                    borderBottomRightRadius: msg.isMe ? 4 : 14,
                    borderBottomLeftRadius: msg.isMe ? 14 : 4,
                  }}>
                    {msg.image && (
                      <img src={msg.image} alt="img" style={{ maxWidth: 200, borderRadius: 8, marginBottom: msg.text ? 6 : 0, display: "block" }} />
                    )}
                    {msg.text && (
                      <p style={{ fontSize: 13, color: "#fff", lineHeight: 1.45, wordBreak: "break-word" }}>{msg.text}</p>
                    )}
                  </div>
                  <p style={{ fontSize: 9, color: "#4b5563", marginTop: 2, textAlign: msg.isMe ? "right" : "left" }}>{msg.time}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px 28px", background: "#0c0c10", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
              placeholder="Escrever mensagem..."
              className="flex-1"
              style={{
                height: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.05)", padding: "0 14px",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
            <button onClick={() => sendMsg(text)}
              disabled={!text.trim()}
              style={{
                width: 42, height: 42, borderRadius: 12, border: "none",
                background: text.trim() ? "#2563eb" : "rgba(255,255,255,0.06)",
                cursor: text.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <Send className="w-4 h-4" style={{ color: text.trim() ? "#fff" : "#6b7280" }} />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
