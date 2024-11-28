import { CookieAuthStrategy } from "./auth/strategies";
import {
  type Profile,
  type SearchOptions,
  type Tweet,
  type TweetOptions,
  type UserTimelineOptions,
} from "./interfaces";
import { GraphQLRequestStrategy } from "./strategies/graphql-request-strategy";

export class TwitterClient {
  private readonly requestStrategy: GraphQLRequestStrategy;

  private constructor(requestStrategy: GraphQLRequestStrategy) {
    this.requestStrategy = requestStrategy;
  }

  static async createWithCookies(cookies: string[]): Promise<TwitterClient> {
    const authStrategy = new CookieAuthStrategy();
    await authStrategy.setCookies(cookies);
    return new TwitterClient(
      new GraphQLRequestStrategy(authStrategy.getHeaders.bind(authStrategy))
    );
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

  async getUserTimeline(
    username: string,
    options?: UserTimelineOptions
  ): Promise<Tweet[]> {
    const response = await this.requestStrategy.getUserTimeline(
      username,
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
}
