import { LLMManager } from "@/core/managers/llm";
import * as schema from "@/db";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export class MemoryManager {
  constructor(
    private db: PostgresJsDatabase<typeof schema>,
    private llmManager: LLMManager
  ) {}

  async addMemory(
    characterId: string,
    content: string,
    options: {
      importance?: number;
      context?: Record<string, any>;
      type?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    try {
      const importance =
        options.importance ??
        (await this.llmManager.analyzeImportance(content, options.context));

      if (importance > 0.2) {
        const [memory] = await this.db
          .insert(schema.memories)
          .values({
            characterId,
            type: (options.type || "interaction") as
              | "interaction"
              | "learning"
              | "achievement"
              | "hobby",
            content,
            importance: importance.toString(),
            metadata: {
              userId: options.metadata?.userId,
              sentiment: options.metadata?.sentiment,
              topic: options.metadata?.topic,
              hobby: options.metadata?.hobby,
              relatedMemories: options.metadata?.relatedMemories,
            },
          })
          .returning();

        return memory;
      }

      return null;
    } catch (error) {
      console.error("Error adding memory:", error);
      throw error;
    }
  }

  async addMemoryBatch(
    characterId: string,
    memories: Array<{
      content: string;
      importance?: number;
      context?: Record<string, any>;
      type?: string;
      metadata?: Record<string, any>;
    }>
  ) {
    const results = await Promise.all(
      memories.map((memory) =>
        this.addMemory(characterId, memory.content, {
          importance: memory.importance,
          context: memory.context,
          type: memory.type,
          metadata: memory.metadata,
        })
      )
    );

    return results.filter(Boolean);
  }
}
