import type { AgentConfig } from "./types";

export const defaultConfig: Partial<AgentConfig> = {
  environment: "development",
  scheduledPosts: {
    enabled: false,
  },
  platforms: {
    telegram: {
      enabled: false,
      token: "",
    },
    twitter: {
      enabled: false,
      cookies: [],
      username: "",
    },
    echoChambers: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
    },
    api: {
      enabled: false,
      port: 3000,
      hostname: "localhost",
      cors: {
        allowedOrigins: [],
      },
      apiKey: "",
    },
    p2p: {
      enabled: false,
      privateKey: "",
      initialPeers: [],
      port: 0,
      turnkeyClient: null,
      address: "",
    },
  },
};
