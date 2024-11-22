import { dbSchemas } from "@/db";

export type Platform = (typeof dbSchemas.platformEnum.enumValues)[number];

export type CustomResponseType = `custom_${string}`;
export type ResponseType =
  | (typeof dbSchemas.responseTypeEnum.enumValues)[number]
  | CustomResponseType;

export interface StyleSettings {
  enabled?: boolean;
  tone: string[];
  guidelines: string[];
  platform?: Platform;
  formatting: {
    maxLength?: number;
    allowMarkdown?: boolean;
    customRules?: string[];
  };
  rules?: string[];
}

export interface PlatformStylesInput {
  enabled: boolean;
  defaultTone: string[];
  defaultGuidelines: string[];
  styles: {
    [key: string]: StyleSettings;
  };
}

export interface PlatformStyles {
  enabled: boolean;
  defaultTone: string[];
  defaultGuidelines: string[];
  styles: {
    [K in ResponseType]?: StyleSettings;
  };
}

export interface ResponseStyles {
  default: {
    tone: string[];
    personality: string[];
    guidelines: string[];
  };
  platforms: {
    [P in Platform]?: PlatformStyles;
  };
  customTypes?: {
    [K in CustomResponseType]?: {
      platform: Platform;
      description?: string;
    };
  };
}
