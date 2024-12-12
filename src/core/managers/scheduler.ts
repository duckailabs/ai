import type { Platform, ResponseType, StyleSettings } from "@/types";
import { PromptBuilder } from "@fatduckai/prompt-utils";
import cron from "node-cron";
import type EchoChambersClient from "../platform/echochambers";
import type { TwitterClient } from "../platform/twitter/api/src/client";
import type { EventService } from "../services/Event";
import { log } from "../utils/logger";
import type { CharacterManager } from "./character";
import type { LLMManager } from "./llm";
import type { StyleManager } from "./style";
import type { ToolManager } from "./tools";

export interface ScheduledPostConfig {
  type: string;
  schedule: string;
  enabled: boolean;
  prompt: string;
  tools: string[];
  withImage?: boolean;
  test?: boolean;
  deliverOption?: "twitter" | "echochambers";
  toolParams?: Record<string, unknown>;
  promptConfig?: {
    includeCharacterSettings?: {
      tone?: boolean;
      personality?: boolean;
      guidelines?: boolean;
      bio?: boolean;
    };
    style?: {
      platform?: Platform;
      responseType?: ResponseType;
      includeDefaultStyles?: boolean;
    };
    additionalContext?: Record<string, any>;
  };
}

interface ScheduledPostResult {
  text: string;
  media?: Buffer[];
  error?: boolean;
}

export type ScheduledPostHandler = (
  data?: Record<string, unknown>
) => Promise<ScheduledPostResult>;

type HandleScheduledPostResult = {
  success: boolean;
  error?: string;
};

export class ScheduledPostManager {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private postCounts: Map<string, number> = new Map();
  private lastResetDate: Date = new Date();

  constructor(
    private eventService: EventService,
    private toolManager: ToolManager,
    private characterManager: CharacterManager,
    private llmManager: LLMManager,
    private styleManager: StyleManager,
    private twitterClient?: TwitterClient,
    private echoChambersClient?: EchoChambersClient
  ) {
    this.resetDailyCounts();
  }

  async schedulePost(config: ScheduledPostConfig): Promise<boolean> {
    const existingJob = this.cronJobs.get(config.type);
    if (existingJob) {
      existingJob.stop();
    }

    if (config.test) {
      await this.handleScheduledPost(config);
      return true;
    }

    const job = cron.schedule(config.schedule, async () => {
      try {
        log.info(`Running scheduled post: ${config.type}`);
        await this.handleScheduledPost(config);
      } catch (error) {
        log.error(`Error in scheduled post (${config.type}):`, error);
      }
    });

    this.cronJobs.set(config.type, job);
    log.info(`Scheduled post configured for type: ${config.type}`);
    return true;
  }

