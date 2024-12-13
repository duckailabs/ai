import { Command } from "commander";
import { AIFactory } from "../AIFactory";
import { ConfigLoader } from "../init/loader";
import { log } from "../utils/logger";
import { ConfigWatcher } from "./watcher";

const isBun = typeof Bun !== "undefined";

const program = new Command();

program.name("fatduck").description("CLI to manage AI agents").version("1.0.0");

program
  .command("dev")
  .description("Start all configured agents in development mode")
  .option("-a, --agent <name>", "Start specific agent")
  .option("--no-reload", "Disable hot reloading")
  .action(async (options) => {
    let watcher: ConfigWatcher | null = null;

    try {
      const configLoader = ConfigLoader.getInstance();
      const configs = await configLoader.loadConfigs();

      // Start agents
      if (options.agent) {
        const config = configs.get(options.agent);
        if (!config) {
          throw new Error(`Agent ${options.agent} not found`);
        }
        const agent = await AIFactory.getInstance(options.agent);
        log.info(`Started agent: ${options.agent}`);
      } else {
        for (const [name, _] of configs) {
          const agent = await AIFactory.getInstance(name);
          log.info(`Started agent: ${name}`);
        }
      }

      // Setup hot reloading if enabled
      if (options.reload) {
        watcher = new ConfigWatcher();
        log.info("Hot reloading enabled - watching for config changes");
      }

      // Keep process alive
      if (isBun) {
        await new Promise(() => {});
      } else {
        process.stdin.resume();
      }

      // Handle shutdown
      const cleanup = async () => {
        log.info("Shutting down agents...");
        if (watcher) {
          await watcher.stop();
        }
        for (const [name, agent] of AIFactory["instances"]) {
          await agent.stop();
          log.info(`Stopped agent: ${name}`);
        }
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    } catch (error) {
      log.error("Failed to start agents:", error);
      process.exit(1);
    }
  });

program.parse();
