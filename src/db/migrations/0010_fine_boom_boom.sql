CREATE TYPE "public"."twitter_mention_status" AS ENUM('pending', 'processed', 'skipped', 'failed', 'rate_limited');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twitter_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tweet_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"author_username" varchar(255) NOT NULL,
	"character_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"status" "twitter_mention_status" DEFAULT 'pending' NOT NULL,
	"skip_reason" varchar(255),
	"response_tweet_id" varchar(255),
	"is_reply" boolean DEFAULT false NOT NULL,
	"is_retweet" boolean DEFAULT false NOT NULL,
	"conversation_id" varchar(255),
	"metrics" jsonb,
	CONSTRAINT "twitter_mentions_tweet_id_unique" UNIQUE("tweet_id")
);
--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "quantum_personality" SET DEFAULT '{"temperature":0.7,"personalityTraits":[],"styleModifiers":{"tone":[],"guidelines":[]},"creativityLevels":{"low":{"personalityTraits":[],"styleModifiers":{"tone":[],"guidelines":[]}},"medium":{"personalityTraits":[],"styleModifiers":{"tone":[],"guidelines":[]}},"high":{"personalityTraits":[],"styleModifiers":{"tone":[],"guidelines":[]}}},"temperatureRange":{"min":0.6,"max":0.8},"creativityThresholds":{"low":100,"medium":180}}'::jsonb;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "quantum_personality" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter_mentions" ADD CONSTRAINT "twitter_mentions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
