export type Platform = "telegram" | "twitter";

export interface CustomInjection {
  name: string;
  content: string;
  position: "before" | "after" | "replace";
}

export interface InteractionDefaults {
  mode: "enhanced";
  characterId: string;
  platform: Platform;
  responseType: string;
  tools: string[];
  injections: {
    injectPersonality: boolean;
    injectStyle: true;
    customInjections: CustomInjection[];
  };
}

export const config = {
  telegram: (characterId: string): InteractionDefaults => ({
    mode: "enhanced",
    characterId,
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
  }),

  twitter: (characterId: string): InteractionDefaults => ({
    mode: "enhanced",
    characterId,
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
  }),
};
