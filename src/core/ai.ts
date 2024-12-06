import { CharacterManager } from "@/core/managers/character";
import { LLMManager, type LLMConfig } from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { CharacterBuilder } from "@/create-character/builder";
import { type ChatMessage, type Tweet } from "@/create-character/types";
import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import type { InteractionDefaults } from "@/types";
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
import { ContextResolver } from "./goals/context";
import { PostGoal } from "./goals/post";
import { CoinGeckoManager } from "./managers/coingecko";
import { ConversationManager } from "./managers/conversation";
import { FatduckManager, type FatduckConfig } from "./managers/fatduck";
import { P2PNetwork } from "./managers/libp2p";
import { QuantumStateManager } from "./managers/quantum";
import { QuantumPersonalityMapper } from "./managers/quantum-personality";
import {
  ScheduledPostManager,
  type ScheduledPostConfig,
} from "./managers/scheduler";
import { ToolManager } from "./managers/tools";
import { APIServer, type ServerConfig } from "./platform/api/server";
import { TelegramClient } from "./platform/telegram/telegram";
import type { TwitterClient } from "./platform/twitter/api/src/client";
import { TwitterManager, type TwitterConfig } from "./platform/twitter/twitter";
import { EventService } from "./services/Event";
import { InteractionService } from "./services/Interaction";
import {
  StateUpdateService,
  type StateUpdateConfig,
} from "./services/quantum-state";
import type { InteractionOptions } from "./types";
import type { IBMConfig } from "./utils/IBMRest";
import { log } from "./utils/logger";

export interface AIOptions {
  databaseUrl: string;
  llmConfig: LLMConfig;
  toolsDir?: string | "./ai/tools/";
  character: CreateCharacterInput;
  refreshCharacterOnRestart?: boolean;
  fatduck: FatduckConfig;
  scheduledPosts?: {
    enabled: boolean;
    posts: ScheduledPostConfig[];
    debug?: boolean;
    runOnStartup?: boolean;
  };
  platformDefaults?: {
    telegram?: InteractionDefaults;
    twitter?: InteractionDefaults;
  };
  coingecko?: {
    enabled: boolean;
    apiKey?: string;
    updateInterval?: string;
    initialScan?: {
      enabled: boolean;
      batchSize?: number;
      delay?: number;
    };
    cache?: {
      enabled: boolean;
      ttl: number;
    };
  };
  quantum?: {
    enabled: boolean;
    cronSchedule?: string;
    checkInitialState?: boolean;
    ibmConfig?: IBMConfig;
  };
  platforms?: {
    telegram?: {
      enabled: boolean;
      token: string;
    };
    twitter?: TwitterConfig;
    api?: {
      enabled: boolean;
      port: number;
      hostname?: string;
      cors?: {
        allowedOrigins: string[];
      };
      apiKey?: string;
    };
    p2p?: {
      enabled: boolean;
      privateKey: string;
      initialPeers: string[];
      port: number;
    };
  };
}

export class ai {
  private characterManager: CharacterManager;
  private memoryManager: MemoryManager;
  private styleManager: StyleManager;
  public llmManager: LLMManager;
  private characterBuilder: CharacterBuilder;
  public db: PostgresJsDatabase<typeof dbSchemas>;
  private interactionService!: InteractionService;
  public eventService: EventService;
  private toolManager: ToolManager;
  private conversationManager!: ConversationManager;
  public character!: Character;
  public telegramClient?: TelegramClient;
  public apiServer?: APIServer;
  public p2pNetwork?: P2PNetwork;
  private queryClient?: postgres.Sql;
  private platformDefaults?: {
    telegram?: InteractionDefaults;
    twitter?: InteractionDefaults;
  };
  private quantumStateManager?: QuantumStateManager;
  private stateUpdateService?: StateUpdateService;
  private twitterManager?: TwitterManager;
  private coinGeckoManager?: CoinGeckoManager;
  private scheduledPostManager?: ScheduledPostManager;
  private isShuttingDown: boolean = false;
  public fatduckManager: FatduckManager;
  public goalManager: PostGoal;
  private contextResolver: ContextResolver;
  constructor(options: AIOptions) {
    this.queryClient = postgres(options.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.queryClient, { schema: dbSchemas });
    this.characterManager = new CharacterManager(this.db);

    // Initialize basic managers without quantum features
    this.fatduckManager = new FatduckManager(options.fatduck);
    this.contextResolver = new ContextResolver(this.fatduckManager);
    this.llmManager = new LLMManager(options.llmConfig, this.characterManager);
    this.goalManager = new PostGoal(
      this.db,
      this.llmManager,
      this.contextResolver,
      this.fatduckManager
    );
    this.styleManager = new StyleManager(this.characterManager);
    this.characterBuilder = new CharacterBuilder(this.llmManager);
    this.memoryManager = new MemoryManager(this.db, this.llmManager);
    this.eventService = new EventService(this.db, this.characterManager);
    this.toolManager = new ToolManager({ toolsDir: options.toolsDir });

    this.platformDefaults = options.platformDefaults;
    if (options.coingecko?.enabled) {
      this.coinGeckoManager = new CoinGeckoManager(
        options.coingecko,
        this.db,
        this.llmManager
      );
    }
  }

