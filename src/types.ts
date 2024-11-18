import { pgEnum } from "drizzle-orm/pg-core";

// Platform and Response Type Enums
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

// Type definitions for response styles
export interface StyleSettings {
  enabled: boolean;
  tone: string[];
  formatting: {
    maxLength?: number;
    minLength?: number;
    allowEmojis?: boolean;
    allowMarkdown?: boolean;
    allowLinks?: boolean;
    allowMentions?: boolean;
    customRules?: string[];
  };
  contextRules: string[];
  examples: string[];
  guidelines: string[];
  metrics?: {
    engagementTargets?: {
      likes?: number;
      replies?: number;
      shares?: number;
    };
    responseTime?: number;
  };
}

export interface PlatformStyles {
  enabled: boolean;
  defaultTone: string[];
  defaultGuidelines: string[];
  styles: {
    [K in (typeof responseTypeEnum.enumValues)[number]]?: StyleSettings;
  };
}

export interface ResponseStyles {
  default: {
    tone: string[];
    personality: string[];
    guidelines: string[];
  };
  platforms: {
    [K in (typeof platformEnum.enumValues)[number]]?: PlatformStyles;
  };
}

export interface CharacterUpdate {
  id?: string;
  name?: string;
  bio?: string;
  personalityTraits?: string[];
  responseStyles?: ResponseStyles;
}
