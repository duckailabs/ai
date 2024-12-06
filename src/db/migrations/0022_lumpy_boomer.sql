CREATE TYPE "public"."goal_type" AS ENUM('post');--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "type" "goal_type" DEFAULT 'post' NOT NULL;