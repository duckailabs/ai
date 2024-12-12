import { dbSchemas } from "@/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CharacterManager } from "../managers/character";
import type { InteractionEventPayload, InteractionEventType } from "../types";
import { log } from "../utils/logger";

export class EventService {
  constructor(
    private db: PostgresJsDatabase<typeof dbSchemas>,
    private characterManager: CharacterManager
  ) {}

  async createEvents(
    events: Array<{
      characterId: string;
      type: InteractionEventType; // Updated type
      payload: Record<string, any>;
      metadata?: Record<string, any>;
    }>
  ) {
    return this.db
      .insert(dbSchemas.events)
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
    const character = await this.characterManager.getCharacter();
    if (!character) {
      log.error("No character found");
      return;
    }

    try {
      const result = await this.db
        .insert(dbSchemas.events)
        .values({
          characterId: character?.id,
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
        characterId: character.id,
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
