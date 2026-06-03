import { Router } from "express";
import { db, activityLogsTable, adminUsersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/activity-logs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const action = req.query.action as string | undefined;

  let rows = await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt));

  if (action) {
    rows = rows.filter(r => r.action === action);
  }

  const total = rows.length;
  const paginated = rows.slice((page - 1) * limit, page * limit);

  const adminIds = [...new Set(paginated.map(r => r.adminId).filter(Boolean))];
  const admins: Record<number, string> = {};
  for (const aid of adminIds) {
    if (aid !== null) {
      const a = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, aid)).then(r => r[0]);
      if (a) admins[aid] = a.username;
    }
  }

  res.json({
    total,
    page,
    limit,
    data: paginated.map(r => ({
      id: r.id,
      action: r.action,
      detail: r.detail ?? null,
      ip: r.ip ?? null,
      adminId: r.adminId ?? null,
      adminUsername: r.adminId ? (admins[r.adminId] ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.post("/activity-logs", async (req, res) => {
  const { action, detail, ip, adminId } = req.body;
  if (!action) return res.status(400).json({ error: "action é obrigatório" });
  const [inserted] = await db.insert(activityLogsTable)
    .values({ action, detail, ip, adminId: adminId ?? 1 })
    .returning();
  res.json({ id: inserted.id, createdAt: inserted.createdAt.toISOString() });
});

export default router;
