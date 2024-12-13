import { CharacterManager } from "@/core/managers/character";
import { LLMManager, type LLMConfig } from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { log } from "@/core/utils/logger";
import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import type {
  CharacterUpdate,
  CreateCharacterInput,
  Platform,
  ResponseStyles,
} from "@/types";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventEmitter } from "events";
import postgres from "postgres";

export interface AICoreConfig {
  databaseUrl: string;
  llmConfig: LLMConfig;
  characterConfig: CreateCharacterInput;
  refreshCharacterOnRestart?: boolean;
}

export class AICore extends EventEmitter {
  // Core managers
  private readonly characterManager: CharacterManager;
  private readonly memoryManager: MemoryManager;
  private readonly styleManager: StyleManager;
  private readonly llmManager: LLMManager;

  // Database
  private readonly db: PostgresJsDatabase<typeof dbSchemas>;
  private readonly queryClient: postgres.Sql;

  // State
  public character!: Character;
  private isInitialized: boolean = false;
  private isShuttingDown: boolean = false;

  constructor(private readonly config: AICoreConfig) {
    super();

    // Initialize database first
    this.queryClient = postgres(this.config.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.queryClient, { schema: dbSchemas });

    // Initialize managers
    this.characterManager = new CharacterManager(this.db);
    this.llmManager = new LLMManager(
      this.config.llmConfig,
      this.characterManager
    );
    this.styleManager = new StyleManager(this.characterManager);
    this.memoryManager = new MemoryManager(this.db, this.llmManager);
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize character
      await this.initializeCharacter(
        this.config.characterConfig,
        this.config.refreshCharacterOnRestart
      );

      this.setupSignalHandlers();
      this.isInitialized = true;
      this.emit("initialized");
      log.info(`AICore initialized successfully`);
    } catch (error) {
      log.error("Failed to initialize AICore:", error);
      throw error;
    }
  }

  public getCharacter(): Character {
    if (!this.character) {
      throw new Error("Character not initialized");
    }
    return this.character;
  }

  private async initializeCharacter(
    characterConfig: CreateCharacterInput,
    refresh?: boolean
  ): Promise<void> {
    try {
      const existingCharacter = await this.characterManager.findCharacterByName(
        characterConfig.name
      );

      if (existingCharacter) {
        if (refresh) {
          log.info("Refreshing character configuration...");
          this.character = await this.characterManager.updateCharacter(
            existingCharacter.id,
            {
              bio: characterConfig.bio,
              personalityTraits: characterConfig.personalityTraits,
              beliefSystem: characterConfig.beliefSystem,
              responseStyles: characterConfig.responseStyles,
              quantumPersonality: characterConfig.quantumPersonality,
              updatedAt: new Date(),
              identity: characterConfig.identity,
              prompts: characterConfig.prompts,
            }
          );
        } else {
          log.info("Using existing character without refresh");
          this.character = existingCharacter;
        }
      } else {
        log.info("Creating new character...");
        this.character = await this.characterManager.createCharacter(
          characterConfig
        );
      }

      if (!this.character?.id) {
        throw new Error("Character initialization failed - ID is missing");
      }

      log.info(`Character initialized: ${this.character.id}`);
    } catch (error) {
      log.error("Error in initializeCharacter:", error);
      throw error;
    }
  }

  private setupSignalHandlers() {
    process.on("SIGINT", async () => {
      await this.handleShutdown("SIGINT");
    });

    process.on("SIGTERM", async () => {
      await this.handleShutdown("SIGTERM");
    });

    process.on("uncaughtException", async (error) => {
      console.error("Uncaught Exception:", error);
      await this.handleShutdown("uncaughtException");
    });

    process.on("unhandledRejection", async (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      await this.handleShutdown("unhandledRejection");
    });
  }

  private async handleShutdown(signal: string) {
    if (this.isShuttingDown) {
      log.info("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    log.info(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      await this.stop();
      log.info("Graceful shutdown completed.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    log.info("Stopping AICore...");

    const shutdownTasks: Promise<void>[] = [];

    // Add core shutdown tasks
    if (this.queryClient) {
      shutdownTasks.push(this.queryClient.end());
    }

    try {
      await Promise.allSettled(shutdownTasks);
      this.emit("stopped");
    } catch (error) {
      console.error("Error during AICore shutdown:", error);
      throw error;
    }
  }

  public async createCharacter(
    input: CreateCharacterInput
  ): Promise<Character> {
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

  public async updateCharacter(
    id: string,
    update: CharacterUpdate
  ): Promise<Character> {
    return this.characterManager.updateCharacter(id, update);
  }

  public async updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: {
      enabled: boolean;
      defaultTone: string[];
      defaultGuidelines: string[];
      styles: {
        [key: string]: any;
      };
    }
  ) {
    return this.styleManager.updatePlatformStyles(
      characterId,
      platform,
      styles
    );
  }

  /* public async interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ) {
    if (!this.isInitialized) {
      throw new Error("AICore must be initialized before interaction");
    }
    // This will be handled by the InteractionManager in future
    return this.llmManager.processInteraction(input, options);
  } */

  // Utility methods
  public log(message: string, data?: any) {
    log.userLog(message, data);
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}
