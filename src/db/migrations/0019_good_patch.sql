ALTER TABLE "goals" DROP CONSTRAINT "goals_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "character_id";