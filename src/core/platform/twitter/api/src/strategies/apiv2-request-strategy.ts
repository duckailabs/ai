import {
  TwitterApi,
  type Tweetv2FieldsParams,
  type Tweetv2SearchParams,
} from "twitter-api-v2";
import {
  type Profile,
  type SearchOptions,
  type Tweet,
  type TweetOptions,
} from "../interfaces";
import { BaseRequestStrategy, type RequestResponse } from "./request-strategy";

export class APIv2RequestStrategy extends BaseRequestStrategy {
  private client: TwitterApi;
  private readonly defaultFields = {
    expansions: [
      "attachments.poll_ids",
      "attachments.media_keys",
      "author_id",
      "referenced_tweets.id",
      "in_reply_to_user_id",
      "edit_history_tweet_ids",
      "geo.place_id",
      "entities.mentions.username",
      "referenced_tweets.id.author_id",
    ],
    "tweet.fields": [
      "attachments",
      "author_id",
      "conversation_id",
      "created_at",
      "entities",
      "geo",
      "id",
      "in_reply_to_user_id",
      "lang",
      "public_metrics",
      "referenced_tweets",
      "reply_settings",
      "text",
      "withheld",
    ],
    "user.fields": [
      "created_at",
      "description",
      "entities",
      "id",
      "location",
      "name",
      "profile_image_url",
      "protected",
      "public_metrics",
      "url",
      "username",
      "verified",
    ],
    "media.fields": [
      "duration_ms",
      "height",
      "media_key",
      "preview_image_url",
      "type",
      "url",
      "width",
      "public_metrics",
      "alt_text",
    ],
    "poll.fields": [
      "duration_minutes",
      "end_datetime",
      "id",
      "options",
      "voting_status",
    ],
  };

  constructor(client: TwitterApi) {
    super(async () => ({
      authorization: `Bearer ${await client.appLogin()}`,
      "content-type": "application/json",
    }));
    this.client = client;
  }

  async sendTweet(
    text: string,
    options?: TweetOptions
  ): Promise<RequestResponse<Tweet>> {
    const tweet = await this.client.v2.tweet(text, {
      reply: options?.replyToTweet
        ? {
            in_reply_to_tweet_id: options.replyToTweet,
          }
        : undefined,
      quote_tweet_id: options?.quoteTweet,
    });

    return {
      data: this.mapTweetResponse(tweet.data),
    };
  }

  async getTweet(id: string): Promise<RequestResponse<Tweet>> {
    const tweet = await this.client.v2.singleTweet(id, {
      ...(this.defaultFields as Tweetv2FieldsParams),
    });

    return {
      data: this.mapTweetResponse(tweet.data),
    };
  }

  async likeTweet(id: string): Promise<RequestResponse<void>> {
    const user = await this.client.v2.me();
    await this.client.v2.like(user.data.id, id);
    return { data: undefined };
  }

  async retweet(id: string): Promise<RequestResponse<void>> {
    const user = await this.client.v2.me();
    await this.client.v2.retweet(user.data.id, id);
    return { data: undefined };
  }

  async createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<RequestResponse<Tweet>> {
    return this.sendTweet(text, { ...options, quoteTweet: quotedTweetId });
  }

  async followUser(username: string): Promise<RequestResponse<void>> {
    const user = await this.client.v2.me();
    const targetUser = await this.client.v2.userByUsername(username);
    await this.client.v2.follow(user.data.id, targetUser.data.id);
    return { data: undefined };
  }

  async searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<RequestResponse<Tweet[]>> {
    const searchResults = await this.client.v2.search(query, {
      ...(this.defaultFields as Tweetv2SearchParams),
      max_results: options?.maxTweets,
      next_token: options?.cursor,
    });

    return {
      data: searchResults.tweets.map(this.mapTweetResponse),
      meta: {
        nextCursor: searchResults.meta.next_token,
      },
    };
  }

  /* async getMentions(
    options?: MentionOptions
  ): Promise<RequestResponse<Tweet[]>> {
    const user = await this.client.v2.me();
    const mentions = await this.client.v2.userMentionTimeline(user.data.id, {
      ...(this.defaultFields as Tweetv2FieldsParams),
      max_results: options?.count,
      pagination_token: options?.cursor,
    });

    return {
      data: mentions.tweets.map(this.mapTweetResponse),
      meta: {
        nextCursor: mentions.meta.next_token,
      },
    };
  } */

  private async uploadMedia(
    media: Array<{ data: Buffer; type: string }>
  ): Promise<string[]> {
    const mediaIds = [];
    for (const item of media) {
      const mediaId = await this.client.v1.uploadMedia(item.data, {
        mimeType: item.type,
      });
      mediaIds.push(mediaId);
    }
    return mediaIds;
  }

  private mapTweetResponse(tweet: any): Tweet {
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at ? new Date(tweet.created_at) : undefined,
      metrics: tweet.public_metrics
        ? {
            likes: tweet.public_metrics.like_count,
            retweets: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
            views: tweet.public_metrics.impression_count,
            bookmarkCount: tweet.public_metrics.bookmark_count,
          }
        : undefined,
      conversationId: tweet.conversation_id,
      isQuoted: !!tweet.referenced_tweets?.some(
        (ref: any) => ref.type === "quoted"
      ),
      isReply: !!tweet.referenced_tweets?.some(
        (ref: any) => ref.type === "replied_to"
      ),
      isRetweet: !!tweet.referenced_tweets?.some(
        (ref: any) => ref.type === "retweeted"
      ),
      isPin: false,
      sensitiveContent: false,
    };
  }

  async getProfile(username: string): Promise<RequestResponse<Profile>> {
    const user = await this.client.v2.userByUsername(username);
    return { data: this.mapProfileResponse(user.data) };
  }

  private mapProfileResponse(user: any): Profile {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      isPrivate: user.protected,
      isVerified: user.verified,
    };
  }
}
