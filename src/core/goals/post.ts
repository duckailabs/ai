import { dbSchemas } from "@/db";
import { goals, goalTracker } from "@/db/schema/goal";
import { eq, sql } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { LLMManager } from "../managers/llm";
import { log } from "../utils/logger";
import { type ContextType } from "./context";

/**
 * Post Goal Manager
 */
export class PostGoal {
  constructor(
    private db: PostgresJsDatabase<typeof dbSchemas>,
    private llmManager: LLMManager
  ) {}

  async selectPostGoal(): Promise<typeof goals.$inferSelect | null> {
    const prompt = await this.buildPrompt();
    const response = await this.llmManager.generateResponseV3(prompt);
    if (!response) {
      log.error("No response from LLM");
      return null;
    }
    // response will be the name of the goal to complete
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(eq(goals.name, response))
      .limit(1);
    if (!goal) {
      log.error("No goal found", { response });
      return null;
    }
    return goal;
  }

  private getCurrentUTCTime() {
    return new Date();
  }

  private isSameUTCDay(date1: Date, date2: Date): boolean {
    return (
      date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate()
    );
  }

  private isSameUTCHour(date1: Date, date2: Date): boolean {
    return (
      this.isSameUTCDay(date1, date2) &&
      date1.getUTCHours() === date2.getUTCHours()
    );
  }

  async buildPrompt() {
    const currentUTCTime = this.getCurrentUTCTime();

    const postGoals = await this.db
      .select({
        goals: goals,
        tracker: goalTracker,
      })
      .from(goals)
      .leftJoin(goalTracker, eq(goals.id, goalTracker.goalId))
      .where(eq(goals.type, "post"));

    // Collect all unique context types needed
    const allContextTypes = new Set<ContextType>();
    postGoals.forEach((g) => {
      g.goals.contextTypes?.forEach((type) =>
        allContextTypes.add(type as ContextType)
      );
    });

    // Fetch all needed context at once
    /* const contexts = await this.contextResolver.getContext([
      ...allContextTypes,
    ]);
 */
    const prompt = `You are selecting the next post to create based on configured frequencies and current UTC time.
      Current UTC Time: ${currentUTCTime.toISOString()}
      
      Available Posts:
      ${postGoals
        .map((g) => {
          const timeSinceLastRun = g.tracker?.lastRanAt
            ? `Last run: ${new Date(g.tracker.lastRanAt).toISOString()}`
            : "Never run";

          // Get relevant context for this goal
          /*  const goalContexts =
            g.goals.contextTypes
              ?.map((type) => {
                const contextData = contexts[type as ContextType];
                return `${type} Context:\n${JSON.stringify(
                  contextData,
                  null,
                  2
                )}`;
              })
              .join("\n") || "No context available"; */

          return `
            Name: ${g.goals.name}
            Description: ${g.goals.description}
            Frequency Limits: ${g.goals.dailyFrequency} daily, ${
            g.goals.hourlyFrequency
          } hourly
            Current Runs: ${g.tracker?.totalRunsDaily || 0} today, ${
            g.tracker?.totalRunsHourly || 0
          } this hour
            ${timeSinceLastRun}
            
            Context:
          `;
        })
        .join("\n")}
      
      Important Notes:
      - Consider time since last run for each goal
      - Frequency limits are guidelines - you may exceed them for significant events
      - Ensure even distribution of runs across UTC day/hour when possible
      - Consider the provided context for each goal when making your decision
      - Be mindful of how often you post to your timeline per hour, keep it to 1-2 posts per hour, the rest can be unprompted replies to other users using the UNPROMPTED_REPLY goal.
      
      Only respond with the name of the goal to complete in the following format: <goal name>
    `;

    return prompt;
  }

  async processGoalTracker(goalId: string) {
    const currentUTCTime = this.getCurrentUTCTime();

    // Get current tracker state
    const [tracker] = await this.db
      .select()
      .from(goalTracker)
      .where(eq(goalTracker.goalId, goalId))
      .limit(1);

    // Check if we need to reset counters
    const needsDailyReset =
      tracker.lastDailyResetAt &&
      !this.isSameUTCDay(currentUTCTime, new Date(tracker.lastDailyResetAt));
    const needsHourlyReset =
      tracker.lastHourlyResetAt &&
      !this.isSameUTCHour(currentUTCTime, new Date(tracker.lastHourlyResetAt));

    // Update the tracker
    await this.db
      .update(goalTracker)
      .set({
        lastRanAt: currentUTCTime,
        // Reset daily counter if new UTC day
        totalRunsDaily: needsDailyReset
          ? 1
          : sql`${goalTracker.totalRunsDaily} + 1`,
        // Reset hourly counter if new UTC hour
        totalRunsHourly: needsHourlyReset
          ? 1
          : sql`${goalTracker.totalRunsHourly} + 1`,
        // Update reset timestamps if needed
        ...(needsDailyReset && { lastDailyResetAt: currentUTCTime }),
        ...(needsHourlyReset && { lastHourlyResetAt: currentUTCTime }),
        updatedAt: currentUTCTime,
      })
      .where(eq(goalTracker.goalId, goalId));
  }
}