  private async handleScheduledPost(
    config: ScheduledPostConfig
  ): Promise<HandleScheduledPostResult> {
    log.info(`Handling scheduled post: ${config.type}`);
    const correlationId = `scheduled-${config.type}-${Date.now()}`;

    try {
      // Get character for prompts
      const character = await this.characterManager.getCharacter();
      if (!character) {
        throw new Error(`Character Error in scheduled post`);
      }

      // Get prompt template from character config
      const promptConfig = character.prompts?.[config.type];
      if (!promptConfig || !promptConfig.system) {
        throw new Error(
          `No valid prompt config found for post type: ${config.type}`
        );
      }

      // Get style settings if configured
      let styleSettings: StyleSettings | undefined;
      if (config.promptConfig?.style && character) {
        const { platform, responseType } = config.promptConfig.style;
        if (platform && responseType) {
          styleSettings = await this.styleManager.getStyleSettings(
            character.responseStyles,
            platform,
            responseType
          );
        }
      }

      // Execute tools and process results
      const toolResults = await this.toolManager.executeTools(
        config.tools,
        config.toolParams
      );

      const processedToolResults = Object.entries(toolResults).reduce(
        (acc, [key, value]) => {
          if (value?.data) {
            acc[key] = value.data;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      // Get character settings
      const characterSettings =
        await this.llmManager.mergeWithCharacterSettingsV2();

      // Create context with formatted character settings
      const contextData: Record<string, any> = {
        ...processedToolResults,
      };

      // Add character settings if requested
      if (config.promptConfig?.includeCharacterSettings) {
        const settings = config.promptConfig.includeCharacterSettings;

        if (settings.tone && characterSettings?.tone) {
          contextData.tone = characterSettings.tone.join(", ");
        }
        if (settings.personality && characterSettings?.personality) {
          contextData.personality = characterSettings.personality.join(", ");
        }
        if (settings.guidelines && characterSettings?.guidelines) {
          contextData.guidelines = characterSettings.guidelines.join("\n- ");
        }
        if (settings.bio && character.bio) {
          contextData.bio = character.bio;
        }
      }

      // Add style settings if available
      if (styleSettings) {
        if (styleSettings.tone?.length) {
          contextData.styleTone = styleSettings.tone.join(", ");
        }
        if (styleSettings.guidelines?.length) {
          contextData.styleGuidelines = styleSettings.guidelines.join("\n- ");
        }
        if (styleSettings.formatting) {
          contextData.formatting = styleSettings.formatting;
        }
      }

      // Add any additional context
      if (config.promptConfig?.additionalContext) {
        Object.assign(contextData, config.promptConfig.additionalContext);
      }

      const prompt = new PromptBuilder({
        system: promptConfig.system,
      })
        .withContext(contextData)
        .build();

      //log.info(`Prompt: ${JSON.stringify(prompt, null, 2)}`);
      const response = await this.llmManager.generatePrompt(prompt);

      if (!response) {
        throw new Error(`No response from LLM for post type: ${config.type}`);
      }

      // testing only
      log.info(`Deliver option: ${this.echoChambersClient} `);
      if (
        config.test &&
        config.deliverOption === "echochambers" &&
        this.echoChambersClient
      ) {
        log.info(`Sending message to echo chambers: ${response}`);
        await this.echoChambersClient.sendMessage(response);
        return { success: true };
      }

      if (config.test) {
        log.info("Test mode enabled, skipping Twitter post");
        log.info(`Post content: ${response}`);
      } else if (config.deliverOption === "twitter" && this.twitterClient) {
        // Implement actual posting logic
      } else if (
        config.deliverOption === "echochambers" &&
        this.echoChambersClient
      ) {
        log.info(`Sending message to echo chambers: ${response}`);
        await this.echoChambersClient.sendMessage(response);
      }

      this.incrementPostCount(config.type);

      await this.eventService.createInteractionEvent("interaction.completed", {
        input: config.type,
        response: response,
        responseType: config.type,
        platform: "twitter",
        processingTime: 0,
        timestamp: new Date().toISOString(),
        messageId: "",
        replyTo: "",
        user: {
          id: "",
          metadata: { correlationId },
        },
      });

      return { success: true };
    } catch (error) {
      await this.eventService.createInteractionEvent("interaction.failed", {
        input: config.type,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        messageId: "",
        user: {
          id: "",
          metadata: { correlationId },
        },
      });
      return {
        success: false,
        error: `${config.type} error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async unschedulePost(type: string): Promise<boolean> {
    const job = this.cronJobs.get(type);
    if (job) {
      job.stop();
      this.cronJobs.delete(type);
      log.info(`Unscheduled post type: ${type}`);
      return true;
    }
    return false;
  }

  getScheduledPosts(): string[] {
    return Array.from(this.cronJobs.keys());
  }

  async stop() {
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
    log.info("Scheduled post manager stopped");
  }

  private incrementPostCount(type: string) {
    const currentCount = this.postCounts.get(type) || 0;
    this.postCounts.set(type, currentCount + 1);
  }

  private resetDailyCounts() {
    setInterval(() => {
      const now = new Date();
      if (now.getDate() !== this.lastResetDate.getDate()) {
        this.postCounts.clear();
        this.lastResetDate = now;
      }
    }, 60 * 60 * 1000);
  }
}
