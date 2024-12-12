import { ai } from "@/core/ai";
import { log } from "@/core/utils/logger";
import { Turnkey } from "@turnkey/sdk-server";
import dotenv from "dotenv";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { duckyCharacter } from "./ai/character/ducky";
import { config } from "./ai/config";
import { getChatHistory, sendMessage } from "./ai/tools/echochambers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const args = process.argv.slice(2);
const user = args[0] === "soulie" ? "soulie" : "ducky";

async function loadTwitterCookies() {
  try {
    if (process.env.TWITTER_COOKIES) {
      try {
        return JSON.parse(process.env.TWITTER_COOKIES);
      } catch (error) {
        log.error(
          "Failed to parse TWITTER_COOKIES environment variable:",
          error
        );
        throw new Error(
          "TWITTER_COOKIES environment variable contains invalid JSON"
        );
      }
    }
    const cookiesPath = path.join(__dirname, "ai", "config", "cookies.json");
    const cookiesData = await fs.readFile(cookiesPath, "utf-8");
    return JSON.parse(cookiesData);
  } catch (error) {
    log.error("Failed to load Twitter cookies:", error);
    throw new Error("Twitter cookies file is required but couldn't be loaded");
  }
}

// Initialize Turnkey client
const turnkeyClient = new Turnkey({
  apiBaseUrl: process.env.TURNKEY_API_URL!,
  apiPrivateKey: process.env.TURNKEY_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORG_ID!,
});

log.info(`Initializing Agent ${user}...`);
const instance = await ai.initialize({
  databaseUrl: process.env.DATABASE_URL!,
  llmConfig: {
    apiKey: process.env.TOGETHER_API_KEY!,
    baseURL: process.env.TOGETHER_API_URL!,
    llm: {
      model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      temperature: 0.7,
    },
    analyzer: {
      model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      temperature: 0.3,
    },
    imageGeneration: {
      model: "black-forest-labs/FLUX.1.1-pro",
      moderationModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    },
  },
  character: duckyCharacter,
  refreshCharacterOnRestart: true,
  toolsDir: path.join(__dirname, "./ai/tools"),
  scheduledPosts: {
    enabled: true,
  },
  platforms: {
    telegram: {
      enabled: false,
      token: process.env.TELEGRAM_BOT_TOKEN!,
    },
    twitter: {
      enabled: true,
      cookies: await loadTwitterCookies(),
      username: "duckunfiltered",
      debug: {
        checkMentionsOnStartup: false,
      },
      checkInterval: "*/2 * * * *",
      maxTweetsPerCheck: 30,
      rateLimit: {
        userMaxPerHour: 5,
        globalMaxPerHour: 30,
      },
    },
    echoChambers: {
      enabled: true,
      apiKey: process.env.ECHOCHAMBERS_API_KEY!,
      baseUrl: process.env.ECHOCHAMBERS_API_URL!,
    },
    p2p: {
      turnkeyClient: turnkeyClient,
      address:
        user === "ducky"
          ? process.env.ADDRESS_DUCKY!
          : process.env.ADDRESS_SOULIE!,
      enabled: true,
      port: user === "ducky" ? 8001 : 8002,
      privateKey:
        user === "ducky"
          ? process.env.PRIVATE_KEY!
          : process.env.PRIVATE_KEY_2!,
      initialPeers:
        user === "ducky"
          ? [
              "/ip4/127.0.0.1/tcp/8002/p2p/12D3KooWQAvECRBqh8iArmzvBDksSWUVbHzPD5sy4hQ1eVZRecYM",
            ]
          : [
              "/ip4/127.0.0.1/tcp/8001/p2p/12D3KooWSWxvpnKXT8aNXKbxuGEmhQWHzo16PRKtTk3R2ga9vtns",
            ],
    },
  },
  quantum: {
    enabled: true,
    checkInitialState: false,
    cronSchedule: "0 */4 * * *",
    ibmConfig: {
      apiToken: process.env.IBM_QUANTUM_API_TOKEN!,
      backend: "ibm_brisbane",
      timeout: 30000,
    },
  },
  platformDefaults: {
    telegram: config.telegram,
    twitter: config.twitter,
  },
});

// Schedule market update post
await instance.schedulePost({
  type: "marketUpdate",
  schedule: "30 * * * *",
  enabled: false,
  test: true,
  prompt: duckyCharacter.prompts?.marketUpdate?.system as string,
  tools: ["market-analyzer"],
  promptConfig: {
    includeCharacterSettings: {
      personality: true,
      bio: true,
    },
    style: {
      platform: "twitter",
      responseType: "custom_market_update",
      includeDefaultStyles: true,
    },
  },
});

// Schedule movers alpha post
await instance.schedulePost({
  type: "moversAlpha",
  schedule: "10 */1 * * *",
  enabled: false,
  test: true,
  prompt: duckyCharacter.prompts?.tokenAnalysis?.system as string,
  tools: ["price-movement-analyzer"],
  promptConfig: {
    style: {
      platform: "twitter",
      responseType: "tweet_reply",
    },
  },
});

// Schedule market cap analysis
await instance.schedulePost({
  type: "marketCapAnalysis",
  schedule: "20 */4 * * *",
  enabled: false,
  test: true,
  prompt: duckyCharacter.prompts?.marketCapAnalysis?.system as string,
  tools: ["market-cap-analyzer"],
  promptConfig: {
    style: {
      platform: "twitter",
      responseType: "tweet_reply",
    },
  },
});

// Schedule project updates with image
await instance.schedulePost({
  type: "projectUpdates",
  schedule: "0 */2 * * *",
  enabled: false,
  prompt: duckyCharacter.prompts?.projectUpdates?.system as string,
  tools: ["get-timeline-data"],
  toolParams: {
    username: "0xglu",
    limit: 20,
    excludeRetweets: true,
  },
  promptConfig: {
    style: {
      platform: "twitter",
      responseType: "tweet_reply",
      includeDefaultStyles: true,
    },
    includeCharacterSettings: {
      tone: true,
      guidelines: true,
    },
    additionalContext: {
      maxLength: 280,
      requiresImage: false,
    },
  },
  test: true,
});

// poll echochambers every 10 seconds
await sendMessage("Hello, world!", "coding");
setInterval(async () => {
  const history = await getChatHistory("coding");
  if (history.length > 0) {
    await instance.schedulePost({
      type: "echochambers",
      schedule: "0 */2 * * *",
      enabled: true,
      deliverOption: "echochambers",
      prompt: duckyCharacter.prompts?.echochambers?.system as string,
      tools: [],
      promptConfig: {
        style: {
          platform: "echoChambers",
          responseType: "custom_echo_reply",
          includeDefaultStyles: true,
        },
        includeCharacterSettings: {
          tone: true,
          guidelines: true,
          bio: true,
          personality: true,
        },
        additionalContext: {
          maxLength: 280,
          requiresImage: false,
        },
      },
      test: true,
    });
  }
  console.log(history);
}, 10000);

// Example P2P messages (commented out)
//await new Promise((resolve) => setTimeout(resolve, 5000));
//await instance.sendP2PQuestion("What is the meaning of life?");
//await instance.sendP2PMessage("Hello!", "PEER_ADDRESS_HERE");
