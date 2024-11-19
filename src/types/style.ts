export const platformEnum = {
  enumValues: ["twitter", "discord", "telegram", "slack"] as const,
};

export const responseTypeEnum = {
  enumValues: [
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
    // Generic
    "generic_chat",
  ] as const,
};

// Single source of truth matching the database schema
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
}

export interface PlatformStyles {
  enabled: boolean;
  defaultTone: string[];
  defaultGuidelines: string[];
  styles: {
    [key: string]: StyleSettings;
  };
}

export interface ResponseStyles {
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
        [key: string]: StyleSettings;
      };
    };
  };
}

// Helper function to validate/normalize response styles
export function validateResponseStyles(styles: ResponseStyles): ResponseStyles {
  const validatedStyles: ResponseStyles = {
    default: {
      tone: styles.default?.tone ?? [],
      personality: styles.default?.personality ?? [],
      guidelines: styles.default?.guidelines ?? [],
    },
    platforms: {},
  };

  // Validate each platform
  Object.entries(styles.platforms || {}).forEach(
    ([platform, platformStyle]) => {
      validatedStyles.platforms[platform] = {
        enabled: platformStyle.enabled ?? true,
        defaultTone: platformStyle.defaultTone ?? [],
        defaultGuidelines: platformStyle.defaultGuidelines ?? [],
        styles: platformStyle.styles ?? {},
      };

      // Validate each style within the platform
      Object.entries(platformStyle.styles || {}).forEach(([type, style]) => {
        validatedStyles.platforms[platform].styles[
          type as keyof StyleSettings
        ] = {
          enabled: style.enabled ?? true,
          tone: style.tone ?? [],
          formatting: {
            maxLength: style.formatting?.maxLength,
            allowEmojis: style.formatting?.allowEmojis,
            allowMarkdown: style.formatting?.allowMarkdown,
            allowLinks: style.formatting?.allowLinks,
            allowMentions: style.formatting?.allowMentions,
            customRules: style.formatting?.customRules,
          },
          contextRules: style.contextRules ?? [],
          examples: style.examples ?? [],
          guidelines: style.guidelines ?? [],
        };
      });
    }
  );

  return validatedStyles;
}
