import { Router } from "express";
import { db, matchesTable, playersTable, betsTable, withdrawalsTable, reportsTable, fraudAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  const [matches, players, bets, withdrawals, reports] = await Promise.all([
    db.select().from(matchesTable),
    db.select().from(playersTable),
    db.select().from(betsTable),
    db.select().from(withdrawalsTable),
    db.select().from(reportsTable),
  ]);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totalBetVolume = bets.reduce((sum, b) => sum + b.amount, 0);
  res.json({
    liveMatches: matches.filter(m => m.status === "live").length,
    onlinePlayers: players.filter(p => p.status === "online" || p.status === "in_game").length,
    activeBets: bets.filter(b => b.status === "active").length,
    pendingWithdrawals: withdrawals.filter(w => w.status === "pending").length,
    totalBetVolume,
    platformRevenue: Math.round(totalBetVolume * 0.05 * 100) / 100,
    pendingReports: reports.filter(r => r.status === "pending").length,
    totalMatches24h: matches.filter(m => m.createdAt >= oneDayAgo).length,
    totalMatchesDama: matches.filter(m => m.game === "dama").length,
    totalMatchesLudo: matches.filter(m => m.game === "ludo").length,
    totalPlayers: players.length,
    registeredToday: players.filter(p => p.createdAt >= oneDayAgo).length,
  });
});

router.get("/stats/matches-over-time", async (req, res) => {
  const matches = await db.select().from(matchesTable);
  const days: Record<string, { dama: number; ludo: number }> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days[key] = { dama: 0, ludo: 0 };
  }
  for (const m of matches) {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (days[key]) {
      if (m.game === "dama") days[key].dama++;
      else if (m.game === "ludo") days[key].ludo++;
    }
  }
  res.json(Object.entries(days).map(([date, v]) => ({ date, ...v })));
});

router.get("/stats/bets-over-time", async (req, res) => {
  const bets = await db.select().from(betsTable);
  const days: Record<string, { dama: number; ludo: number }> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days[key] = { dama: 0, ludo: 0 };
  }
  for (const b of bets) {
    const key = b.createdAt.toISOString().slice(0, 10);
    if (days[key]) {
      if (b.game === "dama") days[key].dama += b.amount;
      else if (b.game === "ludo") days[key].ludo += b.amount;
    }
  }
  res.json(Object.entries(days).map(([date, v]) => ({ date, ...v })));
});

router.get("/stats/game-breakdown", async (req, res) => {
  const [matches, bets, players] = await Promise.all([
    db.select().from(matchesTable),
    db.select().from(betsTable),
    db.select().from(playersTable),
  ]);

  const liveMatches = matches.filter(m => m.status === "live");
  const activeBets = bets.filter(b => b.status === "active");

  res.json({
    damaMatches: matches.filter(m => m.game === "dama").length,
    ludoMatches: matches.filter(m => m.game === "ludo").length,
    damaBetVolume: bets.filter(b => b.game === "dama").reduce((s, b) => s + b.amount, 0),
    ludoBetVolume: bets.filter(b => b.game === "ludo").reduce((s, b) => s + b.amount, 0),
    damaActivePlayers: liveMatches.filter(m => m.game === "dama").length * 2,
    ludoActivePlayers: liveMatches.filter(m => m.game === "ludo").length * 2,
  });
});

router.get("/stats/antifraud", async (req, res) => {
  const [alerts, players] = await Promise.all([
    db.select().from(fraudAlertsTable),
    db.select().from(playersTable),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  res.json({
    flaggedAccounts: players.filter(p => p.status === "suspended").length,
    suspiciousBets: alerts.filter(a => a.type === "suspicious_bet").length,
    unusualPatterns: alerts.filter(a => a.type === "unusual_pattern").length,
    resolvedToday: alerts.filter(a => a.resolved === "true" && a.updatedAt >= today).length,
    alerts: alerts.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      severity: a.severity,
      playerName: a.playerName,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

export default router;
