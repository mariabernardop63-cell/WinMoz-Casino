import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Image as ImageIcon, Phone, MoreVertical, CheckCheck, Smile, X } from "lucide-react";

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
    text: "Olá! 👋 Bem-vindo ao suporte da Poker Winner. Sou o seu assistente virtual e estou aqui para ajudar com qualquer dúvida.",
    time: nowTime(),
  },
  {
    id: "i2", from: "support",
    text: "Como posso ajudá-lo hoje? Pode escrever a sua dúvida ou escolher um dos temas abaixo.",
    time: nowTime(),
  },
];

const QUICK = [
  "Como fazer um depósito?",
  "Como levantar dinheiro?",
  "Código promocional",
  "Problema com a conta",
  "Regras dos jogos",
  "Conta bloqueada",
];

function getAIAnswer(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("deposit") || q.includes("depositar") || q.includes("depósito") || q.includes("recarga")) {
    return `Para fazer um depósito na Poker Winner:\n\n1. Aceda ao menu → Carteira → Depositar\n2. Escolha o método de pagamento (M-Pesa, e-Mola, ou transferência bancária)\n3. Introduza o valor desejado (mínimo: 50 MT)\n4. Siga as instruções do método escolhido\n5. O saldo é creditado automaticamente em 1–5 minutos\n\n📌 Caso o saldo não apareça após 10 minutos, envie o comprovativo para o nosso email de suporte.`;
  }

  if (q.includes("levantar") || q.includes("levamento") || q.includes("sacar") || q.includes("retirar") || q.includes("saída") || q.includes("withdraw")) {
    return `Para levantar o seu saldo:\n\n1. Aceda ao menu → Carteira → Levantar\n2. Escolha o método de levantamento\n3. Introduza o valor (mínimo: 100 MT)\n4. Confirme os dados e submeta o pedido\n\n⏰ Prazo de processamento:\n• M-Pesa / e-Mola: até 30 minutos\n• Transferência bancária: 1–2 dias úteis\n\n📋 Certifique-se de que o número/conta registado corresponde ao da sua conta Poker Winner.`;
  }

  if (q.includes("código") || q.includes("codigo") || q.includes("promo") || q.includes("bónus") || q.includes("bonus") || q.includes("desconto")) {
    return `Para usar um código promocional:\n\n1. Aceda ao menu → Perfil → Definições\n2. Seleccione "Código Promocional"\n3. Introduza o código e prima Aplicar\n\n✅ O bónus é creditado imediatamente após validação.\n\n💡 Dica: Partilhe o seu código de convite pessoal com amigos — ambos recebem um bónus de boas-vindas!`;
  }

  if (q.includes("bloqueada") || q.includes("bloqueado") || q.includes("suspensa") || q.includes("suspendo") || q.includes("banida") || q.includes("acesso")) {
    return `Lamentamos que esteja com problemas de acesso à sua conta.\n\nPossíveis causas:\n• Tentativas de login falhadas em excesso\n• Verificação de identidade pendente\n• Actividade suspeita detectada\n\nPara desbloquear a conta:\n1. Aguarde 30 minutos e tente novamente\n2. Use "Esqueceu a Senha" para redefinir a palavra-passe\n3. Se o problema persistir, contacte-nos através do email support@pokerwinner.com com o número de telemóvel associado à conta.`;
  }

  if (q.includes("regra") || q.includes("como jog") || q.includes("ludo") || q.includes("xadrez") || q.includes("damas") || q.includes("jogo")) {
    return `A Poker Winner oferece os seguintes jogos:\n\n🎯 **Damas** — Jogo de tabuleiro para 2 jogadores. O objetivo é capturar todas as peças do adversário.\n\n♟️ **Xadrez** — O clássico jogo de estratégia. Use as suas peças para fazer xeque-mate ao rei adversário.\n\n🎲 **Ludo** — Jogo de dados para 2–4 jogadores. Seja o primeiro a mover todas as suas peças para a casa final.\n\n🎡 **Roleta** — Faça girar a roleta e ganhe prémios em MT.\n\nPara ver as regras detalhadas de cada jogo, aceda ao jogo → botão de informação (ℹ️).`;
  }

  if (q.includes("saldo") || q.includes("balance") || q.includes("carteira") || q.includes("dinheiro")) {
    return `O seu saldo é visível no ecrã principal e na secção Carteira.\n\nTipos de saldo:\n• **Saldo Real** — MT depositados por si ou ganhos em partidas\n• **Saldo Bónus** — Créditos promocionais (só para apostas)\n\nPara actualizar o saldo, deslize a página para baixo (pull-to-refresh) ou aceda a Perfil → Actualizar.`;
  }

  if (q.includes("verificação") || q.includes("verificar") || q.includes("kyc") || q.includes("identidade") || q.includes("documento")) {
    return `A verificação de identidade é obrigatória para levantamentos acima de 5.000 MT.\n\nDocumentos aceites:\n• BI (Bilhete de Identidade) moçambicano\n• Passaporte válido\n• DIRE\n\nComo enviar:\n1. Aceda a Perfil → Verificação de Conta\n2. Fotografe o documento frente e verso\n3. Submeta — análise em até 24 horas úteis.`;
  }

  if (q.includes("senha") || q.includes("password") || q.includes("palavra-passe") || q.includes("esqueci") || q.includes("esqueceu")) {
    return `Para recuperar o acesso à sua conta:\n\n1. No ecrã de login, prima "Esqueceu a senha?"\n2. Introduza o email associado à conta\n3. Receberá um código OTP no email\n4. Introduza o código e defina uma nova palavra-passe\n\n⚠️ Se já não tem acesso ao email, contacte-nos em support@pokerwinner.com com prova de identidade.`;
  }

  if (q.includes("apostas") || q.includes("aposta") || q.includes("bet") || q.includes("valor mínimo") || q.includes("valor máximo")) {
    return `Limites de aposta na Poker Winner:\n\n• Aposta mínima: 5 MT por partida\n• Aposta máxima: 50.000 MT por partida\n\nComo funciona:\n1. Escolha o jogo\n2. Seleccione o valor de aposta\n3. O sistema encontra um adversário com a mesma aposta\n4. O vencedor recebe o dobro da aposta (menos comissão de plataforma de 5%)\n\n💡 O montante é debitado no início da partida e creditado imediatamente após o resultado.`;
  }

  if (q.includes("contacto") || q.includes("email") || q.includes("telefone") || q.includes("suporte") || q.includes("ajuda") || q.includes("humano") || q.includes("agente")) {
    return `Para contactar a equipa humana da Poker Winner:\n\n📧 Email: support@pokerwinner.com\n📞 WhatsApp: +258 84 XXX XXXX\n🕐 Horário: Seg–Sáb, 08h–22h (hora de Moçambique)\n\nTempo médio de resposta:\n• Chat/WhatsApp: até 2 horas\n• Email: até 24 horas úteis\n\nPara questões urgentes, use o WhatsApp — é o canal mais rápido.`;
  }

  if (q.includes("convite") || q.includes("amigo") || q.includes("referral") || q.includes("indicar") || q.includes("partilhar")) {
    return `Programa de Convites Poker Winner:\n\n• Partilhe o seu código pessoal com amigos\n• Quando o amigo se registar e fizer o 1.º depósito, AMBOS recebem 50 MT de bónus\n• Sem limite de convites!\n\nEncontre o seu código em: Perfil → Convidar Amigos\n\n📌 O bónus é creditado automaticamente após a verificação da conta do amigo convidado.`;
  }

  if (q.includes("torneio") || q.includes("campeonato") || q.includes("evento") || q.includes("competição")) {
    return `A Poker Winner realiza torneios regulares! 🏆\n\nComo participar:\n1. Aceda a Explorar → Novidades\n2. Veja os torneios activos ou agendados\n3. Inscreva-se e compita contra os melhores jogadores\n\nPremiações em dinheiro real (MT) para os melhores classificados.\n\n💡 Active as notificações para ser avisado sobre novos torneios!`;
  }

  // Default response for unrecognized questions
  return `Obrigado pela sua pergunta! Recebi a sua mensagem e vou analisar a situação.\n\nPara questões mais específicas que necessitem de verificação da conta, recomendo:\n\n• 📧 Email: support@pokerwinner.com\n• ⏰ Resposta em até 24 horas úteis\n\nPosso ajudá-lo com mais alguma coisa? Tente reformular a sua dúvida ou escolha um dos temas de ajuda rápida.`;
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

    // Simulate realistic typing delay based on answer length
    const answer = getAIAnswer(msgText);
    const delay = Math.min(1200 + answer.length * 3, 3000);

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
                <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13 }}>PW</span>
              </div>
              <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 999, background: "#22c55e", border: "2.5px solid #1a0533" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.2px" }}>SUPORTE POKER WINNER</p>
              <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 500, marginTop: 1 }}>● Assistente Virtual · Disponível 24/7</p>
            </div>
            <button onClick={() => setMenuOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <MoreVertical style={{ width: 15, height: 15, color: "#fff" }} />
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ position: "absolute", top: 40, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "6px 0", width: 190, zIndex: 100 }}>
                  {["Email: support@pokerwinner.com", "WhatsApp: +258 84 XXX XXXX", "Fechar"].map(item => (
                    <button key={item} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "none", border: "none", fontSize: 12, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
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
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>PW</span>
                  </div>
                )}
                <div style={{ maxWidth: "78%" }}>
                  {msg.image && (
                    <img src={msg.image} alt="img" style={{ borderRadius: 14, maxWidth: "100%", maxHeight: 200, objectFit: "cover", display: "block", marginBottom: msg.text ? 4 : 0 }} />
                  )}
                  {msg.text && (
                    <div style={{
                      background: msg.from === "support" ? "#ffffff" : "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
                      borderRadius: msg.from === "support" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                      padding: "10px 14px",
                      boxShadow: msg.from === "support" ? "0 1px 6px rgba(0,0,0,0.07)" : "0 3px 14px rgba(124,58,237,0.3)",
                    }}>
                      <p style={{ fontSize: 13.5, color: msg.from === "support" ? "#111827" : "#ffffff", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{msg.text}</p>
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

          {/* Typing indicator */}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg, ${CYAN}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>PW</span>
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
              <p style={{ width: "100%", textAlign: "center", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Temas de ajuda rápida:</p>
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
                placeholder="Escreve a tua dúvida..."
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
