import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Send, Mic, Smile, Users, CheckCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const CYAN = "#00D4B4";
const CHANNEL_NAME = "group_chat_v1";

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


const MEMBERS = [
  { initials: "JM", bg: "linear-gradient(135deg, #3b82f6, #1d4ed8)", name: "João M." },
  { initials: "MS", bg: "linear-gradient(135deg, #ec4899, #9d174d)", name: "Maria S." },
  { initials: "CF", bg: "linear-gradient(135deg, #10b981, #065f46)", name: "Carlos F." },
  { initials: "AR", bg: "linear-gradient(135deg, #f59e0b, #b45309)", name: "Ana R." },
  { initials: "PA", bg: "linear-gradient(135deg, #8b5cf6, #4c1d95)", name: "Pedro A." },
];

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GrupoChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(39);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { user, profile } = useAuth();

  const myName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Jogador";
  const myInitials = getInitials(myName);
  const myAvatarBg = `linear-gradient(135deg, ${CYAN}, #7C3AED)`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
        return [...prev, payload as Msg];
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
    setMessages(prev => [...prev, msg]);
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
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f12" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{ background: "#18181b", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingTop: 44, paddingBottom: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 16, height: 16, color: "#e2e8f0" }} />
            </button>
            <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2.5 flex-1 min-w-0">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${CYAN}33, #7C3AED33)`, border: `1.5px solid ${CYAN}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <Users style={{ width: 18, height: 18, color: CYAN }} />
                <span style={{ position: "absolute", bottom: -3, right: -3, width: 12, height: 12, borderRadius: 999, background: "#22c55e", border: "2px solid #18181b" }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Grupo Poker Winner</p>
                <p style={{ fontSize: 10.5, color: "#71717a", marginTop: 1 }}>125 participantes · {onlineCount} online</p>
              </div>
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ background: "#1c1c1f", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
              <div className="px-4 py-3">
                <p style={{ fontSize: 11, color: "#71717a", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 8, textTransform: "uppercase" }}>Participantes Activos</p>
                <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {MEMBERS.map(m => (
                    <div key={m.initials} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div style={{ width: 40, height: 40, borderRadius: 999, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${CYAN}44` }}>
                        <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12 }}>{m.initials}</span>
                      </div>
                      <span style={{ fontSize: 9, color: "#71717a", whiteSpace: "nowrap" }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-3 [&::-webkit-scrollbar]:hidden" style={{ background: "#0f0f12", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 opacity-60">
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users style={{ width: 26, height: 26, color: "#71717a" }} />
              </div>
              <p style={{ color: "#71717a", fontSize: 13.5, fontWeight: 600 }}>Sem mensagens ainda</p>
              <p style={{ color: "#52525b", fontSize: 12, textAlign: "center", maxWidth: 220 }}>Sê o primeiro a cumprimentar o grupo!</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const sameUser = prev && !prev.id.startsWith("sys") && prev.user === msg.user && !msg.isMe && !prev.isMe;
              const isSystem = msg.id.startsWith("sys");

              if (isSystem) return (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  <span style={{ fontSize: 11, color: "#52525b", background: "#1c1c1f", borderRadius: 99, padding: "4px 12px" }}>{msg.text}</span>
                </motion.div>
              );

              /* ── Minha mensagem (direita) ── */
              if (msg.isMe) return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}
                >
                  <div style={{
                    background: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                    borderRadius: "16px 4px 16px 16px",
                    padding: "9px 14px",
                    minWidth: 180,
                    maxWidth: "78%",
                    boxShadow: "0 3px 12px rgba(124,58,237,0.3)",
                  }}>
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                    {msg.text && <p style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.55, margin: 0 }}>{msg.text}</p>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{msg.time}</span>
                      <CheckCheck style={{ width: 13, height: 13, color: CYAN }} />
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
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                >
                  {!sameUser && (
                    <span style={{ fontSize: 11, color: "#a1a1aa", marginLeft: 6, fontWeight: 600, letterSpacing: "0.2px" }}>{msg.user}</span>
                  )}
                  <div style={{
                    background: "#1e1e26",
                    borderRadius: sameUser ? "16px 16px 16px 4px" : "4px 16px 16px 16px",
                    padding: "9px 14px",
                    minWidth: 180,
                    maxWidth: "78%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}>
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 6 : 0 }} />}
                    {msg.text && <p style={{ fontSize: 13.5, color: "#e2e8f0", lineHeight: 1.55, margin: 0 }}>{msg.text}</p>}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "#52525b" }}>{msg.time}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: "#18181b", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", paddingBottom: "max(22px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <Plus style={{ width: 18, height: 18, color: "#9ca3af" }} />
            </button>
            <div style={{ flex: 1, background: "#27272a", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, minHeight: 44, border: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve uma mensagem..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#e2e8f0", fontFamily: "inherit" }}
              />
              <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Smile style={{ width: 17, height: 17, color: "#52525b" }} />
              </button>
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? `linear-gradient(135deg, ${CYAN}, #00a88e)` : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", boxShadow: text.trim() ? `0 4px 14px ${CYAN}55` : "none", transition: "background 0.2s, box-shadow 0.2s" }}
            >
              {text.trim()
                ? <Send style={{ width: 17, height: 17, color: "#001a16" }} />
                : <Mic style={{ width: 17, height: 17, color: "#52525b" }} />
              }
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
