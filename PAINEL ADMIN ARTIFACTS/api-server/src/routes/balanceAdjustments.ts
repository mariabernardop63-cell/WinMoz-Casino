import { Router } from "express";
import { db, balanceAdjustmentsTable, playersTable } from "@workspace/db";
import { eq, desc, or, ilike } from "drizzle-orm";
import { logActivity } from "../lib/activityLogger";

const router = Router();

router.get("/balance-adjustments", async (req, res) => {
  const playerId = req.query.player_id ? Number(req.query.player_id) : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  let rows = await db.select().from(balanceAdjustmentsTable).orderBy(desc(balanceAdjustmentsTable.createdAt));
  if (playerId) rows = rows.filter(r => r.playerId === playerId);

  const total = rows.length;
  const paginated = rows.slice((page - 1) * limit, page * limit);

  const playerIds = [...new Set(paginated.map(r => r.playerId))];
  const players: Record<number, string> = {};
  for (const pid of playerIds) {
    const p = await db.select().from(playersTable).where(eq(playersTable.id, pid)).then(r => r[0]);
    if (p) players[pid] = p.username;
  }

  res.json({
    total,
    page,
    limit,
    data: paginated.map(r => ({
      id: r.id,
      playerId: r.playerId,
      playerName: players[r.playerId] ?? "Unknown",
      adminId: r.adminId ?? null,
      amount: r.amount,
      reason: r.reason,
      note: r.note ?? null,
      balanceBefore: r.balanceBefore,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.get("/balance-adjustments/search", async (req, res) => {
  const query = (req.query.q as string) ?? "";
  if (!query) return res.json([]);

  const allPlayers = await db.select().from(playersTable);
  const matched = allPlayers.filter(p =>
    p.username.toLowerCase().includes(query.toLowerCase()) ||
    String(p.id) === query
  );

  res.json(matched.map(p => ({
    id: p.id,
    username: p.username,
    balance: p.balance,
    status: p.status,
    avatarUrl: p.avatarUrl ?? null,
  })));
});

router.post("/balance-adjustments", async (req, res) => {
  const { playerId, amount, reason, note, type } = req.body;
  if (!playerId || amount === undefined || !reason) {
    return res.status(400).json({ error: "playerId, amount e reason são obrigatórios" });
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "amount deve ser um número positivo" });
  }

  const playerRows = await db.select().from(playersTable).where(eq(playersTable.id, Number(playerId)));
  if (!playerRows[0]) return res.status(404).json({ error: "Jogador não encontrado" });

  const player = playerRows[0];
  const delta = type === "subtract" ? -numAmount : numAmount;
  const balanceBefore = player.balance;
  const balanceAfter = Math.max(0, balanceBefore + delta);

  await db.update(playersTable).set({ balance: balanceAfter }).where(eq(playersTable.id, player.id));

  const [adj] = await db.insert(balanceAdjustmentsTable).values({
    playerId: player.id,
    adminId: 1,
    amount: delta,
    reason,
    note: note ?? null,
    balanceBefore,
    balanceAfter,
  }).returning();

  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  const actionLabel = delta > 0 ? "Adição" : "Remoção";
  await logActivity(
    "balance_adjustment",
    `${actionLabel} de R$${Math.abs(numAmount).toFixed(2)} para ${player.username}. Motivo: ${reason}`,
    ip,
    1,
  );

  res.json({
    id: adj.id,
    playerId: player.id,
    playerName: player.username,
    amount: adj.amount,
    reason: adj.reason,
    note: adj.note ?? null,
    balanceBefore: adj.balanceBefore,
    balanceAfter: adj.balanceAfter,
    createdAt: adj.createdAt.toISOString(),
  });
});

export default router;
