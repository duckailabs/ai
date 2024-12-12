import type { QuantumPersonalityConfig } from "@/core/types";
import type { ResponseStyles } from "./style";

// Base prompt format type
type AIPromptFormat = {
  type: "json" | "text";
  structure?: string;
};

// Base prompt type
interface BaseAIPrompt {
  system: string;
  context?: string;
  examples?: Array<{
    input: string;
    output: string;
  }>;
}

// Text prompt type
interface TextAIPrompt extends BaseAIPrompt {
  format: {
    type: "text";
  };
}

// JSON prompt type
interface JSONAIPrompt extends BaseAIPrompt {
  format: {
    type: "json";
    structure: string;
  };
}

// Union type for all prompt types
type AIPrompt = TextAIPrompt | JSONAIPrompt;

// Extended type for scheduled posts
interface ScheduledPostPrompt extends BaseAIPrompt {
  format: AIPromptFormat;
  requiredTools?: string[];
  schedule?: {
    cron: string;
    timezone?: string;
  };
  formatting?: {
    prefix?: string;
    suffix?: string;
    template?: string;
    maxLength?: number;
    allowMarkdown?: boolean;
    customRules?: string[];
  };
}

// Define the scheduled posts section
type ScheduledPosts = {
  [key: string]: ScheduledPostPrompt;
};

// Main prompts type that matches the actual usage
export type CharacterPrompts = {
  [key: string]: {
    system: string;
    format?: {
      type: "text" | "json";
      structure?: string;
    };
  };
};

export type CharacterTrait = {
  name: string;
  value: number;
  description?: string;
};

export type Hobby = {
  name: string;
  proficiency?: number;
  interest?: number;
  lastPracticed?: string;
  relatedTopics?: string[];
  metadata?: Record<string, unknown>;
};

export type Preferences = {
  preferredTopics: string[];
  dislikedTopics: string[];
  preferredTimes?: string[];
  dislikedTimes?: string[];
  preferredDays?: string[];
  dislikedDays?: string[];
  preferredHours?: string[];
  dislikedHours?: string[];
  generalLikes: string[];
  generalDislikes: string[];
};

export type CreateCharacterInput = {
  name: string;
  bio: string;
  onchain?: {
    [key: string]: string;
  };
  personalityTraits: string[];
  hobbies?: Hobby[];
  preferences?: Preferences;
  responseStyles?: ResponseStyles;
  identity?: {
    [key: string]: string | string[];
  };
  styles?: {
    [key: string]: {
      rules: string[];
      examples: string[];
    };
  };
  beliefSystem?: string[];
  shouldRespond?: {
    rules: string[];
    examples: string[];
  };
  goals?: Array<{
    description: string;
    status?: "active" | "completed" | "paused";
    progress?: number;
    metadata?: {
      dependencies?: string[];
      completionCriteria?: string[];
      notes?: string[];
    };
  }>;
  quantumPersonality?: QuantumPersonalityConfig;
  prompts?: CharacterPrompts;
};

export type CharacterUpdate = Partial<CreateCharacterInput> & {
  updatedAt?: Date;
  responseStyles?: ResponseStyles;
};
