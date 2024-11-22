import { dbSchemas } from "@/db";
import {
  type CharacterUpdate,
  type CreateCharacterInput,
  type ResponseStyles,
} from "@/types";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export class CharacterManager {
  constructor(private db: PostgresJsDatabase<typeof dbSchemas>) {}

  async getCharacter(id?: string) {
    if (id) {
      const [character] = await this.db
        .select()
        .from(dbSchemas.characters)
        .where(eq(dbSchemas.characters.id, id));
      return character;
    }

    const [defaultCharacter] = await this.db
      .select()
      .from(dbSchemas.characters)
      .limit(1);

    if (!defaultCharacter) {
      throw new Error("No default character found");
    }

    return defaultCharacter;
  }

  async createCharacter(input: CreateCharacterInput) {
    try {
      return await this.db.transaction(async (tx) => {
        const defaultValues = {
          responseStyles: {
            default: {
              tone: [],
              personality: [],
              guidelines: [],
            },
            platforms: {},
          },
          styles: {},
          shouldRespond: { rules: [], examples: [] },
          hobbies: [],
          beliefSystem: [],
          preferences: {
            preferredTopics: [],
            dislikedTopics: [],
            preferredTimes: [],
            dislikedTimes: [],
            preferredDays: [],
            dislikedDays: [],
            preferredHours: [],
            dislikedHours: [],
            generalLikes: [],
            generalDislikes: [],
          },
          personalityTraits: [],
          onchain: null,
          generalGuidelines: null,
          updatedAt: new Date(),
        };

        const [character] = await tx
          .insert(dbSchemas.characters)
          .values({
            ...defaultValues,
            ...input,
          })
          .returning();

        await this.initializeCharacter(tx, character.id);
        return character;
      });
    } catch (error) {
      console.error("Error creating character:", error);
      throw error;
    }
  }

  async updateCharacter(id: string, update: CharacterUpdate) {
    try {
      if (update.responseStyles) {
        update.responseStyles = this.validateResponseStyles(
          update.responseStyles
        );
      }

      const [updated] = await this.db
        .update(dbSchemas.characters)
        .set({
          ...update,
          updatedAt: new Date(),
        })
        .where(eq(dbSchemas.characters.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error updating character:", error);
      throw error;
    }
  }

  private async initializeCharacter(tx: any, characterId: string) {
    await tx.insert(dbSchemas.memories).values({
      characterId,
      type: "learning",
      content: "Character initialization",
      importance: 1.0,
      metadata: {
        type: "creation",
        timestamp: new Date().toISOString(),
      },
    });

    await tx.insert(dbSchemas.events).values({
      characterId,
      type: "character:created",
      payload: {
        timestamp: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: "system",
      },
      processed: true,
    });

    const character = await this.getCharacter(characterId);
    if (character?.hobbies?.length) {
      await tx.insert(dbSchemas.goals).values(
        character.hobbies.map((hobby) => ({
          characterId,
          description: `Develop expertise in ${hobby.name}`,
          status: "active",
          progress: 0,
          metadata: {
            hobby: hobby.name,
            currentProficiency: hobby.proficiency,
            targetProficiency: Math.min((hobby.proficiency ?? 0) + 2, 10),
            notes: [`Started with proficiency level ${hobby.proficiency}`],
          },
        }))
      );
    }
  }

  private validateResponseStyles(styles: ResponseStyles): ResponseStyles {
    if (!styles.default) {
      throw new Error("Default response styles are required");
    }
    // ... rest of validation logic ...
    return styles;
  }
}
