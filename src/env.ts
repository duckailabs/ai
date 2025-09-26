import { z } from "zod";

type RawEnv = Record<string, string | undefined>;

const schema = z.object({
  OPENPOND_BASE_URL: z.string().min(1).default("http://localhost:3001"),
  OPENPOND_API_KEY: z.string().min(1, "OPENPOND_API_KEY is required"),
  OPENPOND_TEAM_ID: z.string().min(1, "OPENPOND_TEAM_ID is required"),
  OPENPOND_MODEL: z.string().min(1).default("openai:gpt-5-mini"),
  OPENPOND_STREAM: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }),
  DEFAULT_CHARACTER_ID: z.string().min(1, "DEFAULT_CHARACTER_ID is required"),
  TWITTER_AGENT_PORT: z.coerce.number().default(4000),
  TWITTER_EXECUTOR_URL: z.string().min(1, "TWITTER_EXECUTOR_URL is required"),
  TWITTER_BOT_SECRET: z.string().min(1, "TWITTER_BOT_SECRET is required"),
  TWITTER_SCHEDULE_MESSAGE: z.string().optional(),
  TWITTER_SCHEDULE_CRON: z.string().optional(),
  TWITTER_DEV_FALLBACK: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHARACTER_ID: z.string().optional(),
  TELEGRAM_CONVERSATION_PREFIX: z.string().optional(),
});

const parsed = schema.parse(process.env as RawEnv);

export const env = {
  worker: {
    baseUrl: parsed.OPENPOND_BASE_URL.replace(/\/$/, ""),
    apiKey: parsed.OPENPOND_API_KEY,
    teamId: parsed.OPENPOND_TEAM_ID,
    model: parsed.OPENPOND_MODEL,
    stream: parsed.OPENPOND_STREAM ?? true,
  },
  http: {
    port: parsed.TWITTER_AGENT_PORT,
  },
  characters: {
    defaultId: parsed.DEFAULT_CHARACTER_ID,
  },
  twitterExecutor: {
    url: parsed.TWITTER_EXECUTOR_URL.replace(/\/$/, ""),
    token: parsed.TWITTER_BOT_SECRET,
  },
  ingest: {
    token: parsed.TWITTER_BOT_SECRET,
  },
  devFallback: parsed.TWITTER_DEV_FALLBACK ?? false,
  schedule: parsed.TWITTER_SCHEDULE_MESSAGE
    ? {
        message: parsed.TWITTER_SCHEDULE_MESSAGE,
        cron: parsed.TWITTER_SCHEDULE_CRON || "0 * * * *",
      }
    : null,
  telegram: parsed.TELEGRAM_BOT_TOKEN
    ? {
        token: parsed.TELEGRAM_BOT_TOKEN,
        characterId:
          parsed.TELEGRAM_CHARACTER_ID ?? parsed.DEFAULT_CHARACTER_ID,
        conversationPrefix: parsed.TELEGRAM_CONVERSATION_PREFIX,
      }
    : null,
};
