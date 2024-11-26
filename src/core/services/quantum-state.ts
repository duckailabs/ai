import { log } from "@/core/utils/logger";
import EventEmitter from "events";
import cron from "node-cron";
import type { QuantumStateManager } from "../managers/quantum";
import type { EventService } from "../services/Event";

export interface StateUpdateConfig {
  enabled: boolean;
  cronSchedule?: string; // Default to hourly
  maxRetries?: number;
  initialDelayMs?: number;
  checkInitialState?: boolean; // Default to true
}

export class StateUpdateService extends EventEmitter {
  private cronJob?: cron.ScheduledTask;
  private retryCount: number = 0;
  private isUpdating: boolean = false;

  constructor(
    private quantumManager: QuantumStateManager,
    private eventService: EventService,
    private config: StateUpdateConfig
  ) {
    super();
    this.config = {
      cronSchedule: "0 * * * *", // Every hour by default
      maxRetries: 0,
      initialDelayMs: 1000,
      checkInitialState: true, // Default to true
      ...config,
    };
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      log.info("State update service disabled, skipping initialization");
      return;
    }

    log.info("Starting state update service...");

    // Check for existing states if enabled
    if (this.config.checkInitialState) {
      try {
        const latestState = await this.quantumManager.getLatestState();
        if (!latestState) {
          log.info(
            "No existing quantum states found, generating initial state..."
          );
          // Immediate generation for first state
          await this.performUpdate();
        } else {
          log.info(
            "Found existing quantum state, continuing with regular schedule"
          );
          // No need to perform immediate update if state exists
        }
      } catch (error) {
        log.error("Error checking initial state:", error);
      }
    }

    // Set up cron job
    this.cronJob = cron.schedule(this.config.cronSchedule!, async () => {
      await this.performUpdate();
    });

    await this.eventService.createInteractionEvent("interaction.started", {
      input: "Quantum state update service started",
      responseType: "text",
      platform: "api",
      timestamp: new Date().toISOString(),
      messageId: `quantum-state-${Date.now()}`,
      user: {
        id: "system",
        username: "system",
      },
    });

    this.emit("started");
  }

  async stop(): Promise<void> {
    log.info("Stopping state update service...");
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    await this.eventService.createInteractionEvent("interaction.completed", {
      input: "Quantum state update service stopped",
      response: "Service stopped successfully",
      responseType: "text",
      platform: "api",
      timestamp: new Date().toISOString(),
      messageId: `quantum-state-${Date.now()}`,
      processingTime: 0,
      user: {
        id: "system",
        username: "system",
      },
    });

    this.emit("stopped");
  }

  private async performUpdate(): Promise<void> {
    if (this.isUpdating) {
      log.warn("Update already in progress, skipping...");
      return;
    }

    this.isUpdating = true;

    try {
      log.info("Generating new quantum state...");

      await this.eventService.createInteractionEvent("interaction.started", {
        input: "Generating new quantum state",
        responseType: "text",
        platform: "api",
        timestamp: new Date().toISOString(),
        messageId: `quantum-state-${Date.now()}`,
        user: {
          id: "system",
          username: "system",
        },
      });

      const newState = await this.quantumManager.generateQuantumState();
      const storedState = await this.quantumManager.storeState(newState);

      await this.eventService.createInteractionEvent("interaction.completed", {
        input: "New quantum state generated and stored",
        response: "State updated successfully",
        responseType: "text",
        platform: "api",
        timestamp: new Date().toISOString(),
        messageId: `quantum-state-${Date.now()}`,
        user: {
          id: "system",
          username: "system",
        },
        processingTime: 0,
      });

      log.info("New quantum state generated and stored successfully");
      this.emit("stateUpdated", storedState);

      // Reset retry count on success
      this.retryCount = 0;
    } catch (error) {
      log.error("Failed to update quantum state:", error);

      await this.eventService.createInteractionEvent("interaction.failed", {
        input: "Failed to update quantum state",
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "quantum-state-update-failed",
        timestamp: new Date().toISOString(),
        messageId: `quantum-state-${Date.now()}`,
        user: {
          id: "system",
          username: "system",
        },
      });

      this.emit("updateError", error);

      if (this.retryCount < (this.config.maxRetries || 0)) {
        this.retryCount++;
        const backoffMs = Math.min(
          1000 * Math.pow(2, this.retryCount),
          3600000 // Max 1 hour
        );
        log.info(`Retrying in ${backoffMs}ms (attempt ${this.retryCount})...`);
        setTimeout(() => this.performUpdate(), backoffMs);
        return;
      }
    } finally {
      this.isUpdating = false;
    }
  }

  // Manual trigger for testing or forced updates
  async triggerUpdate(): Promise<void> {
    await this.performUpdate();
  }
}
