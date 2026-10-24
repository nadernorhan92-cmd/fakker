import { pgTable, text, timestamp, jsonb, uuid, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

export const pushDevices = pgTable("push_devices", {
  owner: text("owner").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  subscription: jsonb("subscription").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const pushReminders = pgTable("push_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner: text("owner").notNull().references(() => pushDevices.owner, { onDelete: "cascade" }),
  taskId: text("task_id").notNull(),
  title: text("title").notNull(),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  receipt: text("receipt").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  retryAt: timestamp("retry_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
}, table => [index("push_due_idx").on(table.retryAt, table.remindAt), index("push_owner_idx").on(table.owner)]);

export const insertPushDeviceSchema = createInsertSchema(pushDevices);
export const insertPushReminderSchema = createInsertSchema(pushReminders);
export type PushDevice = z.infer<typeof insertPushDeviceSchema>;
export type PushReminder = z.infer<typeof insertPushReminderSchema>;
