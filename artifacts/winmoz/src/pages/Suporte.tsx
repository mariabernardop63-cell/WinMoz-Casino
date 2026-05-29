import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Image as ImageIcon, Phone, MoreVertical, CheckCheck, Smile, X, Search, Info } from "lucide-react";

const CYAN = "#00D4B4";

type Msg = {
  id: string;
  from: "support" | "user";
  text?: string;
  image?: string;
  time: string;
};

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

const INITIAL: Msg[] = [
  { id: "i1", from: "support", text: "Olá! 👋 Bem-vindo ao suporte WinMoz. Em que podemos ajudar hoje?", time: "10:30" },
  { id: "i2", from: "support", text: "A nossa equipa está disponível 24h/7 dias para qualquer questão relacionada com depósitos, levamentos, jogos ou conta.", time: "10:31" },
];

const QUICK = [
  "Como fazer um depósito?",
  "Problema com levamento",
  "Código promocional",
  "Conta bloqueada",
];

const AUTO_REPLIES = [
  "Recebemos a sua mensagem! Um agente irá responder em instantes. ⚡",
  "Obrigado por entrar em contacto. A nossa equipa está a analisar a sua situação.",
  "Compreendemos a sua questão. Aguarde enquanto verificamos a sua conta.",
  "Pedimos desculpa pelo inconveniente. Estamos a tratar do seu caso com prioridade.",
];

export default function Suporte() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoIdx = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMsg = (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;
    const m: Msg = { id: Date.now().toString(), from: "user", text: msgText.trim() || undefined, image: img, time: nowTime() };
    setMessages(p => [...p, m]);
    setText("");
    setShowQuick(false);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const reply = AUTO_REPLIES[autoIdx.current % AUTO_REPLIES.length];
      autoIdx.current++;
      setMessages(p => [...p, { id: Date.now() + "_s", from: "support", text: reply, time: nowTime() }]);
    }, 1800 + Math.random() * 1200);
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
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#f5f5f7" }}>
      <div className="w-full max-w-[430px] flex flex-col" style={{ height: "100dvh" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #1a0533 0%, #3b1080 100%)", paddingTop: 40, paddingBottom: 9, paddingLeft: 16, paddingRight: 16, flexShrink: 0, boxShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/perfil")} style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
            <div className="relative flex-shrink-0">
              <div style={{ width: 42, height: 42, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px ${CYAN}55` }}>
                <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13 }}>EQ</span>
              </div>
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2.5px solid #1a0533" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.2px" }}>EQUIPE POKER 24H</p>
              <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 500, marginTop: 1 }}>● Online agora · Responde em ~2 min</p>
            </div>
            <button onClick={() => setInfoOpen(true)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Phone style={{ width: 15, height: 15, color: "#fff" }} />
            </button>
            <button onClick={() => setMenuOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <MoreVertical style={{ width: 15, height: 15, color: "#fff" }} />
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ position: "absolute", top: 40, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "6px 0", width: 180, zIndex: 100 }}>
                  {["Pesquisar conversa", "Silenciar notificações", "Apagar conversa", "Bloquear"].map(item => (
                    <button key={item} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "none", border: "none", fontSize: 13, color: item === "Bloquear" ? "#dc2626" : "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                      {item}
                    </button>
                  ))}
                </motion.div>
              )}
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3" style={{ background: "#f0f0f5" }} onClick={() => setMenuOpen(false)}>
          {/* Date divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px" style={{ background: "#d1d5db" }} />
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.5px" }}>HOJE</span>
            <div className="flex-1 h-px" style={{ background: "#d1d5db" }} />
          </div>

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-end gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.from === "support" && (
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 8px ${CYAN}44` }}>
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>EQ</span>
                  </div>
                )}
                <div style={{ maxWidth: "74%" }}>
                  {msg.image && (
                    <img src={msg.image} alt="img" style={{ borderRadius: 14, maxWidth: "100%", maxHeight: 200, objectFit: "cover", display: "block", marginBottom: msg.text ? 4 : 0 }} />
                  )}
                  {msg.text && (
                    <div style={{
                      background: msg.from === "support" ? "#ffffff" : "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
                      borderRadius: msg.from === "support" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                      padding: "10px 14px",
                      boxShadow: msg.from === "support" ? "0 1px 6px rgba(0,0,0,0.07)" : "0 3px 14px rgba(225,29,72,0.3)",
                    }}>
                      <p style={{ fontSize: 13.5, color: msg.from === "support" ? "#111827" : "#ffffff", lineHeight: 1.55, margin: 0 }}>{msg.text}</p>
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-1 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{msg.time}</span>
                    {msg.from === "user" && <CheckCheck style={{ width: 12, height: 12, color: CYAN }} />}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing */}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>EQ</span>
                </div>
                <div style={{ background: "#fff", borderRadius: "4px 18px 18px 18px", padding: "12px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
                  <div className="flex gap-1 items-center">
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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 justify-center pt-2">
              <p style={{ width: "100%", textAlign: "center", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Perguntas frequentes:</p>
              {QUICK.map(q => (
                <button key={q} onClick={() => sendMsg(q)} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 20, padding: "8px 14px", fontSize: 12.5, color: "#374151", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.15s" }}>
                  {q}
                </button>
              ))}
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ background: "#fff", borderTop: "1px solid #f0f0f0", padding: "10px 12px", paddingBottom: "max(24px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as any} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 999, background: "#f5f5f7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <ImageIcon style={{ width: 18, height: 18, color: "#9ca3af" }} />
            </button>
            <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 22, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve uma mensagem..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#111827", fontFamily: "inherit" }}
              />
              <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Smile style={{ width: 18, height: 18, color: "#9ca3af" }} />
              </button>
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? `linear-gradient(135deg, #7C3AED, #4C1D95)` : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", transition: "background 0.2s", boxShadow: text.trim() ? "0 4px 14px rgba(124,58,237,0.4)" : "none" }}>
              <Send style={{ width: 17, height: 17, color: text.trim() ? "#fff" : "#9ca3af" }} />
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
