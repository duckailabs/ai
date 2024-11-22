CREATE TYPE "public"."group_tier" AS ENUM('permanent', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."interaction_event_type" AS ENUM('interaction.started', 'interaction.completed', 'interaction.failed', 'interaction.rate_limited', 'interaction.invalid', 'interaction.cancelled', 'interaction.processed', 'interaction.queued');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" varchar(255) NOT NULL,
	"tier" "group_tier" DEFAULT 'temporary' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{"allowCommands":true,"adminUserIds":[]}'::jsonb,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_groups_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
DROP TABLE "active_conversations" CASCADE;--> statement-breakpoint
DROP TABLE "conversation_history" CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "interaction_event_type" "interaction_event_type" DEFAULT 'interaction.started' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
DROP TYPE "public"."sentiment";