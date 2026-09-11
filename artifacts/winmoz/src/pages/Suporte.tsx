import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Send, Image as ImageIcon, MoreVertical, CheckCheck,
  Users, Mail, Sparkles,
} from "lucide-react";
import { supabase, getSessionWithRefresh } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { BrandMark } from "@/components/BrandLogo";

/* ── Infos oficiais da Poker Winner ── */
const WHATSAPP_SUPPORT = "258835030915";
const WHATSAPP_LABEL   = "+258 83 503 0915";
const SUPPORT_EMAIL    = "support@pokerw.co.mz";
const WHATSAPP_GROUP   = "https://chat.whatsapp.com/IreRFFLnFSKIEFNzjmKLv2";

/* Chama o endpoint serverless Vercel — a chave da IA (b.ia) fica apenas no
   servidor, nunca exposta no browser. O endpoint EXIGE autenticação (Bearer
   token), por isso o pedido inclui sempre a sessão do utilizador.
   Resiliência: se o provider falhar de forma transitória (o backend responde
   `degraded: true`), repete uma vez automaticamente antes de mostrar erro. */
async function callSupportAIMessage(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<{ reply: string; degraded: boolean }> {
  // O backend limita a conversa a 20 mensagens — envia só as últimas 16
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: trimmed }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // Vercel served index.html instead of the function — function not deployed or routing issue
    console.error("[callSupportAI] Resposta não-JSON recebida. Status:", res.status, "Content-Type:", contentType);
    return { reply: `O atendimento inteligente está temporariamente indisponível. Fala connosco no WhatsApp: ${WHATSAPP_LABEL}.`, degraded: true };
  }

  const data = await res.json() as { reply?: string; error?: string; degraded?: boolean };

  if (!res.ok) {
    console.error("[callSupportAI] Erro da API:", res.status, data);
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

  // Uma falha transitória do provider não deve chegar ao utilizador — repete
  // uma vez após um pequeno intervalo.
  await new Promise(r => setTimeout(r, 1200));
  const second = await callSupportAIMessage(messages);
  return second.reply;
}

const CYAN = "#00D4B4";
const BRAND_BG = "linear-gradient(135deg, #1a0533 0%, #3b1080 100%)";

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
      text: "Podes perguntar sobre recargas, levantamentos, jogos, taxas ou a tua conta. Escolhe um tema abaixo ou escreve à vontade 💬",
      time: nowTime(),
    },
  ];
}

const QUICK = [
  "Como carrego saldo?",
  "Comprar recarga no WhatsApp",
  "Como levantar dinheiro?",
  "Quais as taxas?",
  "Como funcionam os jogos?",
  "Entrar no grupo do WhatsApp",
];

