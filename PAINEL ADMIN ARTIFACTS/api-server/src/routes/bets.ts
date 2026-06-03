import { Router } from "express";
import { db, betsTable, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListBetsQueryParams, CancelBetParams } from "@workspace/api-zod";
import { logActivity } from "../lib/activityLogger";

const router = Router();

async function formatBet(b: typeof betsTable.$inferSelect) {
  const player = await db.select().from(playersTable).where(eq(playersTable.id, b.playerId)).then(r => r[0]);
  return {
    id: b.id,
    matchId: b.matchId,
    playerName: player?.username ?? "Unknown",
    game: b.game,
    amount: b.amount,
    status: b.status,
    payout: b.payout ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bets", async (req, res) => {
  const parsed = ListBetsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let rows = await db.select().from(betsTable);
  if (params.status) rows = rows.filter(b => b.status === params.status);
  const limited = params.limit ? rows.slice(0, params.limit) : rows;
  const result = await Promise.all(limited.map(formatBet));
  res.json(result);
});

router.post("/bets/:id/cancel", async (req, res) => {
  const parsed = CancelBetParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(betsTable).where(eq(betsTable.id, parsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Bet not found" });
  const [updated] = await db.update(betsTable)
    .set({ status: "cancelled" })
    .where(eq(betsTable.id, parsed.data.id))
    .returning();
  const formatted = await formatBet(updated);
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("bet_cancel", `Aposta #${updated.id} cancelada — R$${updated.amount.toFixed(2)} (${updated.game})`, ip, 1);
  res.json(formatted);
});

export default router;
