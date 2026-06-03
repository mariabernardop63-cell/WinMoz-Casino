import { Router } from "express";
import { db, playersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListPlayersQueryParams,
  GetPlayerParams,
  SuspendPlayerParams,
  SuspendPlayerBody,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activityLogger";

const router = Router();

function formatPlayer(p: typeof playersTable.$inferSelect) {
  return {
    id: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl ?? null,
    status: p.status,
    balance: p.balance,
    wins: p.wins,
    losses: p.losses,
    totalBets: p.totalBets,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/players", async (req, res) => {
  const parsed = ListPlayersQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let rows = await db.select().from(playersTable);
  if (params.online === true || params.online === "true" as unknown) {
    rows = rows.filter(p => p.status === "online" || p.status === "in_game");
  }
  const limited = params.limit ? rows.slice(0, params.limit) : rows;
  res.json(limited.map(formatPlayer));
});

router.get("/players/online", async (req, res) => {
  const filter = (req.query.filter as string) ?? "all";
  const allPlayers = await db.select().from(playersTable).orderBy(desc(playersTable.updatedAt));

  let onlinePlayers: typeof allPlayers = [];
  let recentOffline: typeof allPlayers = [];

  if (filter === "online") {
    onlinePlayers = allPlayers.filter(p => p.status === "online" || p.status === "in_game");
    res.json(onlinePlayers.map(formatPlayer));
    return;
  }
  if (filter === "offline") {
    recentOffline = allPlayers.filter(p => p.status === "offline").slice(0, 50);
    res.json(recentOffline.map(formatPlayer));
    return;
  }
  if (filter === "blocked") {
    const blocked = allPlayers.filter(p => p.status === "suspended");
    res.json(blocked.map(formatPlayer));
    return;
  }

  onlinePlayers = allPlayers.filter(p => p.status === "online" || p.status === "in_game");
  recentOffline = allPlayers.filter(p => p.status === "offline").slice(0, 50);
  const combined = [...onlinePlayers, ...recentOffline];
  res.json(combined.map(formatPlayer));
});

router.get("/players/:id", async (req, res) => {
  const parsed = GetPlayerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(playersTable).where(eq(playersTable.id, parsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Player not found" });
  res.json(formatPlayer(rows[0]));
});

router.post("/players/:id/suspend", async (req, res) => {
  const paramParsed = SuspendPlayerParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = SuspendPlayerBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) return res.status(400).json({ error: "Invalid input" });
  const rows = await db.select().from(playersTable).where(eq(playersTable.id, paramParsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Player not found" });
  const [updated] = await db.update(playersTable)
    .set({ status: "suspended" })
    .where(eq(playersTable.id, paramParsed.data.id))
    .returning();
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("player_suspend", `Jogador suspenso: ${updated.username} (ID: ${updated.id})`, ip, 1);
  res.json(formatPlayer(updated));
});

export default router;
