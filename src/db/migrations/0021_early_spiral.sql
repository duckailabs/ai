ALTER TABLE "goal_tracker" ADD COLUMN "total_runs_daily" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_tracker" ADD COLUMN "total_runs_hourly" integer DEFAULT 0 NOT NULL;