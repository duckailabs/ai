import type { QuantumPersonalityConfig } from "@/core/types";
import type { Preferences, ResponseStyles } from "@/types";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

const DEFAULT_QUANTUM_PERSONALITY: QuantumPersonalityConfig = {
  temperature: 0.7,
  personalityTraits: [],
  styleModifiers: {
    tone: [],
    guidelines: [],
  },
  creativityLevels: {
    low: {
      personalityTraits: [],
      styleModifiers: {
        tone: [],
        guidelines: [],
      },
    },
    medium: {
      personalityTraits: [],
      styleModifiers: {
        tone: [],
        guidelines: [],
      },
    },
    high: {
      personalityTraits: [],
      styleModifiers: {
        tone: [],
        guidelines: [],
      },
    },
  },
  temperatureRange: {
    min: 0.6,
    max: 0.8,
  },
  creativityThresholds: {
    low: 100,
    medium: 180,
  },
};

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
    .$type<QuantumPersonalityConfig>()
    .notNull()
    .default(DEFAULT_QUANTUM_PERSONALITY),
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

// Social Relations Table
export const socialRelations = pgTable("social_relations", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  status: relationshipStatusEnum("status").notNull().default("neutral"),
  interactionCount: integer("interaction_count").notNull().default(0),
  sentiment: numeric("sentiment").notNull().default("0"),
  lastInteraction: timestamp("last_interaction")
    .notNull()
    .default(sql`now()`),
  metadata: jsonb("metadata")
    .$type<{
      lastTopics?: string[];
      preferences?: Record<string, unknown>;
      notes?: string[];
    }>()
    .default({}),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Memories Table
export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  type: memoryTypeEnum("type").notNull(),
  content: text("content").notNull(),
  importance: numeric("importance").notNull().default("0.5"),
  metadata: jsonb("metadata")
    .$type<{
      userId?: string;
      sentiment?: number;
      topic?: string;
      hobby?: string;
      relatedMemories?: string[];
    }>()
    .default({}),
  createdAt: timestamp("created_at")
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

// Group tier management
export const groupTierEnum = pgEnum("group_tier", ["permanent", "temporary"]);

export const telegramGroups = pgTable("telegram_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramId: varchar("telegram_id", { length: 255 }).notNull().unique(),
  tier: groupTierEnum("tier").notNull().default("temporary"),
  isActive: boolean("is_active").notNull().default(true),
  settings: jsonb("settings")
    .$type<{
      allowCommands: boolean;
      adminUserIds: string[];
    }>()
    .default({ allowCommands: true, adminUserIds: [] }),
  metadata: jsonb("metadata")
    .$type<{
      title: string;
      joinedAt: Date;
      addedBy: string;
      memberCount?: number;
      lastActive: Date;
    }>()
    .notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

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

export const quantumStates = pgTable("quantum_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  randomValue: integer("random_value").notNull(),
  moodValue: integer("mood_value").notNull(),
  creativityValue: integer("creativity_value").notNull(),
  entropyHash: text("entropy_hash").notNull(),
  isFallback: boolean("is_fallback").notNull().default(false),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Add to your schema file:
export const coinPriceHistoryEnum = pgEnum("coin_price_source", [
  "coingecko",
  "binance",
  "kraken",
  "manual",
]);

export const coins = pgTable("coins", {
  id: uuid("id").defaultRandom().primaryKey(),
  coingeckoId: varchar("coingecko_id", { length: 255 }).notNull().unique(),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rank: integer("rank").notNull().default(0),
  currentPrice: numeric("current_price").notNull().default("0"),
  priceChange24h: numeric("price_change_24h").notNull().default("0"),
  priceChange7d: numeric("price_change_7d").notNull().default("0"),
  platforms: jsonb("platforms").$type<Record<string, string>>().default({}),
  metadata: jsonb("metadata")
    .$type<{
      image?: string;
      marketCap?: number;
      rank?: number;
      tags?: string[];
      isDelisted?: boolean;
      lastChecked?: string;
    }>()
    .default({}),
  twitterHandle: text(),
  lastChecked: timestamp("last_checked")
    .notNull()
    .default(sql`now()`),
  lastUpdated: timestamp("last_updated")
    .notNull()
    .default(sql`now()`),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

export const coinPriceHistory = pgTable("coin_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  coinId: uuid("coin_id")
    .notNull()
    .references(() => coins.id, { onDelete: "cascade" }),
  price: numeric("price").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  source: coinPriceHistoryEnum("source").notNull().default("coingecko"),
  metadata: jsonb("metadata")
    .$type<{
      volume?: number;
      marketCap?: number;
      additionalData?: Record<string, unknown>;
    }>()
    .default({}),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

export type Coin = typeof coins.$inferSelect;
export type NewCoin = typeof coins.$inferInsert;
export type CoinPriceHistory = typeof coinPriceHistory.$inferSelect;
export type NewCoinPriceHistory = typeof coinPriceHistory.$inferInsert;

// Export types
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type SocialRelation = typeof socialRelations.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Event = typeof events.$inferSelect;
export type QuantumState = typeof quantumStates.$inferSelect;
export type NewQuantumState = typeof quantumStates.$inferInsert;
