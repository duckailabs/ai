import cron from "node-cron";
import fetch from "node-fetch";
import { type ai } from "../ai";
import type { TwitterClient } from "../platform/twitter/api/src/client";
import { log } from "../utils/logger";

export interface ScheduledPostConfig {
  type: "image" | "market_update" | "daily_alpha";
  schedule: string;
  enabled: boolean;
  maxPerDay?: number;
}

interface TimelineTweet {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: string;
}

interface TimelineContext {
  recentTweets: TimelineTweet[];
  tokenMetrics?: Record<string, any>;
}

export class ScheduledPostManager {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private postCounts: Map<string, number> = new Map();
  private lastResetDate: Date = new Date();

  constructor(
    private ai: ai,
    private configs: ScheduledPostConfig[],
    private twitterClient?: TwitterClient,
    private debug?: boolean,
    private runOnStartup?: boolean
  ) {
    this.resetDailyCounts();
    log.info(
      "ScheduledPostManager initialized with Twitter client:",
      !!twitterClient
    );
  }

  async start() {
    // Debug mode - run once immediately
    if (this.runOnStartup) {
      log.info("Debug mode: Running immediate scheduled posts...");
      for (const config of this.configs) {
        if (config.enabled) {
          try {
            await this.handleScheduledPost(config);
          } catch (error) {
            log.error(`Error in debug scheduled post (${config.type}):`, error);
          }
        }
      }
      return;
    }

    // Normal cron mode
    for (const config of this.configs) {
      if (!config.enabled) continue;
      const job = cron.schedule(config.schedule, async () => {
        try {
          await this.handleScheduledPost(config);
        } catch (error) {
          log.error(`Error in scheduled post (${config.type}):`, error);
        }
      });
      this.cronJobs.set(config.type, job);
      log.info(`Scheduled post manager started for type: ${config.type}`);
    }
  }

  async stop() {
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();
    log.info("Scheduled post manager stopped");
  }

  private async handleScheduledPost(config: ScheduledPostConfig) {
    const correlationId = `scheduled-${config.type}-${Date.now()}`;

    // Check daily limit
    if (this.checkDailyLimit(config)) {
      log.warn(`Daily limit reached for ${config.type}`);
      return;
    }

    try {
      switch (config.type) {
        case "image":
          await this.handleImagePost(correlationId);
          break;
        // Add other types here as needed
        default:
          throw new Error(`Unsupported post type: ${config.type}`);
      }

      this.incrementPostCount(config.type);
    } catch (error) {
      log.error(`Failed to handle scheduled post (${config.type}):`, error);
      await this.ai.eventService.createInteractionEvent("interaction.failed", {
        input: config.type,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        messageId: "",
        user: {
          id: "",
          metadata: { correlationId },
        },
      });
    }
  }

  private async analyzeTimeline(): Promise<TimelineContext | null> {
    if (!this.twitterClient) {
      return null;
    }

    try {
      // Fetch 0xglu's recent timeline
      const timeline = await this.twitterClient.getUserTimeline("0xglu", {
        excludeRetweets: false,
      });

      // Get token details
      let tokenMetrics = {};
      return {
        recentTweets: timeline.map((tweet) => ({
          id: tweet.id,
          text: tweet.text,
          authorUsername: tweet.authorUsername || "",
          createdAt: tweet.createdAt?.toISOString() || "",
        })),
        tokenMetrics,
      };
    } catch (error) {
      log.error("Error analyzing timeline:", error);
      return null;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // Fetch the image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    // Get the image data as a buffer and return it directly
    return await response.buffer();
  }

  private async handleImagePost(correlationId: string) {
    try {
      // Get timeline context before generating content
      const timelineContext = await this.analyzeTimeline();

      // Generate image post content with timeline context
      const { imageUrl, tweetText } =
        await this.ai.llmManager.generateScheduledImagePost({
          timelineContext: timelineContext || undefined,
        });

      // Track content generation
      await this.ai.eventService.createInteractionEvent("interaction.started", {
        input: tweetText,
        responseType: "image",
        platform: "twitter",
        timestamp: new Date().toISOString(),
        messageId: "",
        replyTo: "",
        hasMention: false,
        imageGeneration: {
          url: imageUrl,
        },
        user: {
          id: "",
          metadata: { correlationId },
        },
      });

      // Post to Twitter
      if (this.debug) {
        log.info("Debug mode enabled, skipping Twitter post");
        log.info("Tweet text:", tweetText);
        log.info("Image URL:", imageUrl);
        return;
      }

      if (this.twitterClient) {
        const imageBuffer = await this.downloadImage(imageUrl);

        const tweet = await this.twitterClient.sendTweet(tweetText, {
          media: [
            {
              data: imageBuffer,
              type: "image/jpeg",
            },
          ],
        });

        await this.ai.eventService.createInteractionEvent(
          "interaction.completed",
          {
            input: tweetText,
            response: tweet.id,
            responseType: "image",
            platform: "twitter",
            processingTime: 0,
            timestamp: new Date().toISOString(),
            messageId: "",
            replyTo: "",
            imageGeneration: {
              url: imageUrl,
            },
            user: {
              id: "",
              metadata: { correlationId },
            },
          }
        );
      }
    } catch (error) {
      await this.ai.eventService.createInteractionEvent("interaction.failed", {
        input: "",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        messageId: "",
        user: {
          id: "",
          metadata: { correlationId },
        },
      });
      throw error;
    }
  }

  private checkDailyLimit(config: ScheduledPostConfig): boolean {
    if (!config.maxPerDay) return false;
    const currentCount = this.postCounts.get(config.type) || 0;
    return currentCount >= config.maxPerDay;
  }

  private incrementPostCount(type: string) {
    const currentCount = this.postCounts.get(type) || 0;
    this.postCounts.set(type, currentCount + 1);
  }

  private resetDailyCounts() {
    // Reset counts daily
    setInterval(() => {
      const now = new Date();
      if (now.getDate() !== this.lastResetDate.getDate()) {
        this.postCounts.clear();
        this.lastResetDate = now;
      }
    }, 60 * 60 * 1000); // Check hourly
  }
}
