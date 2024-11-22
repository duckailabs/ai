import type { ai } from "@/core/ai";
import type { InteractionDefaults } from "@/types";
import { Context, Telegraf } from "telegraf";
import { MessageHandler } from "./handlers/messageHandler";

export class TelegramClient {
  private bot: Telegraf;
  private messageHandler: MessageHandler;
  private readonly MAX_MESSAGE_LENGTH = 4096;
  private readonly PROCESSING_TIMEOUT = 30000;
  private processingMessages: Map<number, number> = new Map(); // userId -> timestamp
  private isRunning: boolean = false;

  constructor(
    token: string,
    private ai: ai,
    private defaults?: InteractionDefaults
  ) {
    this.bot = new Telegraf(token);
    this.messageHandler = new MessageHandler(ai, defaults);
    this.setupMiddleware();
    this.setupHandlers();
  }

  public async start() {
    try {
      // Start the bot non-blocking
      this.bot
        .launch()
        .then(() => {
          this.isRunning = true;
          console.log("Telegram bot started successfully!");
        })
        .catch((error) => {
          console.error("Failed to start Telegram bot:", error);
          this.isRunning = false;
        });

      // Enable graceful stop
      process.once("SIGINT", () => this.stop());
      process.once("SIGTERM", () => this.stop());
    } catch (error) {
      console.error("Failed to initialize Telegram bot:", error);
      throw error;
    }
  }

  public async stop() {
    if (this.isRunning) {
      await this.bot.stop("SIGTERM");
      this.isRunning = false;
      console.log("Telegram bot stopped successfully");
    }
  }

  private setupMiddleware() {
    // Add access control middleware
    this.bot.use(async (ctx, next) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) return;

        // Reject private chats for now
        if (!chatId.startsWith("-")) {
          return;
        }

        const adminChatId = this.ai.character.identity?.telegram_admin_chat;
        if (!adminChatId) {
          console.error("No admin chat configured");
          return;
        }

        // For admin chat, allow everything
        if (chatId === adminChatId) {
          return next();
        }

        /*     // For other groups, only allow if they exist and are active in DB
          const group = await this.ai.db
            .select()
            .from(telegramGroups)
            .where(eq(telegramGroups.telegramId, chatId))
            .limit(1)
            .then(rows => rows[0] || null);

          // If group not in DB or not active, leave the chat */

        try {
          await ctx.leaveChat();
        } catch (error) {
          console.error("Failed to leave chat:", error);
        }
        return;
      } catch (error) {
        console.error("Middleware error:", error);
      }
    });
  }

  private setupHandlers() {
    // Handle text messages
    this.bot.on("text", async (ctx) => {
      try {
        const userId = ctx.from?.id;
        if (!userId) return;

        // Check if already processing
        if (this.isProcessing(userId)) {
          await ctx.reply(
            "Still processing your previous message! Please wait..."
          );
          return;
        }

        // Set processing state
        this.setProcessing(userId);

        // Show typing indicator
        await ctx.sendChatAction("typing");

        // Process message
        const response = await this.messageHandler.handle(
          ctx,
          this.ai.character.id
        );

        if (response) {
          // Handle long messages
          await this.sendResponse(ctx, response);
        }
      } catch (error) {
        await this.handleError(ctx, error);
      } finally {
        // Clear processing state
        if (ctx.from?.id) {
          this.clearProcessing(ctx.from.id);
        }
      }
    });

    // Error handling
    this.bot.catch((error: any) => {
      console.error("Telegram bot error:", error);
    });
  }

  private async sendResponse(ctx: Context, text: string) {
    try {
      if (text.length <= this.MAX_MESSAGE_LENGTH) {
        await ctx.reply(text, { parse_mode: "Markdown" });
        return;
      }

      // Split long messages
      const chunks = this.splitMessage(text);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" });
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between chunks
      }
    } catch (error) {
      // Fallback to plain text if markdown fails
      await ctx.reply(text.replace(/[*_`\[\]]/g, ""));
    }
  }

  private splitMessage(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const paragraphs = text.split("\n\n");
    for (const paragraph of paragraphs) {
      if (
        currentChunk.length + paragraph.length + 2 <=
        this.MAX_MESSAGE_LENGTH
      ) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  private isProcessing(userId: number): boolean {
    const timestamp = this.processingMessages.get(userId);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.PROCESSING_TIMEOUT;
  }

  private setProcessing(userId: number) {
    this.processingMessages.set(userId, Date.now());
  }

  private clearProcessing(userId: number) {
    this.processingMessages.delete(userId);
  }

  private async handleError(ctx: Context, error: any) {
    console.error("Error handling message:", error);

    let errorMessage = "An error occurred processing your message.";
    if (error.code === "ETIMEDOUT") {
      errorMessage = "Request timed out. Please try again.";
    } else if (error.message?.includes("context length")) {
      errorMessage =
        "Message is too long to process. Please try a shorter message.";
    }

    try {
      await ctx.reply(errorMessage);
    } catch (replyError) {
      console.error("Error sending error message:", replyError);
    }
  }
}