  // Move character initialization to a separate async method
  private async initializeQuantumFeatures(options: AIOptions) {
    if (!options.quantum?.enabled) return;

    // Initialize quantum components
    this.quantumStateManager = new QuantumStateManager(
      this.db,
      options.quantum.ibmConfig
    );

    // Verify quantum state exists
    const currentState = await this.quantumStateManager.getLatestState();

    // Create quantum personality mapper
    const quantumPersonalityMapper = new QuantumPersonalityMapper(
      this.quantumStateManager,
      this.character
    );

    const initialPersonality =
      await quantumPersonalityMapper.mapQuantumToPersonality();

    // Reinitialize LLM manager with quantum features

    this.llmManager = new LLMManager(
      {
        ...options.llmConfig,
        quantumPersonalityMapper, // Pass the mapper directly
      },
      this.characterManager,
      this.quantumStateManager,
      this.character
    );
  }

  // Static factory method for creating a properly initialized instance
  public static async initialize(options: AIOptions): Promise<ai> {
    const instance = new ai(options);

    // Initialize character first
    await instance.initializeCharacter(
      options.character,
      options.refreshCharacterOnRestart
    );

    if (!instance.character || !instance.character.id) {
      throw new Error(
        "Character initialization failed - character ID is missing"
      );
    }

    if (instance.coinGeckoManager) {
      log.info("Starting CoinGecko manager...");
      await instance.coinGeckoManager.start();
      log.info("CoinGecko manager initialized successfully!");
      //await instance.coinGeckoManager.updateAllRanks();
    }

    // Now initialize quantum features after character is set
    await instance.initializeQuantumFeatures(options);

    let twitterClient: TwitterClient | undefined;
    if (options.platforms?.twitter?.enabled) {
      log.info("Initializing Twitter manager...");
      instance.twitterManager = await TwitterManager.create(
        options.platforms.twitter,
        instance,
        options.platformDefaults?.twitter
      );
      const twitterClient = instance.twitterManager.getClient();
      log.info("Got Twitter client from manager:", !!twitterClient);

      if (options.scheduledPosts?.enabled) {
        log.info("Initializing scheduled post manager...");
        instance.scheduledPostManager = new ScheduledPostManager(
          instance,
          options.scheduledPosts.posts,
          twitterClient,
          options.scheduledPosts.debug,
          options.scheduledPosts.runOnStartup
        );
        await instance.scheduledPostManager.start();
        log.info("Scheduled post manager initialized successfully!");
      }
      // Create preprocessing manager with the initialized client
      // Create InteractionService once with whatever client we have (or undefined)

      instance.interactionService = new InteractionService(
        instance.db,
        instance.characterManager,
        instance.styleManager,
        instance.llmManager,
        instance.memoryManager,
        instance.eventService,
        instance.toolManager,
        twitterClient
      );

      // Create ConversationManager after InteractionService
      instance.conversationManager = new ConversationManager(
        instance.db,
        instance.interactionService,
        instance.eventService,
        instance.llmManager
      );

      await instance.twitterManager.start(
        options.platforms.twitter.checkInterval
      );
      log.info("Twitter manager initialized successfully!");
    }

    // Initialize platforms if configured
    if (options.platforms?.telegram?.enabled) {
      log.info("Initializing Telegram client...");
      const { token } = options.platforms.telegram;
      instance.telegramClient = instance.createTelegramClient(token);
      await instance.telegramClient.start();
      log.info("Telegram client initialized successfully!");
    } else {
      log.info("Telegram client not enabled");
    }

    /* if (options.platforms?.twitter?.enabled) {
      log.info("Initializing Twitter manager...");
      instance.twitterManager = await TwitterManager.create(
        options.platforms.twitter,
        instance,
        options.platformDefaults?.twitter
      );
      await instance.twitterManager.start(
        options.platforms.twitter.checkInterval
      );
      log.info("Twitter manager initialized successfully!");
    } else {
      log.info("Twitter manager not enabled");
    } */

    if (options.platforms?.api?.enabled) {
      log.info("Initializing API server...");
      instance.apiServer = instance.createAPIServer(options.platforms.api);
      await instance.apiServer.start();
      log.info("API server initialized successfully!");
    } else {
      log.info("API server not enabled");
    }

    if (options.platforms?.p2p?.enabled) {
      log.info("Initializing P2P network...");
      const version = "0.0.1";

      const stripped_metadata = {
        creators: Array.isArray(options.character.identity?.creators)
          ? options.character.identity.creators[0]
          : "",
        tokenAddress:
          typeof options.character.onchain?.duckaiTokenAddress === "string"
            ? options.character.onchain.duckaiTokenAddress
            : "",
      };

      // Create minimal p2p config
      const stripped_config = {
        port: Number(options.platforms.p2p.port),
        initialPeers: Array.isArray(options.platforms.p2p.initialPeers)
          ? options.platforms.p2p.initialPeers.filter(
              (p: string) => typeof p === "string"
            )
          : [],
      };

      try {
        instance.p2pNetwork = new P2PNetwork(
          options.platforms.p2p.privateKey,
          String(options.character.name || "unnamed"),
          version,
          stripped_metadata,
          instance.interact.bind(instance),
          instance.characterManager,
          options.platformDefaults?.telegram
        );

        await instance.p2pNetwork.start(
          stripped_config.port,
          stripped_config.initialPeers
        );
      } catch (error) {
        console.error("Failed to initialize P2P network:", error);
        // Optionally handle the error differently or continue without P2P
      }
    } else {
      log.info("P2P network not enabled");
    }

    if (options.quantum?.enabled && instance.quantumStateManager) {
      const updateConfig: StateUpdateConfig = {
        enabled: true,
        cronSchedule: options.quantum.cronSchedule || "0 * * * *", // Default to hourly
        maxRetries: 3,
        initialDelayMs: 1000,
      };

      instance.stateUpdateService = new StateUpdateService(
        instance.quantumStateManager,
        instance.eventService, // Pass the event service
        updateConfig
      );

      // Set up event listeners
      instance.stateUpdateService.on("stateUpdated", (state) => {
        log.info("Quantum state updated:", state.entropyHash);
      });

      instance.stateUpdateService.on("updateError", (error) => {
        log.error("Quantum state update failed:", error);
      });

      await instance.stateUpdateService.start();
      log.info("Quantum state service initialized successfully!");
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

  public async stop() {
    log.info("Stopping AI services...");

    const shutdownTasks: Promise<void>[] = [];

    // Stop Telegram client if it exists
    if (this.telegramClient) {
      log.info("Stopping Telegram client...");
      shutdownTasks.push(Promise.resolve(this.telegramClient.stop()));
    }

    if (this.twitterManager) {
      log.info("Stopping Twitter manager...");
      shutdownTasks.push(this.twitterManager.stop());
    }

    // Stop API server if it exists
    if (this.apiServer) {
      log.info("Stopping API server...");
      shutdownTasks.push(this.apiServer.stop());
    }

    // Close database connections
    if (this.queryClient) {
      log.info("Closing database connections...");
      shutdownTasks.push(this.queryClient.end());
    }

    // Add P2P shutdown
    if (this.p2pNetwork) {
      log.info("Stopping P2P network...");
      shutdownTasks.push(this.p2pNetwork.stop());
    }

    // Stop quantum state service if it exists
    if (this.stateUpdateService) {
      log.info("Stopping quantum state service...");
      shutdownTasks.push(this.stateUpdateService.stop());
    }

    if (this.coinGeckoManager) {
      log.info("Stopping CoinGecko manager...");
      shutdownTasks.push(this.coinGeckoManager.stop());
    }

    try {
      await Promise.allSettled(shutdownTasks);
    } catch (error) {
      console.error("Error during service shutdown:", error);
      throw error;
    }
  }

  public async triggerQuantumUpdate(): Promise<void> {
    if (!this.stateUpdateService) {
      throw new Error("Quantum state service not initialized");
    }
    await this.stateUpdateService.triggerUpdate();
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
      log.info(`Looking for existing character: ${characterConfig.name}...`);

      const [existingCharacter] = await this.db
        .select()
        .from(dbSchemas.characters)
        .where(eq(dbSchemas.characters.name, characterConfig.name));

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
            }
          );
        } else {
          log.info("Using existing character without refresh");
          this.character = existingCharacter;
        }
      } else {
        log.info("No existing character found, creating new one...");
        this.character = await this.characterManager.createCharacter(
          characterConfig
        );
      }

      if (!this.character || !this.character.id) {
        throw new Error(
          "Character initialization failed - character or ID is missing"
        );
      }

      log.info(`Character initialized: ${this.character.id}`);
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
    return new TelegramClient(token, this, this.platformDefaults?.telegram);
  }

  private createAPIServer(config: ServerConfig) {
    return new APIServer(this, config);
  }

  async interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ) {
    return this.conversationManager.handleMessage(input, options);
  }

  public async sendP2PMessage(content: string, toAgentId?: string) {
    if (!this.p2pNetwork) {
      throw new Error("P2P network not initialized");
    }
    const messageId = await this.p2pNetwork.sendMessage(content, toAgentId);
    log.sent(`[SENDING MESSAGE] ${content}\n`);
    return messageId;
  }
}
