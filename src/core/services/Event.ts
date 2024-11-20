import * as schema from "@/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { InteractionEventPayload, InteractionEventType } from "../types";

export class EventService {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async createEvents(
    events: {
      characterId: string;
      type: string;
      payload: Record<string, any>;
      metadata?: Record<string, any>;
    }[]
  ) {
    return this.db
      .insert(schema.events)
      .values(
        events.map((event) => ({
          characterId: event.characterId,
          type: event.type,
          payload: event.payload,
          metadata: {
            ...event.metadata,
            timestamp: new Date().toISOString(),
            source: "system",
          },
          processed: false,
        }))
      )
      .returning();
  }

  async createInteractionEvent<T extends InteractionEventType>(
    type: T,
    payload: InteractionEventPayload[T]
  ) {
    try {
      const result = await this.db
        .insert(schema.events)
        .values({
          characterId: payload.characterId,
          type,
          payload,
          metadata: {
            timestamp: new Date().toISOString(),
            source: "interaction-service",
          },
          processed: false,
        })
        .returning();

      return result[0];
    } catch (error) {
      console.error("Error creating interaction event:", {
        type,
        characterId: payload.characterId,
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                code: (error as any).code,
              }
            : error,
      });
      throw error;
    }
  }
}
