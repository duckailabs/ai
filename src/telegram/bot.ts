import { buildTelegramPrompt } from "./prompt";
import type { TelegramBotOptions } from "./types";
import { callWorker } from "@/twitter/worker";
import { ensureDebugModulePatched } from "@/utils/debug-shim";

import type { Bot as GrammyBot, Context as GrammyContext } from "grammy";

type BotInstance = GrammyBot<GrammyContext>;
type TelegramContext = GrammyContext;

export class TelegramBot {
  private bot: BotInstance | null = null;
  private isRunning = false;
  private options: TelegramBotOptions;

  constructor(options: TelegramBotOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.ensureBot();
    this.bot!.start();
    this.isRunning = true;
    console.log("Telegram bot started");

    process.once("SIGINT", () => this.stop());
    process.once("SIGTERM", () => this.stop());
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    if (this.bot) {
      await this.bot.stop();
    }
    this.isRunning = false;
    console.log("Telegram bot stopped");
  }

  private async ensureBot(): Promise<void> {
    if (this.bot) return;

    ensureDebugModulePatched();
    const grammy = (await import("grammy")) as typeof import("grammy");
    this.bot = new grammy.Bot<TelegramContext>(this.options.token);
    this.registerHandlers();
  }

  private registerHandlers(): void {
    if (!this.bot) return;

    this.bot.on("message:text", async (ctx) => {
      try {
        const message = ctx.message.text.trim();
        if (!message || message.startsWith("/")) {
          return;
        }

        const prompt = buildTelegramPrompt(message, {
          username: ctx.from?.username,
        });

        const reply = await callWorker(prompt, {
          sessionContext: {
            conversationId:
              this.options.conversationPrefix ??
              `telegram-${ctx.chat.id}`,
            userMessageId: ctx.message.message_id.toString(),
          },
        });

        await ctx.reply(reply);
      } catch (error) {
        console.error("telegram_reply_error", error);
        await safeReply(ctx, "Sorry, I ran into an error. Please try again.");
      }
    });
  }
}

async function safeReply(ctx: TelegramContext, text: string) {
  try {
    await ctx.reply(text);
  } catch (error) {
    console.error("telegram_safe_reply_error", error);
  }
}
