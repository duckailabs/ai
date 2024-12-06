CREATE TYPE "public"."goal_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('pending', 'active', 'paused', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('maintenance', 'learning', 'interaction', 'creation', 'analysis', 'social', 'market');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goal_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"depends_on_id" uuid NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goal_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"success" boolean,
	"progress" integer DEFAULT 0 NOT NULL,
	"quantum_state" jsonb,
	"result" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "goal_type" NOT NULL,
	"priority" "goal_priority" DEFAULT 'medium' NOT NULL,
	"status" "goal_status" DEFAULT 'pending' NOT NULL,
	"description" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"criteria" jsonb NOT NULL,
	"quantum_preferences" jsonb,
	"execution_settings" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"next_scheduled_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goal_dependencies" ADD CONSTRAINT "goal_dependencies_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goal_dependencies" ADD CONSTRAINT "goal_dependencies_depends_on_id_goals_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goal_executions" ADD CONSTRAINT "goal_executions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goals" ADD CONSTRAINT "goals_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
