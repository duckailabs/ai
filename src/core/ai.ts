import { CharacterManager } from "@/core/managers/character";
import { LLMManager, type AIConfig } from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { CharacterBuilder } from "@/create-character/builder";
import { type ChatMessage, type Tweet } from "@/create-character/types";
import * as schema from "@/db";
import {
  type CharacterUpdate,
  type CreateCharacterInput,
  type Platform,
  type ResponseStyles,
  type StyleSettings,
} from "@/types";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ToolManager } from "./managers/tools";
import { EventService } from "./services/Event";
import { InteractionService } from "./services/Interaction";
import type {
  InteractionMode,
  InteractionOptions,
  InteractionResult,
} from "./types";

export interface AIOptions {
  databaseUrl: string;
  llmConfig: AIConfig;
  toolsDir?: string | "./ai/tools/";
}

export class ai {
  private characterManager: CharacterManager;
  private memoryManager: MemoryManager;
  private styleManager: StyleManager;
  private llmManager: LLMManager;
  private characterBuilder: CharacterBuilder;
  public db: PostgresJsDatabase<typeof schema>;
  private interactionService: InteractionService;
  private eventService: EventService;
  private toolManager: ToolManager;

  constructor(options: AIOptions) {
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
    this.eventService = new EventService(this.db);
    this.toolManager = new ToolManager({ toolsDir: options.toolsDir });
    this.interactionService = new InteractionService(
      this.db,
      this.characterManager,
      this.styleManager,
      this.llmManager,
      this.memoryManager,
      this.eventService,
      this.toolManager
    );
  }

  async getCharacter(id: string) {
    return this.characterManager.getCharacter(id);
  }

  async createCharacter(
    input: CreateCharacterInput & { responseStyles?: ResponseStyles }
  ) {
    const defaultResponseStyles: ResponseStyles = {
      default: {
        tone: [],
        personality: [],
        guidelines: [],
      },
      platforms: {},
    };

    return this.characterManager.createCharacter({
      ...input,
      responseStyles: input.responseStyles || defaultResponseStyles,
    });
  }

  async updateCharacter(id: string, update: CharacterUpdate) {
    return this.characterManager.updateCharacter(id, update);
  }

  async updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: {
      enabled: boolean;
      defaultTone: string[];
      defaultGuidelines: string[];
      styles: {
        [key: string]: StyleSettings;
      };
    }
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
      return this.characterManager.createCharacter({
        ...profile,
        responseStyles: {
          default: {
            tone: [],
            personality: [],
            guidelines: [],
          },
          platforms: {},
        },
      });
    } catch (error) {
      console.error("Error in character creation:", error);
      throw error;
    }
  }

  async interact(
    input: string | { system: string; user: string },
    options: Omit<InteractionOptions, "characterId"> & {
      characterId?: string;
      mode?: InteractionMode;
      tools?: string[];
      toolContext?: Record<string, any>;
      injections?: {
        injectPersonality?: boolean;
        injectStyle?: boolean;
        customInjections?: Array<{
          name: string;
          content: string;
          position: "before" | "after" | "replace";
        }>;
      };
    } = {}
  ): Promise<InteractionResult> {
    try {
      // Handle character selection
      let characterId = options.characterId;
      if (!characterId && options.mode !== "raw") {
        const [firstCharacter] = await this.db
          .select()
          .from(schema.characters)
          .limit(1);

        if (!firstCharacter) {
          throw new Error("No characters available in the system");
        }
        characterId = firstCharacter.id;
      }

      // Only include characterId in options if it exists
      const interactionOptions = {
        ...options,
        mode: options.mode || (characterId ? "enhanced" : "raw"),
      };

      if (characterId) {
        interactionOptions.characterId = characterId;
      }

      // Load any specified tools
      if (options.tools?.length) {
        await Promise.all(
          options.tools.map((tool) => this.toolManager.loadTool(tool))
        );
      }

      return this.interactionService.handleInteraction(
        input,
        interactionOptions
      );
    } catch (error) {
      console.error("Error in interaction:", error);
      console.error("Error message:", (error as Error).message);

      throw error;
    }
  }
}
