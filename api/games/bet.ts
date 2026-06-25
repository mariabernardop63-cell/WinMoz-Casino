import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

const MIN_BET = 1;
const MAX_BET = 100000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, gameType, gameId, description } = (req.body ?? {}) as {
    amount?: number;
    gameType?: string;
    gameId?: string;
    description?: string;
  };

  if (!amount || typeof amount !== "number" || amount < MIN_BET || amount > MAX_BET) {
    res.status(400).json({ error: "Montante de aposta inválido" });
    return;
  }
  if (!gameType || !["damas","ludo","xadrez"].includes(gameType)) {
    res.status(400).json({ error: "Tipo de jogo inválido" });
    return;
  }

  const admin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("balance, is_blocked")
    .eq("id", auth.userId)
    .single();

  if (profileError || !profile) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
    return;
  }
  if ((profile as { is_blocked?: boolean }).is_blocked) {
    res.status(403).json({ error: "Conta bloqueada" });
    return;
  }

  const currentBalance = parseFloat(String((profile as { balance: number }).balance ?? 0));
  if (currentBalance < amount) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  const newBalance = Math.round((currentBalance - amount) * 100) / 100;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", auth.userId);

  if (updateError) {
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }

  const txDesc = description || `Aposta (${gameType}) - ${amount} MT`;

  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "bet",
    amount: -Math.abs(amount),
    description: txDesc,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  if (gameId) {
    await admin
      .from("matches")
      .upsert(
        {
          id: gameId,
          game_type: gameType,
          player1_id: auth.userId,
          bet_amount: amount,
          winner_payout: Math.floor(amount * 2 * 0.9),
          status: "active",
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .eq("player1_id", auth.userId);
  }

  res.json({ ok: true, newBalance });
}
