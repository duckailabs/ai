import type { AIOptions } from "../ai";

export interface AgentConfig extends AIOptions {
  name: string;
  environment?: "development" | "production" | "test";
}
