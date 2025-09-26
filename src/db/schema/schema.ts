import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

type Preferences = {
  preferredTopics: string[];
  dislikedTopics: string[];
  [key: string]: unknown;
};

type ResponseStyles = {
  default: {
    tone?: string[];
    personality?: string[];
    guidelines: string[];
  };
  platforms: Record<string, unknown>;
};

// Enums
export const memoryTypeEnum = pgEnum("memory_type", [
  "interaction",
  "learning",
  "achievement",
  "hobby",
]);

export const relationshipStatusEnum = pgEnum("relationship_status", [
  "friend",
  "blocked",
  "preferred",
  "disliked",
  "neutral",
]);

export const conversationStyleEnum = pgEnum("conversation_style", [
  "chat",
  "post",
  "friend",
  "professional",
  "casual",
  "news",
  "academic",
  "technical",
  "creative",
  "formal",
  "informal",
  "adversarial",
  "harsh",
]);

export const platformEnum = pgEnum("platform", [
  "twitter",
  "discord",
  "telegram",
  "slack",
  "api",
  "system",
]);

export const responseTypeEnum = pgEnum("response_type", [
  // Twitter
  "tweet_create",
  "tweet_reply",
  "tweet_thread",
  // Discord
  "discord_chat",
  "discord_mod",
  "discord_help",
  "discord_welcome",
  // Telegram
  "telegram_chat",
  "telegram_group",
  "telegram_broadcast",
  // Slack
  "slack_chat",
  "slack_thread",
  "slack_channel",
  "slack_dm",
]);

// In your db/schema file where other pgEnums are defined
export const interactionEventEnum = pgEnum("interaction_event_type", [
  "interaction.started",
  "interaction.completed",
  "interaction.failed",
  "interaction.rate_limited",
  "interaction.invalid",
  "interaction.cancelled",
  "interaction.processed",
  "interaction.queued",
  "image.generation.started",
  "image.generation.completed",
  "image.generation.failed",
  "image.moderation.rejected",
]);

export type ConversationStyle =
  (typeof conversationStyleEnum.enumValues)[number];

export type StylesConfig = {
  [K in ConversationStyle]?: {
    rules: string[];
    examples: string[];
  };
};

const DEFAULT_RESPONSE_STYLES: ResponseStyles = {
  default: {
    tone: [],
    personality: [],
    guidelines: [],
  },
  platforms: {},
} as const;

// Update the characters table
export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  bio: text("bio").notNull(),
  personalityTraits: jsonb("personality_traits").$type<string[]>().notNull(),
  onchain: jsonb("onchain").$type<{
    [key: string]: string;
  }>(),
  generalGuidelines: jsonb("general_guidelines").$type<string[]>().default([]),
  quantumPersonality: jsonb("quantum_personality")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  identity: jsonb("identity").$type<{
    [key: string]: string | string[];
  }>(),
  // Add responseStyles
  responseStyles: jsonb("response_styles")
    .$type<ResponseStyles>()
    .notNull()
    .default(DEFAULT_RESPONSE_STYLES),
  styles: jsonb("styles")
    .$type<StylesConfig>()
    .default({
      chat: { rules: [], examples: [] },
      professional: { rules: [], examples: [] },
      casual: { rules: [], examples: [] },
    }),

  shouldRespond: jsonb("should_respond").$type<{
    rules: string[];
    examples: string[];
  }>(),
  hobbies: jsonb("hobbies")
    .$type<
      Array<{
        name: string;
        proficiency?: number;
        lastPracticed?: string;
        relatedTopics?: string[];
        metadata?: Record<string, unknown>;
      }>
    >()
    .default([]),

  beliefSystem: jsonb("belief_system").$type<string[]>().default([]),

  preferences: jsonb("preferences").$type<Preferences>().default({
    preferredTopics: [],
    dislikedTopics: [],
    preferredTimes: [],
    dislikedTimes: [],
    preferredDays: [],
    dislikedDays: [],
    preferredHours: [],
    dislikedHours: [],
    generalLikes: [],
    generalDislikes: [],
  }),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Events Table
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  type: interactionEventEnum("interaction_event_type")
    .default("interaction.started")
    .notNull(),
  payload: jsonb("payload").notNull(),
  metadata: jsonb("metadata")
    .$type<{
      userId?: string;
      timestamp: string;
      source?: string;
      correlationId?: string;
    }>()
    .notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Export the relations
export const relations = {
  character: {
    socialRelations: [],
    memories: [],
    events: [],
    goals: [],
  },
} as const;

export const twitterMentionStatusEnum = pgEnum("twitter_mention_status", [
  "pending",
  "processed",
  "skipped",
  "failed",
  "rate_limited",
]);

export const twitterMentions = pgTable("twitter_mentions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tweetId: varchar("tweet_id", { length: 255 }).notNull().unique(),
  authorId: varchar("author_id", { length: 255 }).notNull(),
  authorUsername: varchar("author_username", { length: 255 }).notNull(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull(),
  processedAt: timestamp("processed_at"),
  status: twitterMentionStatusEnum("status").notNull().default("pending"),
  skipReason: varchar("skip_reason", { length: 255 }),
  responseTweetId: varchar("response_tweet_id", { length: 255 }),
  isReply: boolean("is_reply").notNull().default(false),
  isRetweet: boolean("is_retweet").notNull().default(false),
  conversationId: varchar("conversation_id", { length: 255 }),
  metrics: jsonb("metrics").$type<{
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
  }>(),
});

// Export types
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type Event = typeof events.$inferSelect;
