import type { AgentConfig } from "@/core/init/types";
import { log } from "@/core/utils/logger";
import { watch } from "chokidar";
import { EventEmitter } from "events";
import { debounce } from "lodash";
import path from "path";

export interface ConfigChangeEvent {
  agentName: string;
  configPath: string;
  type: "updated" | "removed";
}

export class ConfigurationService extends EventEmitter {
  private configs: Map<string, AgentConfig> = new Map();
  private watcher: any;
  private initialized: boolean = false;

  constructor(
    private readonly options: {
      watchMode?: boolean;
      configDir?: string;
    } = {}
  ) {
    super();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadAllConfigs();

      if (this.options.watchMode) {
        this.setupConfigWatcher();
      }

      this.initialized = true;
      this.emit("initialized");
    } catch (error) {
      log.error("Failed to initialize ConfigurationService:", error);
      throw error;
    }
  }

  private async loadAllConfigs(): Promise<void> {
    const configPaths = await this.findConfigFiles();

    for (const configPath of configPaths) {
      try {
        await this.loadConfig(configPath);
      } catch (error) {
        log.error(`Failed to load config from ${configPath}:`, error);
      }
    }

    if (this.configs.size === 0) {
      throw new Error("No valid agent configurations found");
    }
  }

  private async findConfigFiles(): Promise<string[]> {
    const configDir = this.options.configDir || process.cwd();
    const agentsDir = path.join(configDir, "agents");
    const configPaths: string[] = [];

    // Check for agents directory
    try {
      const files = await fs.readdir(agentsDir);
      const agentConfigs = files
        .filter((file) => file.endsWith(".ai.ts"))
        .map((file) => path.join(agentsDir, file));
      configPaths.push(...agentConfigs);
    } catch {
      log.info("No agents directory found, checking root");
    }

    // Check for root config
    try {
      const rootConfig = path.join(configDir, "fatduck.ai.ts");
      const rootExists = await fs
        .access(rootConfig)
        .then(() => true)
        .catch(() => false);

      if (rootExists) {
        configPaths.push(rootConfig);
      }
    } catch {
      log.info("No root config found");
    }

    return configPaths;
  }

  private async loadConfig(configPath: string): Promise<void> {
    try {
      // Clear require cache in watch mode
      if (this.options.watchMode) {
        delete require.cache[require.resolve(configPath)];
      }

      const config = await import(configPath);
      const agentConfig = this.validateConfig(config.default);

      // Extract agent name from file name or config
      const agentName = agentConfig.name || path.basename(configPath, ".ai.ts");

      this.configs.set(agentName, agentConfig);
      log.info(`Loaded configuration for agent: ${agentName}`);

      this.emit("configLoaded", { agentName, configPath });
    } catch (error) {
      log.error(`Error loading config from ${configPath}:`, error);
      throw error;
    }
  }

  private validateConfig(config: any): AgentConfig {
    if (!config) {
      throw new Error("Configuration is empty");
    }

    const requiredFields = ["databaseUrl", "llmConfig", "character"];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    // Validate platform configurations if present
    if (config.platforms) {
      this.validatePlatformConfigs(config.platforms);
    }

    return config as AgentConfig;
  }

  private validatePlatformConfigs(platforms: any): void {
    if (platforms.telegram?.enabled && !platforms.telegram.token) {
      throw new Error("Telegram token is required when telegram is enabled");
    }

    if (platforms.twitter?.enabled && !platforms.twitter.credentials) {
      throw new Error(
        "Twitter credentials are required when twitter is enabled"
      );
    }

    if (platforms.api?.enabled && !platforms.api.port) {
      throw new Error("API port is required when api is enabled");
    }

    if (platforms.p2p?.enabled && !platforms.p2p.privateKey) {
      throw new Error("P2P private key is required when p2p is enabled");
    }
  }

  private setupConfigWatcher(): void {
    const configDir = this.options.configDir || process.cwd();
    const patterns = [
      path.join(configDir, "fatduck.ai.ts"),
      path.join(configDir, "agents", "*.ai.ts"),
    ];

    this.watcher = watch(patterns, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    // Debounce the reload to prevent multiple rapid reloads
    const debouncedReload = debounce(this.handleConfigChange.bind(this), 1000);

    this.watcher.on("change", async (configPath: string) => {
      log.info(`Config file changed: ${configPath}`);
      await debouncedReload(configPath);
    });

    this.watcher.on("unlink", async (configPath: string) => {
      const agentName = path.basename(configPath, ".ai.ts");
      this.configs.delete(agentName);
      this.emit("configRemoved", { agentName, configPath });
    });
  }

  private async handleConfigChange(configPath: string): Promise<void> {
    try {
      const oldConfig = this.getConfigByPath(configPath);
      await this.loadConfig(configPath);

      const agentName = path.basename(configPath, ".ai.ts");
      this.emit("configChanged", {
        agentName,
        configPath,
        type: "updated",
      });
    } catch (error) {
      log.error("Failed to reload configuration:", error);
      throw error;
    }
  }

  private getConfigByPath(configPath: string): AgentConfig | undefined {
    const agentName = path.basename(configPath, ".ai.ts");
    return this.configs.get(agentName);
  }

  // Public API
  public async getConfig(agentName: string): Promise<AgentConfig> {
    if (!this.initialized) {
      throw new Error("ConfigurationService must be initialized first");
    }

    const config = this.configs.get(agentName);
    if (!config) {
      throw new Error(`No configuration found for agent: ${agentName}`);
    }

    return config;
  }

  public async reloadConfig(agentName: string): Promise<void> {
    const config = this.configs.get(agentName);
    if (!config) {
      throw new Error(`No configuration found for agent: ${agentName}`);
    }

    const configPath = await this.findConfigPathByName(agentName);
    await this.loadConfig(configPath);
  }

  private async findConfigPathByName(agentName: string): Promise<string> {
    const configDir = this.options.configDir || process.cwd();
    const possiblePaths = [
      path.join(configDir, `${agentName}.ai.ts`),
      path.join(configDir, "agents", `${agentName}.ai.ts`),
    ];

    for (const configPath of possiblePaths) {
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        continue;
      }
    }

    throw new Error(`Could not find config file for agent: ${agentName}`);
  }

  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.emit("stopped");
  }

  public getLoadedConfigs(): string[] {
    return Array.from(this.configs.keys());
  }
}

// Import at the top
import fs from "fs/promises";