async function saveMsgToSupabase(
  userId: string,
  userName: string,
  sender: "user" | "admin" | "ai",
  content: string
) {
  const { error } = await supabase.from("support_messages").insert({
    user_id:   userId,
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

/* Botão de acção rápida (WhatsApp / grupo) */
function ActionLink({ href, icon, label, accent }: {
  href: string; icon: React.ReactNode; label: string; accent: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
      <motion.div whileTap={{ scale: 0.96 }}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12, padding: "8px 10px",
          cursor: "pointer",
        }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </motion.div>
    </a>
  );
}

export default function Suporte() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const [messages, setMessages]   = useState<Msg[]>(makeInitial());
  const [history, setHistory]     = useState<ChatMsg[]>([]);
  const [text, setText]           = useState("");
  const [typing, setTyping]       = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

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
          id:     m.id,
          from:   (m.sender === "user" ? "user" : "support") as "user" | "support",
          sender: m.sender as "user" | "admin" | "ai",
          text:   m.content,
          time:   new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        }));
        setMessages([...makeInitial(), ...dbMsgs]);
        setShowQuick(false);

        const chatHistory: ChatMsg[] = data
          .filter(m => m.sender === "user" || m.sender === "ai")
          .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content }));
        setHistory(chatHistory);
      });
  }, [user?.id, loaded]);

  // Realtime: receive admin replies instantly
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
              id:     m.id as string,
              from:   "support",
              sender: "admin",
              text:   m.content as string,
              time:   new Date(m.created_at as string).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
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

    // Shortcut: abrir o grupo do WhatsApp
    if (msgText.trim().toLowerCase().includes("grupo do whatsapp")) {
      const userMsg: Msg = {
        id: Date.now().toString(), from: "user", sender: "user", text: msgText, time: nowTime(),
      };
      setMessages(p => [...p, userMsg]);
      setShowQuick(false);
      if (user?.id) await saveMsgToSupabase(user.id, userName, "user", msgText.trim());
      setTyping(true);
      await new Promise(r => setTimeout(r, 600));
      setTyping(false);
      const linkMsg: Msg = {
        id: `${Date.now()}_grp`, from: "support", sender: "ai",
        text: `Claro! Este é o link do nosso grupo oficial no WhatsApp 👥\n${WHATSAPP_GROUP}\n\nEntras para ver dicas, sorteios e falar com a comunidade 🎉`,
        time: nowTime(),
      };
      setMessages(p => [...p, linkMsg]);
      if (user?.id) await saveMsgToSupabase(user.id, userName, "ai", linkMsg.text!);
      window.open(WHATSAPP_GROUP, "_blank", "noopener");
      return;
    }

    const userMsg: Msg = {
      id:   Date.now().toString(),
      from: "user",
      sender: "user",
      text: msgText.trim() || undefined,
      image: img,
      time: nowTime(),
    };
    setMessages(p => [...p, userMsg]);
    setText("");
    setShowQuick(false);

    if (user?.id && msgText.trim()) {
      await saveMsgToSupabase(user.id, userName, "user", msgText.trim());
    }

    // Check if AI mode is enabled
    const aiEnabled = await isAiModeEnabled();

    if (!aiEnabled) {
      // AI mode is OFF — admin will respond manually
      setTyping(true);
      await new Promise(r => setTimeout(r, 800));
      setTyping(false);
      const waitMsg: Msg = {
        id:     `${Date.now()}_wait`,
        from:   "support",
        sender: "ai",
        text:   "✅ A tua mensagem foi recebida com sucesso. Um agente da nossa equipa irá responder em breve. Agradecemos a paciência! 🙏",
        time:   nowTime(),
      };
      setMessages(p => [...p, waitMsg]);

      if (user?.id) {
        await saveMsgToSupabase(user.id, userName, "ai", waitMsg.text!);
      }
      return;
    }

    // AI mode is ON — call the support AI (server-side, key never exposed)
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
        id:     `${Date.now()}_err`,
        from:   "support",
        sender: "ai",
        text:   errReply,
        time:   nowTime(),
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

        {/* ── Header ── */}
        <div style={{ background: BRAND_BG, paddingTop: 40, flexShrink: 0, boxShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px 12px" }}>
            <button onClick={() => setLocation("/perfil")} style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
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
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MoreVertical style={{ width: 15, height: 15, color: "#fff" }} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    style={{ position: "absolute", top: 42, right: 0, background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.22)", padding: "8px", width: 236, zIndex: 100 }}>
                    <a href={`https://wa.me/${WHATSAPP_SUPPORT}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        </span>
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", margin: 0 }}>WhatsApp oficial</p>
                          <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{WHATSAPP_LABEL}</p>
                        </div>
                      </div>
                    </a>
                    <a href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Mail style={{ width: 13, height: 13, color: "#4f46e5" }} />
                        </span>
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", margin: 0 }}>Email</p>
                          <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{SUPPORT_EMAIL}</p>
                        </div>
                      </div>
                    </a>
                    <a href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Users style={{ width: 13, height: 13, color: "#16a34a" }} />
                        </span>
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", margin: 0 }}>Grupo da comunidade</p>
                          <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Entrar no WhatsApp</p>
                        </div>
                      </div>
                    </a>
                    <button onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "center", padding: "9px 12px", background: "none", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
                      Fechar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick contact strip */}
          <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
            <ActionLink
              href={WHATSAPP_GROUP}
              accent="#25D366"
              label="Grupo do WhatsApp"
              icon={
                <span style={{ width: 22, height: 22, borderRadius: 7, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.63 15.06L2 22l5.09-1.32A10 10 0 1 0 12 2zm5.47 14.38c-.23.65-1.35 1.24-1.86 1.28-.5.05-.96.24-3.23-.67-2.74-1.08-4.48-3.9-4.62-4.08-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.99.94-2.26.24-.27.53-.34.7-.34h.5c.16 0 .38-.06.59.45.22.52.74 1.8.8 1.93.07.13.11.28.02.46-.09.18-.13.29-.26.45l-.4.46c-.13.13-.27.28-.12.54.16.27.7 1.14 1.49 1.85 1.03.92 1.89 1.2 2.16 1.34.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.35-.22.6-.13.24.09 1.55.73 1.82.86.27.13.45.2.51.31.07.11.07.63-.16 1.29z"/></svg>
                </span>
              }
            />
            {/* Chat de grupo (dentro do site) */}
            <button onClick={() => setLocation("/grupo-chat")} style={{ textDecoration: "none", flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <motion.div whileTap={{ scale: 0.96 }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 12, padding: "8px 10px",
                  cursor: "pointer",
                }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users style={{ width: 12, height: 12, color: "#fff" }} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Chat de Grupo
                </span>
              </motion.div>
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#eae8f0", padding: "18px 16px 12px" }} onClick={() => setMenuOpen(false)}>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: "#cfcdd8" }} />
            <span style={{ fontSize: 10, color: "#a5a3b0", fontWeight: 700, letterSpacing: "1px" }}>HOJE</span>
            <div className="flex-1 h-px" style={{ background: "#cfcdd8" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}
                >
                  {msg.from === "support" && (
                    <div style={{
                      width: 30, height: 30, borderRadius: 999,
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
                    {msg.image && <img src={msg.image} alt="" style={{ borderRadius: 14, maxWidth: "100%", maxHeight: 200, objectFit: "cover", display: "block", marginBottom: 4, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }} />}
                    {msg.text && (
                      <div style={{
                        background: msg.from === "support" ? "#ffffff" : "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                        borderRadius: msg.from === "support" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                        padding: "11px 15px",
                        boxShadow: msg.from === "support" ? "0 1px 8px rgba(0,0,0,0.08)" : "0 3px 16px rgba(124,58,237,0.32)",
                      }}>
                        {msg.sender === "admin" && (
                          <p style={{ fontSize: 10, color: "#7c3aed", fontWeight: 800, marginBottom: 4, letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 4 }}>
                            EQUIPA · {localStorage.getItem("wm_brand_poker_winner") === "1" ? "Poker Winner" : "Mozbet"}
                          </p>
                        )}
                        <p style={{ fontSize: 13.5, color: msg.from === "support" ? "#1f2937" : "#ffffff", lineHeight: 1.65, margin: 0, whiteSpace: "pre-line", wordBreak: "break-word" }}>{msg.text}</p>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, justifyContent: msg.from === "user" ? "flex-end" : "flex-start", padding: "0 2px" }}>
                      <span style={{ fontSize: 9.5, color: "#a5a3b0", fontWeight: 500 }}>{msg.time}</span>
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
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BrandMark size={15} variant="light" />
                  </div>
                  <div style={{ background: "#fff", borderRadius: "4px 16px 16px 16px", padding: "13px 16px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.65, repeat: Infinity, delay, ease: "easeInOut" }}
                        style={{ width: 6, height: 6, borderRadius: 999, background: "#9ca3af" }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick replies */}
            {showQuick && !typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
                <p style={{ width: "100%", textAlign: "center", fontSize: 11, color: "#a5a3b0", marginBottom: 2, fontWeight: 500 }}>Escolhe um tema ou escreve à vontade:</p>
                {QUICK.map(q => (
                  <button key={q} onClick={() => sendMsg(q)} style={{ background: "#fff", border: "1.5px solid #e4e2ec", borderRadius: 20, padding: "8px 14px", fontSize: 12.5, color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "transform 0.15s" }}>
                    {q}
                  </button>
                ))}
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input bar ── */}
        <div style={{ background: "#fff", borderTop: "1px solid #ebebf0", padding: "10px 14px", paddingBottom: "max(24px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
          <input ref={fileRef as React.RefObject<HTMLInputElement>} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 999, background: "#f5f5f7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              <ImageIcon style={{ width: 18, height: 18, color: "#9ca3af" }} />
            </button>
            <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 22, padding: "10px 15px", display: "flex", alignItems: "center", gap: 8, minHeight: 44, border: "1px solid #ececf2" }}>
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
