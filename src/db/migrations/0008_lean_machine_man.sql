CREATE TABLE IF NOT EXISTS "quantum_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"random_value" integer NOT NULL,
	"mood_value" integer NOT NULL,
	"creativity_value" integer NOT NULL,
	"entropy_hash" text NOT NULL,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
