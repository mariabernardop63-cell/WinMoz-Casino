import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, MoreVertical, Plus, Send, Image as ImageIcon, Mic, Smile,
  Users, Pin, Search, Bell, Phone, Video, ChevronDown, Shield, Star
} from "lucide-react";

const CYAN = "#00D4B4";

type Msg = {
  id: string;
  user: string;
  initials: string;
  avatarBg: string;
  text?: string;
  image?: string;
  time: string;
  isMe?: boolean;
  images?: string[];
};

const INITIAL_MSGS: Msg[] = [
  {
    id: "g0", user: "Sistema", initials: "SI", avatarBg: "#374151",
    text: "📢 Temos uma sessão emocionante planeada para esta noite! Prepara-te para o torneio.",
    time: "09:00", isMe: false,
  },
  {
    id: "g1", user: "João Mondlane", initials: "JM", avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    text: "Alguém quer um desafio de Damas? Aposto 500 MZN! 🎯",
    time: "10:30", isMe: false,
  },
  {
    id: "g2", user: "Maria Santos", initials: "MS", avatarBg: "linear-gradient(135deg, #ec4899, #9d174d)",
    text: "Aceito o desafio! Mas tenho que avisar — não perco fácil 😏",
    time: "10:31", isMe: false,
  },
  {
    id: "g3", user: "Carlos Fonseca", initials: "CF", avatarBg: "linear-gradient(135deg, #10b981, #065f46)",
    text: "Eu também quero entrar! E posso vos mostrar uma estratégia infalível para o Ludo Turbo 🚀",
    time: "10:33", isMe: false,
  },
  {
    id: "g4", user: "Tu", initials: "SD", avatarBg: `linear-gradient(135deg, ${CYAN}, #7C3AED)`,
    text: "Estou a ver tudo! Quando começa a partida?",
    time: "10:35", isMe: true,
  },
  {
    id: "g5", user: "João Mondlane", initials: "JM", avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    text: "Às 20h00! Vamos todos? Pode ser um torneio em grupo 🏆",
    time: "10:36", isMe: false,
  },
  {
    id: "g6", user: "Ana Ribeiro", initials: "AR", avatarBg: "linear-gradient(135deg, #f59e0b, #b45309)",
    text: "Conta comigo! Já fiz a recarga. Só estou à espera da hora 🔥",
    time: "10:38", isMe: false,
  },
  {
    id: "g7", user: "Tu", initials: "SD", avatarBg: `linear-gradient(135deg, ${CYAN}, #7C3AED)`,
    text: "Perfeito, às 20h00 então. Boa sorte a todos! 🎮",
    time: "10:39", isMe: true,
  },
  {
    id: "g8", user: "Pedro Alves", initials: "PA", avatarBg: "linear-gradient(135deg, #8b5cf6, #4c1d95)",
    text: "Digitando....",
    time: "10:40", isMe: false,
  },
];

const MEMBERS = [
  { initials: "JM", bg: "linear-gradient(135deg, #3b82f6, #1d4ed8)", name: "João M." },
  { initials: "MS", bg: "linear-gradient(135deg, #ec4899, #9d174d)", name: "Maria S." },
  { initials: "CF", bg: "linear-gradient(135deg, #10b981, #065f46)", name: "Carlos F." },
  { initials: "AR", bg: "linear-gradient(135deg, #f59e0b, #b45309)", name: "Ana R." },
  { initials: "PA", bg: "linear-gradient(135deg, #8b5cf6, #4c1d95)", name: "Pedro A." },
  { initials: "+", bg: "#374151", name: "+120" },
];

const AUTO = [
  "Boa estratégia! 👍",
  "Já estou pronto para jogar! 🎯",
  "Alguém sabe o código da sala?",
  "Vamos nessa! 💪",
  "Boa sorte a todos! 🏆",
  "Que partida incrível! 🔥",
];

