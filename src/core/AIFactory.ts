import type { AgentConfig } from "@/core/init/types";
import { PlatformManager } from "@/core/PlatformManager";
import { ConfigurationService } from "@/core/services/ConfigurationService";
import { log } from "@/core/utils/logger";
import { AICore, type AICoreConfig } from "./AICore";

export class AIFactory {
  private static instances: Map<string, AICore> = new Map();
  private static configService: ConfigurationService;

  private constructor() {}

  public static async initialize(): Promise<void> {
    this.configService = new ConfigurationService();
    await this.configService.initialize();
  }

  public static async getInstance(agentName: string): Promise<AICore> {
    // Return existing instance if available
    const existingInstance = this.instances.get(agentName);
    if (existingInstance) {
      return existingInstance;
    }

    // Load config for the specified agent
    const agentConfig = await this.configService.getConfig(agentName);

    // Create new instance
    const instance = await this.createInstance(agentConfig);
    this.instances.set(agentName, instance);

    return instance;
  }

  private static async createInstance(config: AgentConfig): Promise<AICore> {
    try {
      log.info(`Creating new AI instance: ${config.name}`);

      // Transform agent config to core config
      const coreConfig: AICoreConfig = {
        databaseUrl: config.databaseUrl,
        llmConfig: config.llmConfig,
        characterConfig: config.character,
        refreshCharacterOnRestart: config.refreshCharacterOnRestart,
      };

      // Create core instance
      const core = new AICore(coreConfig);

      // Initialize core
      await core.initialize();

      // Create and attach platform manager if platforms are configured
      if (this.hasPlatformConfigs(config)) {
        const platformManager = new PlatformManager(core, {
          telegram: config.platforms?.telegram,
          twitter: config.platforms?.twitter,
          api: config.platforms?.api,
          p2p: config.platforms?.p2p,
          echoChambers: config.platforms?.echoChambers,
        });

        await platformManager.initialize();
      }

      // Listen for shutdown events
      core.on("stopped", () => {
        this.instances.delete(config.name);
        log.info(`Removed AI instance: ${config.name}`);
      });

      return core;
    } catch (error) {
      log.error(`Failed to create AI instance: ${config.name}`, error);
      throw error;
    }
  }

  private static hasPlatformConfigs(config: AgentConfig): boolean {
    return !!(
      config.platforms?.telegram?.enabled ||
      config.platforms?.twitter?.enabled ||
      config.platforms?.api?.enabled ||
      config.platforms?.p2p?.enabled ||
      config.platforms?.echoChambers?.enabled
    );
  }

  public static async destroyInstance(agentName: string): Promise<void> {
    const instance = this.instances.get(agentName);
    if (instance) {
      await instance.stop();
      this.instances.delete(agentName);
      log.info(`Destroyed AI instance: ${agentName}`);
    }
  }

  public static async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.instances.entries()).map(
      async ([name, instance]) => {
        try {
          await instance.stop();
          this.instances.delete(name);
          log.info(`Stopped AI instance: ${name}`);
        } catch (error) {
          log.error(`Error stopping AI instance ${name}:`, error);
        }
      }
    );

    await Promise.allSettled(stopPromises);
  }

  public static getRunningInstances(): string[] {
    return Array.from(this.instances.keys());
  }

  public static async reloadInstance(agentName: string): Promise<AICore> {
    await this.destroyInstance(agentName);
    return this.getInstance(agentName);
  }

  public static async reloadAll(): Promise<void> {
    const instanceNames = this.getRunningInstances();
    await this.stopAll();

    for (const name of instanceNames) {
      await this.getInstance(name);
    }
  }
}

// Add type safety for process signals
declare global {
  namespace NodeJS {
    interface Process {
      on(
        signal:
          | "SIGTERM"
          | "SIGINT"
          | "uncaughtException"
          | "unhandledRejection",
        listener: (...args: any[]) => void
      ): Process;
    }
  }
}
