import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, CheckCheck, Smile, X } from "lucide-react";

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
  {
    id: "i1", from: "support",
    text: "Oi! 👋 Que bom ter você aqui. Sou o assistente do suporte da Poker Winner — pode falar comigo à vontade.",
    time: nowTime(),
  },
  {
    id: "i2", from: "support",
    text: "Em que posso ajudar hoje? Escreva a sua dúvida ou escolha um dos temas abaixo:",
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

function getAIAnswer(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("deposit") || q.includes("depositar") || q.includes("depósito") || q.includes("recarga") || q.includes("carregar")) {
    return `Claro, é simples! Para depositar:\n\n• Vai ao menu → Carteira → Depositar\n• Escolhe M-Pesa, e-Mola ou transferência bancária\n• Mínimo é 50 MT\n• O saldo aparece em até 5 minutos\n\nSe demorar mais de 10 minutos, guarda o comprovativo e envia para o nosso email que resolvemos rapidinho.`;
  }

  if (q.includes("levantar") || q.includes("levamento") || q.includes("sacar") || q.includes("retirar") || q.includes("saque") || q.includes("withdraw")) {
    return `Certo, sem problema! Veja como levantar o seu dinheiro:\n\n• Menu → Carteira → Levantar\n• Valor mínimo: 100 MT\n• M-Pesa e e-Mola: até 30 min\n• Banco: 1 a 2 dias úteis\n\nUma coisa importante — o número que usa para levantar tem de ser o mesmo que está registado na sua conta. Qualquer dúvida, é só dizer.`;
  }

  if (q.includes("código") || q.includes("codigo") || q.includes("promo") || q.includes("bónus") || q.includes("bonus")) {
    return `Boa! Para usar um código promo:\n\n• Vai a Perfil → Definições → Código Promocional\n• Cola o código e confirma\n• O bónus é adicionado na hora 🎉\n\nSe quiser, também podes partilhar o teu próprio código de convite com amigos — quando eles se registarem, os dois ganham um bónus. Encontras o teu código em Perfil → Convidar Amigos.`;
  }

  if (q.includes("bloqueada") || q.includes("bloqueado") || q.includes("suspensa") || q.includes("suspendo") || q.includes("acesso") || q.includes("não consigo entrar")) {
    return `Ih, que chato! Vamos resolver isso.\n\nPrimeiro, tenta isto:\n• Aguarda 30 minutos (pode ser bloqueio temporário por tentativas erradas)\n• Usa "Esqueceu a senha?" para redefinir a senha\n\nSe mesmo assim não consegues entrar, manda um email para support@pokerwinner.com com o teu número de telemóvel. A equipa resolve em menos de 24 horas.`;
  }

  if (q.includes("regra") || q.includes("como jog") || q.includes("ludo") || q.includes("xadrez") || q.includes("damas") || q.includes("roleta") || q.includes("bilhar")) {
    return `Na Poker Winner tens estes jogos disponíveis:\n\n🎯 Damas — captura as peças do adversário\n♟️ Xadrez — estratégia pura, faz xeque-mate\n🎲 Ludo — dados e sorte, chega primeiro à base\n🎡 Roleta — gira e ganha prémios em MT\n\nCada jogo tem um botão ℹ️ com as regras detalhadas. Há algum em específico sobre o qual quer saber mais?`;
  }

  if (q.includes("saldo") || q.includes("balance") || q.includes("carteira") || q.includes("quanto tenho")) {
    return `O teu saldo aparece logo no ecrã inicial, no canto superior. Também o podes ver em detalhe na Carteira.\n\nSe o saldo não estiver actualizado, puxa a página para baixo (pull-to-refresh) ou vai a Perfil → Actualizar. Tens dois tipos de saldo: o real (teu dinheiro) e o bónus (só para apostas).`;
  }

  if (q.includes("verificação") || q.includes("verificar") || q.includes("kyc") || q.includes("identidade") || q.includes("documento")) {
    return `A verificação de identidade é só pedida quando o valor de levantamento ultrapassa 5.000 MT.\n\nO processo é rápido — vai a Perfil → Verificação de Conta, fotografa o teu BI ou passaporte (frente e verso) e submete. A análise demora até 24 horas úteis.\n\nDocumentos aceites: BI moçambicano, passaporte válido ou DIRE.`;
  }

  if (q.includes("senha") || q.includes("password") || q.includes("palavra-passe") || q.includes("esqueci") || q.includes("esqueceu")) {
    return `Sem pânico! Para recuperar a senha:\n\n• No login, clica em "Esqueceu a senha?"\n• Introduz o email da conta\n• Recebes um código no email\n• Defines uma senha nova\n\nSe já não tens acesso ao email, contacta-nos em support@pokerwinner.com com um documento de identificação e tratamos do caso.`;
  }

  if (q.includes("aposta") || q.includes("valor mínimo") || q.includes("valor máximo") || q.includes("quanto apostar")) {
    return `Sobre as apostas:\n\n• Mínimo: 5 MT por partida\n• Máximo: 50.000 MT por partida\n• O valor é debitado quando o jogo começa\n• O vencedor recebe o dobro (a plataforma fica com 5% de comissão)\n\nSimples assim. Tens alguma dúvida sobre como funciona um jogo específico?`;
  }

  if (q.includes("falar com") || q.includes("humano") || q.includes("agente") || q.includes("atendente") || q.includes("contacto") || q.includes("email") || q.includes("whatsapp") || q.includes("telefone")) {
    return `Claro! Para falar com a equipa humana:\n\n📧 Email: support@pokerwinner.com\n📱 WhatsApp: +258 84 XXX XXXX\n\nHorário: segunda a sábado, das 8h às 22h.\n\nO WhatsApp é o mais rápido — costumamos responder em menos de 2 horas. Por email pode demorar até um dia útil.`;
  }

  if (q.includes("convite") || q.includes("amigo") || q.includes("indicar") || q.includes("referral")) {
    return `O programa de convites é simples e vale a pena!\n\nPartilha o teu código pessoal com amigos. Quando eles se registarem e fizerem o primeiro depósito, os dois ganham 50 MT de bónus — sem limite de convites.\n\nEncontras o teu código em: Perfil → Convidar Amigos 🎁`;
  }

  if (q.includes("torneio") || q.includes("campeonato") || q.includes("competição") || q.includes("evento")) {
    return `Adoramos torneios! 🏆\n\nPodes ver os torneios activos em Explorar → Novidades. Lá encontras os que estão abertos para inscrição, datas e premiações.\n\nOs melhores classificados ganham em dinheiro real (MT). Activa as notificações para não perder nenhum torneio.`;
  }

  if (q.includes("sala") || q.includes("código de sala") || q.includes("partida privada") || q.includes("room")) {
    return `As salas privadas são fixes para jogar com amigos!\n\nO criador da sala recebe um código, partilha com o adversário. Quando o adversário entra com o código, a aposta e o jogo são detectados automaticamente — sem complicações.\n\nEncontras as salas em Explorar → Sala 🚪`;
  }

  // Default — friendly and helpful
  return `Percebi a tua mensagem! Não tenho uma resposta automática exacta para isso, mas posso tentar ajudar de outra forma.\n\nSe for algo urgente ou específico da tua conta, contacta a equipa directamente:\n\n📧 support@pokerwinner.com\n📱 WhatsApp: +258 84 XXX XXXX\n\nRespondem rapidinho nos dias úteis. Posso ajudar com mais alguma coisa?`;
}

