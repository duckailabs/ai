import { TwitterClient } from "@/core/platform/twitter/api/src/client";
import type { Tweet } from "@/core/platform/twitter/api/src/interfaces";
import { log } from "@/core/utils/logger";
import { dbSchemas } from "@/db";
import { twitterMentions, twitterMentionStatusEnum } from "@/db/schema/schema";
import type { InteractionDefaults } from "@/types";
import { and, eq, gte } from "drizzle-orm";
import cron from "node-cron";
import type { InteractionOptions } from "../../types";

export interface TwitterConfig {
  enabled: boolean;
  cookies: any[];
  username: string;
  checkInterval?: string;
  debug?: {
    checkMentionsOnStartup?: boolean;
  };
  maxTweetsPerCheck?: number;
  rateLimit?: {
    userMaxPerHour?: number;
    globalMaxPerHour?: number;
  };
}

export class TwitterManager {
  private client: TwitterClient;
  private username: string;
  private cronTask?: cron.ScheduledTask;
  private lastCheckedId?: string;
  private ai: any;
  private defaults?: InteractionDefaults;
  private config: TwitterConfig;

  private constructor(
    client: TwitterClient,
    config: TwitterConfig,
    ai: any,
    defaults?: InteractionDefaults
  ) {
    this.client = client;
    this.username = config.username;
    this.ai = ai;
    this.defaults = defaults;
    this.config = config;
  }

  public static async create(
    config: TwitterConfig,
    ai: any,
    defaults?: InteractionDefaults
  ): Promise<TwitterManager> {
    const client = await TwitterClient.createWithCookies(config.cookies);
    return new TwitterManager(client, config, ai, defaults);
  }

  async initialize() {
    try {
      this.client = await TwitterClient.createWithCookies(this.config.cookies);
      log.info("Twitter client initialized successfully!");
    } catch (error) {
      log.error("Failed to initialize Twitter client:", error);
      throw error;
    }
  }

  async start(checkInterval: string = "*/5 * * * *") {
    if (this.config.debug?.checkMentionsOnStartup) {
      log.info("Debug mode: Running initial mention check...");
      await this.checkMentions();
    }

    if (this.cronTask) {
      log.warn("Twitter watcher already running");
      return;
    }

    this.cronTask = cron.schedule(checkInterval, () => {
      this.checkMentions().catch((error) => {
        log.error("Error in Twitter mention check:", error);
      });
    });

    log.info("Twitter mention watcher started with schedule:", checkInterval);
  }

