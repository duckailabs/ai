export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
}

export interface Block {
  type: Role | "text";
  content: string;
  children?: Block[];
  variables?: Record<string, string>;
  range?: { start: number; end: number };
  name?: string;
}

export interface ParsedTemplate {
  blocks: Block[];
  variables: string[];
  raw: string;
}

export interface LintResult {
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
  code?: string;
}
