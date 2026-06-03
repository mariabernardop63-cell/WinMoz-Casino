import { Router } from "express";
import { db, reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListReportsQueryParams,
  ResolveReportParams,
  ResolveReportBody,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activityLogger";

const router = Router();

function formatReport(r: typeof reportsTable.$inferSelect) {
  return {
    id: r.id,
    reporterName: r.reporterName,
    accusedName: r.accusedName,
    reason: r.reason,
    description: r.description ?? null,
    status: r.status,
    matchId: r.matchId,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reports", async (req, res) => {
  const parsed = ListReportsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};
  let rows = await db.select().from(reportsTable);
  if (params.status) rows = rows.filter(r => r.status === params.status);
  res.json(rows.map(formatReport));
});

router.post("/reports/:id/resolve", async (req, res) => {
  const paramParsed = ResolveReportParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = ResolveReportBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) return res.status(400).json({ error: "Invalid input" });
  const rows = await db.select().from(reportsTable).where(eq(reportsTable.id, paramParsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Report not found" });
  const [updated] = await db.update(reportsTable)
    .set({ status: bodyParsed.data.action })
    .where(eq(reportsTable.id, paramParsed.data.id))
    .returning();
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("report_resolve", `Denúncia #${updated.id} marcada como: ${bodyParsed.data.action} (${updated.reason})`, ip, 1);
  res.json(formatReport(updated));
});

export default router;
