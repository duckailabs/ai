import fs from "fs/promises";
import path from "path";
import { log } from "../utils/logger";
import { defaultConfig } from "./defaults";
import type { AgentConfig } from "./types";

export class ConfigLoader {
  private static instance: ConfigLoader;
  private configs: Map<string, AgentConfig> = new Map();

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private async findAgentConfigs(): Promise<string[]> {
    const cwd = process.cwd();
    const agentsDir = path.join(cwd, "agents");
    const configPaths: string[] = [];

    // Check for agents directory
    try {
      await fs.access(agentsDir);
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
      const rootConfig = path.join(cwd, "fatduck.ai.ts");
      await fs.access(rootConfig);
      configPaths.push(rootConfig);
    } catch {
      log.info("No root config found");
    }

    if (configPaths.length === 0) {
      log.warn("No agent configurations found");
    }

    return configPaths;
  }

  public async loadConfigs(): Promise<Map<string, AgentConfig>> {
    const configPaths = await this.findAgentConfigs();

    for (const configPath of configPaths) {
      try {
        // Use dynamic import for TypeScript/JavaScript configs
        const userConfig = await import(configPath);
        const config = {
          ...defaultConfig,
          ...userConfig.default,
        };

        this.validateConfig(config);
        this.configs.set(config.name, config);
        log.info(`Loaded configuration for agent: ${config.name}`);
      } catch (error) {
        log.error(`Failed to load config from ${configPath}:`, error);
      }
    }

    if (this.configs.size === 0) {
      throw new Error("No valid agent configurations found");
    }

    return this.configs;
  }

  private validateConfig(config: AgentConfig): void {
    if (!config.name) {
      throw new Error("Agent configuration must include a name");
    }

    const requiredFields = ["databaseUrl", "llmConfig", "character"] as const;
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(
          `Missing required configuration field: ${field} for agent ${config.name}`
        );
      }
    }
  }

  public async getConfig(agentName: string): Promise<AgentConfig> {
    if (!this.configs.has(agentName)) {
      await this.loadConfigs();
    }

    const config = this.configs.get(agentName);
    if (!config) {
      throw new Error(`No configuration found for agent: ${agentName}`);
    }

    return config;
  }
}
