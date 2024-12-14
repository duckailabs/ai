import type {
  TimelineAnalysisOptions,
  TwitterManager,
} from "@/core/platform/twitter/twitter";
import type { Tool } from "@/types/tools";

export default {
  name: "timeline-analyzer",
  config: {
    name: "timeline-analyzer",
    description: "Analyzes a Twitter user's timeline",
    version: "1.0.0",
  },
  execute: async (context?: Record<string, unknown>) => {
    try {
      const twitterManager = context?.twitterManager as TwitterManager;
      const handle = context?.handle as string;
      const options = context?.options as TimelineAnalysisOptions;

      if (!twitterManager) {
        throw new Error("Twitter manager not available");
      }

      const timeline = await twitterManager.analyzeTimeline(handle, {
        ...options,
      });

      return {
        success: true,
        data: { timeline },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Failed to fetch timeline",
      };
    }
  },
} satisfies Tool;