  async stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      log.info("Twitter mention watcher stopped");
    }
  }

  private async shouldRespond(tweet: Tweet): Promise<{
    shouldRespond: boolean;
    reason: string;
  }> {
    try {
      // Check if we've already processed this tweet
      const existingMention = await this.ai.db
        .select()
        .from(twitterMentions)
        .where(eq(twitterMentions.tweetId, tweet.id))
        .limit(1);

      if (existingMention.length > 0) {
        return { shouldRespond: false, reason: "already_processed" };
      }

      // Don't respond to our own tweets
      log.info(`Checking if tweet ${tweet.id} is from ${this.username}`);
      if (tweet.authorUsername?.toLowerCase() === this.username.toLowerCase()) {
        return { shouldRespond: false, reason: "self_tweet" };
      }

      // Check how many times we've responded in this conversation
      if (tweet.conversationId) {
        const conversationResponses = await this.ai.db
          .select()
          .from(twitterMentions)
          .where(and(eq(twitterMentions.conversationId, tweet.conversationId)));
        log.info(`Conversation responses:`, conversationResponses.length);
        // Limit to 1 response per conversation
        if (conversationResponses.length >= 1) {
          return { shouldRespond: false, reason: "conversation_limit_reached" };
        }
      }

      // Check social relations for blocked status
      const [relation] = await this.ai.db
        .select()
        .from(dbSchemas.socialRelations)
        .where(
          and(
            eq(dbSchemas.socialRelations.characterId, this.ai.character.id),
            eq(dbSchemas.socialRelations.userId, tweet.authorId)
          )
        );

      if (relation?.status === "blocked") {
        return { shouldRespond: false, reason: "user_blocked" };
      }

      // Check rate limits
      if (this.config.rateLimit) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Check user-specific rate limit
        const userResponses = await this.ai.db
          .select()
          .from(twitterMentions)
          .where(
            and(
              eq(twitterMentions.authorId, tweet.authorId),
              eq(twitterMentions.status, "processed"),
              gte(twitterMentions.processedAt, hourAgo)
            )
          );

        if (
          userResponses.length >= (this.config.rateLimit.userMaxPerHour || 5)
        ) {
          return { shouldRespond: false, reason: "user_rate_limited" };
        }

        // Check global rate limit
        const globalResponses = await this.ai.db
          .select()
          .from(twitterMentions)
          .where(
            and(
              eq(twitterMentions.status, "processed"),
              gte(twitterMentions.processedAt, hourAgo)
            )
          );

        if (
          globalResponses.length >=
          (this.config.rateLimit.globalMaxPerHour || 30)
        ) {
          return { shouldRespond: false, reason: "global_rate_limited" };
        }
      }

      return { shouldRespond: true, reason: "ok" };
    } catch (error) {
      log.error("Error in shouldRespond:", error);
      return { shouldRespond: false, reason: "error_checking" };
    }
  }

  private async recordMention(
    tweet: Tweet,
    status: (typeof twitterMentionStatusEnum.enumValues)[number],
    skipReason?: string,
    responseTweetId?: string
  ) {
    try {
      await this.ai.db
        .insert(twitterMentions)
        .values({
          tweetId: tweet.id,
          authorId: tweet.authorId,
          authorUsername: tweet.authorUsername || "",
          characterId: this.ai.character.id,
          createdAt: tweet.createdAt || new Date(),
          processedAt: new Date(),
          status,
          skipReason,
          responseTweetId,
          isReply: tweet.isReply,
          isRetweet: tweet.isRetweet,
          conversationId: tweet.conversationId,
          metrics: tweet.metrics,
        })
        .onConflictDoUpdate({
          target: [twitterMentions.tweetId],
          set: {
            status,
            skipReason,
            responseTweetId,
          },
        });
    } catch (error) {
      log.error("Failed to record mention:", error);
    }
  }

  getClient() {
    return this.client;
  }

  private async handleMention(tweet: Tweet) {
    const correlationId = `twitter-${tweet.id}-${Date.now()}`;

    try {
      log.info(`Handling mention for tweet ${tweet.id}`, {
        ...tweet,
      });
      // Check if we should respond
      const { shouldRespond, reason } = await this.shouldRespond(tweet);
      log.info(`Should respond: ${shouldRespond}, reason: ${reason}`);

      if (!shouldRespond) {
        await this.recordMention(tweet, "skipped", reason);
        await this.ai.eventService.createInteractionEvent(
          "interaction.cancelled",
          {
            platform: "twitter",
            tweetId: tweet.id,
            reason,
            metadata: {
              userId: tweet.authorId,
              correlationId,
            },
          }
        );
        return;
      }

      // Record start of processing
      await this.recordMention(tweet, "pending");
      await this.ai.eventService.createInteractionEvent("interaction.started", {
        platform: "twitter",
        tweetId: tweet.id,
        tweetText: tweet.text,
        metadata: {
          userId: tweet.authorId,
          correlationId,
        },
      });
      const options: InteractionOptions = {
        userId: tweet.authorId,
        username: tweet.authorUsername,
        platform: "twitter",
        chatId: tweet.conversationId || tweet.id,
        characterId: this.ai.character.id,
        messageId: tweet.id,
        responseType: "tweet_reply",
        injections: {
          injectStyle: true,
          injectPersonality: true,
          customInjections: [],
        },
      };

      // Structure input with system and user messages
      const input = {
        system:
          "You are responding to a tweet. Consider the timeline context provided and maintain the character's Twitter persona. Ensure responses are concise and engaging.",
        user: "Hey @duckunfiltered, can you explain why Hypertensor, a decentralized AI platform is better than OpenAI, a centralized and oligarchy controlled AI company?",
      };

      // Use ai.interact() instead of direct LLM call
      const response = await this.ai.interact(input, options);
      await this.ai.eventService.createInteractionEvent(
        "interaction.processed",
        {
          platform: "twitter",
          tweetId: tweet.id,
          response,
          metadata: {
            userId: tweet.authorId,
            correlationId,
          },
        }
      );

      if (response) {
        /* const responseTweet = await this.client.sendTweet(response, {
          replyToTweet: tweet.id,
        }); */
        log.message(`Replying to tweet ${tweet.id} with response:`, {
          response: response.content,
        });

        // Update mention record
        /* await this.recordMention(
          tweet,
          "processed",
          undefined,
          responseTweet.id
        );

        // Record successful completion
        await this.ai.eventService.createInteractionEvent(
          "interaction.completed",
          {
            platform: "twitter",
            tweetId: tweet.id,
            responseTweetId: responseTweet.id,
            response,
            metadata: {
              userId: tweet.authorId,
              correlationId,
            },
          }
        ); */
      }
    } catch (error) {
      log.error(`Error handling mention for tweet ${tweet.id}:`, error);

      await this.recordMention(tweet, "failed", (error as Error).message);
      await this.ai.eventService.createInteractionEvent("interaction.failed", {
        platform: "twitter",
        tweetId: tweet.id,
        error: (error as Error).message,
        metadata: {
          userId: tweet.authorId,
          correlationId,
        },
      });
    }
  }

  async checkMentions() {
    try {
      const query = `to:@${this.username} OR @${this.username} OR $duckai`;
      const { tweets } = await this.client.searchTweets(query, {
        maxTweets: this.config.maxTweetsPerCheck || 10,
        searchMode: "Latest",
      });
      log.info(`Found ${tweets.length} tweets`);
      if (tweets.length === 0) return;

      // Process tweets in chronological order (oldest first)
      const sortedTweets = tweets.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      );

      let newLastCheckedId = this.lastCheckedId;
      for (const tweet of sortedTweets) {
        // Skip if we've already processed this tweet
        log.info(`Checking tweet ${tweet.id}`);
        if (this.lastCheckedId && tweet.id <= this.lastCheckedId) {
          continue;
        }
        log.info(`Processing tweet ${tweet.id}`);
        await this.handleMention(tweet);

        // Update the new last checked ID to be the highest ID we've seen
        if (!newLastCheckedId || tweet.id > newLastCheckedId) {
          newLastCheckedId = tweet.id;
        }
      }

      // Only update lastCheckedId after processing all tweets
      this.lastCheckedId = newLastCheckedId;
    } catch (error) {
      log.error("Error in checkMentions:", error);
      await this.ai.eventService.createInteractionEvent("interaction.failed", {
        platform: "twitter",
        error: (error as Error).message,
        metadata: {
          source: "checkMentions",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
