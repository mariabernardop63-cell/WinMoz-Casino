import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { roomId } = (req.body ?? {}) as { roomId?: string };

  if (!roomId || typeof roomId !== "string") {
    res.status(400).json({ error: "roomId obrigatório" });
    return;
  }

  const admin = getSupabaseAdmin();

  // Verify room ownership and get bet amount
  const { data: room, error: roomError } = await admin
    .from("game_rooms")
    .select("id, creator_id, bet_amount, status, game_type")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !room) {
    res.status(404).json({ error: "Sala não encontrada" });
    return;
  }

  const r = room as {
    id: string;
    creator_id: string;
    bet_amount: number;
    status: string;
    game_type: string;
  };

  // SECURITY: Only the creator can cancel their own room
  if (r.creator_id !== auth.userId) {
    res.status(403).json({ error: "Não és o criador desta sala" });
    return;
  }

  if (r.status !== "waiting") {
    res.status(409).json({ error: "Sala já está em jogo ou foi cancelada" });
    return;
  }

  // SECURITY: Atomic delete — only delete if still "waiting" (prevents double refund)
  const { error: deleteError, count } = await admin
    .from("game_rooms")
    .delete({ count: "exact" })
    .eq("id", roomId)
    .eq("creator_id", auth.userId) // must be creator
    .eq("status", "waiting");      // must still be waiting

  if (deleteError || count === 0) {
    res.status(409).json({ error: "Sala já foi preenchida — não é possível cancelar" });
    return;
  }

  // Refund the bet
  const betAmount = Number(r.bet_amount);

  const { data: profile } = await admin
    .from("profiles")
    .select("balance")
    .eq("id", auth.userId)
    .single();

  const currentBalance = parseFloat(String((profile as { balance: number } | null)?.balance ?? 0));
  const newBalance = Math.round((currentBalance + betAmount) * 100) / 100;

  await admin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", auth.userId);

  await admin.from("transactions").insert({
    user_id: auth.userId,
    type: "win",
    amount: betAmount,
    description: `Reembolso: sala cancelada (${r.game_type})`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  res.json({ ok: true, refund: betAmount, newBalance });
}
