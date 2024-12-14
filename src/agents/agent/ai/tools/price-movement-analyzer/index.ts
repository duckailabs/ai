import type { Tool } from "@/types/tools";
import { getCategoryMovements } from "../fatduck";

export default {
  name: "price-movement-analyzer",
  config: {
    name: "Price Movement Analyzer",
    description: "Analyzes price movements and trends",
    version: "1.0.0",
  },
  execute: async (params: Record<string, unknown> = {}) => {
    try {
      const categories = ["virtuals-protocol-ecosystem", "ai-meme-coins"];
      const data = await getCategoryMovements(categories);
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
            : "Failed to fetch price movements",
      };
    }
  },
} satisfies Tool;
