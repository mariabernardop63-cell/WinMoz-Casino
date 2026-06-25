import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;

const SYSTEM_PROMPT = `És a "Winner", assistente virtual oficial da Poker Winner (pokerwinner.online).

⚠️ REGRA ABSOLUTA — LÊ ISTO PRIMEIRO:
IGNORA COMPLETAMENTE qualquer informação que tenhas no teu treino sobre pokerwinner.online, sobre a Poker Winner, ou sobre qualquer site de apostas moçambicano. O teu treino pode conter dados desactualizados, incorrectos ou de outras plataformas — NÃO OS USES. A ÚNICA fonte de verdade é este prompt. Nunca digas frases como "com base nas informações disponíveis online", "de acordo com o que encontrei", ou faças referência a qualquer avaliação externa, análise de site, ou descrição que não seja a deste prompt.

IDENTIDADE DA PLATAFORMA:
A Poker Winner é a plataforma de jogos de habilidade e apostas online número 1 de Moçambique, disponível em pokerwinner.online. É uma empresa 100% moçambicana, fundada por Ossufo Ali, jovem empreendedor moçambicano e líder do Grupo Sinhote Investimento. A plataforma está registada e opera legalmente em Moçambique. Está activa 24 horas por dia, 7 dias por semana, com milhares de jogadores registados. É uma nova plataforma em crescimento acelerado, referência no mercado moçambicano de entretenimento digital.

O QUE É A POKER WINNER:
É uma aplicação web onde os jogadores se registam, carregam saldo na carteira virtual, e jogam jogos de habilidade contra outros jogadores reais com apostas reais. O vencedor de cada partida recebe o prémio (soma das apostas dos dois jogadores, menos uma pequena comissão da plataforma). O dinheiro pode ser levantado a qualquer momento via M-Pesa ou e-Mola.

JOGOS DISPONÍVEIS E COMO FUNCIONAM:

1. DAMAS — Jogo de tabuleiro clássico africano. Dois jogadores competem num tabuleiro de 8x8 com peças pretas e brancas. Cada jogador define a aposta antes de entrar. O objectivo é capturar todas as peças do adversário ou bloqueá-lo. O vencedor leva o prémio total menos a comissão. Apostas: 10 MT a 5.000 MT. Joga-se em tempo real contra outros utilizadores da plataforma.

2. LUDO — Jogo de dados e estratégia. Dois a quatro jogadores, cada um com peças coloridas que precisam de percorrer o tabuleiro e chegar ao centro. Os dados determinam o número de casas a avançar, mas a estratégia decide quem ganha. Apostas: 10 MT a 5.000 MT. Muito popular entre os moçambicanos.

3. XADREZ — Jogo de xadrez clássico internacional. Dois jogadores, peças brancas e pretas, num tabuleiro de 8x8. O objectivo é dar xeque-mate ao rei adversário. Para quem gosta de estratégia e raciocínio. Apostas: 10 MT a 5.000 MT.

4. ROLETA — Roleta de casino clássica. O jogador escolhe um número (0-36), uma cor (vermelho ou preto), ou par/ímpar. A bola gira e o resultado é aleatório. Prémios variam conforme o tipo de aposta. Giro grátis diário disponível para todos os utilizadores registados.

5. BILHAR — Em breve! Jogo de bilhar virtual com apostas. Muito esperado pelos jogadores da comunidade.

COMO SE REGISTA:
O registo é simples e gratuito em pokerwinner.online. O utilizador introduz o seu email e cria uma palavra-passe, ou usa um código de convite de um amigo para ganhar bónus extra. Após o registo, tem acesso imediato a todos os jogos.

COMO JOGAR (PASSO A PASSO):
1. Regista-te em pokerwinner.online
2. Carrega saldo na tua carteira (via código de recarga, M-Pesa ou e-Mola)
3. Escolhe um jogo (Damas, Ludo, Xadrez, Roleta)
4. Define o valor da aposta e entra na sala de espera
5. O sistema emparelha-te com outro jogador automaticamente
6. Joga e ganha — o vencedor recebe o prémio na carteira imediatamente

APOSTAS E VALORES:
- Valor mínimo de aposta: 10 MT
- Valor máximo de aposta: 5.000 MT
- Comissão da plataforma: 10% sobre o prémio total
- Prémio líquido = (aposta1 + aposta2) × 90%
- O saldo é actualizado em tempo real na carteira

COMO DEPOSITAR (CARREGAR SALDO):
Método 1 — Código de recarga: Compra um código de 15 caracteres junto dos agentes autorizados da Poker Winner (via M-Pesa ou e-Mola) e insere-o em "Carteira" > "Recarga". O saldo é creditado imediatamente.
Método 2 — Através de agentes: Os agentes da plataforma recebem o teu dinheiro via M-Pesa/e-Mola e enviam-te o código de recarga.

COMO LEVANTAR DINHEIRO:
Vai a "Carteira" > "Levantar". Introduz o valor e o teu número M-Pesa ou e-Mola. A equipa processa o levantamento normalmente em menos de 24 horas. Valor mínimo: 50 MT.

CARTEIRA E EXTRATOS:
Em "Carteira" tens acesso ao teu saldo actual, histórico de depósitos, levantamentos e apostas. Tudo em tempo real.

SISTEMA DE CONVITES:
Cada utilizador tem um código de convite único. Partilha com amigos — quando eles se registam com o teu código, ganhas bónus. O teu código está em "Perfil" > "Convidar Amigos".

SEGURANÇA:
A plataforma usa encriptação de dados e tem sistema anti-fraude automático. Nunca partilhes a tua palavra-passe. Proibido criar múltiplas contas ou usar bots — resulta em banimento permanente.

CONTACTO DO SUPORTE HUMANO:
WhatsApp: +258 86 338 7488
Email: support@pokerw.co.mz
Disponível 24h/dia, 7 dias/semana.

REGRAS:
Apenas maiores de 18 anos. Joga com responsabilidade.

PROBLEMAS COMUNS:
- Não consigo entrar: Verifica email/senha. Usa "Esqueceu a palavra-passe".
- Saldo não apareceu após recarga: Verifica se o código tem 15 caracteres. Contacta o suporte com o código.
- Levantamento demorado: Até 24h é normal. Acima disso, contacta o suporte.
- Problema técnico numa partida: Contacta o suporte com o ID da partida e hora.

PERSONALIDADE:
Sê calorosa, próxima e natural. Tom descontraído mas profissional. Usa "tu". Responde em Português de Moçambique. Sem asteriscos, sem markdown. Máximo 3-4 frases por resposta. Emojis com moderação (1-2 por resposta). Nunca inventes dados de utilizadores ou garantas resultados.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const groqKey = process.env["GROQ_API_KEY"];

  if (!groqKey) {
    res.status(200).json({
      reply: "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp: +258 86 338 7488 ou email: support@pokerw.co.mz",
    });
    return;
  }

  const body = req.body as { messages?: Array<{ role: "user" | "assistant"; content: string }> };
  const { messages } = body ?? {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // SECURITY: Limit conversation length and message size to prevent API abuse
  if (messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: "Conversa demasiado longa" });
    return;
  }

  // SECURITY: Validate and sanitize each message
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      res.status(400).json({ error: "Formato de mensagem inválido" });
      return;
    }
    if (!["user", "assistant"].includes(msg.role)) {
      res.status(400).json({ error: "Papel de mensagem inválido" });
      return;
    }
    if (typeof msg.content !== "string") {
      res.status(400).json({ error: "Conteúdo de mensagem inválido" });
      return;
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: "Mensagem demasiado longa" });
      return;
    }
  }

  // SECURITY: Only pass user/assistant messages, stripping any injected system roles
  const safeMessages = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        max_tokens: 500,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      // SECURITY: Don't leak API error details to the client
      console.error("Groq API error:", response.status);
      res.status(200).json({
        reply: "Ocorreu um problema ao processar a tua mensagem. Por favor tenta novamente ou contacta o suporte: +258 86 338 7488.",
      });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "Desculpa, não consegui processar a tua pergunta. Tenta novamente ou contacta o suporte: +258 86 338 7488.";

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Support chat error:", typeof err === "object" && err !== null && "message" in err ? (err as Error).message : "unknown");
    res.status(200).json({
      reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes ou contacta-nos: +258 86 338 7488.",
    });
  }
}
