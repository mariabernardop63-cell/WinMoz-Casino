import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, Send, MoreVertical,
  CheckCheck, ChevronLeft,
  MessageCircle, Bot, Shield, AlertCircle,
} from "lucide-react";
import {
  useListSupportConversations,
  useGetSupportMessages,
  useSendAdminSupportMessage,
  useMarkSupportMessagesRead,
} from "@/admin/lib/supabase-api";

const V1 = "#6C5CE7";

function getAvatarUrl(seed: string) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[seed.charCodeAt(0) % palette.length];
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${color}`;
}

function fmtTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function SenderBadge({ sender }: { sender: "user" | "admin" | "ai" }) {
  if (sender === "ai") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold" style={{ background: "rgba(14,165,233,.1)", color: "#0ea5e9" }}>
      <Bot style={{ width: 9, height: 9 }} />IA
    </span>
  );
  if (sender === "admin") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold" style={{ background: "rgba(108,92,231,.1)", color: V1 }}>
      <Shield style={{ width: 9, height: 9 }} />Admin
    </span>
  );
  return null;
}

export default function Messages() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [showList, setShowList] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: loadingConvs } = useListSupportConversations();
  const { data: messages = [], isLoading: loadingMsgs } = useGetSupportMessages(selectedUserId);
  const sendMsg = useSendAdminSupportMessage();
  const markRead = useMarkSupportMessagesRead();

  const filtered = conversations.filter(c =>
    search === "" ||
    c.userName.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  const selectedConv = conversations.find(c => c.userId === selectedUserId);
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSelect(userId: string) {
    setSelectedUserId(userId);
    setShowList(false);
    markRead.mutate(userId);
  }

  function handleSend() {
    if (!input.trim() || !selectedUserId || !selectedConv) return;
    sendMsg.mutate(
      { userId: selectedUserId, userName: selectedConv.userName, content: input.trim() },
      { onSuccess: () => setInput("") }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div className="p-4 h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)`, boxShadow: "0 4px 14px rgba(108,92,231,.35)" }}>
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Mensagens de Suporte</h1>
          <p className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
            Conversas reais do Atendimento 24h · {totalUnread > 0 ? `${totalUnread} não lida${totalUnread !== 1 ? "s" : ""}` : "tudo lido"}
          </p>
        </div>
      </div>

      <div className="flex-1 gz-card overflow-hidden flex" style={{ minHeight: 0 }}>

        {/* ── Conversation List ── */}
        <div className={`w-full md:w-[290px] md:flex-shrink-0 flex flex-col border-r ${showList ? "flex" : "hidden md:flex"}`} style={{ borderColor: "rgba(108,92,231,.07)" }}>
          <div className="p-3 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--gz-bg-subtle)" }}>
              <Search style={{ width: 13, height: 13, color: "var(--gz-text-tertiary)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar conversa..."
                className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: "var(--gz-text-primary)" }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs && (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded-full w-24" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-36" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingConvs && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <MessageCircle style={{ width: 32, height: 32, color: "var(--gz-text-tertiary)", opacity: .4 }} />
                <p className="text-[12.5px]" style={{ color: "var(--gz-text-muted)" }}>
                  {search ? "Nenhuma conversa encontrada." : "Ainda não há mensagens de suporte."}
                </p>
              </div>
            )}

            {filtered.map(c => (
              <button key={c.userId} onClick={() => handleSelect(c.userId)} className="w-full text-left transition-colors"
                style={{ background: selectedUserId === c.userId ? "rgba(108,92,231,.06)" : "transparent" }}>
                <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "rgba(108,92,231,.04)" }}>
                  <div className="relative flex-shrink-0">
                    <img src={getAvatarUrl(c.userName)} alt={c.userName}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: "white", border: "2px solid rgba(108,92,231,.12)" }} />
                    {c.lastSender === "user" && c.unreadCount > 0 && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-red-400 border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[13px] font-bold truncate" style={{ color: "var(--gz-text-primary)" }}>{c.userName}</span>
                      <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: "var(--gz-text-tertiary)" }}>{fmtTime(c.lastMessageTime)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {c.lastSender === "ai" && <Bot style={{ width: 10, height: 10, color: "#0ea5e9", flexShrink: 0 }} />}
                        {c.lastSender === "admin" && <Shield style={{ width: 10, height: 10, color: V1, flexShrink: 0 }} />}
                        <span className="text-[11.5px] truncate" style={{ color: "var(--gz-text-muted)" }}>{c.lastMessage}</span>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="ml-1 flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: "#ef4444" }}>{c.unreadCount}</span>
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
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: "rgba(108,92,231,.07)" }}>
                <button className="md:hidden mr-1" onClick={() => setShowList(true)}>
                  <ChevronLeft style={{ width: 20, height: 20, color: "var(--gz-text-muted)" }} />
                </button>
                <img src={getAvatarUrl(selectedConv.userName)} alt={selectedConv.userName}
                  style={{ width: 38, height: 38, borderRadius: "50%", background: "white", border: "2px solid rgba(108,92,231,.15)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{selectedConv.userName}</div>
                  <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>
                    {messages.length} mensagem{messages.length !== 1 ? "s" : ""} · suporte
                  </div>
                </div>
                <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50">
                  <MoreVertical style={{ width: 15, height: 15, color: "var(--gz-text-muted)" }} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingMsgs && (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                  </div>
                )}

                {!loadingMsgs && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <AlertCircle style={{ width: 28, height: 28, color: "var(--gz-text-tertiary)", opacity: .4 }} />
                    <p className="text-[13px]" style={{ color: "var(--gz-text-muted)" }}>Nenhuma mensagem nesta conversa.</p>
                  </div>
                )}

                {!loadingMsgs && messages.length > 0 && (
                  <>
                    <div className="text-center mb-2">
                      <span className="text-[10.5px] font-semibold px-3 py-1 rounded-full" style={{ background: "var(--gz-bg-subtle)", color: "var(--gz-text-muted)" }}>
                        {messages.length} mensagen{messages.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender !== "user" ? "justify-end" : "justify-start"}`}>
                        {msg.sender === "user" && (
                          <img src={getAvatarUrl(msg.userName)} alt=""
                            style={{ width: 28, height: 28, borderRadius: "50%", background: "white", flexShrink: 0, marginRight: 8, marginTop: 4, border: "1.5px solid rgba(108,92,231,.12)" }} />
                        )}
                        <div style={{ maxWidth: "72%" }}>
                          <div className="flex items-center gap-1.5 mb-1" style={{ justifyContent: msg.sender !== "user" ? "flex-end" : "flex-start" }}>
                            <SenderBadge sender={msg.sender} />
                          </div>
                          <div
                            className="px-4 py-2.5 text-[13px] leading-relaxed"
                            style={{
                              borderRadius: msg.sender !== "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                              background: msg.sender === "admin"
                                ? `linear-gradient(135deg, ${V1}, #4f46e5)`
                                : msg.sender === "ai"
                                  ? "linear-gradient(135deg, #0ea5e9, #06b6d4)"
                                  : "var(--gz-bg-subtle)",
                              color: msg.sender !== "user" ? "#fff" : "var(--gz-text-primary)",
                            }}>
                            {msg.content}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 px-1" style={{ justifyContent: msg.sender !== "user" ? "flex-end" : "flex-start" }}>
                            <span className="text-[10px]" style={{ color: "var(--gz-text-tertiary)" }}>{fmtTime(msg.createdAt)}</span>
                            {msg.sender === "admin" && <CheckCheck style={{ width: 12, height: 12, color: "#059669" }} />}
                          </div>
                        </div>
                        {msg.sender === "admin" && (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${V1}, #4f46e5)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8, marginTop: 22, fontSize: 10, fontWeight: 800, color: "#fff" }}>A</div>
                        )}
                        {msg.sender === "ai" && (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8, marginTop: 22 }}>
                            <Bot style={{ width: 14, height: 14, color: "#fff" }} />
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="px-5 py-3.5 border-t flex-shrink-0" style={{ borderColor: "rgba(108,92,231,.07)" }}>
                <div className="flex items-end gap-3">
                  <div className="flex-1 flex items-end gap-2 rounded-2xl px-4 py-2.5" style={{ background: "var(--gz-bg-subtle)", border: "1.5px solid rgba(108,92,231,.1)" }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Responder ao utilizador... (Enter para enviar)"
                      rows={1}
                      className="flex-1 bg-transparent outline-none text-[13px] resize-none"
                      style={{ color: "var(--gz-text-primary)", maxHeight: 100 }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sendMsg.isPending}
                    className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{
                      background: input.trim() ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "var(--gz-bg-subtle)",
                      boxShadow: input.trim() ? "0 4px 12px rgba(108,92,231,.4)" : "none",
                    }}>
                    {sendMsg.isPending
                      ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      : <Send style={{ width: 15, height: 15, color: input.trim() ? "#fff" : "var(--gz-text-tertiary)" }} />
                    }
                  </button>
                </div>
                <p className="text-[10.5px] mt-2 px-1" style={{ color: "var(--gz-text-tertiary)" }}>
                  A tua resposta será guardada e o utilizador verá na próxima vez que abrir o suporte.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div style={{ width: 64, height: 64, borderRadius: 22, background: "rgba(108,92,231,.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle style={{ width: 28, height: 28, color: V1, strokeWidth: 1.5, opacity: .5 }} />
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold" style={{ color: "var(--gz-text-primary)" }}>Selecciona uma conversa</div>
                <div className="text-[12.5px] mt-1" style={{ color: "var(--gz-text-muted)" }}>
                  {conversations.length === 0
                    ? "Ainda não há conversas de suporte."
                    : "Escolhe um utilizador para ver as mensagens"}
                </div>
              </div>
              {conversations.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium" style={{ background: "rgba(108,92,231,.07)", color: V1 }}>
                  <MessageCircle style={{ width: 13, height: 13 }} />
                  {conversations.length} conversa{conversations.length !== 1 ? "s" : ""} no suporte
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
