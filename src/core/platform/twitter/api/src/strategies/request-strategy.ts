import { TwitterError } from "../error";
import {
  type SearchOptions,
  type Tweet,
  type TweetOptions,
} from "../interfaces";

export interface RequestResponse<T> {
  data: T;
  meta?: {
    nextCursor?: string;
  };
}

export interface IRequestStrategy {
  sendTweet(
    text: string,
    options?: TweetOptions
  ): Promise<RequestResponse<Tweet>>;
  getTweet(id: string): Promise<RequestResponse<Tweet>>;
  likeTweet(id: string): Promise<RequestResponse<void>>;
  retweet(id: string): Promise<RequestResponse<void>>;
  createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<RequestResponse<Tweet>>;
  followUser(username: string): Promise<RequestResponse<void>>;
  searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<RequestResponse<Tweet[]>>;
}

export abstract class BaseRequestStrategy implements IRequestStrategy {
  protected constructor(
    protected readonly headers: () => Promise<Record<string, string>>
  ) {}

  abstract sendTweet(
    text: string,
    options?: TweetOptions
  ): Promise<RequestResponse<Tweet>>;
  abstract getTweet(id: string): Promise<RequestResponse<Tweet>>;
  abstract likeTweet(id: string): Promise<RequestResponse<void>>;
  abstract retweet(id: string): Promise<RequestResponse<void>>;
  abstract createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<RequestResponse<Tweet>>;
  abstract followUser(username: string): Promise<RequestResponse<void>>;
  abstract searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<RequestResponse<Tweet[]>>;

  protected async makeRequest<T>(
    url: string,
    method: "GET" | "POST" = "GET",
    body?: string | Record<string, string>,
    additionalHeaders?: Record<string, string>
  ): Promise<T> {
    const headers = await this.headers();
    const finalHeaders = {
      ...headers,
      ...additionalHeaders,
    };
    const requestInit: RequestInit = {
      method,
      headers: finalHeaders,
      credentials: "include",
    };

    // Only add body for non-GET requests
    if (method !== "GET" && body) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    if (!response.ok) {
      if (responseData?.errors?.[0]?.message) {
        throw new TwitterError(
          response.status,
          responseData.errors[0].message,
          responseData
        );
      }
      throw new TwitterError(response.status, "Request failed", responseData);
    }

    return responseData;
  }
}
