import { watch } from "chokidar";
import { EventEmitter } from "events";
import { debounce } from "lodash";
import path from "path";
import { ConfigLoader } from "../core/init/loader";
import { log } from "../core/utils/logger";

export declare interface ConfigWatcher {
  on(event: "configChanged", listener: (agentName: string) => void): this;
  emit(event: "configChanged", agentName: string): boolean;
}

export class ConfigWatcher extends EventEmitter {
  private watcher: any;
  private configLoader: ConfigLoader;

  constructor() {
    super();
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

      // Notify listeners of configuration change
      this.emit("configChanged", agentName);

      log.info(`Configuration change detected for agent: ${agentName}`);
    } catch (error) {
      log.error("Failed to handle configuration change:", error);
    }
  }

  public async stop() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }
}
