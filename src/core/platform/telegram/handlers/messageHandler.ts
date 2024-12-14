import type { AICore } from "@/core/ai";
import type { InteractionDefaults } from "@/types";
import { Context } from "telegraf";
import type { Message } from "telegraf/types";
import { PromptService } from "../PromptService";

interface ProcessingMessage {
  timestamp: number;
  messageId: number;
}

export class MessageHandler {
  private processingMessages: Map<number, ProcessingMessage> = new Map();
  private readonly PROCESSING_TIMEOUT = 30000;
  private readonly MAX_MESSAGE_LENGTH = 4096;
  private readonly RATE_LIMIT_WINDOW = 60000;
  private readonly MAX_MESSAGES_PER_WINDOW = 10;
  private messageCounter: Map<number, { count: number; windowStart: number }> =
    new Map();
  private promptService: PromptService;

  constructor(private ai: AICore, private defaults?: InteractionDefaults) {
    this.setupCleanupInterval();
    this.promptService = new PromptService();
  }

  public async handle(ctx: Context, characterId: string) {
    const message = ctx.message as Message.TextMessage;
    if (!this.isValidMessage(message)) {
      return;
    }

    const userId = message.from?.id;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    try {
      if (userId && !this.checkRateLimit(userId)) {
        await ctx.reply(
          "You are sending too many messages. Please wait a moment before trying again."
        );
        return;
      }

      if (userId && this.isProcessing(userId)) {
        await ctx.reply(
          "Still processing your previous message! Please wait a moment..."
        );
        return;
      }

      if (userId) {
        this.setProcessingState(userId, messageId);
        await ctx.sendChatAction("typing");
      }

      // Add user message to history
      this.promptService.addToHistory(chatId, {
        role: "user",
        content: message.text,
        timestamp: message.date,
        messageId: message.message_id,
        username:
          message.from?.username || `${message.from?.first_name || "User"}`,
      });

      const response = await this.processMessage(message, characterId);

      if (!response) {
        console.error("No response from AI");
        return;
      }

      // Add assistant's response to history
      this.promptService.addToHistory(chatId, {
        role: "assistant",
        content: response,
        timestamp: Math.floor(Date.now() / 1000),
        messageId: messageId + 1,
        username: "Ducky",
      });

      return response;
    } catch (error) {
      await this.handleError(ctx, error);
    } finally {
      if (userId) {
        this.clearProcessingState(userId);
      }
    }
  }

  private async processMessage(
    message: Message.TextMessage,
    characterId: string
  ) {
    // Get default options either from config or use basic defaults
    const defaultOptions = this.defaults || {
      mode: "enhanced" as const,
      platform: "telegram" as const,
      responseType: "telegram_chat",
      characterId,
    };

    const chatHistory = this.promptService.formatChatHistory(message.chat.id);

    // Complete the options with required fields
    const interactionOptions = {
      ...defaultOptions,
      characterId,
      userId: message.from?.id.toString() || "",
      chatId: message.chat.id.toString(),
      messageId: message.message_id.toString(),
      username: message.from?.username,
    };

    // Process with the AI
    const response = await this.ai.interact(
      {
        system: this.promptService.buildSystemPrompt(
          message.from?.username || "",
          message.from?.first_name || "",
          message.from?.last_name || "",
          !!message.reply_to_message,
          chatHistory
        ),
        user: message.text,
      },
      interactionOptions
    );

    return response?.content ?? null;
  }

  private isValidMessage(message: any): message is Message.TextMessage {
    if (!message?.text || typeof message.text !== "string") {
      return false;
    }

    if (message.text.trim().length === 0) {
      return false;
    }

    if (!message.from?.id || !message.chat?.id || !message.message_id) {
      return false;
    }

    return true;
  }

  private isProcessing(userId: number): boolean {
    const processingMessage = this.processingMessages.get(userId);
    if (!processingMessage) return false;

    const elapsed = Date.now() - processingMessage.timestamp;
    return elapsed < this.PROCESSING_TIMEOUT;
  }

  private setProcessingState(userId: number, messageId: number) {
    this.processingMessages.set(userId, {
      timestamp: Date.now(),
      messageId,
    });
  }

  private clearProcessingState(userId: number) {
    this.processingMessages.delete(userId);
  }

  private setupCleanupInterval() {
    setInterval(() => {
      const now = Date.now();

      // Cleanup processing messages
      for (const [userId, message] of this.processingMessages) {
        if (now - message.timestamp > this.PROCESSING_TIMEOUT) {
          this.processingMessages.delete(userId);
        }
      }

      // Cleanup rate limit counters
      for (const [userId, data] of this.messageCounter) {
        if (now - data.windowStart > this.RATE_LIMIT_WINDOW) {
          this.messageCounter.delete(userId);
        }
      }
    }, 60000);
  }

  private checkRateLimit(userId: number): boolean {
    const now = Date.now();
    const userMessages = this.messageCounter.get(userId);

    if (
      !userMessages ||
      now - userMessages.windowStart > this.RATE_LIMIT_WINDOW
    ) {
      this.messageCounter.set(userId, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    if (userMessages.count >= this.MAX_MESSAGES_PER_WINDOW) {
      return false;
    }

    userMessages.count++;
    return true;
  }

  private async handleError(ctx: Context, error: any) {
    console.error("Error handling message:", error);

    let errorMessage = "An error occurred processing your message.";

    if (error.code === "ETIMEDOUT") {
      errorMessage = "Request timed out. Please try again.";
    } else if (error.response?.status === 429) {
      errorMessage =
        "Too many requests. Please wait a moment before trying again.";
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
