import type { Platform } from "@/types";
import type { EventService } from "../services/Event";
import type { LLMManager } from "./llm";

interface ImageRequestOptions {
  messageId: string;
  sessionId?: string;
  platform: Platform;
  user: {
    id: string;
    username?: string;
  };
}

export class ImageManager {
  private processingRequests: Map<string, boolean> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000;

  constructor(
    private llmManager: LLMManager,
    private eventService: EventService
  ) {}

  async generateImage(prompt: string, options: ImageRequestOptions) {
    try {
      // Check if user has pending request
      if (this.processingRequests.get(options.user.id)) {
        await this.createRateLimitEvent(options);
        throw new Error("Already processing an image request");
      }

      // Set processing state
      this.processingRequests.set(options.user.id, true);
      const startTime = Date.now();

      // Create start event
      await this.createStartEvent(prompt, options);

      // Check moderation
      const moderationResult = await this.llmManager.moderateContent(prompt);

      if (!moderationResult.isAppropriate) {
        await this.createInvalidEvent(prompt, options, moderationResult.reason);
        throw new Error(moderationResult.reason);
      }

      // Generate image
      const result = await this.llmManager.generateImage(prompt);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Create completion event
      await this.createCompletionEvent(prompt, options, {
        imageUrl: result.url || "",
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      await this.createFailedEvent(prompt, options, error);
      throw error;
    } finally {
      this.processingRequests.delete(options.user.id);
    }
  }

  private async createStartEvent(prompt: string, options: ImageRequestOptions) {
    return this.eventService.createInteractionEvent("interaction.started", {
      input: prompt,
      responseType: "image_generation",
      platform: options.platform,
      timestamp: new Date().toISOString(),
      messageId: options.messageId,
      sessionId: options.sessionId,
      user: options.user,
      imageGeneration: {
        prompt,
      },
    });
  }

  private async createCompletionEvent(
    prompt: string,
    options: ImageRequestOptions,
    result: { imageUrl: string; processingTime: number }
  ) {
    return this.eventService.createInteractionEvent("interaction.completed", {
      input: prompt,
      response: "Image generated successfully",
      responseType: "image_generation",
      platform: options.platform,
      processingTime: result.processingTime,
      timestamp: new Date().toISOString(),
      messageId: options.messageId,
      sessionId: options.sessionId,
      user: options.user,
      imageGeneration: {
        prompt,
        imageUrl: result.imageUrl,
      },
    });
  }

  private async createFailedEvent(
    prompt: string,
    options: ImageRequestOptions,
    error: unknown
  ) {
    return this.eventService.createInteractionEvent("interaction.failed", {
      input: prompt,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      messageId: options.messageId,
      sessionId: options.sessionId,
      user: options.user,
      imageGeneration: {
        prompt,
        stage: "generation",
        technicalDetails: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    });
  }

  private async createInvalidEvent(
    prompt: string,
    options: ImageRequestOptions,
    reason: string
  ) {
    return this.eventService.createInteractionEvent("interaction.invalid", {
      input: prompt,
      reason,
      timestamp: new Date().toISOString(),
      user: options.user,
      imageGeneration: {
        prompt,
        stage: "moderation",
      },
    });
  }

  private async createRateLimitEvent(options: ImageRequestOptions) {
    return this.eventService.createInteractionEvent(
      "interaction.rate_limited",
      {
        limit: 1,
        resetTime: new Date(Date.now() + this.DEFAULT_TIMEOUT).toISOString(),
        timestamp: new Date().toISOString(),
        user: options.user,
        imageGeneration: {
          stage: "moderation",
        },
      }
    );
  }
}
