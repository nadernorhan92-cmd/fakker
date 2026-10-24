import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const studyPlans = pgTable("study_plans", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull(),
  plan: jsonb("plan").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
