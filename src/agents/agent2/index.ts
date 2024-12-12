// USER AGENT
import { ai } from "@/core/ai";
import { log } from "@/core/utils/logger";
import { Turnkey } from "@turnkey/sdk-server";
import dotenv from "dotenv";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { duckyCharacter } from "./ai/character/ducky";
import { config } from "./ai/config";
// Get equivalent of __dirname in ESM
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
  coingecko: {
    enabled: false,
    apiKey: process.env.COINGECKO_API_KEY!,
    updateInterval: "0 0 * * *",
    initialScan: {
      enabled: true,
      batchSize: 50, // Process 5 coins in parallel
      delay: 6000,
    },
  },
  scheduledPosts: {
    enabled: false,
    debug: false,
  },
  platforms: {
    telegram: {
      enabled: false,
      token: process.env.TELEGRAM_BOT_TOKEN!,
    },
    api: {
      enabled: false,
      port: 3000,
      cors: {
        allowedOrigins: ["http://localhost"],
      },
    },
    twitter: {
      enabled: true,
      cookies: await loadTwitterCookies(),
      username: "duckunfiltered",
      debug: {
        checkMentionsOnStartup: false,
      },
      checkInterval: "*/2 * * * *", // Check every 2 minutes
      maxTweetsPerCheck: 30,
      rateLimit: {
        userMaxPerHour: 5,
        globalMaxPerHour: 30,
      },
    },
    p2p: {
      address:
        user === "ducky"
          ? process.env.ADDRESS_DUCKY!
          : process.env.ADDRESS_SOULIE!,
      turnkeyClient: turnkeyClient,
      enabled: true,
      port: user === "ducky" ? 8001 : 8002, // You can change this port or read from env
      privateKey:
        user === "ducky"
          ? process.env.PRIVATE_KEY!
          : process.env.PRIVATE_KEY_2!, // Add this to your .env file
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
    cronSchedule: "0 */4 * * *", // 4 hours
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

await instance.schedulePost({
  type: "marketUpdate",
  schedule: "30 * * * *",
  enabled: false,
  prompt: duckyCharacter.prompts?.marketUpdate?.system as string,
  tools: ["market-analyzer"],
  test: false,
});

await instance.schedulePost({
  type: "moversAlpha",
  schedule: "10 */1 * * *",
  enabled: false,
  prompt: duckyCharacter.prompts?.tokenAnalysis?.system as string,
  tools: ["price-movement-analyzer", "timeline-analyzer"],
  test: false,
});

await instance.schedulePost({
  type: "marketCapAnalysis",
  schedule: "20 */4 * * *",
  enabled: false,
  prompt: duckyCharacter.prompts?.marketCapAnalysis?.system as string,
  tools: ["market-cap-analyzer"],
  test: false,
});

await instance.schedulePost({
  type: "image",
  schedule: "0 */2 * * *",
  enabled: false,
  prompt: duckyCharacter.prompts?.imageGeneration?.system as string,
  tools: ["timeline-analyzer", "market-analyzer"],
  test: false,
});

// Example usage:
// To send a question that will reward with tokens:
