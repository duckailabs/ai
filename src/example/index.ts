import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import path from "path";
import { ai } from "../core/ai";
import * as schema from "../db";
import { createDuckyCharacter } from "./ai/character/ducky";

dotenv.config();

async function runExample() {
  // Initialize AI
  const agent = new ai({
    databaseUrl: process.env.DATABASE_URL!,
    llmConfig: {
      apiKey: process.env.OPENAI_API_KEY!,
      llm: {
        model: "gpt-4-turbo-preview",
        temperature: 0.7,
      },
      analyzer: {
        model: "gpt-3.5-turbo",
        temperature: 0.3,
      },
    },
    toolsDir: path.join(__dirname, "ai/tools"),
  });

  try {
    // 1. Try to find existing character or create new one
    console.log("Looking for existing Ducky character...");
    let character;

    const characters = await agent.db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.name, "Ducky"));

    if (characters.length > 0) {
      console.log("Found existing Ducky character!");
      character = characters[0];
    } else {
      console.log("Creating new Ducky character...");
      const duckyConfig = await createDuckyCharacter();
      character = await agent.createCharacter(duckyConfig);
    }

    // 2. Twitter Raw Mode Example
    console.log("\n=== Testing raw mode with BTC price tool ===");
    const rawResponse = await agent.interact(
      {
        system:
          "Generate a single tweet. No hashtags, quotes, or waddling references. Be original and avoid starting with 'Sometimes'.",
        user: "To continue growing my Twitter following and building a cult-like community around Ducky through engaging content about being a web3/crypto degen.",
      },
      {
        tools: ["btc-price"],
        characterId: character.id,
        mode: "enhanced",
        platform: "twitter",
        responseType: "tweet_create",
      }
    );
    console.log("Twitter Response:", rawResponse.content);

    // 7. Mixed Mode Example with Custom Injection
    console.log("\n=== Testing mixed mode with custom injection ===");
    const mixedResponse = await agent.interact(
      {
        system: "Be original and avoid starting with 'Sometimes'.",
        user: "To continue growing my Twitter following and building a cult-like community around Ducky through engaging content about being a web3/crypto degen.",
      },
      {
        characterId: character.id,
        mode: "mixed",
        platform: "twitter",
        responseType: "tweet_create",
        injections: {
          customInjections: [
            {
              name: "btc_context",
              content:
                "Focus on the recent price action and market sentiment. " +
                "If BTC is up > 5% in 7 days, be cautiously optimistic. " +
                "If BTC is down > 5% in 7 days, be sarcastically bearish. " +
                "Never reveal the exact price numbers.",
              position: "before",
            },
          ],
        },
        tools: ["btc-price"],
      }
    );
    console.log("Mixed Mode Response:", mixedResponse.content);
  } catch (error) {
    console.error("Error running example:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.stack);
    }
  }
}

// Run the example
runExample()
  .then(() => {
    console.log("Example completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Example failed:", error);
    process.exit(1);
  });
