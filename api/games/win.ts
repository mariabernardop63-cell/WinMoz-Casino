import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const PLATFORM_COMMISSION = 0.10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; }

  const { gameId, gameType, betAmount } = (req.body ?? {}) as {
    gameId?: string;
    gameType?: string;
    betAmount?: number;
  };

  if (!gameId || !gameType || !betAmount || betAmount <= 0) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ ok: false, error: "Serviço indisponível" }); return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      res.status(401).json({ ok: false, error: "Sessão inválida" }); return;
    }
    const userId = userData.user.id;

    // Idempotency check — don't double-credit
    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "win")
      .ilike("description", `%${gameId}%`)
      .maybeSingle();

    if (existing) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    // Prize = both bets * (1 - commission)
    const prize = Math.floor(betAmount * 2 * (1 - PLATFORM_COMMISSION));

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance").eq("id", userId).single();
    if (profileError || !profileData) {
      res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return;
    }

    const currentBalance = Math.round(Number(profileData.balance ?? 0) * 100) / 100;
    const newBalance = Math.round((currentBalance + prize) * 100) / 100;

    const { error: updateError } = await admin
      .from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (updateError) {
      res.status(500).json({ ok: false, error: "Erro ao creditar saldo" }); return;
    }

    await admin.from("transactions").insert({
      user_id: userId,
      type: "win",
      amount: prize,
      description: JSON.stringify({ gameId, gameType, betAmount, prize }),
      status: "approved",
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, prize, newBalance });
  } catch (err) {
    console.error("games/win error:", err);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
}
