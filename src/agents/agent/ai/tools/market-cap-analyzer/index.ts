import type { Tool } from "@/types/tools";
import { getTopMarketCapMovers } from "../fatduck";

export default {
  name: "market-cap-analyzer",
  config: {
    name: "Market Cap Analyzer",
    description: "Analyzes market cap movements and trends",
    version: "1.0.0",
  },
  execute: async (params: Record<string, unknown> = {}) => {
    try {
      const category =
        (params.category as string) || "virtuals-protocol-ecosystem";
      const data = await getTopMarketCapMovers(category);

      return {
        success: true,
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          category,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch market cap data",
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
} satisfies Tool;
