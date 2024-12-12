import type { Tool } from "@/types/tools";
import { getTimelineData } from "../fatduck";

export default {
  name: "market-analyzer",
  config: {
    name: "Market Analyzer",
    description: "Analyzes market data and trends",
    version: "1.0.0",
  },
  execute: async (params: Record<string, unknown> = {}) => {
    try {
      const data = await getTimelineData(
        params.username as string,
        params.limit as number,
        params.excludeRetweets as boolean
      );
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch market data",
      };
    }
  },
} satisfies Tool;
