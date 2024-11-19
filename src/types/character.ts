import type { ResponseStyles } from "./style";

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
  personalityTraits: string[];
  hobbies?: Hobby[];
  preferences?: Preferences;
  responseStyles?: ResponseStyles;
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
};

export type CharacterUpdate = Partial<CreateCharacterInput> & {
  updatedAt?: Date;
  responseStyles?: ResponseStyles;
};
