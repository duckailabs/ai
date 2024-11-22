import { ai } from "@/core/ai";
import dotenv from "dotenv";
import path from "path";
import { duckyCharacter } from "./ai/character/ducky";
import { config } from "./ai/config";
dotenv.config();

console.log("Initializing agent ducky007...");
await ai.initialize({
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
  },
  platformDefaults: {
    telegram: config.telegram,
    twitter: config.twitter,
  },
});
