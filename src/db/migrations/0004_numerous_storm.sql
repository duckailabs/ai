CREATE TYPE "public"."sentiment" AS ENUM('formal', 'casual', 'friendly', 'professional', 'excited', 'reserved', 'degen', 'curt', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."conversation_style" AS ENUM('chat', 'post', 'friend', 'professional', 'casual', 'news', 'academic', 'technical', 'creative', 'formal', 'informal', 'adversarial', 'harsh');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('interaction', 'learning', 'achievement', 'hobby');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('twitter', 'discord', 'telegram', 'slack');--> statement-breakpoint
CREATE TYPE "public"."relationship_status" AS ENUM('friend', 'blocked', 'preferred', 'disliked', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('tweet_create', 'tweet_reply', 'tweet_thread', 'discord_chat', 'discord_mod', 'discord_help', 'discord_welcome', 'telegram_chat', 'telegram_group', 'telegram_broadcast', 'slack_chat', 'slack_thread', 'slack_channel', 'slack_dm');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "active_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"message_count" numeric DEFAULT '0' NOT NULL,
	"last_message_timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"character_id" uuid NOT NULL,
	"message" varchar(1000) NOT NULL,
	"sentiment" "sentiment",
	"metadata" jsonb DEFAULT '{"platform":"","messageType":""}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"bio" text NOT NULL,
	"personality_traits" jsonb NOT NULL,
	"onchain" jsonb,
	"general_guidelines" jsonb DEFAULT '[]'::jsonb,
	"identity" jsonb,
	"response_styles" jsonb DEFAULT '{"default":{"tone":[],"personality":[],"guidelines":[]},"platforms":{}}'::jsonb NOT NULL,
	"styles" jsonb DEFAULT '{"chat":{"rules":[],"examples":[]},"professional":{"rules":[],"examples":[]},"casual":{"rules":[],"examples":[]}}'::jsonb,
	"should_respond" jsonb,
	"hobbies" jsonb DEFAULT '[]'::jsonb,
	"belief_system" jsonb DEFAULT '[]'::jsonb,
	"preferences" jsonb DEFAULT '{"preferredTopics":[],"dislikedTopics":[],"preferredTimes":[],"dislikedTimes":[],"preferredDays":[],"dislikedDays":[],"preferredHours":[],"dislikedHours":[],"generalLikes":[],"generalDislikes":[]}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"progress" numeric DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "memory_type" NOT NULL,
	"content" text NOT NULL,
	"importance" numeric DEFAULT '0.5' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"status" "relationship_status" DEFAULT 'neutral' NOT NULL,
	"interaction_count" numeric DEFAULT '0' NOT NULL,
	"sentiment" numeric DEFAULT '0' NOT NULL,
	"last_interaction" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_conversation_id_active_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."active_conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goals" ADD CONSTRAINT "goals_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_relations" ADD CONSTRAINT "social_relations_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
