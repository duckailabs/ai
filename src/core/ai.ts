import { CharacterManager } from "@/core/managers/character";
import { LLMManager, type AIConfig } from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { CharacterBuilder } from "@/create-character/builder";
import { type ChatMessage, type Tweet } from "@/create-character/types";
import * as schema from "@/db";
import {
  responseTypeEnum,
  type CharacterUpdate,
  type CreateCharacterInput,
  type PlatformStyles,
  type ResponseStyles,
  type StyleSettings,
} from "@/types";
import { drizzle } from "drizzle-orm/postgres-js";
import { EventEmitter } from "events";
import postgres from "postgres";

export interface AIOptions {
  databaseUrl: string;
  llmConfig: AIConfig;
}

export class ai extends EventEmitter {
  private characterManager: CharacterManager;
  private memoryManager: MemoryManager;
  private styleManager: StyleManager;
  private llmManager: LLMManager;
  private characterBuilder: CharacterBuilder;
  private db;

  constructor(options: AIOptions) {
    super();

    const queryClient = postgres(options.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(queryClient, { schema });

    this.llmManager = new LLMManager(options.llmConfig);
    this.characterManager = new CharacterManager(this.db);
    this.characterBuilder = new CharacterBuilder(this.llmManager);
    this.memoryManager = new MemoryManager(this.db, this.llmManager);
    this.styleManager = new StyleManager(this.characterManager);
  }

  // Expose necessary methods from managers
  async getCharacter(id: string) {
    return this.characterManager.getCharacter(id);
  }

  async createCharacter(
    input: CreateCharacterInput & { responseStyles: ResponseStyles }
  ) {
    return this.characterManager.createCharacter(input);
  }

  async updateCharacter(id: string, update: CharacterUpdate) {
    return this.characterManager.updateCharacter(id, update);
  }

  async updatePlatformStyles(
    characterId: string,
    platform: (typeof schema.platformEnum.enumValues)[number],
    styles: PlatformStyles
  ) {
    return this.styleManager.updatePlatformStyles(
      characterId,
      platform,
      styles
    );
  }

  async createCharacterFromData(input: {
    data: ChatMessage[] | Tweet[];
    type: "chat" | "tweet";
    options?: {
      minConfidence?: number;
      mergingStrategy?: "weighted" | "latest" | "highest_confidence";
    };
  }) {
    try {
      const profile = await this.characterBuilder.analyzeData(input);
      return this.characterManager.createCharacter(profile);
    } catch (error) {
      console.error("Error in character creation:", error);
      throw error;
    }
  }

  // Main interaction method
  async interact(
    characterId: string,
    userInput: string,
    responseType: (typeof responseTypeEnum.enumValues)[number],
    context?: Record<string, any>,
    options?: Record<string, any>
  ) {
    try {
      const character = await this.characterManager.getCharacter(characterId);
      if (!character) throw new Error("Character not found");

      const platform =
        this.styleManager.getPlatformFromResponseType(responseType);
      const styleSettings = this.styleManager.getStyleSettings(
        character.responseStyles,
        platform,
        responseType
      );

      // Include user input in context
      const fullContext = {
        ...context,
        userInput,
        name: character.name,
        personality: character.personalityTraits.join(", "),
        tone: styleSettings.tone?.join(", ") || "",
        guidelines: styleSettings.guidelines?.join(", ") || "",
      };

      // Build XML-formatted template
      const template = this.buildResponseTemplate(
        userInput,
        character,
        styleSettings,
        responseType
      );

      const messages = await this.llmManager.preparePrompt(
        template,
        fullContext
      );

      const response = await this.llmManager.generateResponse(
        messages,
        options
      );

      await this.memoryManager.addMemory(characterId, response.content, {
        type: "interaction",
        metadata: {
          responseType,
          context: fullContext,
          llmMetadata: response.metadata,
          userInput,
        },
      });

      return {
        content: response.content,
        metadata: {
          characterId,
          responseType,
          platform,
          styleSettings,
          contextUsed: fullContext,
          llmMetadata: response.metadata,
          template, // Include template for debugging
        },
      };
    } catch (error) {
      console.error("Error in interaction:", error);
      throw error;
    }
  }

  private buildResponseTemplate(
    userInput: string,
    character: schema.Character,
    styleSettings: StyleSettings,
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): string {
    // Build the system instructions block
    let systemBlock = `<system>You are ${
      character.name
    }, and you must stay in character at all times.

Character Traits:
${character.personalityTraits.map((trait) => `- ${trait}`).join("\n")}

${
  styleSettings.tone?.length
    ? `Tone:
${styleSettings.tone.map((t) => `- ${t}`).join("\n")}`
    : ""
}

${
  styleSettings.guidelines?.length
    ? `Guidelines:
${styleSettings.guidelines.map((g) => `- ${g}`).join("\n")}`
    : ""
}

${
  styleSettings.examples?.length
    ? `Example Responses:
${styleSettings.examples.map((ex) => `- ${ex}`).join("\n")}`
    : ""
}

${
  Object.keys(styleSettings.formatting || {}).length
    ? `Formatting Rules:
${Object.entries(styleSettings.formatting || {})
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}`
    : ""
}

Always maintain character consistency and respond naturally while following the above guidelines.</system>`;

    // Add the user's message
    let userBlock = `<user>${userInput}</user>`;

    // Combine the blocks
    return `${systemBlock}\n\n${userBlock}`;
  }
}
