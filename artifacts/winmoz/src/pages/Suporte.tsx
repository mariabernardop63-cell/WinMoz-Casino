import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Send, Image as ImageIcon, CheckCheck,
  Sparkles, Users,
} from "lucide-react";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { BrandMark } from "@/components/BrandLogo";

/* ── Infos oficiais da Poker Winner ── */
const WHATSAPP_LABEL = "+258 83 503 0915";

async function callSupportAIMessage(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<{ reply: string; degraded: boolean }> {
  const trimmed = messages.slice(-16);
  const session = await getSessionWithRefresh();
  const token = session?.access_token;
  if (!token) {
    return {
      reply: `A tua sessão expirou. Entra novamente para continuares o atendimento, ou fala connosco no WhatsApp: ${WHATSAPP_LABEL}.`,
      degraded: true,
    };
  }
  const res = await fetch("/api/support/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: trimmed }),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { reply: `O atendimento inteligente está temporariamente indisponível. Fala connosco no WhatsApp: ${WHATSAPP_LABEL}.`, degraded: true };
  }
  const data = await res.json() as { reply?: string; error?: string; degraded?: boolean };
  if (!res.ok) {
    if (res.status === 429) {
      return { reply: "Estás a enviar mensagens muito rápido. Aguarda um momento e tenta novamente 🙂", degraded: true };
    }
    return { reply: `Tive um problema a responder. Tenta novamente ou fala connosco no WhatsApp: ${WHATSAPP_LABEL}.`, degraded: true };
  }
  return { reply: data.reply ?? "Desculpa, não consegui processar. Tenta novamente.", degraded: Boolean(data.degraded) };
}

async function callSupportAI(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<string> {
  const first = await callSupportAIMessage(messages);
  if (!first.degraded) return first.reply;
  await new Promise(r => setTimeout(r, 1200));
  const second = await callSupportAIMessage(messages);
  return second.reply;
}

const CYAN = "#00D4B4";
const BRAND_BG = "#0c0c10";

type Msg = {
  id: string;
  from: "support" | "user";
  text?: string;
  image?: string;
  time: string;
  sender?: "user" | "admin" | "ai";
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function makeInitial(): Msg[] {
  const brand = (() => {
    try { return localStorage.getItem("wm_brand_poker_winner") === "1" ? "Poker Winner" : "Mozbet"; }
    catch { return "Poker Winner"; }
  })();
  return [
    {
      id: "i1", from: "support", sender: "ai",
      text: `Olá! 👋 Bem-vindo ao atendimento da Equipa ${brand}. Sou a Lia, a tua assistente virtual — estou online 24h para te ajudar.`,
      time: nowTime(),
    },
    {
      id: "i2", from: "support", sender: "ai",
      text: "Podes perguntar sobre recargas, levantamentos, jogos, taxas ou a tua conta. Escreve à vontade 💬",
      time: nowTime(),
    },
  ];
}

async function saveMsgToSupabase(
  userId: string,
  userName: string,
  sender: "user" | "admin" | "ai",
  content: string
) {
  const { error } = await supabase.from("support_messages").insert({
    user_id: userId,
    user_name: userName,
    sender,
    content,
  });
  if (error) {
    console.error("[saveMsgToSupabase] Falha ao gravar mensagem:", error.message, error.code);
  }
}

async function isAiModeEnabled(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "support_ai_mode")
      .maybeSingle();
    const val = (data as { value: string } | null)?.value;
    if (val === undefined || val === null) return true;
    return val !== "false";
  } catch {
    return true;
  }
}

export default function Suporte() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>(makeInitial());
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = profile?.full_name ?? profile?.phone ?? user?.email ?? "utilizador";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!user?.id || loaded) return;
    setLoaded(true);

    supabase
      .from("support_messages")
      .select("id, sender, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const dbMsgs: Msg[] = data.map(m => ({
          id: m.id,
          from: (m.sender === "user" ? "user" : "support") as "user" | "support",
          sender: m.sender as "user" | "admin" | "ai",
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        }));
        setMessages([...makeInitial(), ...dbMsgs]);

        const chatHistory: ChatMsg[] = data
          .filter(m => m.sender === "user" || m.sender === "ai")
          .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content }));
        setHistory(chatHistory);
      });
  }, [user?.id, loaded]);

  useEffect(() => {
    if (!user?.id || !loaded) return;
    const channel = supabase
      .channel(`support-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as Record<string, unknown>;
          if (m.sender === "admin") {
            const newMsg: Msg = {
              id: m.id as string,
              from: "support",
              sender: "admin",
              text: m.content as string,
              time: new Date(m.created_at as string).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages(prev => {
              if (prev.some(p => p.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loaded]);

  const sendMsg = async (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;

    const userMsg: Msg = {
      id: Date.now().toString(),
      from: "user",
      sender: "user",
      text: msgText.trim() || undefined,
      image: img,
      time: nowTime(),
    };
    setMessages(p => [...p, userMsg]);
    setText("");

    if (user?.id && msgText.trim()) {
      await saveMsgToSupabase(user.id, userName, "user", msgText.trim());
    }

    const aiEnabled = await isAiModeEnabled();

    if (!aiEnabled) {
      setTyping(true);
      await new Promise(r => setTimeout(r, 800));
      setTyping(false);
      const waitMsg: Msg = {
        id: `${Date.now()}_wait`,
        from: "support",
        sender: "ai",
        text: "✅ A tua mensagem foi recebida com sucesso. Um agente da nossa equipa irá responder em breve. Agradecemos a paciência! 🙏",
        time: nowTime(),
      };
      setMessages(p => [...p, waitMsg]);
      if (user?.id) {
        await saveMsgToSupabase(user.id, userName, "ai", waitMsg.text!);
      }
      return;
    }

    const newHistory: ChatMsg[] = [...history, { role: "user", content: msgText.trim() || "[imagem enviada]" }];
    setHistory(newHistory);
    setTyping(true);

    try {
      const reply = await callSupportAI(newHistory);
      setTyping(false);
      const aiMsg: Msg = { id: `${Date.now()}_s`, from: "support", sender: "ai", text: reply, time: nowTime() };
      setMessages(p => [...p, aiMsg]);
      setHistory(h => [...h, { role: "assistant", content: reply }]);
      if (user?.id) {
        await saveMsgToSupabase(user.id, userName, "ai", reply);
      }
    } catch {
      setTyping(false);
      const errReply = `Tive um problema de ligação. Tenta novamente ou fala connosco no WhatsApp: ${WHATSAPP_LABEL}.`;
      const errMsg: Msg = {
        id: `${Date.now()}_err`,
        from: "support",
        sender: "ai",
        text: errReply,
        time: nowTime(),
      };
      setMessages(p => [...p, errMsg]);
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
        <div style={{ background: BRAND_BG, paddingTop: 40, flexShrink: 0, boxShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px 16px" }}>
            <button onClick={() => setLocation("/perfil")} style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
            <div className="relative flex-shrink-0">
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(63,63,70,0.6)", border: "2px solid rgba(255,255,255,0.14)" }}>
                <BrandMark size={24} variant="light" />
              </div>
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2.5px solid #1a0533" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: 5 }}>
                Atendimento 24h
                <Sparkles style={{ width: 12, height: 12, color: "#f5c542" }} />
              </p>
              <p style={{ fontSize: 10.5, color: "#22c55e", fontWeight: 600, marginTop: 2 }}>● ONLINE · resposta imediata</p>
            </div>
            <a href="/grupo-chat" title="Grupo de chat"
              style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textDecoration: "none" }}>
              <Users style={{ width: 16, height: 16, color: "#fff" }} />
            </a>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#eae8f0", padding: "20px 18px 16px" }}>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: "#cfcdd8" }} />
            <span style={{ fontSize: 10, color: "#a5a3b0", fontWeight: 700, letterSpacing: "1px" }}>HOJE</span>
            <div className="flex-1 h-px" style={{ background: "#cfcdd8" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 10 }}
                >
                  {msg.from === "support" && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 999,
                      background: msg.sender === "admin" ? "linear-gradient(135deg, #1a0533, #3b1080)" : "#3f3f46",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, boxShadow: "0 2px 8px rgba(63,63,70,0.45)", marginBottom: 2,
                      overflow: "hidden",
                    }}>
                      {msg.sender === "admin"
                        ? <BrandMark size={16} variant="light" />
                        : <BrandMark size={15} variant="light" />
                      }
                    </div>
                  )}
                  <div style={{ maxWidth: "78%", minWidth: 0 }}>
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 14, maxWidth: "100%", maxHeight: 200, objectFit: "cover", display: "block", marginBottom: 6, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }} />}
                    {msg.text && (
                      <div style={{
                        background: msg.from === "support" ? "#ffffff" : "#111827",
                        borderRadius: msg.from === "support" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                        padding: "12px 16px",
                        boxShadow: msg.from === "support" ? "0 1px 8px rgba(0,0,0,0.08)" : "0 3px 16px rgba(0,0,0,0.25)",
                      }}>
                        {msg.sender === "admin" && (
                          <p style={{ fontSize: 10, color: "#7c3aed", fontWeight: 800, marginBottom: 4, letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 4 }}>
                            EQUIPA · {localStorage.getItem("wm_brand_poker_winner") === "1" ? "Poker Winner" : "Mozbet"}
                          </p>
                        )}
                        <p style={{ fontSize: 14, color: msg.from === "support" ? "#1f2937" : "#ffffff", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line", wordBreak: "break-word" }}>{msg.text}</p>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, justifyContent: msg.from === "user" ? "flex-end" : "flex-start", padding: "0 2px" }}>
                      <span style={{ fontSize: 10, color: "#a5a3b0", fontWeight: 500 }}>{msg.time}</span>
                      {msg.from === "user" && <CheckCheck style={{ width: 13, height: 13, color: CYAN }} />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {typing && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BrandMark size={15} variant="light" />
                  </div>
                  <div style={{ background: "#fff", borderRadius: "4px 16px 16px 16px", padding: "14px 18px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.65, repeat: Infinity, delay, ease: "easeInOut" }}
                        style={{ width: 6, height: 6, borderRadius: 999, background: "#9ca3af" }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div style={{ background: "#fff", borderTop: "1px solid #ebebf0", padding: "12px 16px", paddingBottom: "max(24px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as React.RefObject<HTMLInputElement>} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: 42, height: 42, borderRadius: 999, background: "#f5f5f7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <ImageIcon style={{ width: 19, height: 19, color: "#9ca3af" }} />
            </button>
            <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 22, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, minHeight: 46, border: "1px solid #ececf2" }}>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !typing) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve aqui a tua dúvida…"
                disabled={typing}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#111827", fontFamily: "inherit" }}
              />
            </div>
            <motion.button
              onClick={() => !typing && sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              disabled={typing || !text.trim()}
              style={{ width: 46, height: 46, borderRadius: 999, background: text.trim() && !typing ? "#111827" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: text.trim() && !typing ? "pointer" : "default", boxShadow: text.trim() && !typing ? "0 4px 14px rgba(0,0,0,0.25)" : "none" }}>
              <Send style={{ width: 18, height: 18, color: text.trim() && !typing ? "#fff" : "#9ca3af" }} />
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
