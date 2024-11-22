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

// Goals Table
export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  progress: numeric("progress").notNull().default("0"),
  metadata: jsonb("metadata")
    .$type<{
      dependencies?: string[];
      completionCriteria?: string[];
      notes?: string[];
    }>()
    .default({}),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at")
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

// Export types
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type SocialRelation = typeof socialRelations.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Goal = typeof goals.$inferSelect;
