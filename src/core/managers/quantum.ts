import { IBMQuantumClient, type IBMConfig } from "@/core/utils/IBMRest";
import type { dbSchemas } from "@/db";
import {
  quantumStates,
  type NewQuantumState,
  type QuantumState,
} from "@/db/schema/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export class QuantumStateManager {
  private quantumClient: IBMQuantumClient;

  constructor(
    private db: PostgresJsDatabase<typeof dbSchemas>,
    config?: IBMConfig
  ) {
    if (!config) {
      throw new Error("IBM Quantum config is required");
    }
    this.quantumClient = new IBMQuantumClient(config);
  }

  async generateQuantumState(): Promise<NewQuantumState> {
    try {
      // Generate the circuit QASM
      const circuitQASM = this.quantumClient.generateCircuitQASM(16);

      // Execute the circuit and get results
      const result = await this.quantumClient.submitJob(circuitQASM);

      // Get all measurement results and their counts
      const counts = result.meas.get_counts();
      const measurements = Object.entries(counts);

      // Calculate statistics from the quantum measurements
      const total = measurements.reduce((sum, [_, count]) => sum + count, 0);
      let entropy = 0;
      let weightedSum = 0;

      measurements.forEach(([bitstring, count]) => {
        const prob = count / total;
        if (prob > 0) {
          entropy -= prob * Math.log2(prob); // Calculate Shannon entropy
          weightedSum += parseInt(bitstring, 2) * prob;
        }
      });

      // Normalize entropy to 0-255 range for mood
      const normalizedEntropy = Math.floor((entropy / 16) * 255); // 16 is max entropy for 16 qubits

      // Use weighted sum for creativity (normalized to 0-255)
      const normalizedWeightedSum = Math.floor((weightedSum / 65535) * 255);

      // Get the most frequent measurement for random value
      const [mostFrequentBitstring] = measurements.reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      );

      return {
        timestamp: new Date(),
        randomValue: parseInt(mostFrequentBitstring, 2),
        moodValue: normalizedEntropy,
        creativityValue: normalizedWeightedSum,
        entropyHash: mostFrequentBitstring,
        isFallback: false,
      };
    } catch (error) {
      console.error("Quantum generation failed, using fallback:", error);
      // if we get an error use the last good state
      const lastState = await this.getLatestState();
      if (lastState) {
        return lastState;
      } else {
        return {
          timestamp: new Date(),
          randomValue: 65367,
          moodValue: 145,
          creativityValue: 240,
          entropyHash: "1111111101010111",
          isFallback: true,
        };
      }
    }
  }

  // hard defaults for fallback state
  private generateFallbackState(): NewQuantumState {
    const randomBytes = new Uint16Array(1); // Use Uint16Array to directly get a 16-bit value
    crypto.getRandomValues(randomBytes);

    // Convert the single 16-bit number to binary
    //const entropyBinary = randomBytes[0].toString(2).padStart(16, "0");

    return {
      timestamp: new Date(),
      randomValue: 65367,
      moodValue: 145,
      creativityValue: 240,
      entropyHash: "1111111101010111",
      isFallback: true,
    };
  }

  async storeState(state: NewQuantumState) {
    return await this.db.insert(quantumStates).values(state).returning();
  }

  async getLatestState(): Promise<QuantumState | undefined> {
    const results = await this.db
      .select()
      .from(quantumStates)
      .orderBy(desc(quantumStates.timestamp))
      .where(eq(quantumStates.isFallback, false))
      .limit(1);

    return results[0];
  }

  async getStatesInRange(startTime: Date, endTime: Date) {
    return await this.db
      .select()
      .from(quantumStates)
      .where(
        and(
          gte(quantumStates.timestamp, startTime),
          lte(quantumStates.timestamp, endTime)
        )
      )
      .orderBy(quantumStates.timestamp);
  }

  async cleanupOldStates(daysToKeep: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await this.db
      .delete(quantumStates)
      .where(lte(quantumStates.timestamp, cutoffDate))
      .returning();
  }

  async getStateStats(startTime: Date, endTime: Date) {
    const stats = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        fallbackCount: sql<number>`sum(case when ${quantumStates.isFallback} then 1 else 0 end)::int`,
        avgRandomValue: sql<number>`avg(${quantumStates.randomValue})::float`,
        avgCreativityValue: sql<number>`avg(${quantumStates.creativityValue})::float`,
      })
      .from(quantumStates)
      .where(
        and(
          gte(quantumStates.timestamp, startTime),
          lte(quantumStates.timestamp, endTime)
        )
      );

    return stats[0];
  }
}
