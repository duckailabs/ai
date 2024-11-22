import { CharacterManager } from "@/core/managers/character";
import { LLMManager, type AIConfig } from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { CharacterBuilder } from "@/create-character/builder";
import { type ChatMessage, type Tweet } from "@/create-character/types";
import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import {
  type CharacterUpdate,
  type CreateCharacterInput,
  type Platform,
  type ResponseStyles,
  type StyleSettings,
} from "@/types";
import { eq } from "drizzle-orm";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ConversationManager } from "./managers/conversation";
import { ToolManager } from "./managers/tools";
import { TelegramClient } from "./platform/telegram/telegram";
import { EventService } from "./services/Event";
import { InteractionService } from "./services/Interaction";
import type { InteractionOptions } from "./types";

export interface AIOptions {
  databaseUrl: string;
  llmConfig: AIConfig;
  toolsDir?: string | "./ai/tools/";
  character: CreateCharacterInput;
  refreshCharacterOnRestart?: boolean;
  platforms?: {
    telegram?: {
      enabled: boolean;
      token: string;
    };
  };
}

export class ai {
  private characterManager: CharacterManager;
  private memoryManager: MemoryManager;
  private styleManager: StyleManager;
  private llmManager: LLMManager;
  private characterBuilder: CharacterBuilder;
  public db: PostgresJsDatabase<typeof dbSchemas>;
  private interactionService: InteractionService;
  private eventService: EventService;
  private toolManager: ToolManager;
  private conversationManager: ConversationManager;
  public character!: Character;
  public telegramClient?: TelegramClient;
  private queryClient?: postgres.Sql;

  private isShuttingDown: boolean = false;
  constructor(options: AIOptions) {
    this.queryClient = postgres(options.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.queryClient, { schema: dbSchemas });

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
    this.conversationManager = new ConversationManager(
      this.db,
      this.interactionService,
      this.eventService,
      this.llmManager
    );
  }

  // Static factory method for creating a properly initialized instance
  public static async initialize(options: AIOptions): Promise<ai> {
    const instance = new ai(options);
    await instance.initializeCharacter(
      options.character,
      options.refreshCharacterOnRestart
    );

    if (!instance.character || !instance.character.id) {
      throw new Error(
        "Character initialization failed - character ID is missing"
      );
    }

    // Initialize platforms if configured
    if (options.platforms?.telegram?.enabled) {
      console.log("Initializing Telegram client...");
      const { token } = options.platforms.telegram;
      instance.telegramClient = instance.createTelegramClient(token);
      await instance.telegramClient.start();
      console.log("Telegram client initialized successfully!");
    }

    instance.setupSignalHandlers();

    return instance;
  }

  private setupSignalHandlers() {
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      await this.handleShutdown("SIGINT");
    });

    process.on("SIGTERM", async () => {
      await this.handleShutdown("SIGTERM");
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      console.error("Uncaught Exception:", error);
      await this.handleShutdown("uncaughtException");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", async (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      await this.handleShutdown("unhandledRejection");
    });
  }

  private async handleShutdown(signal: string) {
    if (this.isShuttingDown) {
      console.log("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      await this.stop();
      console.log("Graceful shutdown completed.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  public async stop() {
    console.log("Stopping AI services...");

    const shutdownTasks: Promise<void>[] = [];

    // Stop Telegram client if it exists
    if (this.telegramClient) {
      console.log("Stopping Telegram client...");
      shutdownTasks.push(Promise.resolve(this.telegramClient.stop()));
    }

    // Close database connections
    if (this.queryClient) {
      console.log("Closing database connections...");
      shutdownTasks.push(this.queryClient.end());
    }

    try {
      await Promise.allSettled(shutdownTasks);
    } catch (error) {
      console.error("Error during service shutdown:", error);
      throw error;
    }
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

  private async initializeCharacter(
    characterConfig: CreateCharacterInput,
    refresh?: boolean
  ) {
    try {
      console.log(`Looking for existing character: ${characterConfig.name}...`);

      const existingCharacter = await this.db
        .select()
        .from(dbSchemas.characters)
        .where(eq(dbSchemas.characters.name, characterConfig.name))
        .execute();

      if (existingCharacter && existingCharacter.length > 0) {
        const foundCharacter = existingCharacter[0];

        if (refresh) {
          console.log("Refreshing character configuration...");
          this.character = await this.characterManager.updateCharacter(
            foundCharacter.id,
            {
              bio: characterConfig.bio,
              personalityTraits: characterConfig.personalityTraits,
              beliefSystem: characterConfig.beliefSystem,
              responseStyles: characterConfig.responseStyles,
              updatedAt: new Date(),
              identity: characterConfig.identity,
            }
          );
        } else {
          console.log("Using existing character without refresh");
          this.character = foundCharacter;
        }
      } else {
        console.log("No existing character found, creating new one...");
        this.character = await this.characterManager.createCharacter(
          characterConfig
        );
      }

      if (!this.character || !this.character.id) {
        throw new Error(
          "Character initialization failed - character or ID is missing"
        );
      }

      console.log("Character initialized:", {
        id: this.character.id,
        name: this.character.name,
        updatedAt: this.character.updatedAt,
      });
    } catch (error) {
      console.error("Error in initializeCharacter:", error);
      throw error;
    }
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

  private createTelegramClient(token: string) {
    return new TelegramClient(token, this);
  }

  async interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ) {
    return this.conversationManager.handleMessage(input, options);
  }
}
