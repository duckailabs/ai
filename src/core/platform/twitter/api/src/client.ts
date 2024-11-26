import { TwitterApi } from "twitter-api-v2";
import { CookieAuthStrategy } from "./auth/strategies";
import {
  type APIv2Credentials,
  type Profile,
  type SearchOptions,
  type Tweet,
  type TweetOptions,
} from "./interfaces";
import { APIv2RequestStrategy } from "./strategies/apiv2-request-strategy";
import { GraphQLRequestStrategy } from "./strategies/graphql-request-strategy";

export class TwitterClient {
  private readonly requestStrategy:
    | GraphQLRequestStrategy
    | APIv2RequestStrategy;

  private constructor(
    requestStrategy: GraphQLRequestStrategy | APIv2RequestStrategy
  ) {
    this.requestStrategy = requestStrategy;
  }

  static async createWithCookies(cookies: string[]): Promise<TwitterClient> {
    const authStrategy = new CookieAuthStrategy();
    await authStrategy.setCookies(cookies);
    return new TwitterClient(
      new GraphQLRequestStrategy(authStrategy.getHeaders.bind(authStrategy))
    );
  }

  static createWithAPIv2(credentials: APIv2Credentials): TwitterClient {
    const client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
    return new TwitterClient(new APIv2RequestStrategy(client));
  }

  async sendTweet(text: string, options?: TweetOptions): Promise<Tweet> {
    const response = await this.requestStrategy.sendTweet(text, options);
    return response.data;
  }

  async getTweet(id: string): Promise<Tweet> {
    const response = await this.requestStrategy.getTweet(id);
    return response.data;
  }

  async likeTweet(id: string): Promise<void> {
    await this.requestStrategy.likeTweet(id);
  }

  async retweet(id: string): Promise<void> {
    await this.requestStrategy.retweet(id);
  }

  async getProfile(username: string): Promise<Profile> {
    const response = await this.requestStrategy.getProfile(username);
    return response.data;
  }

  async createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<Tweet> {
    const response = await this.requestStrategy.createQuoteTweet(
      text,
      quotedTweetId,
      options
    );
    return response.data;
  }

  async followUser(username: string): Promise<void> {
    await this.requestStrategy.followUser(username);
  }

  async searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
    const response = await this.requestStrategy.searchTweets(query, options);
    return {
      tweets: response.data,
      nextCursor: response.meta?.nextCursor,
    };
  }

  /*  async getMentions(
    options?: MentionOptions
  ): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
    const response = await this.requestStrategy.getMentions(options);
    return {
      tweets: response.data,
      nextCursor: response.meta?.nextCursor,
    };
  } */
}

export class TwitterClientFactory {
  static async createWithCookies(cookies: string[]): Promise<TwitterClient> {
    return TwitterClient.createWithCookies(cookies);
  }

  static createWithAPIv2(credentials: APIv2Credentials): TwitterClient {
    return TwitterClient.createWithAPIv2(credentials);
  }
}
