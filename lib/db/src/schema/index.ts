import { pgTable, text, decimal, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  full_name: text("full_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  avatar_url: text("avatar_url"),
  invite_code_used: text("invite_code_used"),
  my_invite_code: text("my_invite_code").unique(),
  password_hash: text("password_hash").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  my_invite_code: true,
  balance: true,
  created_at: true,
  updated_at: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
