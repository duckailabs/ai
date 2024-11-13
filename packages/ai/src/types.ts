export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
}

export interface Block {
  type: Role;
  content: string;
  name?: string;
  variables?: Record<string, string>; // Was expecting a Record, not an array
  range: {
    start: number;
    end: number;
  };
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
