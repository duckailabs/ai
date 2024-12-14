import { CharacterManager } from "@/core/managers/character";
import {
  LLMManager,
  type LLMConfig,
  type TimelineTweet,
} from "@/core/managers/llm";
import { MemoryManager } from "@/core/managers/memory";
import { StyleManager } from "@/core/managers/style";
import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import type {
  CharacterUpdate,
  CreateCharacterInput,
  InteractionDefaults,
  Platform,
  PlatformStylesInput,
  ResponseStyles,
} from "@/types";
import type { Turnkey } from "@turnkey/sdk-server";
import { eq } from "drizzle-orm";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventEmitter } from "events";
import postgres from "postgres";
import { PostGoal } from "./goals/post";
import { CoinGeckoManager } from "./managers/coingecko";
import { ConversationManager } from "./managers/conversation";
import { P2PNetwork } from "./managers/libp2p";
import { QuantumStateManager } from "./managers/quantum";
import { QuantumPersonalityMapper } from "./managers/quantum-personality";
import {
  ScheduledPostManager,
  type ScheduledPostConfig,
} from "./managers/scheduler";
import { ToolManager } from "./managers/tools";
import { APIServer, type ServerConfig } from "./platform/api/server";
import EchoChambersClient from "./platform/echochambers";
import { TelegramClient } from "./platform/telegram/telegram";
import type { TwitterClient } from "./platform/twitter/api/src/client";
import {
  TwitterManager,
  type TimelineAnalysisOptions,
  type TwitterConfig,
} from "./platform/twitter/twitter";
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
  scheduledPosts?: {
    enabled: boolean;
    debug?: boolean;
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
    echoChambers?: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
    };
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
      turnkeyClient: Turnkey | null | undefined;
      address: string;
    };
  };
}

export interface ai {
  characterManager: CharacterManager;
  memoryManager: MemoryManager;
  styleManager: StyleManager;
  llmManager: LLMManager;
  toolManager: ToolManager;
  coinGeckoManager?: CoinGeckoManager;
  quantumStateManager?: QuantumStateManager;
  scheduledPostManager?: ScheduledPostManager;
  goalManager: PostGoal;
  interactionService: InteractionService;
  eventService: EventService;
  conversationManager: ConversationManager;
  stateUpdateService?: StateUpdateService;
  telegramClient?: TelegramClient;
  twitterManager?: TwitterManager;
  apiServer?: APIServer;
  p2pNetwork?: P2PNetwork;
  echoChambersClient?: EchoChambersClient;
  db: PostgresJsDatabase<typeof dbSchemas>;
  character: Character;

  initialize(options: AIOptions): Promise<ai>;
  stop(): Promise<void>;
  interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ): Promise<any>;
  getCharacter(id: string): Promise<Character>;
  createCharacter(input: CreateCharacterInput): Promise<Character>;
  updateCharacter(id: string, update: CharacterUpdate): Promise<Character>;
  updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: PlatformStylesInput
  ): Promise<void>;
  triggerQuantumUpdate(): Promise<void>;
  sendP2PMessage(content: string, toAgentId?: string): Promise<string>;
  sendP2PQuestion(content: string): Promise<string>;
  analyzeTwitterTimeline(
    username: string,
    options: TimelineAnalysisOptions
  ): Promise<TimelineTweet[]>;
  schedulePost(config: ScheduledPostConfig): Promise<boolean>;
  unschedulePost(type: string): Promise<boolean>;
  getScheduledPosts(): string[];
  log(message: string, data?: any): void;
}

export class AICore extends EventEmitter implements ai {
  public characterManager: CharacterManager;
  public memoryManager: MemoryManager;
  public styleManager: StyleManager;
  public llmManager: LLMManager;
  public toolManager: ToolManager;
  public coinGeckoManager?: CoinGeckoManager;
  public quantumStateManager?: QuantumStateManager;
  public scheduledPostManager?: ScheduledPostManager;
  public goalManager: PostGoal;

  public interactionService!: InteractionService;
  public eventService: EventService;
  public conversationManager!: ConversationManager;
  public stateUpdateService?: StateUpdateService;

  public telegramClient?: TelegramClient;
  public twitterManager?: TwitterManager;
  public apiServer?: APIServer;
  public p2pNetwork?: P2PNetwork;
  public echoChambersClient?: EchoChambersClient;

