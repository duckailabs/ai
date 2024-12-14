import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventEmitter } from "events";
import postgres from "postgres";
import { CharacterManager } from "./managers/character";
import { CoinGeckoManager } from "./managers/coingecko";
import { ConversationManager } from "./managers/conversation";
import { LLMManager, type LLMConfig } from "./managers/llm";
import { MemoryManager } from "./managers/memory";
import { QuantumStateManager } from "./managers/quantum";
import { StyleManager } from "./managers/style";
import { ToolManager } from "./managers/tools";
import { EventService } from "./services/Event";
import { InteractionService } from "./services/Interaction";
import { StateUpdateService } from "./services/quantum-state";
import type { CreateCharacterInput, InteractionOptions } from "./types";
import { log } from "./utils/logger";

export interface AICoreConfig {
  databaseUrl: string;
  llmConfig: LLMConfig;
  characterConfig: CreateCharacterInput;
  refreshCharacterOnRestart?: boolean;
  toolsDir?: string;
  coingecko?: {
    enabled: boolean;
    apiKey?: string;
    updateInterval?: string;
  };
  quantum?: {
    enabled: boolean;
    cronSchedule?: string;
    checkInitialState?: boolean;
  };
}

export interface AICoreDependencies {
  characterManager?: CharacterManager;
  llmManager?: LLMManager;
  memoryManager?: MemoryManager;
  styleManager?: StyleManager;
  toolManager?: ToolManager;
  eventService?: EventService;
}

export class AICore extends EventEmitter {
  // Core managers
  public readonly characterManager: CharacterManager;
  public readonly memoryManager: MemoryManager;
  public readonly styleManager: StyleManager;
  public readonly llmManager: LLMManager;
  public readonly toolManager: ToolManager;

  // Services
  public readonly eventService: EventService;
  private interactionService!: InteractionService;
  private conversationManager!: ConversationManager;

  // Optional services
  private coinGeckoManager?: CoinGeckoManager;
  private quantumStateManager?: QuantumStateManager;
  private stateUpdateService?: StateUpdateService;

  // Database
  public readonly db: PostgresJsDatabase<typeof dbSchemas>;
  private readonly queryClient: postgres.Sql;

  // State
  private character?: Character;
  private isInitialized: boolean = false;
  private isShuttingDown: boolean = false;

  constructor(
    private readonly config: AICoreConfig,
    dependencies?: AICoreDependencies
  ) {
    super();

    // Initialize database
    this.queryClient = postgres(this.config.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.queryClient, { schema: dbSchemas });

    // Initialize or use provided core managers
    this.characterManager =
      dependencies?.characterManager || new CharacterManager(this.db);
    this.llmManager =
      dependencies?.llmManager ||
      new LLMManager(this.config.llmConfig, this.characterManager);
    this.styleManager =
      dependencies?.styleManager || new StyleManager(this.characterManager);
    this.memoryManager =
      dependencies?.memoryManager ||
      new MemoryManager(this.db, this.llmManager);
    this.toolManager =
      dependencies?.toolManager ||
      new ToolManager({ toolsDir: config.toolsDir });
    this.eventService =
      dependencies?.eventService ||
      new EventService(this.db, this.characterManager);

    // Initialize optional services based on config
    this.initializeOptionalServices();
  }

  private initializeOptionalServices(): void {
    if (this.config.coingecko?.enabled) {
      this.coinGeckoManager = new CoinGeckoManager(
        this.config.coingecko,
        this.db,
        this.llmManager
      );
    }

    if (this.config.quantum?.enabled) {
      this.quantumStateManager = new QuantumStateManager(this.db);
    }
  }

  private async createInteractionService(): Promise<void> {
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

  private async createConversationManager(): Promise<void> {
    this.conversationManager = new ConversationManager(
      this.db,
      this.interactionService,
      this.eventService,
      this.llmManager
    );
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize character first
      await this.initializeCharacter(
        this.config.characterConfig,
        this.config.refreshCharacterOnRestart
      );

      // Initialize core services
      await this.createInteractionService();
      await this.createConversationManager();

      // Start optional services
      await this.startOptionalServices();

      this.setupSignalHandlers();
      this.isInitialized = true;
      this.emit("initialized");
      log.info("AICore initialized successfully");
    } catch (error) {
      log.error("Failed to initialize AICore:", error);
      throw error;
    }
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
          this.character = existingCharacter;
        }
      } else {
        this.character = await this.characterManager.createCharacter(
          characterConfig
        );
      }
    } catch (error) {
      log.error("Error in initializeCharacter:", error);
      throw error;
    }
  }

  private async startOptionalServices(): Promise<void> {
    const startTasks: Promise<void>[] = [];

    if (this.coinGeckoManager) {
      startTasks.push(this.coinGeckoManager.start());
    }

    if (this.quantumStateManager && this.config.quantum?.enabled) {
      this.stateUpdateService = new StateUpdateService(
        this.quantumStateManager,
        this.eventService,
        {
          enabled: true,
          cronSchedule: this.config.quantum.cronSchedule || "0 * * * *",
          maxRetries: 3,
          initialDelayMs: 1000,
        }
      );
      startTasks.push(this.stateUpdateService.start());
    }

    if (startTasks.length > 0) {
      await Promise.all(startTasks);
    }
  }

  private setupSignalHandlers(): void {
    process.once("SIGINT", async () => await this.handleShutdown("SIGINT"));
    process.once("SIGTERM", async () => await this.handleShutdown("SIGTERM"));
    process.once("uncaughtException", async (error) => {
      log.error("Uncaught Exception:", error);
      await this.handleShutdown("uncaughtException");
    });
  }

  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    log.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await this.stop();
      log.info("Graceful shutdown completed");
    } catch (error) {
      log.error("Error during shutdown:", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    const stopTasks: Promise<void>[] = [];

    // Stop optional services
    if (this.stateUpdateService) {
      stopTasks.push(this.stateUpdateService.stop());
    }
    if (this.coinGeckoManager) {
      stopTasks.push(this.coinGeckoManager.stop());
    }

    // Close database connection
    stopTasks.push(this.queryClient.end());

    try {
      await Promise.allSettled(stopTasks);
      this.emit("stopped");
    } catch (error) {
      log.error("Error during AICore shutdown:", error);
      throw error;
    }
  }

  // Public API methods
  public async interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ) {
    if (!this.isInitialized) {
      throw new Error("AICore must be initialized before interaction");
    }
    if (!this.conversationManager) {
      throw new Error("ConversationManager not initialized");
    }
    return this.conversationManager.handleMessage(input, options);
  }

  public async getCharacter(): Promise<Character> {
    if (!this.character) {
      throw new Error("Character not initialized");
    }
    return this.character;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  // Service status methods
  public getServiceStatus(): Record<string, boolean> {
    return {
      character: !!this.character,
      interaction: !!this.interactionService,
      conversation: !!this.conversationManager,
      coingecko: !!this.coinGeckoManager,
      quantum: !!this.quantumStateManager,
      stateUpdate: !!this.stateUpdateService,
    };
  }
}
