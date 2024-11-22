import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema",
  dialect: "postgresql",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
