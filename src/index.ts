import { PromptBuilder } from "@fatduckai/prompt-utils";
import { sql } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventEmitter } from "events";
import * as schema from "./db/schema";
import {
  OpenAIImportanceAnalyzer,
  type IImportanceAnalyzer,
} from "./Interfaces/IImportanceAnalyzer";
import {
  platformEnum,
  responseTypeEnum,
  type CharacterUpdate,
  type PlatformStyles,
  type ResponseStyles,
  type StyleSettings,
} from "./types";

interface PromptConfig {
  // What character context to inject into system prompt
  systemInjects?: {
    before?: boolean; // inject before user's system content
    after?: boolean; // inject after user's system content
    // What character fields to include
    includes?: Array<
      "personality" | "goals" | "recentPosts" | "examples" | "guidelines"
    >;
  };
  // Additional template variables
  variables?: Record<string, any>;
}

export interface CreateCharacterInput {
  name: string;
  bio: string;
  personalityTraits: string[];
  responseStyles: ResponseStyles;
  styles: {
    [key in (typeof schema.conversationStyleEnum.enumValues)[number]]: {
      rules: string[];
      examples: string[];
    };
  };
  shouldRespond: {
    rules: string[];
    examples: string[];
  };
  hobbies?: Array<{
    name: string;
    proficiency: number;
    relatedTopics: string[];
    metadata?: Record<string, unknown>;
  }>;
  beliefSystem?: string[];
  preferences: {
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
  };
}

export class AI extends EventEmitter {
  private db: PostgresJsDatabase<typeof schema>;
  private analyzer: IImportanceAnalyzer;

  constructor(
    db: PostgresJsDatabase<typeof schema>,
    analyzer?: IImportanceAnalyzer
  ) {
    super();
    this.db = db;
    this.analyzer =
      analyzer || new OpenAIImportanceAnalyzer(process.env.OPENAI_API_KEY!);
  }

  async getCharacter(id: string) {
    const [character] = await this.db
      .select()
      .from(schema.characters)
      .where(sql`id = ${id}`);

    return character;
  }

  private async initializeCharacter(tx: any, characterId: string) {
    // Create initial memories
    await tx.insert(schema.memories).values({
      characterId,
      type: "learning",
      content: "Character initialization",
      importance: 1.0,
      metadata: {
        type: "creation",
        timestamp: new Date().toISOString(),
      },
    });

    // Create initial events
    await tx.insert(schema.events).values({
      characterId,
      type: "character:created",
      payload: {
        timestamp: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: "system",
      },
      processed: true,
    });

    // Create initial goals based on hobbies
    const character = await this.getCharacter(characterId);
    if (character?.hobbies?.length) {
      await tx.insert(schema.goals).values(
        character.hobbies.map((hobby) => ({
          characterId,
          description: `Develop expertise in ${hobby.name}`,
          status: "active",
          progress: 0,
          metadata: {
            hobby: hobby.name,
            currentProficiency: hobby.proficiency,
            targetProficiency: Math.min(hobby.proficiency + 2, 10),
            notes: [`Started with proficiency level ${hobby.proficiency}`],
          },
        }))
      );
    }
  }

