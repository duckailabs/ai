import type { Character } from "@/db/schema/schema";
import type { InteractionDefaults } from "@/types";
import { EventEmitter } from "events";
import type { AICore } from "./AICore";
import { P2PNetwork } from "./managers/libp2p";
import { ScheduledPostManager } from "./managers/scheduler";
import { APIServer, type ServerConfig } from "./platform/api/server";
import EchoChambersClient from "./platform/echochambers";
import { TelegramClient } from "./platform/telegram/telegram";
import { TwitterManager, type TwitterConfig } from "./platform/twitter/twitter";
import { log } from "./utils/logger";

export interface PlatformConfig {
  telegram?: {
    enabled: boolean;
    token: string;
    defaults?: InteractionDefaults;
  };
  twitter?: TwitterConfig & {
    defaults?: InteractionDefaults;
  };
  api?: ServerConfig & {
    enabled: boolean;
  };
  p2p?: {
    enabled: boolean;
    privateKey: string;
    initialPeers: string[];
    port: number;
    turnkeyClient: any; // TODO: Replace with proper Turnkey type
    address: string;
  };
  echoChambers?: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
  };
  scheduler?: {
    enabled: boolean;
  };
}

type PlatformName =
  | "telegram"
  | "twitter"
  | "api"
  | "p2p"
  | "echoChambers"
  | "scheduler";

interface PlatformState {
  telegram?: TelegramClient;
  twitter?: TwitterManager;
  api?: APIServer;
  p2p?: P2PNetwork;
  echoChambers?: EchoChambersClient;
  scheduler?: ScheduledPostManager;
}

interface PlatformStatus {
  name: PlatformName;
  isEnabled: boolean;
  isRunning: boolean;
  error?: Error;
}

export class PlatformManager extends EventEmitter {
  private platforms: PlatformState = {};
  private platformStatus: Map<PlatformName, PlatformStatus> = new Map();
  private isInitialized: boolean = false;
  private currentCharacter?: Character;

  constructor(
    private readonly core: AICore,
    private readonly config: PlatformConfig
  ) {
    super();
    this.validateConfig();
    this.initializePlatformStatus();
  }

  private validateConfig() {
    const enabledPlatforms = Object.entries(this.config)
      .filter(([_, config]) => config?.enabled)
      .map(([name]) => name);

    if (enabledPlatforms.length === 0) {
      throw new Error("At least one platform must be enabled");
    }

    log.info(`Enabled platforms: ${enabledPlatforms.join(", ")}`);
  }

