import { Router } from "express";
import { db, withdrawalsTable, playersTable, reportsTable, depositsTable } from "@workspace/db";

const router = Router();

router.get("/notifications", async (req, res) => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [withdrawals, players, reports, deposits] = await Promise.all([
    db.select().from(withdrawalsTable),
    db.select().from(playersTable),
    db.select().from(reportsTable),
    db.select().from(depositsTable),
  ]);

  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
  const newPlayers = players.filter(p => p.createdAt >= oneDayAgo);
  const pendingReports = reports.filter(r => r.status === "pending");
  const newDeposits = deposits.filter(d => d.createdAt >= oneDayAgo);

  const total = pendingWithdrawals.length + newPlayers.length + pendingReports.length + newDeposits.length;

  const items = [
    ...pendingWithdrawals.slice(0, 5).map(w => ({
      type: "withdrawal",
      label: `Levantamento pendente de R$${w.amount.toFixed(2)}`,
      createdAt: w.createdAt.toISOString(),
    })),
    ...newDeposits.slice(0, 5).map(d => ({
      type: "deposit",
      label: `Novo depósito de R$${d.amount.toFixed(2)}`,
      createdAt: d.createdAt.toISOString(),
    })),
    ...newPlayers.slice(0, 5).map(p => ({
      type: "new_user",
      label: `Novo utilizador: ${p.username}`,
      createdAt: p.createdAt.toISOString(),
    })),
    ...pendingReports.slice(0, 5).map(r => ({
      type: "report",
      label: `Denúncia pendente: ${r.reason}`,
      createdAt: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  res.json({
    total,
    pendingWithdrawals: pendingWithdrawals.length,
    newDeposits: newDeposits.length,
    newPlayers: newPlayers.length,
    pendingReports: pendingReports.length,
    items,
  });
});

export default router;
