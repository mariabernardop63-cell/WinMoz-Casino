import { Router } from "express";
import { db, withdrawalsTable, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListWithdrawalsQueryParams,
  ApproveWithdrawalParams,
  RejectWithdrawalParams,
  RejectWithdrawalBody,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activityLogger";

const router = Router();

async function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  const player = await db.select().from(playersTable).where(eq(playersTable.id, w.playerId)).then(r => r[0]);
  return {
    id: w.id,
    playerId: w.playerId,
    playerName: player?.username ?? "Unknown",
    amount: w.amount,
    method: w.method,
    status: w.status,
    rejectionReason: w.rejectionReason ?? null,
    createdAt: w.createdAt.toISOString(),
  };
}

router.get("/withdrawals", async (req, res) => {
  const parsed = ListWithdrawalsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let rows = await db.select().from(withdrawalsTable);
  if (params.status) rows = rows.filter(w => w.status === params.status);
  const result = await Promise.all(rows.map(formatWithdrawal));
  res.json(result);
});

router.post("/withdrawals/:id/approve", async (req, res) => {
  const parsed = ApproveWithdrawalParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, parsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Withdrawal not found" });
  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "approved" })
    .where(eq(withdrawalsTable.id, parsed.data.id))
    .returning();
  const formatted = await formatWithdrawal(updated);
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("withdrawal_approve", `Levantamento #${updated.id} aprovado — R$${updated.amount.toFixed(2)} para ${formatted.playerName}`, ip, 1);
  res.json(formatted);
});

router.post("/withdrawals/:id/reject", async (req, res) => {
  const paramParsed = RejectWithdrawalParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = RejectWithdrawalBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) return res.status(400).json({ error: "Invalid input" });
  const rows = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, paramParsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Withdrawal not found" });
  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "rejected", rejectionReason: bodyParsed.data.reason })
    .where(eq(withdrawalsTable.id, paramParsed.data.id))
    .returning();
  const formatted = await formatWithdrawal(updated);
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("withdrawal_reject", `Levantamento #${updated.id} rejeitado — Motivo: ${bodyParsed.data.reason}`, ip, 1);
  res.json(formatted);
});

export default router;
