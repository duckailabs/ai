import type { Character } from "@/db";
import type {
  CharacterUpdate,
  CreateCharacterInput,
  LLMResponse,
  Memory,
  MemoryType,
  platformEnum,
  PlatformStyles,
  ResponseStyles,
  responseTypeEnum,
  StyleSettings,
} from "../types";

export type {
  CharacterUpdate,
  CreateCharacterInput,
  LLMConfig,
  LLMResponse,
  Memory,
  MemoryType,
  PlatformStyles,
  ResponseStyles,
  StyleSettings,
} from "../types";

export { platformEnum, responseTypeEnum } from "../types";

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
    platform: (typeof platformEnum.enumValues)[number],
    styles: PlatformStyles
  ): Promise<Character>;

  getPlatformFromResponseType(
    responseType: (typeof responseTypeEnum.enumValues)[number]
  ): (typeof platformEnum.enumValues)[number];

  getStyleSettings(
    responseStyles: ResponseStyles,
    platform: (typeof platformEnum.enumValues)[number],
    responseType: (typeof responseTypeEnum.enumValues)[number]
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