const USERS = [
  { name: "João Mondlane", initials: "JM", avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { name: "Maria Santos", initials: "MS", avatarBg: "linear-gradient(135deg, #ec4899, #9d174d)" },
  { name: "Carlos Fonseca", initials: "CF", avatarBg: "linear-gradient(135deg, #10b981, #065f46)" },
  { name: "Ana Ribeiro", initials: "AR", avatarBg: "linear-gradient(135deg, #f59e0b, #b45309)" },
];

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function GrupoChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MSGS);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlineCount] = useState(39);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const interval = setInterval(() => {
      const u = USERS[Math.floor(Math.random() * USERS.length)];
      const txt = AUTO[Math.floor(Math.random() * AUTO.length)];
      setMessages(p => [...p, {
        id: Date.now().toString(), user: u.name, initials: u.initials,
        avatarBg: u.avatarBg, text: txt, time: nowTime(),
      }]);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const sendMsg = (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;
    setMessages(p => [...p, {
      id: Date.now().toString(), user: "Tu", initials: "SD",
      avatarBg: `linear-gradient(135deg, ${CYAN}, #7C3AED)`,
      text: msgText.trim() || undefined, image: img,
      time: nowTime(), isMe: true,
    }]);
    setText("");
    setTyping(true);
    setTimeout(() => setTyping(false), 2500 + Math.random() * 1500);
  };

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => sendMsg("", ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const myProfile = localStorage.getItem("winmoz_user_avatar");

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0f0f12" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{ background: "#18181b", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingTop: 52, paddingBottom: 12, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 17, height: 17, color: "#e2e8f0" }} />
            </button>
            <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2.5 flex-1 min-w-0">
              <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${CYAN}33, #7C3AED33)`, border: `1.5px solid ${CYAN}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <Users style={{ width: 19, height: 19, color: CYAN }} />
                <span style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: 999, background: "#22c55e", border: "2px solid #18181b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "#fff" }} />
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14.5 }}>Grupo em Equipe</p>
                <p style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>125 participantes · {onlineCount} online</p>
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              <button style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Search style={{ width: 14, height: 14, color: "#9ca3af" }} />
              </button>
              <button style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Phone style={{ width: 14, height: 14, color: "#9ca3af" }} />
              </button>
              <button onClick={() => setMenuOpen(v => !v)} style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <MoreVertical style={{ width: 14, height: 14, color: "#9ca3af" }} />
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ position: "absolute", top: 38, right: 0, background: "#27272a", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", padding: "6px 0", width: 200, zIndex: 100, border: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Ver participantes", "Silenciar grupo", "Pesquisar no chat", "Sair do grupo"].map(item => (
                      <button key={item} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "none", border: "none", fontSize: 13, color: item === "Sair do grupo" ? "#f87171" : "#e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>
                        {item}
                      </button>
                    ))}
                  </motion.div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Group info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ background: "#1c1c1f", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
              <div className="px-4 py-3">
                <p style={{ fontSize: 11, color: "#71717a", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 8 }}>PARTICIPANTES ACTIVOS</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {MEMBERS.map(m => (
                    <div key={m.initials} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div style={{ width: 38, height: 38, borderRadius: 999, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${CYAN}44` }}>
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

        {/* Announcement banner */}
        <div style={{ background: `linear-gradient(90deg, ${CYAN}18, #7C3AED18)`, borderBottom: `1px solid ${CYAN}22`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Pin style={{ width: 13, height: 13, color: CYAN, flexShrink: 0 }} />
          <p style={{ fontSize: 11.5, color: "#e2e8f0", flex: 1, lineHeight: 1.4 }}>
            <span style={{ color: CYAN, fontWeight: 700 }}>Anúncio:</span> Torneio de Damas às 20h00 — Prémio total: 5.000 MZN! Inscreve-te já.
          </p>
          <ChevronDown style={{ width: 13, height: 13, color: "#71717a", flexShrink: 0 }} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3" style={{ background: "#0f0f12" }} onClick={() => setMenuOpen(false)}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const sameUser = prevMsg && prevMsg.user === msg.user && !msg.isMe;
              return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`flex items-end gap-2 ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!msg.isMe && (
                    <div style={{ width: sameUser ? 30 : 30, height: 30, borderRadius: 999, background: sameUser ? "transparent" : msg.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, visibility: sameUser ? "hidden" : "visible" }}>
                      <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 10 }}>{msg.initials}</span>
                    </div>
                  )}
                  {msg.isMe && (
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: msg.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {myProfile
                        ? <img src={myProfile} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 10 }}>SD</span>
                      }
                    </div>
                  )}
                  <div style={{ maxWidth: "74%" }}>
                    {!msg.isMe && !sameUser && (
                      <p style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600, marginBottom: 3, paddingLeft: 2 }}>{msg.user}</p>
                    )}
                    {msg.image && (
                      <img src={msg.image} alt="img" style={{ borderRadius: 12, maxWidth: "100%", maxHeight: 180, objectFit: "cover", display: "block", marginBottom: msg.text ? 4 : 0 }} />
                    )}
                    {msg.text && (
                      <div style={{
                        background: msg.isMe ? `linear-gradient(135deg, ${CYAN}, #00a88e)` : "#27272a",
                        borderRadius: msg.isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        padding: "9px 13px",
                        boxShadow: msg.isMe ? `0 3px 12px ${CYAN}44` : "0 1px 4px rgba(0,0,0,0.3)",
                      }}>
                        <p style={{ fontSize: 13.5, color: msg.isMe ? "#001a16" : "#e2e8f0", lineHeight: 1.5, margin: 0, fontWeight: msg.isMe ? 600 : 400 }}>{msg.text}</p>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${msg.isMe ? "justify-end" : "justify-start"}`}>
                      <span style={{ fontSize: 10, color: "#52525b" }}>{msg.time}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing */}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <div style={{ width: 30, height: 30, borderRadius: 999, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>JM</span>
                </div>
                <div style={{ background: "#27272a", borderRadius: "4px 18px 18px 18px", padding: "10px 14px" }}>
                  <p style={{ fontSize: 11.5, color: "#9ca3af", fontStyle: "italic" }}>A digitar...</p>
                </div>
              </motion.div>
            )}
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
              <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <ImageIcon style={{ width: 17, height: 17, color: "#52525b" }} />
              </button>
              <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Smile style={{ width: 17, height: 17, color: "#52525b" }} />
              </button>
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? `linear-gradient(135deg, ${CYAN}, #00a88e)` : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", boxShadow: text.trim() ? `0 4px 14px ${CYAN}55` : "none", transition: "background 0.2s, box-shadow 0.2s" }}>
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
