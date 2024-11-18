import { CharacterManager } from "@/core/managers/character";
import * as schema from "@/db/schema";
import {
  platformEnum,
  responseTypeEnum,
  type PlatformStyles,
  type ResponseStyles,
  type StyleSettings,
} from "@/types";

export class StyleManager {
  constructor(private characterManager: CharacterManager) {}

  async updatePlatformStyles(
    characterId: string,
    platform: (typeof platformEnum.enumValues)[number],
    styles: PlatformStyles
  ) {
    const character = await this.characterManager.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    const responseStyles = character.responseStyles || {
      default: { tone: [], personality: [], guidelines: [] },
      platforms: {},
    };

    responseStyles.platforms[platform] = styles;

    return this.characterManager.updateCharacter(characterId, {
      responseStyles,
    });
  }

  getPlatformFromResponseType(
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): (typeof platformEnum.enumValues)[number] {
    if (responseType.startsWith("tweet_")) return "twitter";
    if (responseType.startsWith("discord_")) return "discord";
    if (responseType.startsWith("telegram_")) return "telegram";
    if (responseType.startsWith("slack_")) return "slack";
    return "telegram"; // Default to telegram if no match
  }

  getStyleSettings(
    responseStyles: ResponseStyles,
    platform: (typeof platformEnum.enumValues)[number],
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): StyleSettings {
    // Use default styles if platform styles aren't set
    const defaultStyles: StyleSettings = {
      enabled: true,
      tone: responseStyles.default.tone || [],
      guidelines: responseStyles.default.guidelines || [],
      formatting: {},
      examples: [],
      contextRules: [],
    };

    // If no platform styles exist, return default
    if (!responseStyles.platforms[platform]) {
      return defaultStyles;
    }

    const platformStyles = responseStyles.platforms[platform];

    // If platform exists but no specific type styles, return platform defaults
    if (!platformStyles.styles?.[responseType]) {
      return {
        ...defaultStyles,
        tone: [...defaultStyles.tone, ...(platformStyles.defaultTone || [])],
        guidelines: [
          ...defaultStyles.guidelines,
          ...(platformStyles.defaultGuidelines || []),
        ],
      };
    }

    // Merge type-specific styles with defaults
    const typeStyles = platformStyles.styles[responseType];
    return {
      enabled: true,
      tone: [...defaultStyles.tone, ...(typeStyles.tone || [])],
      guidelines: [
        ...defaultStyles.guidelines,
        ...(typeStyles.guidelines || []),
      ],
      formatting: { ...defaultStyles.formatting, ...typeStyles.formatting },
      examples: typeStyles.examples || [],
      contextRules: typeStyles.contextRules || [],
    };
  }

  async buildStyleContext(
    character: schema.Character,
    styleSettings: StyleSettings,
    userContext: Record<string, any>
  ) {
    return {
      name: character.name,
      personality: character.personalityTraits.join("\n"),
      tone: styleSettings.tone.join("\n"),
      guidelines: [
        ...(character.responseStyles?.default?.guidelines || []),
        ...styleSettings.guidelines,
      ].join("\n"),
      formatting: styleSettings.formatting,
      ...userContext,
    };
  }
}
