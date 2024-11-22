ALTER TYPE "public"."interaction_event_type" ADD VALUE 'image.generation.started';--> statement-breakpoint
ALTER TYPE "public"."interaction_event_type" ADD VALUE 'image.generation.completed';--> statement-breakpoint
ALTER TYPE "public"."interaction_event_type" ADD VALUE 'image.generation.failed';--> statement-breakpoint
ALTER TYPE "public"."interaction_event_type" ADD VALUE 'image.moderation.rejected';--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'api';