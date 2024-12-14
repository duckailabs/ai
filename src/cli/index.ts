import { Command } from "commander";
import { AIFactory } from "../core/AIFactory";
import { ConfigLoader } from "../core/init/loader";
import { log } from "../core/utils/logger";
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
    const factory = AIFactory.getInstance();

    try {
      // Initialize factory first
      await factory.initialize();

      const configLoader = ConfigLoader.getInstance();
      const configs = await configLoader.loadConfigs();

      // Start agents
      if (options.agent) {
        const config = configs.get(options.agent);
        if (!config) {
          throw new Error(`Agent ${options.agent} not found`);
        }
        await factory.createAgent(options.agent);
        log.info(`Started agent: ${options.agent}`);
      } else {
        for (const [name, _] of configs) {
          await factory.createAgent(name);
          log.info(`Started agent: ${name}`);
        }
      }

      // Setup hot reloading if enabled
      if (options.reload) {
        watcher = new ConfigWatcher();
        watcher.on("configChanged", async (agentName: string) => {
          try {
            await factory.reloadAgent(agentName);
            log.info(`Reloaded agent: ${agentName}`);
          } catch (error) {
            log.error(`Failed to reload agent ${agentName}:`, error);
          }
        });
        log.info("Hot reloading enabled - watching for config changes");
      }

      // Setup status reporting
      const reportStatus = () => {
        const agents = factory.getRunningAgents();
        const status = agents.map((name) => {
          const platforms = factory.getPlatformManager(name);
          return {
            name,
            platformStatus: platforms?.getAllPlatformStatus(),
          };
        });
        log.info("Agent Status:", status);
      };

      // Report initial status
      reportStatus();
      setInterval(reportStatus, 60000); // Report status every minute

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
        await factory.stopAllAgents();
        process.exit(0);
      };

      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
    } catch (error) {
      log.error("Failed to start agents:", error);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all running agents and their status")
  .action(() => {
    const factory = AIFactory.getInstance();
    const agents = factory.getRunningAgents();

    if (agents.length === 0) {
      log.info("No agents running");
      return;
    }

    agents.forEach((name) => {
      const core = factory.getAgent(name);
      const platforms = factory.getPlatformManager(name);

      log.info(`Agent: ${name}`);
      log.info("Core Status:", core?.getServiceStatus());
      log.info("Platform Status:", platforms?.getAllPlatformStatus());
    });
  });

program
  .command("stop")
  .description("Stop one or all agents")
  .option("-a, --agent <name>", "Stop specific agent")
  .action(async (options) => {
    const factory = AIFactory.getInstance();

    try {
      if (options.agent) {
        await factory.stopAgent(options.agent);
        log.info(`Stopped agent: ${options.agent}`);
      } else {
        await factory.stopAllAgents();
        log.info("All agents stopped");
      }
      process.exit(0);
    } catch (error) {
      log.error("Failed to stop agents:", error);
      process.exit(1);
    }
  });

program
  .command("reload")
  .description("Reload one or all agents")
  .option("-a, --agent <name>", "Reload specific agent")
  .action(async (options) => {
    const factory = AIFactory.getInstance();

    try {
      if (options.agent) {
        await factory.reloadAgent(options.agent);
        log.info(`Reloaded agent: ${options.agent}`);
      } else {
        const agents = factory.getRunningAgents();
        for (const name of agents) {
          await factory.reloadAgent(name);
          log.info(`Reloaded agent: ${name}`);
        }
      }
    } catch (error) {
      log.error("Failed to reload agents:", error);
      process.exit(1);
    }
  });

program.parse();
