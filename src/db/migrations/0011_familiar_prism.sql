CREATE TYPE "public"."coin_price_source" AS ENUM('coingecko', 'binance', 'kraken', 'manual');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coin_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coin_id" uuid NOT NULL,
	"price" numeric NOT NULL,
	"timestamp" timestamp NOT NULL,
	"source" "coin_price_source" DEFAULT 'coingecko' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coingecko_id" varchar(255) NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"current_price" numeric DEFAULT '0' NOT NULL,
	"price_change_24h" numeric DEFAULT '0' NOT NULL,
	"price_change_7d" numeric DEFAULT '0' NOT NULL,
	"platforms" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"twitterHandle" text,
	"last_checked" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coins_coingecko_id_unique" UNIQUE("coingecko_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coin_price_history" ADD CONSTRAINT "coin_price_history_coin_id_coins_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
