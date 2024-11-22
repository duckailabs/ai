import { ai } from "@/core/ai";
import { log } from "@/core/managers/libp2p";
import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { duckyCharacter } from "./ai/character/ducky";
import { config } from "./ai/config";

// Get equivalent of __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const args = process.argv.slice(2);
const port = args[0] ? parseInt(args[0]) : 8001;

log.info(`Initializing Agent Ducky 00${port === 8001 ? 7 : 8}...`);
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
  platforms: {
    telegram: {
      enabled: true,
      token: process.env.TELEGRAM_BOT_TOKEN!,
    },
    api: {
      enabled: false,
      port: 3000,
      cors: {
        allowedOrigins: ["http://localhost"],
      },
    },
    p2p: {
      enabled: false,
      port, // You can change this port or read from env
      privateKey: process.env.PRIVATE_KEY!, // Add this to your .env file
      initialPeers:
        port === 8001
          ? [
              "/ip4/127.0.0.1/tcp/8002/p2p/12D3KooWQAvECRBqh8iArmzvBDksSWUVbHzPD5sy4hQ1eVZRecYM",
            ]
          : [
              "/ip4/127.0.0.1/tcp/8001/p2p/12D3KooWSWxvpnKXT8aNXKbxuGEmhQWHzo16PRKtTk3R2ga9vtns",
            ],
    },
  },
  platformDefaults: {
    telegram: config.telegram,
    twitter: config.twitter,
  },
});

if (port === 8001) {
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await instance.sendP2PMessage(
    "Hey Ducky, lets code up some new ai tools for us to use in future prompts!"
  );
}
