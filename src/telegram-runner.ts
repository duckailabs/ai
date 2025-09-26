import { config } from "dotenv";
config();

import { env } from "@/env";
import { TelegramBot } from "@/telegram";

async function main() {
  if (!env.telegram) {
    console.error("Telegram configuration missing; set TELEGRAM_BOT_TOKEN to enable bot.");
    process.exit(1);
  }

  const bot = new TelegramBot({
    token: env.telegram.token,
    characterId: env.telegram.characterId,
    conversationPrefix: env.telegram.conversationPrefix,
  });

  await bot.start();
}

main().catch((error) => {
  console.error("telegram_runner_error", error);
  process.exit(1);
});
