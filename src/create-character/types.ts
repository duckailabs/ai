import type { CreateCharacterInput } from "@/types";

export interface AnalysisSource {
  type: "chat" | "tweet" | "discord";
  data: any;
  metadata?: {
    platform?: string;
    timeframe?: {
      start: Date;
      end: Date;
    };
    messageCount?: number;
    confidence?: number;
  };
}

export interface AnalysisResult {
  profile: CreateCharacterInput;
  metadata: {
    source: AnalysisSource;
    confidence: {
      overall: number;
      traits: number;
      preferences: number;
      styles: number;
    };
    timestamp: string;
  };
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  threadId?: string;
  replyTo?: string;
  platform?: string;
  metadata?: {
    reactions?: Array<{
      type: string;
      count: number;
      users: string[];
    }>;
    mentions?: string[];
    attachments?: Array<{
      type: string;
      url: string;
      name: string;
    }>;
    importance?: number;
    tags?: string[];
    isEdited?: boolean;
    originalContent?: string;
    editHistory?: Array<{
      content: string;
      timestamp: Date;
    }>;
  };
}

export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  retweet_count: number;
  favorite_count: number;
  reply_count: number;
  user: {
    id: string;
    screen_name: string;
    name: string;
  };
  in_reply_to_status_id?: string;
  in_reply_to_user_id?: string;
  quoted_status_id?: string;
  is_quote_status: boolean;
  entities?: {
    hashtags: Array<{ text: string }>;
    user_mentions: Array<{ screen_name: string; id: string }>;
    urls: Array<{ url: string; expanded_url: string }>;
  };
  metadata?: {
    iso_language_code: string;
    result_type: string;
  };
}
