import { useState, useEffect, useRef } from "react";
import { Search, Send, ChevronLeft, RefreshCw, Circle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSupportConversations, getSupportMessages, sendAdminMessage,
  type AdminSupportMessage,
} from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const V1 = "#6C5CE7";

function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const palette = ["6C5CE7", "7c3aed", "4f46e5", "0ea5e9", "10b981", "f59e0b"];
  const color = palette[(seed?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=${color}`} alt={seed}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "white", border: "1.5px solid rgba(108,92,231,.12)" }} />
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUserName, setActiveUserName] = useState<string>("—");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: convsLoading, refetch: refetchConvs } = useQuery({
    queryKey: ["admin-support-convs"],
    queryFn: listSupportConversations,
    refetchInterval: 15000,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery({
    queryKey: ["admin-support-msgs", activeUserId],
    queryFn: () => activeUserId ? getSupportMessages(activeUserId) : Promise.resolve([]),
    enabled: !!activeUserId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!activeUserId) return;
    const ch = supabase.channel(`admin-msgs-${activeUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${activeUserId}` },
        () => refetchMsgs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeUserId, refetchMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = conversations.filter(c =>
    search === "" || c.user_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!activeUserId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await sendAdminMessage(activeUserId, reply.trim());
      setReply("");
      await refetchMsgs();
    } catch { }
    finally { setSending(false); }
  }

  return (
    <div className="flex h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Left panel — conversation list */}
      <div className="w-72 flex flex-col border-r" style={{ borderColor: "rgba(108,92,231,.08)", background: "var(--gz-card-bg)" }}>
        <div className="px-4 pt-5 pb-3 border-b" style={{ borderColor: "rgba(108,92,231,.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-black" style={{ color: "var(--gz-text-primary)" }}>Mensagens</h2>
            <button onClick={() => refetchConvs()} className="p-1.5 rounded-lg" style={{ background: "var(--gz-bg-subtle)" }}>
              <RefreshCw style={{ width: 12, height: 12, color: "var(--gz-text-muted)" }} />
            </button>
          </div>
          <div className="relative">
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--gz-text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none border"
              style={{ background: "var(--gz-bg-subtle)", borderColor: "rgba(108,92,231,.1)", color: "var(--gz-text-primary)" }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
                  <div className="h-2 w-32 rounded animate-pulse" style={{ background: "var(--gz-bg-subtle)" }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--gz-text-muted)" }}>
              Nenhuma conversa ainda
            </div>
          ) : filtered.map(c => (
            <button key={c.user_id}
              onClick={() => { setActiveUserId(c.user_id); setActiveUserName(c.user_name); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeUserId === c.user_id ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
              <div className="relative">
                <Avatar seed={c.user_name} size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--gz-text-primary)" }}>{c.user_name}</span>
                  <span className="text-[10px]" style={{ color: "var(--gz-text-muted)" }}>
                    {new Date(c.last_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-[11px] truncate" style={{ color: "var(--gz-text-muted)" }}>Suporte ao utilizador</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — chat */}
      <div className="flex-1 flex flex-col">
        {!activeUserId ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3" style={{ color: "var(--gz-text-muted)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${V1}, #4f46e5)` }}>
              <Send style={{ width: 22, height: 22, color: "white" }} />
            </div>
            <p className="text-sm font-semibold">Selecciona uma conversa</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b flex items-center gap-3" style={{ borderColor: "rgba(108,92,231,.06)", background: "var(--gz-card-bg)" }}>
              <Avatar seed={activeUserName} size={32} />
              <div>
                <div className="text-[13px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{activeUserName}</div>
                <div className="text-[11px]" style={{ color: "var(--gz-text-muted)" }}>Chat de suporte</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "#f8f9ff" }}>
              {messages.length === 0 ? (
                <div className="text-center text-sm py-8" style={{ color: "var(--gz-text-muted)" }}>
                  Nenhuma mensagem nesta conversa
                </div>
              ) : messages.map((m: AdminSupportMessage) => {
                const isAdmin = m.sender === "admin";
                return (
                  <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"} gap-2 items-end`}>
                    {!isAdmin && <Avatar seed={activeUserName} size={26} />}
                    <div style={{ maxWidth: "70%" }}>
                      <div style={{
                        background: isAdmin ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "#fff",
                        borderRadius: isAdmin ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        padding: "10px 14px",
                        boxShadow: isAdmin ? `0 3px 12px rgba(108,92,231,.3)` : "0 1px 6px rgba(0,0,0,.07)",
                      }}>
                        <p style={{ fontSize: 13, color: isAdmin ? "#fff" : "#111827", lineHeight: 1.5, margin: 0 }}>
                          {m.content}
                        </p>
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, textAlign: isAdmin ? "right" : "left" }}>
                        {new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        {isAdmin && " · Admin"}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(108,92,231,.08)", background: "var(--gz-card-bg)" }}>
              <div className="flex items-end gap-3">
                <div className="flex-1 rounded-2xl px-4 py-2.5" style={{ background: "var(--gz-bg-subtle)", border: "1px solid rgba(108,92,231,.1)" }}>
                  <input value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
                    placeholder="Escreve uma resposta…" disabled={sending}
                    className="w-full bg-transparent outline-none text-sm" style={{ color: "var(--gz-text-primary)" }} />
                </div>
                <button onClick={handleSend} disabled={!reply.trim() || sending}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: reply.trim() && !sending ? `linear-gradient(135deg, ${V1}, #4f46e5)` : "var(--gz-bg-subtle)", boxShadow: reply.trim() ? "0 4px 12px rgba(108,92,231,.35)" : "none" }}>
                  <Send style={{ width: 16, height: 16, color: reply.trim() && !sending ? "#fff" : "var(--gz-text-muted)" }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
