import { AICore } from "@/core/AICore";
import { P2PNetwork } from "@/core/managers/libp2p";
import { APIServer, type ServerConfig } from "@/core/platform/api/server";
import EchoChambersClient from "@/core/platform/echochambers";
import { TelegramClient } from "@/core/platform/telegram/telegram";
import {
  TwitterManager,
  type TwitterConfig,
} from "@/core/platform/twitter/twitter";
import { log } from "@/core/utils/logger";
import type { InteractionDefaults } from "@/types";
import { EventEmitter } from "events";

export interface PlatformConfig {
  telegram?: {
    enabled: boolean;
    token: string;
    defaults?: InteractionDefaults;
  };
  twitter?: TwitterConfig & {
    defaults?: InteractionDefaults;
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
    turnkeyClient?: any; // Replace with proper type
    address: string;
  };
  echoChambers?: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
  };
}

export class PlatformManager extends EventEmitter {
  private telegramClient?: TelegramClient;
  private twitterManager?: TwitterManager;
  private apiServer?: APIServer;
  private p2pNetwork?: P2PNetwork;
  private echoChambersClient?: EchoChambersClient;
  private isInitialized: boolean = false;

  constructor(
    private readonly core: AICore,
    private readonly config: PlatformConfig
  ) {
    super();
    this.validateConfig();
  }

  private validateConfig() {
    // Validate that at least one platform is enabled
    const hasEnabledPlatform =
      this.config.telegram?.enabled ||
      this.config.twitter?.enabled ||
      this.config.api?.enabled ||
      this.config.p2p?.enabled ||
      this.config.echoChambers?.enabled;

    if (!hasEnabledPlatform) {
      throw new Error("At least one platform must be enabled");
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.initializePlatforms();
      this.setupEventHandlers();
      this.isInitialized = true;
      this.emit("initialized");
      log.info("Platform manager initialized successfully");
    } catch (error) {
      log.error("Failed to initialize platform manager:", error);
      throw error;
    }
  }

  private async initializePlatforms(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Initialize Telegram
    if (this.config.telegram?.enabled) {
      initPromises.push(this.initializeTelegram());
    }

    // Initialize Twitter
    if (this.config.twitter?.enabled) {
      initPromises.push(this.initializeTwitter());
    }

    // Initialize API Server
    if (this.config.api?.enabled) {
      initPromises.push(this.initializeAPIServer());
    }

    // Initialize P2P Network
    if (this.config.p2p?.enabled) {
      initPromises.push(this.initializeP2P());
    }

    // Initialize Echo Chambers
    if (this.config.echoChambers?.enabled) {
      initPromises.push(this.initializeEchoChambers());
    }

    await Promise.all(initPromises);
  }

  private async initializeTelegram(): Promise<void> {
    try {
      log.info("Initializing Telegram client...");
      const { token, defaults } = this.config.telegram!;
      this.telegramClient = new TelegramClient(token, this.core, defaults);
      await this.telegramClient.start();
      log.info("Telegram client initialized successfully");
    } catch (error) {
      log.error("Failed to initialize Telegram client:", error);
      throw error;
    }
  }

  private async initializeTwitter(): Promise<void> {
    try {
      log.info("Initializing Twitter manager...");
      this.twitterManager = await TwitterManager.create(
        this.config.twitter!,
        this.core,
        this.config.twitter?.defaults
      );
      await this.twitterManager.start();
      log.info("Twitter manager initialized successfully");
    } catch (error) {
      log.error("Failed to initialize Twitter manager:", error);
      throw error;
    }
  }

  private async initializeAPIServer(): Promise<void> {
    try {
      log.info("Initializing API server...");
      this.apiServer = new APIServer(
        this.core,
        this.config.api as ServerConfig
      );
      await this.apiServer.start();
      log.info("API server initialized successfully");
    } catch (error) {
      log.error("Failed to initialize API server:", error);
      throw error;
    }
  }

  private async initializeP2P(): Promise<void> {
    try {
      log.info("Initializing P2P network...");
      const { privateKey, port, initialPeers, turnkeyClient, address } =
        this.config.p2p!;
      const metadata = {
        name: this.core.character.name || "unnamed",
        version: "0.0.1",
      };

      this.p2pNetwork = new P2PNetwork(
        privateKey,
        metadata.name,
        metadata.version,
        this.core.character,
        this.core.interact.bind(this.core),
        this.core.characterManager,
        undefined, // Default interactions
        {
          turnkeyClient,
          port,
          initialPeers,
          address,
          rewardAmount: 6900, // Make configurable
        }
      );

      await this.p2pNetwork.start(port, initialPeers);
      log.info("P2P network initialized successfully");
    } catch (error) {
      log.error("Failed to initialize P2P network:", error);
      throw error;
    }
  }

  private async initializeEchoChambers(): Promise<void> {
    try {
      log.info("Initializing Echo Chambers client...");
      const { apiKey, baseUrl } = this.config.echoChambers!;
      this.echoChambersClient = new EchoChambersClient({
        apiKey,
        baseUrl,
      });
      log.info("Echo Chambers client initialized successfully");
    } catch (error) {
      log.error("Failed to initialize Echo Chambers client:", error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle core shutdown
    this.core.on("stopped", async () => {
      await this.stop();
    });

    // Platform-specific event handlers
    if (this.telegramClient) {
      this.telegramClient.on("error", (error) => {
        log.error("Telegram client error:", error);
        this.emit("platformError", { platform: "telegram", error });
      });
    }

    if (this.twitterManager) {
      this.twitterManager.on("error", (error) => {
        log.error("Twitter manager error:", error);
        this.emit("platformError", { platform: "twitter", error });
      });
    }
  }

  public async stop(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    if (this.telegramClient) {
      stopPromises.push(this.telegramClient.stop());
    }

    if (this.twitterManager) {
      stopPromises.push(this.twitterManager.stop());
    }

    if (this.apiServer) {
      stopPromises.push(this.apiServer.stop());
    }

    if (this.p2pNetwork) {
      stopPromises.push(this.p2pNetwork.stop());
    }

    try {
      await Promise.allSettled(stopPromises);
      this.emit("stopped");
      log.info("Platform manager stopped successfully");
    } catch (error) {
      log.error("Error during platform manager shutdown:", error);
      throw error;
    }
  }

  // Utility methods
  public getTwitterManager(): TwitterManager | undefined {
    return this.twitterManager;
  }

  public getTelegramClient(): TelegramClient | undefined {
    return this.telegramClient;
  }

  public getAPIServer(): APIServer | undefined {
    return this.apiServer;
  }

  public getP2PNetwork(): P2PNetwork | undefined {
    return this.p2pNetwork;
  }

  public getEchoChambers(): EchoChambersClient | undefined {
    return this.echoChambersClient;
  }
}
