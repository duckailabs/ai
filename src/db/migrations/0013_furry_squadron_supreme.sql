ALTER TABLE "coins" ADD COLUMN "rank" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coin_price_history" DROP COLUMN IF EXISTS "rank";