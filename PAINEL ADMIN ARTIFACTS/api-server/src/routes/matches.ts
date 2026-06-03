import { Router } from "express";
import { db, matchesTable, playersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import {
  ListMatchesQueryParams,
  GetMatchParams,
  ResolveMatchParams,
  ResolveMatchBody,
} from "@workspace/api-zod";

const router = Router();

async function formatMatch(match: typeof matchesTable.$inferSelect) {
  const [p1, p2] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.id, match.player1Id)).then(r => r[0]),
    db.select().from(playersTable).where(eq(playersTable.id, match.player2Id)).then(r => r[0]),
  ]);
  let winnerName: string | null = null;
  if (match.winnerId) {
    if (match.winnerId === match.player1Id) winnerName = p1?.username ?? null;
    else if (match.winnerId === match.player2Id) winnerName = p2?.username ?? null;
  }
  return {
    id: match.id,
    game: match.game,
    status: match.status,
    player1Name: p1?.username ?? "Unknown",
    player2Name: p2?.username ?? "Unknown",
    betAmount: match.betAmount,
    winnerId: match.winnerId ?? null,
    winnerName,
    durationSeconds: match.durationSeconds ?? null,
    createdAt: match.createdAt.toISOString(),
  };
}

router.get("/matches", async (req, res) => {
  const parsed = ListMatchesQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let query = db.select().from(matchesTable);
  const conditions = [];
  if (params.status) conditions.push(eq(matchesTable.status, params.status));
  if (params.game) conditions.push(eq(matchesTable.game, params.game));
  const rows = await (conditions.length > 0
    ? db.select().from(matchesTable).where(and(...conditions))
    : db.select().from(matchesTable));
  const limited = params.limit ? rows.slice(0, params.limit) : rows;
  const result = await Promise.all(limited.map(formatMatch));
  res.json(result);
});

router.get("/matches/:id", async (req, res) => {
  const parsed = GetMatchParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(matchesTable).where(eq(matchesTable.id, parsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Match not found" });
  res.json(await formatMatch(rows[0]));
});

router.post("/matches/:id/resolve", async (req, res) => {
  const paramParsed = ResolveMatchParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = ResolveMatchBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) return res.status(400).json({ error: "Invalid input" });
  const rows = await db.select().from(matchesTable).where(eq(matchesTable.id, paramParsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Match not found" });
  const [updated] = await db.update(matchesTable)
    .set({ status: "finished", winnerId: bodyParsed.data.winnerId })
    .where(eq(matchesTable.id, paramParsed.data.id))
    .returning();
  res.json(await formatMatch(updated));
});

export default router;
