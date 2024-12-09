import { getToken, getTokenMetrics } from "@/agent/ai/tools/token";
import { TwitterClient } from "@/core/platform/twitter/api/src/client";
import type { Tweet } from "@/core/platform/twitter/api/src/interfaces";
import type { Platform } from "@/types";
import { log } from "../utils/logger";

interface PreprocessingResult {
  type: string;
  data: any;
}

interface PreprocessingContext {
  platform: Platform;
  text: string;
  userId?: string;
  username?: string;
  messageId?: string;
}

export class PreprocessingManager {
  constructor(private twitterClient?: TwitterClient) {
    log.info(
      "PreprocessingManager initialized with Twitter client:",
      !!twitterClient
    );
  }

  async process(context: PreprocessingContext): Promise<PreprocessingResult[]> {
    const results: PreprocessingResult[] = [];
    log.info("Processing context:", context);

    const mentionResults = await this.processMentions(context.text);
    if (mentionResults) {
      results.push(...mentionResults);
    }

    return results;
  }

  private async processMentions(
    text: string
  ): Promise<PreprocessingResult[] | null> {
    if (!this.twitterClient) {
      log.info("No Twitter client available");
      return null;
    }

    const mentions = text.match(/[@＠]([a-zA-Z0-9_]+)/g);
    if (!mentions) {
      return null;
    }
    log.info("Processing mentions:", mentions);

    // Remove @ symbol and get unique usernames, also normalize to lowercase
    const usernames = [
      ...new Set(mentions.map((m) => m.slice(1).toLowerCase())),
    ];
    log.info("Processing usernames:", usernames);

    const timelines: Tweet[] = [];

    // Fetch timeline for each mentioned user
    for (const username of usernames) {
      try {
        if (username === "duckunfiltered") continue;
        log.info(`Fetching timeline for @${username}`);
        const userTimeline = await this.twitterClient.getUserTimeline(
          username,
          {
            excludeRetweets: false,
          }
        );
        timelines.push(...userTimeline);
      } catch (error) {
        log.warn(`Failed to fetch timeline for @${username}:`, error);
      }
    }

    // get token metrics for each mentioned user
    const tokenMetrics: Record<string, {}> = {};
    for (const username of usernames) {
      if (username === "duckunfiltered") continue;
      const token = await getToken(username);
      if (token && token.length > 0) {
        const metrics = await getTokenMetrics(token[0].coingeckoId);
        if (metrics) {
          tokenMetrics[username] = metrics;
        }
      }
    }

    if (timelines.length === 0) {
      log.info("No timelines retrieved");
      return null;
    }

    return [
      {
        type: "twitter_profiles",
        data: {
          mentionedUsers: usernames,
          timelines: timelines.map((tweet) => ({
            id: tweet.id,
            text: tweet.text,
            authorUsername: tweet.authorUsername,
            createdAt: tweet.createdAt,
          })),
        },
      },
      {
        type: "token_metrics",
        data: tokenMetrics,
      },
    ];
  }
  formatResults(results: PreprocessingResult[]): string {
    let formattedContent = "";

    for (const result of results) {
      switch (result.type) {
        case "twitter_profiles":
          formattedContent += "\nTwitter Profile Context:\n";
          formattedContent += result.data.timelines
            .map((tweet: any) => `@${tweet.authorUsername}: ${tweet.text}`)
            .join("\n");
          break;
        case "token_metrics":
          formattedContent += "\nToken Metrics:\n";
          formattedContent += JSON.stringify(result.data);
          break;
      }
    }

    return formattedContent;
  }
}
