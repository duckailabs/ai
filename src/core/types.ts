import type { Character } from "@/db/schema/schema";
import type {
  CharacterUpdate,
  CreateCharacterInput,
  LLMResponse,
  Memory,
  MemoryType,
  Platform,
  ResponseStyles,
  StyleSettings,
} from "../types";

export type {
  CharacterUpdate,
  CreateCharacterInput,
  LLMConfig,
  LLMResponse,
  Memory,
  MemoryType,
  ResponseStyles,
  StyleSettings,
} from "../types";

// Core-specific interfaces for managers
export interface ICharacterManager {
  getCharacter(id: string): Promise<Character | null>;
  createCharacter(
    input: CreateCharacterInput & { responseStyles: ResponseStyles }
  ): Promise<Character>;
  updateCharacter(id: string, update: CharacterUpdate): Promise<Character>;
}

export interface IMemoryManager {
  addMemory(
    characterId: string,
    content: string,
    options?: {
      importance?: number;
      context?: Record<string, any>;
      type?: MemoryType;
      metadata?: Record<string, any>;
    }
  ): Promise<Memory | null>;

  addMemoryBatch(
    characterId: string,
    memories: Array<{
      content: string;
      importance?: number;
      context?: Record<string, any>;
      type?: MemoryType;
      metadata?: Record<string, any>;
    }>
  ): Promise<Memory[]>;
}

export interface IStyleManager {
  updatePlatformStyles(
    characterId: string,
    platform: Platform,
    styles: {
      enabled: boolean;
      defaultTone: string[];
      defaultGuidelines: string[];
      styles: {
        [K in ResponseType]?: StyleSettings;
      };
    }
  ): Promise<Character>;

  getPlatformFromResponseType(responseType: ResponseType): Platform;

  getStyleSettings(
    responseStyles: ResponseStyles,
    platform: Platform,
    responseType: ResponseType
  ): StyleSettings;
}

export interface ILLMManager {
  generateResponse(
    messages: any[],
    options?: Record<string, any>
  ): Promise<LLMResponse>;

  analyzeImportance(
    content: string,
    context?: Record<string, any>
  ): Promise<number>;

  preparePrompt(template: string, context: Record<string, any>): Promise<any[]>;
}

interface ImageGenerationMetadata {
  prompt?: string;
  settings?: {
    model?: string;
    size?: string;
    quality?: string;
  };
  imageUrl?: string;
  moderationScore?: number;
  flaggedCategories?: string[];
  stage?: "moderation" | "generation" | "delivery";
  technicalDetails?: Record<string, any>;
  url?: string;
}

export type InteractionEventType =
  | "interaction.started" // Initial interaction request
  | "interaction.completed" // Successful completion
  | "interaction.failed" // Failed due to error
  | "interaction.rate_limited" // Hit rate limits
  | "interaction.invalid" // Invalid input/request
  | "interaction.cancelled" // Cancelled by user/system
  | "interaction.processed" // Post-processing complete
  | "interaction.queued"; // Queued for processing

export type InteractionEventPayload = {
  "interaction.started": {
    input: string;
    responseType: string;
    platform: Platform;
    timestamp: string;
    sessionId?: string;
    messageId: string;
    replyTo?: string;
    hasMention?: boolean;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.completed": {
    input: string;
    response: string;
    responseType: string;
    platform: Platform;
    processingTime: number;
    timestamp: string;
    sessionId?: string;
    messageId: string;
    replyTo?: string;
    metrics?: {
      tokenCount: number;
      promptTokens: number;
      completionTokens: number;
    };
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.failed": {
    input: string;
    error: string;
    errorCode?: string;
    timestamp: string;
    sessionId?: string;
    messageId: string;
    attemptCount?: number;
    stage?: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.processed": {
    input: string;
    messageId: string;
    timestamp: string;
    sessionId?: string;
    processingResults: Record<string, any>;
    decision: string;
    reason?: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.rate_limited": {
    limit: number;
    resetTime: string;
    timestamp: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.invalid": {
    input: string;
    reason: string;
    validationErrors?: string[];
    timestamp: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.cancelled": {
    reason: string;
    timestamp: string;
    sessionId?: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };

  "interaction.queued": {
    queuePosition: number;
    estimatedProcessingTime?: number;
    timestamp: string;
    user: {
      id: string;
      platform_specific_id?: string;
      username?: string;
      metadata?: Record<string, any>;
    };
    imageGeneration?: ImageGenerationMetadata;
  };
};

// Core interaction types
export interface InteractionResult {
  content: string;
  metadata: {
    characterId: string;
    responseType: string;
    platform: string;
    styleSettings: StyleSettings;
    contextUsed: Record<string, any>;
    llmMetadata?: Record<string, any>;
  };
}

export interface InteractionOptions {
  userId: string;
  username?: string;
  platform: Platform;
  chatId: string;
  characterId: string;
  messageId: string;
  replyTo?: string;
  hasMention?: boolean;
  mode?: InteractionMode;
  temperature?: number;
  maxTokens?: number;
  responseType?: string;
  tools?: string[];
  toolContext?: Record<string, any>;
  sessionId?: string;
  context?: Record<string, any>;
  injections?: {
    injectPersonality?: boolean;
    injectOnchain?: boolean;
    injectStyle?: boolean;
    injectIdentity?: boolean;
    customInjections?: Array<{
      name: string;
      content: string;
      position: "before" | "after" | "replace";
    }>;
  };
}

export type InteractionInput =
  | string
  | {
      system: string;
      user: string;
    };

// Core configuration types
export interface AIOptions {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableCache?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface ManagerConfig {
  characterManager?: Partial<ICharacterManager>;
  memoryManager?: Partial<IMemoryManager>;
  styleManager?: Partial<IStyleManager>;
  llmManager?: Partial<ILLMManager>;
}

// Core event types
export type AIEvent = {
  type: "interaction" | "memory" | "character" | "error";
  payload: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
};

export type InteractionMode =
  | "raw" // Pure prompt without character/style injection
  | "enhanced" // Full character personality and style injection
  | "mixed"; // Selective injection based on user preferences

export interface ConversationConfig {
  platforms: {
    [key: string]: {
      triggerWord?: string;
      maxMessages: number;
      timeoutMinutes: number;
    };
  };
}

export interface ConversationContext {
  platform: string;
  userId: string;
  chatId: string;
  message: string;
  characterId: string;
  conversationId: string;
}

export interface ConversationParams {
  characterId: string;
  userId: string;
  platform: Platform;
  chatId: string;
  message: string;
}

// Types for conversation state
export interface ConversationState {
  lastDuckyMessage?: Date;
  activeParticipants: Set<string>;
  messageCount: number;
  lastMessageTime: Date;
  currentTopic?: string;
}

export interface MessageEvent {
  id: string;
  chatId: string;
  messageId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  replyToId?: string;
  hasMention: boolean;
  isFromDucky: boolean;
}

export interface MessagePayload {
  input: string;
  messageId: string;
  replyTo?: string;
  hasMention: boolean;
  response?: string;
  processingTime?: number;
  metrics?: {
    tokenCount?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface ImageGenerationOptions {
  model?: string;
  size?: string;
  quality?: string;
  numImages?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  error?: string;
  url?: string;
}
