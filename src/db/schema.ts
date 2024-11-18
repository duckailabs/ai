import { sql } from "drizzle-orm";
import {
  boolean,
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

// Update the characters table
export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  bio: text("bio").notNull(),
  personalityTraits: jsonb("personality_traits").$type<string[]>().notNull(),
  generalGuidelines: jsonb("general_guidelines").$type<string[]>().default([]),

  // Add responseStyles
  responseStyles: jsonb("response_styles")
    .$type<{
      default: {
        tone: string[];
        personality: string[];
        guidelines: string[];
      };
      platforms: {
        [key: string]: {
          enabled: boolean;
          defaultTone: string[];
          defaultGuidelines: string[];
          styles: {
            [key: string]: {
              enabled: boolean;
              tone: string[];
              formatting: {
                maxLength?: number;
                allowEmojis?: boolean;
                allowMarkdown?: boolean;
                allowLinks?: boolean;
                allowMentions?: boolean;
                customRules?: string[];
              };
              contextRules: string[];
              examples: string[];
              guidelines: string[];
            };
          };
        };
      };
    }>()
    .notNull(),

  // Your existing fields
  styles: jsonb("styles")
    .$type<{
      [key in (typeof conversationStyleEnum.enumValues)[number]]: {
        rules: string[];
        examples: string[];
      };
    }>()
    .notNull(),

  shouldRespond: jsonb("should_respond")
    .$type<{
      rules: string[];
      examples: string[];
    }>()
    .notNull(),

  hobbies: jsonb("hobbies")
    .$type<
      Array<{
        name: string;
        proficiency: number;
        lastPracticed?: string;
        relatedTopics: string[];
        metadata?: Record<string, unknown>;
      }>
    >()
    .default([]),

  beliefSystem: jsonb("belief_system").$type<string[]>().default([]),

  preferences: jsonb("preferences")
    .$type<{
      preferredTopics: string[];
      dislikedTopics: string[];
      preferredTimes: string[];
      dislikedTimes: string[];
      preferredDays: string[];
      dislikedDays: string[];
      preferredHours: string[];
      dislikedHours: string[];
      generalLikes: string[];
      generalDislikes: string[];
    }>()
    .notNull(),

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
  interactionCount: numeric("interaction_count").notNull().default("0"),
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
  type: varchar("type", { length: 255 }).notNull(),
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

// Export types
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type SocialRelation = typeof socialRelations.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Goal = typeof goals.$inferSelect;
