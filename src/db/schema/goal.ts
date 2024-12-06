import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const GoalType = pgEnum("goal_type", ["post"]);

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  dailyFrequency: integer("daily_frequency").notNull().default(1),
  hourlyFrequency: integer("hourly_frequency").notNull().default(1),
  type: GoalType("type").notNull().default("post"),
  tools: text("tools").array(),
  contextTypes: text("context_types").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const goalTracker = pgTable("goal_tracker", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  lastRanAt: timestamp("last_ran_at"),
  // New fields for UTC tracking
  lastDailyResetAt: timestamp("last_daily_reset_at"),
  lastHourlyResetAt: timestamp("last_hourly_reset_at"),
  totalRunsDaily: integer("total_runs_daily").notNull().default(0),
  totalRunsHourly: integer("total_runs_hourly").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
