import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(
  action: string,
  detail: string,
  ip?: string,
  adminId?: number,
): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      adminId: adminId ?? 1,
      action,
      detail,
      ip: ip ?? "unknown",
    });
  } catch {
  }
}