export default function Suporte() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
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

  const sendMsg = (msgText: string, img?: string) => {
    if (!msgText.trim() && !img) return;
    const userMsg: Msg = { id: Date.now().toString(), from: "user", text: msgText.trim() || undefined, image: img, time: nowTime() };
    setMessages(p => [...p, userMsg]);
    setText("");
    setShowQuick(false);
    setTyping(true);

    const answer = getAIAnswer(msgText);
    const delay = 900 + Math.min(answer.length * 2.5, 2200);

    setTimeout(() => {
      setTyping(false);
      setMessages(p => [...p, { id: `${Date.now()}_s`, from: "support", text: answer, time: nowTime() }]);
    }, delay);
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
              <div style={{ width: 42, height: 42, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px ${CYAN}55` }}>
                <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13 }}>PW</span>
              </div>
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2.5px solid #1a0533" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.2px" }}>SUPORTE POKER WINNER</p>
              <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 500, marginTop: 1 }}>● Online agora · Responde em segundos</p>
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MoreVertical style={{ width: 15, height: 15, color: "#fff" }} />
              </button>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ position: "absolute", top: 42, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "6px 0", width: 200, zIndex: 100 }}>
                  {["📧  support@pokerwinner.com", "📱  WhatsApp: +258 84 XXX XXXX", "✕  Fechar"].map(item => (
                    <button key={item} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "none", border: "none", fontSize: 12.5, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                      {item}
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
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 8px ${CYAN}44`, marginBottom: 2 }}>
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>PW</span>
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
                <div style={{ width: 32, height: 32, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>PW</span>
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
                <button key={q} onClick={() => sendMsg(q)} style={{ background: "#fff", border: "1.5px solid #e2e2ea", borderRadius: 20, padding: "8px 14px", fontSize: 12.5, color: "#374151", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "all 0.15s" }}>
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
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }}
                placeholder="Escreve aqui a tua dúvida…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, color: "#111827", fontFamily: "inherit" }}
              />
            </div>
            <motion.button
              onClick={() => sendMsg(text)}
              whileTap={{ scale: 0.88 }}
              style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? "linear-gradient(135deg, #7C3AED, #4C1D95)" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: text.trim() ? "pointer" : "default", boxShadow: text.trim() ? "0 4px 14px rgba(124,58,237,0.4)" : "none" }}>
              <Send style={{ width: 17, height: 17, color: text.trim() ? "#fff" : "#9ca3af" }} />
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
