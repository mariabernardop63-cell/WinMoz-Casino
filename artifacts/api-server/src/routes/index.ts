import { Router, type IRouter } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/complete-registration", async (req, res) => {
  try {
    const { user_id, full_name, phone, invite_code_used } = req.body as {
      user_id?: string;
      full_name?: string;
      phone?: string;
      invite_code_used?: string;
    };

    if (!user_id) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }

    res.json({ success: true, user_id, full_name, phone, invite_code_used });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── AI Support Chat (Groq) ── */
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

const SYSTEM_PROMPT = `Tu és o assistente de suporte da WinMoz, uma plataforma de apostas e jogos online em Moçambique.
Responde SEMPRE em Português de Moçambique.
Sê amigável, profissional e conciso nas respostas.
Ajuda com: depósitos via M-Pesa/e-Mola, levantamentos, apostas, regras dos jogos (Damas, Ludo, Xadrez, Roleta), conta e código promocional.
Nunca inventes saldos, transações ou dados do utilizador.
Se não souberes algo específico, diz que vais encaminhar para a equipa humana de suporte.
Responde em texto simples sem asteriscos, hífens de lista ou markdown.`;

router.post("/support/chat", async (req, res) => {
  try {
    const groqKey = process.env["GROQ_API_KEY"];

    if (!groqKey) {
      res
        .status(200)
        .json({
          reply:
            "O serviço de suporte IA não está disponível de momento. Contacta-nos pelo WhatsApp ou email listados no menu.",
        });
      return;
    }

    const { messages } = req.body as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

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
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res
        .status(200)
        .json({
          reply:
            "Ocorreu um erro ao processar a tua mensagem. Por favor tenta novamente.",
        });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "Desculpa, não consegui processar a tua pergunta. Tenta novamente.";

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Support chat error");
    res
      .status(200)
      .json({
        reply: "Ocorreu um erro interno. Por favor tenta novamente em instantes.",
      });
  }
});

export default router;
