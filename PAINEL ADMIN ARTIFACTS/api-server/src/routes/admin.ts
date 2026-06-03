import { Router } from "express";
import { db, adminUsersTable, ADMIN_ROLES } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logActivity } from "../lib/activityLogger";

const router = Router();

function formatAdmin(a: typeof adminUsersTable.$inferSelect) {
  return {
    id: a.id,
    name: a.name,
    username: a.username,
    email: a.email,
    phone: a.phone ?? null,
    role: a.role,
    avatarUrl: a.avatarUrl ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/admin/profile", async (req, res) => {
  const rows = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, 1));
  if (!rows[0]) return res.status(404).json({ error: "Admin not found" });
  res.json(formatAdmin(rows[0]));
});

router.put("/admin/profile", async (req, res) => {
  const { name, username, email, phone, role, avatarUrl } = req.body;

  if (role !== undefined && !ADMIN_ROLES.includes(role)) {
    return res.status(400).json({ error: `Cargo inválido. Válidos: ${ADMIN_ROLES.join(", ")}` });
  }

  const rows = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, 1));
  if (!rows[0]) return res.status(404).json({ error: "Admin not found" });

  const [updated] = await db.update(adminUsersTable)
    .set({
      ...(name !== undefined && { name }),
      ...(username !== undefined && { username }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(role !== undefined && { role }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    })
    .where(eq(adminUsersTable.id, 1))
    .returning();

  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("profile_update", `Perfil atualizado: ${updated.username}`, ip, 1);
  res.json(formatAdmin(updated));
});

router.post("/admin/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword e newPassword são obrigatórios" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
  }

  const rows = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, 1));
  if (!rows[0]) return res.status(404).json({ error: "Admin not found" });

  const isValid = await bcrypt.compare(currentPassword, rows[0].passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Senha atual incorreta" });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(adminUsersTable)
    .set({ passwordHash: newHash })
    .where(eq(adminUsersTable.id, 1));

  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown";
  await logActivity("password_change", "Senha do administrador alterada", ip, 1);
  res.json({ success: true });
});

export default router;
