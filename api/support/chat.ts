import type { IncomingMessage, ServerResponse } from "node:http";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `Tu és o assistente de suporte da WinMoz, uma plataforma de apostas e jogos online em Moçambique.
Responde SEMPRE em Português de Moçambique.
Sê amigável, profissional e conciso nas respostas.
Ajuda com: depósitos via M-Pesa/e-Mola, levantamentos, apostas, regras dos jogos (Damas, Ludo, Xadrez, Roleta), conta e código promocional.
Nunca inventes saldos, transações ou dados do utilizador.
Se não souberes algo específico, diz que vais encaminhar para a equipa humana de suporte.
Responde em texto simples sem asteriscos, hífens de lista ou markdown.`;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const groqKey = process.env["GROQ_API_KEY"];

  if (!groqKey) {
    json(res, 200, {
      reply: "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp ou email listados no menu.",
    });
    return;
  }

  let body: { messages?: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { messages } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    json(res, 400, { error: "messages array is required" });
    return;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", response.status, errText);
      json(res, 200, {
        reply: "Ocorreu um erro ao processar a tua mensagem. Por favor tenta novamente.",
      });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "Desculpa, não consegui processar a tua pergunta. Tenta novamente.";

    json(res, 200, { reply });
  } catch (err) {
    console.error("Support chat error:", err);
    json(res, 200, {
      reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes.",
    });
  }
}