  public db: PostgresJsDatabase<typeof dbSchemas>;
  private queryClient: postgres.Sql;

  public character!: Character;
  private isInitialized: boolean = false;
  private isShuttingDown: boolean = false;
  private platformDefaults?: {
    telegram?: InteractionDefaults;
    twitter?: InteractionDefaults;
  };

  constructor(options: AIOptions) {
    super();

    this.queryClient = postgres(options.databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.queryClient, { schema: dbSchemas });

    this.characterManager = new CharacterManager(this.db);
    this.llmManager = new LLMManager(options.llmConfig, this.characterManager);
    this.goalManager = new PostGoal(this.db, this.llmManager);
    this.styleManager = new StyleManager(this.characterManager);
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

  public static async initialize(options: AIOptions): Promise<AICore> {
    const instance = new AICore(options);

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
    }

    await instance.initializeQuantumFeatures(options);

    let twitterClient: TwitterClient | undefined;
    if (options.platforms?.twitter?.enabled) {
      log.info("Initializing Twitter manager...");
      instance.twitterManager = await TwitterManager.create(
        options.platforms.twitter,
        instance,
        options.platformDefaults?.twitter
      );
      twitterClient = instance.twitterManager.getClient();

      if (options.platforms?.echoChambers?.enabled) {
        log.info("Initializing Echo Chambers client...");
        instance.echoChambersClient = new EchoChambersClient(
          options.platforms.echoChambers
        );
        log.info("Echo Chambers client initialized successfully!");
      }

      if (options.scheduledPosts?.enabled) {
        log.info("Initializing scheduled post manager...");
        instance.scheduledPostManager = new ScheduledPostManager(
          instance.eventService,
          instance.toolManager,
          instance.characterManager,
          instance.llmManager,
          instance.styleManager,
          twitterClient,
          instance.echoChambersClient
        );
        log.info("Scheduled post manager initialized successfully!");
      }

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

    if (options.platforms?.telegram?.enabled) {
      log.info("Initializing Telegram client...");
      const { token } = options.platforms.telegram;
      instance.telegramClient = instance.createTelegramClient(token);
      await instance.telegramClient.start();
      log.info("Telegram client initialized successfully!");
    }

    if (options.platforms?.api?.enabled) {
      log.info("Initializing API server...");
      instance.apiServer = instance.createAPIServer(options.platforms.api);
      await instance.apiServer.start();
      log.info("API server initialized successfully!");
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

      const stripped_config = {
        port: Number(options.platforms.p2p.port),
        initialPeers: Array.isArray(options.platforms.p2p.initialPeers)
          ? options.platforms.p2p.initialPeers.filter(
              (p: string) => typeof p === "string"
            )
          : [],
      };

      const p2pConfig = {
        turnkeyClient: options.platforms.p2p.turnkeyClient,
        tokenMintAddress: stripped_metadata.tokenAddress,
        address: options.platforms.p2p.address,
        rewardAmount: 6900,
        port: Number(options.platforms.p2p.port),
        initialPeers: stripped_config.initialPeers,
      };

      try {
        /* instance.p2pNetwork = new P2PNetwork(
          options.platforms.p2p.privateKey,
          String(options.character.name || "unnamed"),
          version,
          stripped_metadata,
          instance.interact.bind(instance),
          instance.characterManager,
          options.platformDefaults?.telegram,
          p2pConfig
        );

        await instance.p2pNetwork.start(
          stripped_config.port,
          stripped_config.initialPeers
        ); */
      } catch (error) {
        console.error("Failed to initialize P2P network:", error);
      }
    }

    if (options.quantum?.enabled && instance.quantumStateManager) {
      const updateConfig: StateUpdateConfig = {
        enabled: true,
        cronSchedule: options.quantum.cronSchedule || "0 * * * *",
        maxRetries: 3,
        initialDelayMs: 1000,
      };

      instance.stateUpdateService = new StateUpdateService(
        instance.quantumStateManager,
        instance.eventService,
        updateConfig
      );

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

  private async initializeQuantumFeatures(options: AIOptions) {
    if (!options.quantum?.enabled) return;

    this.quantumStateManager = new QuantumStateManager(
      this.db,
      options.quantum.ibmConfig
    );

    const currentState = await this.quantumStateManager.getLatestState();

    const quantumPersonalityMapper = new QuantumPersonalityMapper(
      this.quantumStateManager,
      this.character
    );

    const initialPersonality =
      await quantumPersonalityMapper.mapQuantumToPersonality();

    this.llmManager = new LLMManager(
      {
        ...options.llmConfig,
        quantumPersonalityMapper,
      },
      this.characterManager,
      this.quantumStateManager,
      this.character
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
              prompts: characterConfig.prompts,
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

  public async stop() {
    log.info("Stopping AI services...");

    const shutdownTasks: Promise<void>[] = [];

    if (this.telegramClient) {
      log.info("Stopping Telegram client...");
      shutdownTasks.push(Promise.resolve(this.telegramClient.stop()));
    }

    if (this.twitterManager) {
      log.info("Stopping Twitter manager...");
      shutdownTasks.push(this.twitterManager.stop());
    }

    if (this.apiServer) {
      log.info("Stopping API server...");
      shutdownTasks.push(this.apiServer.stop());
    }

    if (this.queryClient) {
      log.info("Closing database connections...");
      shutdownTasks.push(this.queryClient.end());
    }

    if (this.p2pNetwork) {
      log.info("Stopping P2P network...");
      shutdownTasks.push(this.p2pNetwork.stop());
    }

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

  private createTelegramClient(token: string) {
    return new TelegramClient(token, this, this.platformDefaults?.telegram);
  }

  private createAPIServer(config: ServerConfig) {
    return new APIServer(this, config);
  }

  public async interact(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ) {
    return this.conversationManager.handleMessage(input, options);
  }

  public async triggerQuantumUpdate(): Promise<void> {
    if (!this.stateUpdateService) {
      throw new Error("Quantum state service not initialized");
    }
    await this.stateUpdateService.triggerUpdate();
  }

  public async getCharacter(id: string): Promise<Character> {
    const character = await this.characterManager.getCharacter(id);
    if (!character) {
      throw new Error(`Character with id ${id} not found`);
    }
    return character;
  }

  public async createCharacter(input: CreateCharacterInput) {
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

  public async updateCharacter(id: string, update: CharacterUpdate) {
    return this.characterManager.updateCharacter(id, update);
  }

  public async updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: PlatformStylesInput
  ) {
    this.styleManager.updatePlatformStyles(characterId, platform, styles);
  }

  public async sendP2PMessage(content: string, toAgentId?: string) {
    if (!this.p2pNetwork) {
      throw new Error("P2P network not initialized");
    }
    const messageId = await this.p2pNetwork.sendMessage(content, toAgentId);
    log.sent(`[SENDING MESSAGE] ${content}\n`);
    return messageId;
  }

  public async sendP2PQuestion(content: string) {
    if (!this.p2pNetwork) {
      throw new Error("P2P network not initialized");
    }
    const messageId = await this.p2pNetwork.sendQuestion(content);
    return messageId;
  }

  public async analyzeTwitterTimeline(
    username: string,
    options: TimelineAnalysisOptions
  ): Promise<TimelineTweet[]> {
    if (!this.twitterManager) {
      throw new Error("Twitter manager not initialized");
    }

    return this.twitterManager.analyzeTimeline(username, options);
  }

  public async schedulePost(config: ScheduledPostConfig): Promise<boolean> {
    if (!config.enabled) {
      return false;
    }

    if (!this.scheduledPostManager) {
      throw new Error("Scheduler is not enabled in AIOptions");
    }

    return this.scheduledPostManager.schedulePost(config);
  }

  public async unschedulePost(type: string): Promise<boolean> {
    if (!this.scheduledPostManager) {
      throw new Error(
        "Scheduler is not enabled. Enable it in AIOptions to use scheduling features."
      );
    }
    return this.scheduledPostManager.unschedulePost(type);
  }

  public getScheduledPosts(): string[] {
    if (!this.scheduledPostManager) {
      throw new Error(
        "Scheduler is not enabled. Enable it in AIOptions to use scheduling features."
      );
    }
    return this.scheduledPostManager.getScheduledPosts();
  }

  public log(message: string, data?: any) {
    log.userLog(message, data);
  }

  public async initialize(options: AIOptions): Promise<ai> {
    return AICore.initialize(options);
  }
}
