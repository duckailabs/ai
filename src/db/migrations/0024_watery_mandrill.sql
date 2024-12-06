ALTER TABLE "goals" ADD COLUMN "context_types" text[];--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "metadata";