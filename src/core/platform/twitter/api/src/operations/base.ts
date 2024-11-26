import {
  type ITwitterOperations,
  type Profile,
  type SearchOptions,
  type Tweet,
  type TweetOptions,
  type TwitterAuthStrategy,
} from "../interfaces";

export abstract class BaseOperations implements ITwitterOperations {
  constructor(protected auth: TwitterAuthStrategy) {}

  abstract sendTweet(text: string, options?: TweetOptions): Promise<Tweet>;
  abstract getTweet(id: string): Promise<Tweet>;
  abstract likeTweet(id: string): Promise<void>;
  abstract retweet(id: string): Promise<void>;
  abstract createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<Tweet>;
  abstract followUser(username: string): Promise<void>;
  abstract searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<{ tweets: Tweet[]; nextCursor?: string }>;
  abstract getProfile(username: string): Promise<Profile>;

  protected async getHeaders(): Promise<Record<string, string>> {
    return this.auth.getHeaders();
  }

  protected async isAuthenticated(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }
}
