export interface Profile {
  id: string;
  username: string;
  name: string;
  bio?: string;
  metrics?: {
    followers: number;
    following: number;
    tweets: number;
  };
  isPrivate: boolean;
  isVerified: boolean;
  isBlueVerified?: boolean;
  avatar?: string;
  banner?: string;
  location?: string;
  website?: string;
  joined?: Date;
}

export interface Tweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  createdAt?: Date;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    bookmarkCount?: number;
  };
  media?: {
    photos: Photo[];
    videos: Video[];
  };
  quotedTweet?: Tweet;
  retweetedTweet?: Tweet;
  replyToTweetId?: string;
  conversationId?: string;
  inReplyToStatus?: Tweet;
  isQuoted: boolean;
  isReply: boolean;
  isRetweet: boolean;
  isPin: boolean;
  isSelfThread?: boolean;
  sensitiveContent?: boolean;
  poll?: Poll | null;
  isLongform?: boolean;
  noteText?: string;
}

export interface Photo {
  id: string;
  url: string;
  altText?: string;
}

export interface Video {
  id: string;
  url?: string;
  preview: string;
}

export interface Poll {
  id?: string;
  options: Array<{
    position?: number;
    label: string;
    votes?: number;
  }>;
  end_datetime?: string;
  duration_minutes: number;
  voting_status?: string;
}

export interface TweetOptions {
  replyToTweet?: string;
  quoteTweet?: string;
  media?: Array<{ data: Buffer; type: string }>;
  poll?: {
    options: Array<{ label: string }>;
    duration_minutes: number;
  };
  longform?: {
    richtext?: {
      text: string;
    };
    languageCode?: string;
  };
}

export interface SearchOptions {
  maxTweets?: number;
  cursor?: string;
  searchMode?: "Top" | "Latest" | "Photos" | "Videos" | "Users";
}

export interface MentionOptions {
  count?: number;
  cursor?: string;
}

export interface ITwitterOperations {
  sendTweet(text: string, options?: TweetOptions): Promise<Tweet>;
  getTweet(id: string): Promise<Tweet>;
  likeTweet(id: string): Promise<void>;
  retweet(id: string): Promise<void>;
  createQuoteTweet(
    text: string,
    quotedTweetId: string,
    options?: Omit<TweetOptions, "quoteTweet">
  ): Promise<Tweet>;
  followUser(username: string): Promise<void>;
  searchTweets(
    query: string,
    options?: SearchOptions
  ): Promise<{ tweets: Tweet[]; nextCursor?: string }>;
  getProfile(username: string): Promise<Profile>;
}

export interface TwitterAuthStrategy {
  getHeaders(): Promise<Record<string, string>>;
  isAuthenticated(): Promise<boolean>;
}

export interface APIv2Credentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface MediaUploadResult {
  mediaId: string;
  mediaType: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface UserResponse {
  data: {
    user: {
      result: {
        rest_id: string;
        legacy?: any;
      };
    };
  };
}
