import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/* ── Chat Bot + Group Chat Persistence ──────────────────────────────────────
   GET /api/chat-bots               → bot message generation (existing)
   GET /api/chat-bots?action=group-history → load last 40 group messages
   POST /api/chat-bots?action=group-save   → save a message to group chat
   ───────────────────────────────────────────────────────────────────────── */

const BAI_API_URL = "https://api.b.ai/v1/chat/completions";
const BAI_MODEL   = "mimo-v2.5";

const rateMap = new Map<string, number[]>();

function getAdminClient() {
  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

function normalise(text: string): string {
  return text.toLocaleLowerCase("pt-PT").replace(/\s+/g, " ").trim();
}

function chooseFallback(recentContext: string): { name: string; initials: string; avatarBg: string; message: string } {
  const fallbackMessages = [
    "Kmk malta, alguém para jogar?",
    "Boa noite pessoal!",
    "Alguém quer jogar Damas?",
    "Acabei de ganhar uma partida!",
    "Qual é a sena people?",
    "Bora jogar Ludo, malta!",
    "Tou disponível para um desafio!",
    "Quem aceita uma partida de Xadrez?",
  ];
  const recent = new Set(
    recentContext
      .split(/\r?\n/)
      .map(line => line.replace(/^[^:]{1,80}:\s*/, ""))
      .map(normalise)
      .filter(Boolean),
  );
  const available = fallbackMessages.filter(message => !recent.has(normalise(message)));
  const pool = available.length > 0 ? available : fallbackMessages;
  const message = pool[Math.floor(Math.random() * pool.length)];
  const idx = Math.floor(Math.random() * BOT_NAMES_POOL.length);
  return {
    name: BOT_NAMES_POOL[idx],
    initials: BOT_NAMES_POOL[idx].split(" ").map(n => n[0]).join(""),
    avatarBg: BOT_GRADIENTS[idx],
    message,
  };
}

// ─── Group Chat: Load History ───────────────────────────────────────────────
async function handleGroupHistory(req: VercelRequest, res: VercelResponse) {
  const supabase = getAdminClient();
  if (!supabase) { res.status(500).json({ error: "Serviço indisponível" }); return; }

  const { data, error } = await supabase
    .from("group_chat_messages")
    .select("id, user_id, user_name, user_initials, avatar_bg, text, image, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) { res.status(500).json({ error: "Erro ao carregar mensagens" }); return; }

  // Reverse to chronological order
  res.json({ messages: (data ?? []).reverse() });
}

// ─── Group Chat: Save Message ───────────────────────────────────────────────
async function handleGroupSave(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabase = getAdminClient();
  if (!supabase) { res.status(500).json({ error: "Serviço indisponível" }); return; }

  const body = req.body ?? {};
  const { user_id, user_name, user_initials, avatar_bg, text, image } = body;

  if (!user_name || !user_initials) {
    res.status(400).json({ error: "Campos obrigatórios em falta" }); return;
  }

  // Text or image required
  if (!text && !image) {
    res.status(400).json({ error: "Mensagem vazia" }); return;
  }

  // Limit text length
  if (text && text.length > 500) {
    res.status(400).json({ error: "Mensagem demasiado longa" }); return;
  }

  const { error } = await supabase.from("group_chat_messages").insert({
    user_id: user_id || null,
    user_name,
    user_initials,
    avatar_bg: avatar_bg || "linear-gradient(135deg, #374151, #111827)",
    text: text || null,
    image: image || null,
  });

  if (error) { res.status(500).json({ error: "Erro ao guardar mensagem" }); return; }
  res.json({ ok: true });
}

// ─── Bot Message Generation (existing) ──────────────────────────────────────
async function handleBotMessage(req: VercelRequest, res: VercelResponse) {
  const recentContext = (req.query.context as string) || "";

  const baiKey = process.env["BAI_API_KEY"];
  if (!baiKey) {
    return res.json(chooseFallback(recentContext));
  }

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
      return res.json(chooseFallback(recentContext));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    let message = data.choices?.[0]?.message?.content?.trim() || "";
    message = message.replace(/^["']|["']$/g, "").replace(/\*\*/g, "").trim();

    if (!message || message.length > 200) {
      message = chooseFallback(recentContext).message;
    }

    res.json({
      ...chooseFallback(""),
      message,
    });
  } catch {
    res.json(chooseFallback(recentContext));
  }
}

// ─── Main Router ────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] || process.env["VITE_APP_URL"] || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query.action as string) || "";

  // Group chat endpoints
  if (action === "group-history") {
    if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
    return handleGroupHistory(req, res);
  }
  if (action === "group-save") {
    return handleGroupSave(req, res);
  }

  // Default: bot message generation
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

  return handleBotMessage(req, res);
}
