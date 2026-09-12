import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ── Chat Bot AI Message Generator ────────────────────────────────────────
   Uses b.ia API (mimo v2.5) to generate realistic Mozambican chat messages.
   This endpoint is NOT authenticated — it generates anonymous bot messages
   for the group chat and is rate-limited server-side.

   Environment variables:
     BAI_API_KEY  — b.ia API key (required, already set in Vercel)
   ───────────────────────────────────────────────────────────────────────── */

const BAI_API_URL = "https://api.b.ai/v1/chat/completions";
const BAI_MODEL   = "b-ai/mimo-v2.5";

const rateMap = new Map<string, number[]>();

const BOT_SYSTEM_PROMPT = `És um membro da comunidade de jogadores moçambicanos numa plataforma de jogos online (Damas, Ludo, Xadrez) com apostas reais em Meticais (MT).

A tua tarefa é gerar UMA mensagem curta de chat de grupo como se fosses um jogador moçambicano real.

REGRAS:
- Escreve APENAS uma mensagem, sem nome nem prefixo
- Máximo 2 frases curtas
- Usa português moçambicanos informal e natural
- Usa gírias moçambicanas: "kmk", "mano", "malta", "people", "sena", "bora", "tou", "fixe", "pá", "eh pá"
- Fala sobre jogos (Damas, Ludo, Xadrez), apostas, ganhar/perder dinheiro, convites para jogar, dicas
- Pode falar sobre recargas, levantamentos, ou a vida normal
- Máximo 1 emoji por mensagem
- NUNCA repitas mensagens anteriores
- Sê natural e humano, como se fosses um jovem moçambicano de Maputo, Beira ou Nampula
- Varia o tom: às vezes animado, às vezes tranquilo, às vezes competitivo
- NUNCA menciones que és um bot ou IA

EXEMPLOS de estilo:
"Kmk malta, alguém para jogar Damas comigo?"
"Acabei de ganhar 300MT, tou contente pá!"
"Qual é a sena people, ninguém quer jogar?"
"Boa noite malta! Alguém online?"
"Damas é o jogo mais fixe desta plataforma"
"Vou recarregar e jogar Ludo agora"`;

const BOT_NAMES_POOL = [
  "Carlos Matsinhe", "Fátima Guambe", "João Macamo", "Ana Sitoe",
  "Pedro Cossa", "Maria Nhantumbo", "Ricardo Mavie", "Sofia Munguambe",
];

const BOT_GRADIENTS = [
  "linear-gradient(135deg, #10b981, #065f46)",
  "linear-gradient(135deg, #ec4899, #9d174d)",
  "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  "linear-gradient(135deg, #f59e0b, #b45309)",
  "linear-gradient(135deg, #8b5cf6, #4c1d95)",
  "linear-gradient(135deg, #ef4444, #b91c1c)",
  "linear-gradient(135deg, #06b6d4, #0e7490)",
  "linear-gradient(135deg, #d946ef, #a21caf)",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Rate limit: 30 requests per minute per IP
  {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
    const key = `bot:${ip}`;
    const now = Date.now();
    const hits = (rateMap.get(key) ?? []).filter(t => now - t < 60_000);
    if (hits.length >= 30) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    hits.push(now);
    rateMap.set(key, hits);
  }

  const baiKey = process.env["BAI_API_KEY"];
  if (!baiKey) {
    // Fallback: return a static message if no API key
    const fallbackMessages = [
      "Kmk malta, alguém para jogar?",
      "Boa noite pessoal!",
      "Alguém quer jogar Damas?",
      "Acabei de ganhar uma partida!",
      "Qual é a sena people?",
    ];
    const idx = Math.floor(Math.random() * BOT_NAMES_POOL.length);
    return res.json({
      name: BOT_NAMES_POOL[idx],
      initials: BOT_NAMES_POOL[idx].split(" ").map(n => n[0]).join(""),
      avatarBg: BOT_GRADIENTS[idx],
      message: fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)],
    });
  }

  // Get recent messages from query to provide context (avoid repetition)
  const recentContext = (req.query.context as string) || "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(BAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${baiKey}`,
      },
      body: JSON.stringify({
        model: BAI_MODEL,
        messages: [
          { role: "system", content: BOT_SYSTEM_PROMPT },
          ...(recentContext ? [{ role: "user", content: `Últimas mensagens no chat (para contexto, não repitas):\n${recentContext}\n\nGera uma nova mensagem diferente:` }] : [{ role: "user", content: "Gera uma mensagem de chat agora:" }]),
        ],
        max_tokens: 80,
        temperature: 0.95,
        top_p: 0.95,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[chat-bots] b.ia API error:", response.status, errText.slice(0, 200));
      // Fallback to static
      const idx = Math.floor(Math.random() * BOT_NAMES_POOL.length);
      const fallbackMessages = [
        "Kmk malta, alguém para jogar?", "Boa noite pessoal!", "Bora jogar!",
      ];
      return res.json({
        name: BOT_NAMES_POOL[idx],
        initials: BOT_NAMES_POOL[idx].split(" ").map(n => n[0]).join(""),
        avatarBg: BOT_GRADIENTS[idx],
        message: fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)],
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    let message = data.choices?.[0]?.message?.content?.trim() || "";

    // Sanitize: remove quotes, markdown, excess whitespace
    message = message.replace(/^["']|["']$/g, "").replace(/\*\*/g, "").trim();

    if (!message || message.length > 200) {
      message = "Kmk malta, alguém para jogar?";
    }

    // Pick a random bot identity
    const idx = Math.floor(Math.random() * BOT_NAMES_POOL.length);

    res.json({
      name: BOT_NAMES_POOL[idx],
      initials: BOT_NAMES_POOL[idx].split(" ").map(n => n[0]).join(""),
      avatarBg: BOT_GRADIENTS[idx],
      message,
    });
  } catch (err) {
    console.error("[chat-bots] Error:", err instanceof Error ? err.message : "unknown");
    const idx = Math.floor(Math.random() * BOT_NAMES_POOL.length);
    res.json({
      name: BOT_NAMES_POOL[idx],
      initials: BOT_NAMES_POOL[idx].split(" ").map(n => n[0]).join(""),
      avatarBg: BOT_GRADIENTS[idx],
      message: "Kmk malta, alguém disponível?",
    });
  }
}
