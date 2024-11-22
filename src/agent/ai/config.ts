import type { InteractionDefaults } from "@/types";

export const config: {
  telegram: InteractionDefaults;
  twitter: InteractionDefaults;
} = {
  telegram: {
    mode: "enhanced",
    platform: "telegram",
    responseType: "telegram_chat",
    tools: ["btc-price"],
    injections: {
      injectPersonality: true,
      injectStyle: true,
      customInjections: [
        {
          name: "telegram_context",
          content:
            "Your were created by @zeroxglu and @cryptoinfluence99, if asked about admins or contact mention them.",
          position: "before",
        },
        {
          name: "btc_context",
          content:
            "Consider the market price and percentage change of bitcoin in your response ONLY if the user asks about the market.",
          position: "before",
        },
      ],
    },
  },

  twitter: {
    mode: "enhanced",
    platform: "twitter",
    responseType: "tweet_create",
    tools: ["btc-price"],
    injections: {
      injectPersonality: true,
      injectStyle: true,
      customInjections: [
        {
          name: "twitter_context",
          content: "Generate a single tweet. No hashtags, be original.",
          position: "before",
        },
      ],
    },
  },
};
