import type { AgentConfig } from "@/core/init/types";
import { EventEmitter } from "events";
import { AICore, type AICoreConfig } from "./AICore";
import { PlatformManager, type PlatformConfig } from "./PlatformManager";
import { ConfigurationService } from "./services/ConfigurationService";
import { log } from "./utils/logger";

export class AIFactory extends EventEmitter {
  private static instance: AIFactory;
  private configService: ConfigurationService;
  private agents: Map<string, { core: AICore; platforms: PlatformManager }> =
    new Map();

  private constructor() {
    super();
    this.configService = new ConfigurationService();
  }

  public static getInstance(): AIFactory {
    if (!AIFactory.instance) {
      AIFactory.instance = new AIFactory();
    }
    return AIFactory.instance;
  }

  public async initialize(): Promise<void> {
    await this.configService.initialize();
  }

  public async createAgent(agentName: string): Promise<AICore> {
    try {
      // Check if agent already exists
      if (this.agents.has(agentName)) {
        return this.agents.get(agentName)!.core;
      }

      // Load agent configuration
      const agentConfig = await this.configService.getConfig(agentName);
      if (!agentConfig) {
        throw new Error(`Configuration not found for agent: ${agentName}`);
      }

      // Create and initialize core
      const core = await this.createAndInitializeCore(agentConfig);

      // Create and initialize platform manager if platforms are configured
      const platforms = await this.createAndInitializePlatforms(
        agentConfig,
        core
      );

      // Store the agent instances
      this.agents.set(agentName, { core, platforms: platforms! });

      // Setup event handlers
      this.setupAgentEventHandlers(agentName, core, platforms);

      log.info(`Agent ${agentName} initialized successfully`);
      return core;
    } catch (error) {
      log.error(`Failed to create agent ${agentName}:`, error);
      throw error;
    }
  }

  private async createAndInitializeCore(config: AgentConfig): Promise<AICore> {
    const coreConfig: AICoreConfig = {
      databaseUrl: config.databaseUrl,
      llmConfig: config.llmConfig,
      characterConfig: config.character,
      refreshCharacterOnRestart: config.refreshCharacterOnRestart,
      coingecko: config.coingecko,
      quantum: config.quantum,
    };

    const core = new AICore(coreConfig);
    await core.initialize();
    return core;
  }

  private async createAndInitializePlatforms(
    config: AgentConfig,
    core: AICore
  ): Promise<PlatformManager | undefined> {
    if (!this.hasPlatformConfigs(config)) {
      return undefined;
    }

    const platformConfig: PlatformConfig = {
      telegram: config.platforms?.telegram,
      twitter: config.platforms?.twitter,
      api: config.platforms?.api,
      p2p: config.platforms?.p2p,
      echoChambers: config.platforms?.echoChambers,
    };

    const platforms = new PlatformManager(core, platformConfig);
    await platforms.initialize();

    // Connect core and platform manager
    //core.setPlatformManager(platforms);

    return platforms;
  }

  private setupAgentEventHandlers(
    agentName: string,
    core: AICore,
    platforms?: PlatformManager
  ): void {
    // Handle core shutdown
    core.on("stopped", () => {
      this.agents.delete(agentName);
      this.emit("agentStopped", agentName);
      log.info(`Agent ${agentName} stopped`);
    });

    // Handle platform errors
    platforms?.on("platformError", (error) => {
      log.error(`Platform error for agent ${agentName}:`, error);
      this.emit("platformError", { agent: agentName, error });
    });

    // Handle platform shutdown
    platforms?.on("stopped", () => {
      log.info(`Platforms stopped for agent ${agentName}`);
    });
  }

  private hasPlatformConfigs(config: AgentConfig): boolean {
    return !!(
      config.platforms?.telegram?.enabled ||
      config.platforms?.twitter?.enabled ||
      config.platforms?.api?.enabled ||
      config.platforms?.p2p?.enabled ||
      config.platforms?.echoChambers?.enabled
    );
  }

  public async stopAgent(agentName: string): Promise<void> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return;
    }

    try {
      // Stop platforms first
      if (agent.platforms) {
        await agent.platforms.stop();
      }

      // Then stop core
      await agent.core.stop();

      this.agents.delete(agentName);
      log.info(`Agent ${agentName} stopped successfully`);
    } catch (error) {
      log.error(`Error stopping agent ${agentName}:`, error);
      throw error;
    }
  }

  public async stopAllAgents(): Promise<void> {
    const stopPromises = Array.from(this.agents.keys()).map((name) =>
      this.stopAgent(name)
    );

    await Promise.allSettled(stopPromises);
    log.info("All agents stopped");
  }

  public async reloadAgent(agentName: string): Promise<AICore> {
    await this.stopAgent(agentName);
    return this.createAgent(agentName);
  }

  public getRunningAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  public getAgent(agentName: string): AICore | undefined {
    return this.agents.get(agentName)?.core;
  }

  public getPlatformManager(agentName: string): PlatformManager | undefined {
    return this.agents.get(agentName)?.platforms;
  }
}
