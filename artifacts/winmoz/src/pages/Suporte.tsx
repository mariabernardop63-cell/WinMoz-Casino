import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, CheckCheck, X } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

const CYAN = "#00D4B4";

type Msg = {
  id: string;
  from: "support" | "user";
  text?: string;
  image?: string;
  time: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

const INITIAL: Msg[] = [
  {
    id: "i1", from: "support",
    text: "Olá! 👋 Bem-vindo ao suporte da Equipe Poker W. Estou aqui para ajudar.",
    time: nowTime(),
  },
  {
    id: "i2", from: "support",
    text: "Em que posso ajudar hoje? Escreve a tua dúvida ou escolhe um dos temas abaixo:",
    time: nowTime(),
  },
];

const QUICK = [
  "Como depositar?",
  "Quero levantar dinheiro",
  "Código promocional",
  "Problema com a conta",
  "Regras dos jogos",
  "Falar com alguém",
];

export default function Suporte() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMsg = async (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;

    const userMsg: Msg = {
      id: Date.now().toString(),
      from: "user",
      text: msgText.trim() || undefined,
      image: img,
      time: nowTime(),
    };
    setMessages(p => [...p, userMsg]);
    setText("");
    setShowQuick(false);
    setTyping(true);

    const newHistory: ChatMsg[] = [...history, { role: "user", content: msgText.trim() || "[imagem enviada]" }];
    setHistory(newHistory);

    try {
      const res = await fetch(`${API_BASE}/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      const data = await res.json();
      const reply: string = data.reply ?? "Desculpa, ocorreu um erro. Tenta novamente.";

      setTyping(false);
      setMessages(p => [...p, { id: `${Date.now()}_s`, from: "support", text: reply, time: nowTime() }]);
      setHistory(h => [...h, { role: "assistant", content: reply }]);
    } catch {
      setTyping(false);
      setMessages(p => [...p, {
        id: `${Date.now()}_err`,
        from: "support",
        text: "Ups, tive um problema de ligação. Por favor tenta novamente em instantes. 🙏",
        time: nowTime(),
      }]);
    }
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
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#f0f0f5" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #1a0533 0%, #3b1080 100%)", paddingTop: 40, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, flexShrink: 0, boxShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/perfil")} style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
            <div className="relative flex-shrink-0">
              <div style={{ width: 42, height: 42, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(63,63,70,0.6)" }}>
                <svg width="18" height="22" viewBox="0 0 18 26" fill="none">
                  <path d="M1 1 L9 1 L6 25 L-2 25 Z" fill="#fff"/>
                  <path d="M11 1 L17 1 L14 25 L8 25 Z" fill="#fff" opacity="0.38"/>
                </svg>
              </div>
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2.5px solid #1a0533" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.2px" }}>Atendimento 24h</p>
              <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 500, marginTop: 1 }}>● ONLINE 24H/D</p>
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MoreVertical style={{ width: 15, height: 15, color: "#fff" }} />
              </button>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ position: "absolute", top: 42, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "6px 0", width: 210, zIndex: 100 }}>
                  {[
                    { label: "📧  support@winmoz.co.mz" },
                    { label: "📱  WhatsApp: +258 84 000 0000" },
                    { label: "✕  Fechar" },
                  ].map(item => (
                    <button key={item.label} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "none", border: "none", fontSize: 12.5, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3" style={{ background: "#eae8f0" }} onClick={() => setMenuOpen(false)}>
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px" style={{ background: "#c4c4cc" }} />
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.5px" }}>HOJE</span>
            <div className="flex-1 h-px" style={{ background: "#c4c4cc" }} />
          </div>

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}
              >
                {msg.from === "support" && (
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(63,63,70,0.5)", marginBottom: 2 }}>
                    <svg width="13" height="16" viewBox="0 0 18 26" fill="none">
                      <path d="M1 1 L9 1 L6 25 L-2 25 Z" fill="#fff"/>
                      <path d="M11 1 L17 1 L14 25 L8 25 Z" fill="#fff" opacity="0.38"/>
                    </svg>
                  </div>
                )}
                <div style={{ maxWidth: "80%" }}>
                  {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 14, maxWidth: "100%", maxHeight: 200, objectFit: "cover", display: "block", marginBottom: msg.text ? 4 : 0 }} />}
                  {msg.text && (
                    <div style={{
                      background: msg.from === "support" ? "#ffffff" : "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                      borderRadius: msg.from === "support" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                      padding: "10px 14px",
                      boxShadow: msg.from === "support" ? "0 1px 6px rgba(0,0,0,0.08)" : "0 3px 14px rgba(124,58,237,0.3)",
                      minWidth: 80,
                    }}>
                      <p style={{ fontSize: 13.5, color: msg.from === "support" ? "#111827" : "#ffffff", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{msg.text}</p>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, justifyContent: msg.from === "user" ? "flex-end" : "flex-start" }}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{msg.time}</span>
                    {msg.from === "user" && <CheckCheck style={{ width: 12, height: 12, color: CYAN }} />}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="16" viewBox="0 0 18 26" fill="none">
                    <path d="M1 1 L9 1 L6 25 L-2 25 Z" fill="#fff"/>
                    <path d="M11 1 L17 1 L14 25 L8 25 Z" fill="#fff" opacity="0.38"/>
                  </svg>
                </div>
                <div style={{ background: "#fff", borderRadius: "4px 18px 18px 18px", padding: "12px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.65, repeat: Infinity, delay, ease: "easeInOut" }}
                        style={{ width: 7, height: 7, borderRadius: 999, background: "#9ca3af" }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick replies */}
          {showQuick && !typing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingTop: 8 }}>
              <p style={{ width: "100%", textAlign: "center", fontSize: 11, color: "#9ca3af", marginBottom: 0 }}>Escolhe um tema ou escreve à vontade:</p>
              {QUICK.map(q => (
                <button key={q} onClick={() => sendMsg(q)} style={{ background: "#fff", border: "1.5px solid #e2e2ea", borderRadius: 20, padding: "8px 14px", fontSize: 12.5, color: "#374151", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  {q}
                </button>
              ))}
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ background: "#fff", borderTop: "1px solid #ebebf0", padding: "10px 12px", paddingBottom: "max(24px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 999, background: "#f5f5f7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <ImageIcon style={{ width: 18, height: 18, color: "#9ca3af" }} />
            </button>
            <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !typing) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve aqui a tua dúvida…"
                disabled={typing}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#111827", fontFamily: "inherit" }}
              />
            </div>
            <motion.button
              onClick={() => !typing && sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              disabled={typing || !text.trim()}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() && !typing ? "linear-gradient(135deg, #7C3AED, #4C1D95)" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: text.trim() && !typing ? "pointer" : "default", boxShadow: text.trim() && !typing ? "0 4px 14px rgba(124,58,237,0.4)" : "none" }}>
              <Send style={{ width: 17, height: 17, color: text.trim() && !typing ? "#fff" : "#9ca3af" }} />
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
