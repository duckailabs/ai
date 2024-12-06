ALTER TABLE "goal_tracker" ADD COLUMN "last_daily_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "goal_tracker" ADD COLUMN "last_hourly_reset_at" timestamp;