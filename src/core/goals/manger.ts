import { dbSchemas } from "@/db";
import { goals } from "@/db/schema/goal";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Manages goals for the AI agent.
 */
export class GoalManager {
  constructor(private db: PostgresJsDatabase<typeof dbSchemas>) {}

  public async registerGoal(goal: typeof goals.$inferInsert) {
    const result = await this.db
      .insert(goals)
      .values(goal)
      .returning()
      .onConflictDoNothing();
    return result[0];
  }

  async start() {
    return goals;
  }
}
