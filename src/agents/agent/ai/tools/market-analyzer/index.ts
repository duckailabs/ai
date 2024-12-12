import type { Tool } from "@/types/tools";
import { getMarketUpdate } from "../fatduck";

export default {
  name: "market-analyzer",
  config: {
    name: "Market Analyzer",
    description: "Analyzes market data and trends",
    version: "1.0.0",
  },
  execute: async (params: Record<string, unknown> = {}) => {
    try {
      const data = await getMarketUpdate("1hr");
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
