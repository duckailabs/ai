import { watch } from "chokidar";
import { debounce } from "lodash";
import path from "path";
import { AIFactory } from "../AIFactory";
import { ConfigLoader } from "../init/loader";
import { log } from "../utils/logger";

export class ConfigWatcher {
  private watcher: any;
  private configLoader: ConfigLoader;

  constructor() {
    this.configLoader = ConfigLoader.getInstance();
    this.setupWatcher();
  }

  private setupWatcher() {
    const cwd = process.cwd();
    const patterns = [
      path.join(cwd, "fatduck.ai.ts"),
      path.join(cwd, "agents", "*.ai.ts"),
    ];

    this.watcher = watch(patterns, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    // Debounce the reload to prevent multiple rapid reloads
    const debouncedReload = debounce(this.handleConfigChange.bind(this), 1000);

    this.watcher.on("change", async (path: string) => {
      log.info(`Config file changed: ${path}`);
      await debouncedReload(path);
    });
  }

  private async handleConfigChange(configPath: string) {
    try {
      log.info("Reloading configuration...");

      // Clear require cache for the config file
      delete require.cache[require.resolve(configPath)];

      // Get agent name from file path
      const fileName = path.basename(configPath);
      const agentName =
        fileName === "fatduck.ai.ts"
          ? "fatduck"
          : fileName.replace(".ai.ts", "");

      // Stop the existing agent
      const existingAgent = AIFactory["instances"].get(agentName);
      if (existingAgent) {
        await existingAgent.stop();
        AIFactory["instances"].delete(agentName);
      }

      // Reload config and restart agent
      await this.configLoader.loadConfigs();
      const agent = await AIFactory.getInstance(agentName);

      log.info(`Successfully reloaded agent: ${agentName}`);
    } catch (error) {
      log.error("Failed to reload configuration:", error);
    }
  }

  public async stop() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }
}