  async createCharacter(
    input: CreateCharacterInput & { responseStyles: ResponseStyles }
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        // Create character with response styles
        const [character] = await tx
          .insert(schema.characters)
          .values({
            ...input,
            responseStyles: this.validateResponseStyles(input.responseStyles),
          })
          .returning();

        // Initialize other character data
        await this.initializeCharacter(tx, character.id);

        return character;
      });
    } catch (error) {
      console.error("Error creating character:", error);
      throw error;
    }
  }

  async updateCharacter(id: string, update: CharacterUpdate) {
    try {
      // If updating response styles, validate them
      if (update.responseStyles) {
        update.responseStyles = this.validateResponseStyles(
          update.responseStyles
        );
      }

      const [updated] = await this.db
        .update(schema.characters)
        .set({
          ...update,
          updatedAt: new Date(),
        })
        .where(sql`id = ${id}`)
        .returning();

      return updated;
    } catch (error) {
      console.error("Error updating character:", error);
      throw error;
    }
  }

  async updatePlatformStyles(
    characterId: string,
    platform: (typeof platformEnum.enumValues)[number],
    styles: PlatformStyles
  ) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    const responseStyles = character.responseStyles || {
      default: { tone: [], personality: [], guidelines: [] },
      platforms: {},
    };

    responseStyles.platforms[platform] = styles;

    return this.updateCharacter(characterId, { responseStyles });
  }

  async preparePrompt(
    characterId: string,
    template: string,
    responseType: (typeof responseTypeEnum.enumValues)[number],
    context: Record<string, any> = {}
  ) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error("Character not found");

    // Get platform from response type
    const platform = this.getPlatformFromResponseType(responseType);

    // Get style settings
    const styleSettings = this.getStyleSettings(
      character.responseStyles,
      platform,
      responseType
    );

    // Build context with style-specific rules
    const styleContext = await this.buildStyleContext(
      character,
      styleSettings,
      context
    );

    // Create final prompt
    const builder = new PromptBuilder(template).withContext(styleContext);

    return {
      messages: builder.build(),
      metadata: {
        characterId,
        responseType,
        platform,
        styleSettings,
        contextUsed: styleContext,
      },
    };
  }

  private validateResponseStyles(styles: ResponseStyles): ResponseStyles {
    // Ensure default settings exist
    if (!styles.default) {
      throw new Error("Default response styles are required");
    }

    // Validate each platform's styles
    Object.entries(styles.platforms || {}).forEach(
      ([platform, platformStyle]) => {
        if (!platformEnum.enumValues.includes(platform as any)) {
          throw new Error(`Invalid platform: ${platform}`);
        }

        // Validate response types for platform
        Object.entries(platformStyle.styles || {}).forEach(
          ([type, settings]) => {
            if (!responseTypeEnum.enumValues.includes(type as any)) {
              throw new Error(
                `Invalid response type: ${type} for platform ${platform}`
              );
            }

            this.validateStyleSettings(settings);
          }
        );
      }
    );

    return styles;
  }

  private validateStyleSettings(settings: StyleSettings) {
    // Add your validation rules here
    if (settings.formatting?.maxLength && settings.formatting?.minLength) {
      if (settings.formatting.maxLength < settings.formatting.minLength) {
        throw new Error("maxLength cannot be less than minLength");
      }
    }
    // Add more validation as needed
  }

  private getPlatformFromResponseType(
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): (typeof platformEnum.enumValues)[number] {
    if (responseType.startsWith("tweet_")) return "twitter";
    if (responseType.startsWith("discord_")) return "discord";
    if (responseType.startsWith("telegram_")) return "telegram";
    if (responseType.startsWith("slack_")) return "slack";
    throw new Error(`Unknown platform for response type: ${responseType}`);
  }

  private getStyleSettings(
    responseStyles: ResponseStyles,
    platform: (typeof platformEnum.enumValues)[number],
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): StyleSettings {
    const platformStyles = responseStyles.platforms[platform];
    if (!platformStyles?.enabled) {
      throw new Error(`Platform ${platform} is not enabled for this character`);
    }

    const typeStyles = platformStyles.styles[responseType];
    if (!typeStyles?.enabled) {
      throw new Error(
        `Response type ${responseType} is not enabled for this character`
      );
    }

    return typeStyles;
  }

  private async buildStyleContext(
    character: schema.Character,
    styleSettings: StyleSettings,
    userContext: Record<string, any>
  ) {
    return {
      // Base character context
      name: character.name,
      personality: character.personalityTraits.join("\n"),

      // Style-specific context
      tone: styleSettings.tone.join("\n"),
      guidelines: [
        ...character.responseStyles.default.guidelines,
        ...styleSettings.guidelines,
      ].join("\n"),
      formatting: styleSettings.formatting,

      // User provided context
      ...userContext,
    };
  }

  async addMemory(
    characterId: string,
    content: string,
    options: {
      importance?: number;
      context?: Record<string, any>;
      type?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    try {
      // If importance not provided, analyze it
      const importance =
        options.importance ??
        (await this.analyzer.analyzeImportance(content, options.context));

      // Only store if important enough
      if (importance > 0.2) {
        const [memory] = await this.db
          .insert(schema.memories)
          .values({
            characterId,
            type: (options.type || "interaction") as
              | "interaction"
              | "learning"
              | "achievement"
              | "hobby",
            content,
            importance: importance.toString(),
            metadata: {
              userId: options.metadata?.userId,
              sentiment: options.metadata?.sentiment,
              topic: options.metadata?.topic,
              hobby: options.metadata?.hobby,
              relatedMemories: options.metadata?.relatedMemories,
            },
          })
          .returning();

        return memory;
      }

      return null;
    } catch (error) {
      console.error("Error adding memory:", error);
      throw error;
    }
  }

  async addMemoryBatch(
    characterId: string,
    memories: Array<{
      content: string;
      importance?: number;
      context?: Record<string, any>;
      type?: string;
      metadata?: Record<string, any>;
    }>
  ) {
    const results = await Promise.all(
      memories.map((memory) =>
        this.addMemory(characterId, memory.content, {
          importance: memory.importance,
          context: memory.context,
          type: memory.type,
          metadata: memory.metadata,
        })
      )
    );

    return results.filter(Boolean); // Remove null results
  }
}

// Example usage:
const exampleStyles: ResponseStyles = {
  default: {
    tone: ["friendly", "professional"],
    personality: ["helpful", "knowledgeable"],
    guidelines: ["Be concise", "Stay on topic"],
  },
  platforms: {
    twitter: {
      enabled: true,
      defaultTone: ["casual", "engaging"],
      defaultGuidelines: ["Use hashtags sparingly"],
      styles: {
        tweet_create: {
          enabled: true,
          tone: ["authoritative", "thought-leading"],
          formatting: {
            maxLength: 280,
            allowEmojis: true,
            allowLinks: true,
          },
          contextRules: ["Consider current trends"],
          examples: ["Example tweet format"],
          guidelines: ["Start strong", "End with hooks"],
        },
        // ... other Twitter styles
      },
    },
    // ... other platforms
  },
};

/* const ai = new ai(db);

const character = await ai.createCharacter({
  name: "AI Assistant",
  bio: "A helpful AI assistant",
  personalityTraits: ["friendly", "helpful"],
  responseStyles: defaultResponseStyles,
  styles: {
    chat: { rules: ["Be conversational"], examples: ["Hello!"] },
    professional: { rules: ["Be formal"], examples: ["Good morning."] },
    // ... other styles
  },
  shouldRespond: {
    rules: ["Respond when directly addressed"],
    examples: ["User: Hello -> Assistant: Hi!"]
  },
  preferences: {
    preferredTopics: ["technology"],
    dislikedTopics: [],
    preferredTimes: [],
    dislikedTimes: [],
    preferredDays: [],
    dislikedDays: [],
    preferredHours: [],
    dislikedHours: [],
    generalLikes: ["helping"],
    generalDislikes: []
  }
}); */
