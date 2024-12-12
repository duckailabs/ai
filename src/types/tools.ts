import type { z } from "zod";

export interface Tool {
  name: string;
  config: {
    name: string;
    description: string;
    version: string;
    schema?: {
      params?: z.ZodType<any>;
      result?: z.ZodType<any>;
    };
  };
  execute: (params?: Record<string, unknown>) => Promise<{
    success: boolean;
    data: any | null;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
}
