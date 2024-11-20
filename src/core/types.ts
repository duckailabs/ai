import type { Character } from "@/db";
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
    characterId: string;
    responseType: string;
    platform: string;
    timestamp: string;
    sessionId?: string;
  };

  "interaction.completed": {
    input: string;
    response: string;
    characterId: string;
    responseType: string;
    platform: string;
    processingTime: number;
    timestamp: string;
    sessionId?: string;
    metrics?: {
      tokenCount: number;
      promptTokens: number;
      completionTokens: number;
    };
  };

  "interaction.failed": {
    input: string;
    characterId: string;
    error: string;
    errorCode?: string;
    timestamp: string;
    sessionId?: string;
    attemptCount?: number;
  };

  "interaction.rate_limited": {
    characterId: string;
    limit: number;
    resetTime: string;
    timestamp: string;
  };

  "interaction.invalid": {
    input: string;
    characterId: string;
    reason: string;
    validationErrors?: string[];
    timestamp: string;
  };

  "interaction.cancelled": {
    characterId: string;
    reason: string;
    timestamp: string;
    sessionId?: string;
  };

  "interaction.processed": {
    characterId: string;
    processingResults: Record<string, any>;
    timestamp: string;
    sessionId?: string;
  };

  "interaction.queued": {
    characterId: string;
    queuePosition: number;
    estimatedProcessingTime?: number;
    timestamp: string;
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
  characterId?: string;
  temperature?: number;
  [key: string]: any;
}

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
