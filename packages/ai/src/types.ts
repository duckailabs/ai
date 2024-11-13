import { z } from "zod";

export const BlockType = z.enum([
  "system",
  "user",
  "assistant",
  "if",
  "select",
  "gen",
  "each",
  "include",
]);

export type BlockType = z.infer<typeof BlockType>;

export interface Block {
  type: BlockType;
  content: string;
  children?: Block[];
  variables?: Record<string, string>;
  range?: {
    start: number;
    end: number;
  };
}

export interface ParsedTemplate {
  blocks: Block[];
  raw: string;
  variables: Set<string>;
}

export interface LintResult {
  message: string;
  severity: "error" | "warning" | "suggestion";
  line: number;
  column: number;
  fix?: {
    from: number;
    to: number;
    replacement: string;
  };
}

export interface BuilderOptions {
  validateOnBuild?: boolean;
  throwOnWarnings?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
