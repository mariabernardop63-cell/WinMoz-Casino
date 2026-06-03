import { Router } from "express";
import { db, playersTable, matchesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { GetRankingQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/ranking", async (req, res) => {
  const parsed = GetRankingQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  const game = params.game ?? "all";

  let players = await db.select().from(playersTable);

  const entries = await Promise.all(players.map(async (p) => {
    let wins = p.wins;
    let losses = p.losses;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
    const totalEarnings = p.totalBets * winRate / 100;
    return {
      playerId: p.id,
      username: p.username,
      avatarUrl: p.avatarUrl ?? null,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      game: game === "all" ? "all" : game,
    };
  }));

  entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  const limited = params.limit ? entries.slice(0, params.limit) : entries;
  const ranked = limited.map((e, i) => ({ rank: i + 1, ...e }));
  res.json(ranked);
});

export default router;
