import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_GAME_TYPES = new Set(["Ludo", "Damas", "Xadrez"]);
const MAX_BET = 50_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return res.status(500).json({ error: "Server misconfigured" });

  const body = req.body as Record<string, unknown>;
  const gameId = body["gameId"];
  const gameType = body["gameType"];
  const betAmount = body["betAmount"];

  if (
    typeof gameId !== "string" || gameId.length === 0 || gameId.length > 120 ||
    typeof gameType !== "string" || !ALLOWED_GAME_TYPES.has(gameType) ||
    typeof betAmount !== "number" || betAmount <= 0 || betAmount > MAX_BET
  ) {
    return res.status(400).json({ error: "Parâmetros inválidos" });
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Sessão inválida" });

  const userId = user.id;

  const { data: existingWin } = await admin
    .from("transactions")
    .select("id, amount")
    .eq("user_id", userId)
    .eq("type", "win")
    .like("description", `%[${gameId}]%`)
    .maybeSingle();

  if (existingWin) {
    const { data: prof } = await admin
      .from("profiles").select("balance").eq("id", userId).single();
    return res.status(200).json({
      ok: true,
      newBalance: parseFloat(String(prof?.balance ?? 0)),
      duplicate: true,
    });
  }

  const payout = Math.floor(betAmount * 2 * 0.90);
  const platformFee = betAmount * 2 - payout;

  const { data: profile, error: profErr } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profErr || !profile) return res.status(500).json({ error: "Perfil não encontrado" });

  const currentBal = parseFloat(String(profile.balance ?? 0));
  const newBalance = Math.round((currentBal + payout) * 100) / 100;

  const { error: updateErr } = await admin
    .from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateErr) return res.status(500).json({ error: "Erro ao creditar saldo" });

  await admin.from("transactions").insert({
    user_id: userId,
    type: "win",
    amount: payout,
    description: `Vitória (${gameType}) [${gameId}]`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  if (platformFee > 0) {
    await admin.from("platform_earnings").insert({
      amount: platformFee,
      source: "game_fee",
      description: `Taxa de jogo (${gameType}) — aposta ${betAmount} MT`,
      reference_id: gameId,
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});
  }

  return res.status(200).json({ ok: true, newBalance });
}
