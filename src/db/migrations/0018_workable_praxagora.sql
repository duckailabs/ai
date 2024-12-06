DROP TABLE "goal_dependencies" CASCADE;--> statement-breakpoint
DROP TABLE "goal_executions" CASCADE;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "daily_frequency" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "hourly_frequency" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "tools" text[];--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "priority";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "progress";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "is_recurring";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "criteria";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "quantum_preferences";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "execution_settings";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "completed_at";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "next_scheduled_at";--> statement-breakpoint
DROP TYPE "public"."goal_priority";--> statement-breakpoint
DROP TYPE "public"."goal_status";--> statement-breakpoint
DROP TYPE "public"."goal_type";