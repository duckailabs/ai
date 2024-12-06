ALTER TABLE "goals" ADD COLUMN "type" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;