  private initializePlatformStatus() {
    const platforms: PlatformName[] = [
      "telegram",
      "twitter",
      "api",
      "p2p",
      "echoChambers",
      "scheduler",
    ];
    platforms.forEach((name) => {
      this.platformStatus.set(name, {
        name,
        isEnabled: !!this.config[name]?.enabled,
        isRunning: false,
      });
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get character first as platforms might need it
      this.currentCharacter = await this.core.getCharacter();

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
    const initPromises = [
      //this.initializeTelegram(),
      this.initializeTwitter(),
      //this.initializeAPI(),
      //this.initializeP2P(),
      //this.initializeEchoChambers(),
      //this.initializeScheduler(),
    ];

    const results = await Promise.allSettled(initPromises);

    results.forEach((result, index) => {
      const platformName = [
        "telegram",
        "twitter",
        "api",
        "p2p",
        "echoChambers",
        "scheduler",
      ][index] as PlatformName;
      const status = this.platformStatus.get(platformName);

      if (result.status === "fulfilled") {
        if (status) {
          status.isRunning = true;
        }
      } else {
        if (status) {
          status.error = result.reason;
          status.isRunning = false;
        }
        log.error(`Failed to initialize ${platformName}:`, result.reason);
      }
    });
  }

  /* private async initializeTelegram(): Promise<void> {
    if (!this.config.telegram?.enabled) return;

    try {
      const { token, defaults } = this.config.telegram;
      this.platforms.telegram = new TelegramClient(token, this.core, defaults);
      await this.platforms.telegram.start();
      log.info("Telegram client initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("telegram", false, error as Error);
      throw error;
    }
  } */

  private async initializeTwitter(): Promise<void> {
    if (!this.config.twitter?.enabled) return;

    try {
      this.platforms.twitter = await TwitterManager.create(
        this.config.twitter,
        this.core,
        this.config.twitter.defaults
      );
      await this.platforms.twitter.start();
      log.info("Twitter manager initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("twitter", false, error as Error);
      throw error;
    }
  }

  /* private async initializeAPI(): Promise<void> {
    if (!this.config.api?.enabled) return;

    try {
      this.platforms.api = new APIServer(this.core, this.config.api);
      await this.platforms.api.start();
      log.info("API server initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("api", false, error as Error);
      throw error;
    }
  } */

  /*  private async initializeP2P(): Promise<void> {
    if (!this.config.p2p?.enabled || !this.currentCharacter) return;

    try {
      const { privateKey, port, initialPeers, turnkeyClient, address } =
        this.config.p2p;

      const p2pConfig = {
        turnkeyClient,
        address,
        rewardAmount: 6900, // TODO: Make configurable
      };

      this.platforms.p2p = new P2PNetwork(
        privateKey,
        this.currentCharacter.name || "unnamed",
        "0.0.1",
        this.core.interact.bind(this.core),
        this.currentCharacter,
        this.core.characterManager,
        this.config.telegram?.defaults,
        p2pConfig,
        port
      );

      await this.platforms.p2p.start(port, initialPeers);
      log.info("P2P network initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("p2p", false, error as Error);
      throw error;
    }
  }

  private async initializeEchoChambers(): Promise<void> {
    if (!this.config.echoChambers?.enabled) return;

    try {
      const { apiKey, baseUrl } = this.config.echoChambers;
      this.platforms.echoChambers = new EchoChambersClient({
        apiKey,
        baseUrl,
      });
      log.info("Echo Chambers client initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("echoChambers", false, error as Error);
      throw error;
    }
  }

  private async initializeScheduler(): Promise<void> {
    if (!this.config.scheduler?.enabled) return;

    try {
      this.platforms.scheduler = new SchedulerManager(this.core);
      await this.platforms.scheduler.start();
      log.info("Scheduler initialized successfully");
    } catch (error) {
      this.updatePlatformStatus("scheduler", false, error as Error);
      throw error;
    }
  } */

  private updatePlatformStatus(
    platform: PlatformName,
    isRunning: boolean,
    error?: Error
  ) {
    const status = this.platformStatus.get(platform);
    if (status) {
      status.isRunning = isRunning;
      status.error = error;
      this.emit("platformStatusChanged", { platform, status });
    }
  }

  private setupEventHandlers(): void {
    // Handle platform-specific error handlers
    Object.entries(this.platforms).forEach(([name, platform]) => {
      if (platform instanceof EventEmitter) {
        platform.on("error", (error) => {
          this.updatePlatformStatus(name as PlatformName, true, error);
          this.emit("platformError", { platform: name, error });
        });
      }
    });
  }

  public async stop(): Promise<void> {
    const stopTasks = Object.entries(this.platforms).map(
      async ([name, platform]) => {
        try {
          if (platform && "stop" in platform) {
            await platform.stop();
            this.updatePlatformStatus(name as PlatformName, false);
            log.info(`${name} stopped successfully`);
          }
        } catch (error) {
          log.error(`Error stopping ${name}:`, error);
          this.updatePlatformStatus(
            name as PlatformName,
            false,
            error as Error
          );
        }
      }
    );

    await Promise.allSettled(stopTasks);
    this.isInitialized = false;
    this.emit("stopped");
    log.info("Platform manager stopped successfully");
  }

  public getPlatform<T extends keyof PlatformState>(
    platform: T
  ): PlatformState[T] | undefined {
    return this.platforms[platform];
  }

  public getPlatformStatus(platform: PlatformName): PlatformStatus | undefined {
    return this.platformStatus.get(platform);
  }

  public getAllPlatformStatus(): Map<PlatformName, PlatformStatus> {
    return new Map(this.platformStatus);
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}
