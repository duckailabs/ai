import { CharacterManager } from "@/core/managers/character";
import type { Character } from "@/db/schema/schema";
import type {
  CustomResponseType,
  Platform,
  PlatformStyles,
  PlatformStylesInput,
  ResponseStyles,
  ResponseType,
  StyleSettings,
} from "@/types";
import { QuantumPersonalityMapper } from "./quantum-personality";

export class StyleManager {
  constructor(
    private characterManager: CharacterManager,
    private quantumPersonalityMapper?: QuantumPersonalityMapper
  ) {}

  async updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: PlatformStylesInput
  ) {
    const character = await this.characterManager.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    const responseStyles = character.responseStyles || {
      default: { tone: [], personality: [], guidelines: [] },
      platforms: {},
    };

    responseStyles.platforms[platform] = styles as PlatformStyles;

    return this.characterManager.updateCharacter(characterId, {
      responseStyles,
      updatedAt: new Date(),
    });
  }

  async getPlatformFromResponseType(
    characterId: string,
    responseType: ResponseType
  ): Promise<Platform> {
    const character = await this.characterManager.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    // Handle custom types
    if (responseType.startsWith("custom_")) {
      // Type guard to ensure responseType is a custom type key
      const customTypeKey =
        responseType as keyof typeof character.responseStyles.customTypes;
      const customType = character.responseStyles?.customTypes?.[customTypeKey];
      if (customType) {
        return customType.platform;
      }
    }

    // Handle standard types
    if (responseType.startsWith("tweet_")) return "twitter";
    if (responseType.startsWith("discord_")) return "discord";
    if (responseType.startsWith("telegram_")) return "telegram";
    if (responseType.startsWith("slack_")) return "slack";
    return "telegram"; // default fallback
  }

  async getStyleSettings(
    responseStyles: ResponseStyles,
    platform: Platform,
    responseType: ResponseType
  ): Promise<StyleSettings> {
    const defaultStyles: StyleSettings = {
      enabled: true,
      tone: responseStyles.default.tone,
      guidelines: responseStyles.default.guidelines,
      formatting: {},
    };

    // Get quantum personality modifiers
    const personalitySettings =
      await this.quantumPersonalityMapper?.mapQuantumToPersonality();

    // Merge quantum style modifiers
    defaultStyles.tone = [
      ...defaultStyles.tone,
      ...(personalitySettings?.styleModifiers.tone || []),
    ];
    defaultStyles.guidelines = [
      ...defaultStyles.guidelines,
      ...(personalitySettings?.styleModifiers.guidelines || []),
    ];

    const platformStyles = responseStyles.platforms[platform];
    if (!platformStyles) return defaultStyles;

    // Handle custom types
    if (responseType.startsWith("custom_")) {
      const customType =
        responseStyles.customTypes?.[responseType as CustomResponseType];
      if (customType && customType.platform !== platform) {
        throw new Error(
          `Custom type ${responseType} is registered for platform ${customType.platform}, not ${platform}`
        );
      }
    }

    // Merge platform defaults
    const withPlatformDefaults: StyleSettings = {
      ...defaultStyles,
      tone: [...defaultStyles.tone, ...platformStyles.defaultTone],
      guidelines: [
        ...defaultStyles.guidelines,
        ...platformStyles.defaultGuidelines,
      ],
    };

    const typeStyles = platformStyles.styles[responseType];
    if (!typeStyles) return withPlatformDefaults;

    return {
      enabled: typeStyles.enabled ?? true,
      tone: [...withPlatformDefaults.tone, ...typeStyles.tone],
      guidelines: [
        ...withPlatformDefaults.guidelines,
        ...typeStyles.guidelines,
      ],
      formatting: {
        ...withPlatformDefaults.formatting,
        ...typeStyles.formatting,
      },
      rules: [...(typeStyles.formatting?.customRules || [])],
    };
  }

  async buildStyleContext(
    character: Character,
    styleSettings: StyleSettings,
    userContext: Record<string, any>
  ) {
    return {
      name: character.name,
      personality: character.personalityTraits.join("\n"),
      tone: styleSettings.tone.join("\n"),
      guidelines: styleSettings.guidelines.join("\n"),
      formatting: styleSettings.formatting,
      ...userContext,
    };
  }

  async registerCustomResponseType(
    characterId: string,
    customType: CustomResponseType,
    config: {
      platform: Platform;
      description?: string;
      settings: StyleSettings;
    }
  ) {
    const character = await this.characterManager.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    const responseStyles = character.responseStyles || {
      default: { tone: [], personality: [], guidelines: [] },
      platforms: {},
      customTypes: {},
    };

    // Register the custom type
    responseStyles.customTypes = responseStyles.customTypes || {};
    responseStyles.customTypes[customType] = {
      platform: config.platform,
      description: config.description,
    };

    // Add the style settings to the appropriate platform
    if (!responseStyles.platforms[config.platform]) {
      responseStyles.platforms[config.platform] = {
        enabled: true,
        defaultTone: [],
        defaultGuidelines: [],
        styles: {},
      };
    }

    responseStyles.platforms[config.platform]!.styles[customType] =
      config.settings;

    return this.characterManager.updateCharacter(characterId, {
      responseStyles,
    });
  }
}
