import { useState } from "react";
import {
  Search, Send, Paperclip, Smile, MoreVertical,
  Circle, CheckCheck, Phone, Video, Users,
  MessageCircle, ChevronLeft,
} from "lucide-react";

const V1 = "#6C5CE7";

const MOCK_CONVERSATIONS = [
  { id: 1,  name: "João Machava",    avatar: "joao",     lastMsg: "Boa tarde, preciso de ajuda com meu saldo",  time: "14:32", unread: 2, online: true  },
  { id: 2,  name: "Ana Sitoe",       avatar: "ana",      lastMsg: "Obrigada pelo suporte!",                      time: "13:15", unread: 0, online: true  },
  { id: 3,  name: "Carlos Mondlane", avatar: "carlos",   lastMsg: "Quando será resolvido o meu saque?",          time: "11:48", unread: 5, online: false },
  { id: 4,  name: "Maria Guambe",    avatar: "maria",    lastMsg: "Tive um problema no jogo de xadrez",          time: "10:30", unread: 0, online: true  },
  { id: 5,  name: "Pedro Nhantumbo", avatar: "pedro",    lastMsg: "Como faço para depositar?",                   time: "09:12", unread: 1, online: false },
  { id: 6,  name: "Sofia Cossa",     avatar: "sofia",    lastMsg: "O meu jogo de ludo ficou pausado",            time: "Ontem", unread: 0, online: false },
  { id: 7,  name: "Tomás Mavie",     avatar: "tomas",    lastMsg: "Quero reclamar uma vitória não reconhecida",  time: "Ontem", unread: 0, online: true  },
  { id: 8,  name: "Beatriz Macuácua",avatar: "beatriz",  lastMsg: "Parabéns pelo trabalho!",                     time: "Seg",   unread: 0, online: false },
];

const MOCK_MESSAGES: Record<number, { id: number; from: "user" | "admin"; text: string; time: string; read: boolean }[]> = {
  1: [
    { id: 1, from: "user",  text: "Olá, bom dia! Tenho uma dúvida sobre meu saldo.",        time: "14:28", read: true  },
    { id: 2, from: "admin", text: "Bom dia! Claro, pode perguntar à vontade.",               time: "14:29", read: true  },
    { id: 3, from: "user",  text: "Boa tarde, preciso de ajuda com meu saldo",               time: "14:32", read: false },
  ],
  2: [
    { id: 1, from: "user",  text: "Olá, tive um problema ontem com o saque.",                time: "12:00", read: true  },
    { id: 2, from: "admin", text: "Já verificamos e o saque foi processado com sucesso.",    time: "12:30", read: true  },
    { id: 3, from: "user",  text: "Obrigada pelo suporte!",                                  time: "13:15", read: true  },
  ],
  3: [
    { id: 1, from: "user",  text: "Fiz um pedido de saque há 3 dias e ainda não recebi.",   time: "10:00", read: true  },
    { id: 2, from: "admin", text: "Pedimos desculpa pelo atraso. Estamos a verificar.",      time: "10:15", read: true  },
    { id: 3, from: "user",  text: "Quando será resolvido o meu saque?",                      time: "11:48", read: false },
    { id: 4, from: "user",  text: "Já passaram mais 3 dias!",                                time: "11:49", read: false },
    { id: 5, from: "user",  text: "Preciso de uma resposta urgente por favor",               time: "11:50", read: false },
  ],
  4: [{ id: 1, from: "user", text: "Tive um problema no jogo de xadrez", time: "10:30", read: true }],
  5: [{ id: 1, from: "user", text: "Como faço para depositar?", time: "09:12", read: false }],
  6: [{ id: 1, from: "user", text: "O meu jogo de ludo ficou pausado", time: "Ontem", read: true }],
  7: [{ id: 1, from: "user", text: "Quero reclamar uma vitória não reconhecida", time: "Ontem", read: true }],
  8: [{ id: 1, from: "user", text: "Parabéns pelo trabalho!", time: "Seg", read: true }],
};

