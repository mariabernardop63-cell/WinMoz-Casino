import { pgTable, text, decimal, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
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
  password_hash: text("password_hash"),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default("completed"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("pending"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const referralsTable = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrer_id: uuid("referrer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  referred_id: uuid("referred_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  bonus_paid: boolean("bonus_paid").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
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
export type Transaction = typeof transactionsTable.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
