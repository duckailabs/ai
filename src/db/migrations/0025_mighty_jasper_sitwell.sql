ALTER TABLE "goal_tracker" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coin_price_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coins" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quantum_states" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "social_relations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "telegram_groups" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "goal_tracker" CASCADE;--> statement-breakpoint
DROP TABLE "goals" CASCADE;--> statement-breakpoint
DROP TABLE "coin_price_history" CASCADE;--> statement-breakpoint
DROP TABLE "coins" CASCADE;--> statement-breakpoint
DROP TABLE "memories" CASCADE;--> statement-breakpoint
DROP TABLE "quantum_states" CASCADE;--> statement-breakpoint
DROP TABLE "social_relations" CASCADE;--> statement-breakpoint
DROP TABLE "telegram_groups" CASCADE;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "quantum_personality" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
DROP TYPE "public"."goal_type";--> statement-breakpoint
DROP TYPE "public"."coin_price_source";--> statement-breakpoint
DROP TYPE "public"."group_tier";