function getAvatarUrl(seed: string) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`;
}

export default function Messages() {
  const [selected, setSelected] = useState<number | null>(1);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [showList, setShowList] = useState(true);

  const filtered = MOCK_CONVERSATIONS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMsg.toLowerCase().includes(search.toLowerCase())
  );

  const conversation = MOCK_CONVERSATIONS.find(c => c.id === selected);
  const msgs = selected ? (messages[selected] ?? []) : [];

  function handleSend() {
    if (!input.trim() || !selected) return;
    const newMsg = { id: Date.now(), from: "admin" as const, text: input.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), read: true };
    setMessages(prev => ({ ...prev, [selected]: [...(prev[selected] ?? []), newMsg] }));
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleSelect(id: number) {
    setSelected(id);
    setShowList(false);
    setMessages(prev => ({
      ...prev,
      [id]: (prev[id] ?? []).map(m => ({ ...m, read: true })),
    }));
  }

  const totalUnread = MOCK_CONVERSATIONS.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="p-4 h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Mensagens</h1>
          <p className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>Gestão de conversas com utilizadores · {totalUnread} não lidas</p>
        </div>
      </div>

      <div className="flex-1 gz-card overflow-hidden flex" style={{ minHeight: 0 }}>

        {/* ── Conversation List ── */}
        <div className={`w-full md:w-[280px] md:flex-shrink-0 flex flex-col border-r ${showList ? "flex" : "hidden md:flex"}`} style={{ borderColor: "rgba(108,92,231,.07)" }}>
          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--gz-bg-subtle)" }}>
              <Search style={{ width: 13, height: 13, color: "var(--gz-text-tertiary)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar conversa..."
                className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: "var(--gz-text-primary)" }} />
            </div>
          </div>

          {/* Online now */}
          <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(108,92,231,.05)" }}>
            <div className="text-[10.5px] font-black uppercase tracking-wider mb-2" style={{ color: "var(--gz-text-tertiary)" }}>Online agora</div>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {MOCK_CONVERSATIONS.filter(c => c.online).slice(0, 5).map(c => (
                <button key={c.id} onClick={() => handleSelect(c.id)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 transition-transform hover:-translate-y-0.5">
                  <div className="relative">
                    <img src={getAvatarUrl(c.avatar)} alt={c.name} style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "2px solid rgba(108,92,231,.15)" }} />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
                  </div>
                  <span className="text-[9px] font-semibold truncate w-10 text-center" style={{ color: "var(--gz-text-muted)" }}>{c.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map(c => (
              <button key={c.id} onClick={() => handleSelect(c.id)} className="w-full text-left transition-colors"
                style={{ background: selected === c.id ? "rgba(108,92,231,.06)" : "transparent" }}>
                <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "rgba(108,92,231,.04)" }}>
                  <div className="relative flex-shrink-0">
                    <img src={getAvatarUrl(c.avatar)} alt={c.name} style={{ width: 40, height: 40, borderRadius: "50%", background: "white", border: "2px solid rgba(108,92,231,.12)" }} />
                    {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{c.name}</span>
                      <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: "var(--gz-text-tertiary)" }}>{c.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] truncate" style={{ color: "var(--gz-text-muted)" }}>{c.lastMsg}</span>
                      {c.unread > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: V1 }}>{c.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat Area ── */}
        <div className={`flex-1 flex flex-col ${!showList ? "flex" : "hidden md:flex"}`}>
          {conversation ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: "rgba(108,92,231,.07)" }}>
                <button className="md:hidden mr-1" onClick={() => setShowList(true)}>
                  <ChevronLeft style={{ width: 20, height: 20, color: "var(--gz-text-muted)" }} />
                </button>
                <div className="relative">
                  <img src={getAvatarUrl(conversation.avatar)} alt={conversation.name} style={{ width: 38, height: 38, borderRadius: "50%", background: "white", border: "2px solid rgba(108,92,231,.15)" }} />
                  {conversation.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{conversation.name}</div>
                  <div className="text-[11px]" style={{ color: conversation.online ? "#059669" : "var(--gz-text-muted)" }}>
                    {conversation.online ? "● Online agora" : "● Offline"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50" title="Chamada de voz">
                    <Phone style={{ width: 15, height: 15, color: "var(--gz-text-muted)" }} />
                  </button>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50" title="Videochamada">
                    <Video style={{ width: 15, height: 15, color: "var(--gz-text-muted)" }} />
                  </button>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50">
                    <MoreVertical style={{ width: 15, height: 15, color: "var(--gz-text-muted)" }} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="text-center mb-4">
                  <span className="text-[10.5px] font-semibold px-3 py-1 rounded-full" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>Hoje</span>
                </div>
                {msgs.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === "admin" ? "justify-end" : "justify-start"}`}>
                    {msg.from === "user" && (
                      <img src={getAvatarUrl(conversation.avatar)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", background: "white", flexShrink: 0, marginRight: 8, marginTop: 4, border: "1.5px solid rgba(108,92,231,.12)" }} />
                    )}
                    <div style={{ maxWidth: "70%" }}>
                      <div
                        className="px-4 py-2.5 text-[13px] leading-relaxed"
                        style={{
                          borderRadius: msg.from === "admin" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: msg.from === "admin" ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "var(--gz-bg-subtle)",
                          color: msg.from === "admin" ? "#fff" : "var(--gz-text-primary)",
                        }}
                      >
                        {msg.text}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 px-1" style={{ justifyContent: msg.from === "admin" ? "flex-end" : "flex-start" }}>
                        <span className="text-[10px]" style={{ color: "var(--gz-text-tertiary)" }}>{msg.time}</span>
                        {msg.from === "admin" && <CheckCheck style={{ width: 12, height: 12, color: msg.read ? "#059669" : "var(--gz-text-tertiary)" }} />}
                      </div>
                    </div>
                    {msg.from === "admin" && (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${V1}, #4f46e5)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8, marginTop: 4, fontSize: 10, fontWeight: 800, color: "#fff" }}>A</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="px-5 py-3.5 border-t flex-shrink-0" style={{ borderColor: "rgba(108,92,231,.07)" }}>
                <div className="flex items-end gap-3">
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-indigo-50 transition-colors mb-1">
                    <Paperclip style={{ width: 16, height: 16, color: "var(--gz-text-muted)" }} />
                  </button>
                  <div className="flex-1 flex items-end gap-2 rounded-2xl px-4 py-2.5" style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.1)" }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Escrever mensagem... (Enter para enviar)"
                      rows={1}
                      className="flex-1 bg-transparent outline-none text-[13px] resize-none"
                      style={{ color: "var(--gz-text-primary)", maxHeight: 100 }}
                    />
                    <button className="w-6 h-6 flex items-center justify-center flex-shrink-0 hover:opacity-70 transition-opacity mb-0.5">
                      <Smile style={{ width: 16, height: 16, color: "var(--gz-text-muted)" }} />
                    </button>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{
                      background: input.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "var(--gz-bg-subtle)",
                      boxShadow: input.trim() ? "0 4px 12px rgba(108,92,231,.4)" : "none",
                    }}
                  >
                    <Send style={{ width: 15, height: 15, color: input.trim() ? "#fff" : "var(--gz-text-tertiary)" }} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div style={{ width: 64, height: 64, borderRadius: 22, background: "rgba(108,92,231,.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle style={{ width: 28, height: 28, color: V1, strokeWidth: 1.5, opacity: .5 }} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-center" style={{ color: "var(--gz-text-primary)" }}>Selecciona uma conversa</div>
                <div className="text-[12.5px] text-center mt-1" style={{ color: "var(--gz-text-muted)" }}>Escolhe um utilizador para começar a conversar</div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium" style={{ background: "rgba(108,92,231,.07)", color: V1 }}>
                <Users style={{ width: 13, height: 13 }} />
                {MOCK_CONVERSATIONS.filter(c => c.online).length} utilizadores online
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
