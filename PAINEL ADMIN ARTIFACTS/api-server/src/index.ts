import app from "./app";
import { logger } from "./lib/logger";
import { db, adminUsersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminUser() {
  try {
    const existing = await db.select().from(adminUsersTable).limit(1);
    if (existing.length === 0) {
      const defaultPassword = process.env["ADMIN_DEFAULT_PASSWORD"] ?? "admin123";
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      await db.insert(adminUsersTable).values({
        name: "Administrador",
        username: "admin",
        email: "admin@gamezone.com",
        phone: "+244 900 000 000",
        role: "super_admin",
        avatarUrl: null,
        passwordHash,
      });
      logger.info("Default admin user created. Change the password via the admin profile page.");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedAdminUser();
});
