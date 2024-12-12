import { dbSchemas } from "@/db";
import type { Character } from "@/db/schema/schema";
import type {
  LLMResponse,
  Platform,
  ResponseType,
  StyleSettings,
} from "@/types";
import crypto from "crypto";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CharacterManager } from "../managers/character";
import type { LLMManager } from "../managers/llm";
import type { MemoryManager } from "../managers/memory";
import { PreprocessingManager } from "../managers/preprocess";
import type { StyleManager } from "../managers/style";
import type { ToolManager } from "../managers/tools";
import type { TwitterClient } from "../platform/twitter/api/src/client";
import type {
  InteractionEventType,
  InteractionOptions,
  InteractionResult,
} from "../types";
import { EventService } from "./Event";

interface PromptContext {
  system: string;
  user: string;
  character: Character | null;
  messageId: string;
  styleContext: {
    responseType: ResponseType;
    platform: Platform;
    styleSettings: StyleSettings;
  };
  sessionId: string;
  startTime: number;
}

export class InteractionService {
  private preprocessingManager: PreprocessingManager;
  private twitterClient?: TwitterClient;

  constructor(
    private db: PostgresJsDatabase<typeof dbSchemas>,
    private characterManager: CharacterManager,
    private styleManager: StyleManager,
    private llmManager: LLMManager,
    private memoryManager: MemoryManager,
    private eventService: EventService,
    private toolManager: ToolManager,
    twitterClient?: TwitterClient
  ) {
    this.preprocessingManager = new PreprocessingManager(twitterClient);
    this.twitterClient = twitterClient;
  }

  async handleInteraction(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ): Promise<InteractionResult> {
    return this.db.transaction(async (tx) => {
      try {
        // Initialize context
        const context = await this.initializeContext(input, options);

        const preprocessingResults = await this.preprocessingManager.process({
          platform: options.platform,
          text: typeof input === "string" ? input : input.user,
          userId: options.userId,
          username: options.username,
          messageId: options.messageId,
        });
        // Add preprocessing results to custom injections
        if (preprocessingResults.length > 0) {
          options.injections = options.injections || {};
          options.injections.customInjections =
            options.injections.customInjections || [];
          options.injections.customInjections.push({
            name: "timeline",
            content:
              this.preprocessingManager.formatResults(preprocessingResults),
            position: "before",
          });
        }

        // Execute tools first if any are specified
        let toolResults: Record<string, any> = {};
        /* if (options.tools?.length) {
          toolResults = await this.toolManager.executeTools(
            options.tools,
            options.toolContext
          );
        } */
        // Process prompt with injections and tool results
        const finalSystem = await this.buildFinalPrompt(
          context,
          options,
          toolResults
        );

        // Create start event if we have a character
        if (context.character) {
          await this.createStartEvent(context, options);
        }

        // Generate and process response
        const response = await this.processResponse(
          finalSystem,
          context,
          options
        );

        // Handle completion tasks
        if (context.character) {
          await this.handleCompletion(response, context, options);
        }

        return this.formatResult(
          response,
          context.character,
          context.styleContext,
          await this.buildLLMContext(context, options)
        );
      } catch (error) {
        console.error("Error in handleInteraction:", error);
        await this.handleError(error, options, input);
        throw error;
      }
    });
  }

  private async buildFinalPrompt(
    context: PromptContext,
    options: InteractionOptions,
    toolResults: Record<string, any>
  ): Promise<string> {
    let finalSystem = context.system;

    if (context.character) {
      finalSystem = await this.injectCharacterInfo(
        finalSystem,
        context.character
      );

      // Default both injections to true unless explicitly set to false
      if (options.injections?.injectPersonality !== false) {
        finalSystem = await this.injectPersonality(
          finalSystem,
          context.character
        );
      }

      if (options.injections?.injectStyle !== false) {
        finalSystem = await this.injectStyle(finalSystem, context.styleContext);
      }
      if (
        options.injections?.injectOnchain !== false &&
        context.character.onchain
      ) {
        finalSystem = await this.injectOnchain(finalSystem, context.character);
      }
    }

    if (options.injections?.customInjections) {
      finalSystem = await this.handleCustomInjections(
        finalSystem,
        options.injections.customInjections
      );
    }

    if (
      options.injections?.injectIdentity !== false &&
      context.character?.identity
    ) {
      finalSystem = await this.injectIdentity(finalSystem, context.character);
    }

    // Inject tool results if any exist
    if (Object.keys(toolResults).length > 0) {
      const formattedResults = this.toolManager.formatToolResults(toolResults);
      finalSystem += `\n\nAvailable Data:${formattedResults}`;
    }

    return finalSystem;
  }

  private async initializeContext(
    input: string | { system: string; user: string },
    options: any
  ): Promise<PromptContext> {
    const { system, user } = this.parseInput(input);

    try {
      const [character, styleContext] = await Promise.all([
        options.characterId
          ? this.characterManager.getCharacter(options.characterId)
          : null,
        this.resolveStyleSettings(options),
      ]);

      if (options.characterId && !character) {
        throw new Error(`Character not found: ${options.characterId}`);
      }

      const context = {
        system,
        user,
        character,
        styleContext,
        sessionId: crypto.randomUUID(),
        startTime: Date.now(),
        messageId: options.messageId,
      };

      return context;
    } catch (error) {
      console.error("Error in initializeContext:", error);
      throw error;
    }
  }

  private async processResponse(
    system: string,
    context: PromptContext,
    options: {
      temperature?: number;
      maxTokens?: number;
      mode?: string;
      responseType?: string;
      [key: string]: any;
    }
  ): Promise<LLMResponse> {
    try {
      // Build the LLM context with all available information
      const llmContext = await this.buildLLMContext(context, options);

      // Prepare messages for the LLM
      const messages = await this.llmManager.preparePrompt(system, {
        ...llmContext,
        user: context.user,
        styleSettings: context.styleContext.styleSettings,
        responseType: context.styleContext.responseType,
      });
      // Generate the response with the configured settings
      const response = await this.llmManager.generateResponsev2(messages, {
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        styleSettings: context.styleContext.styleSettings,
        responseType: context.styleContext.responseType,
      });

      // Enhance the response metadata
      const enhancedResponse: LLMResponse = {
        content: response.content,
        metadata: {
          ...response.metadata,
          context: {
            mode: options.mode,
            responseType: options.responseType,
            characterId: context.character?.id,
          },
          usage: response.metadata?.usage
            ? {
                promptTokens: response.metadata.usage.prompt_tokens,
                completionTokens: response.metadata.usage.completion_tokens,
                totalTokens: response.metadata.usage.total_tokens,
              }
            : {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
        },
      };
      return enhancedResponse;
    } catch (error) {
      console.error("Error processing response:", error);

      // If it's an OpenAI error, try to extract useful information
      if (error instanceof Error) {
        const errorMessage =
          error.message || "Unknown error during response processing";
        throw new Error(`Failed to process response: ${errorMessage}`);
      }

      // For unknown errors
      throw new Error(
        "An unexpected error occurred while processing the response"
      );
    }
  }
  private async handleCompletion(
    response: LLMResponse,
    context: PromptContext,
    options: InteractionOptions
  ): Promise<void> {
    await Promise.all([
      this.eventService.createInteractionEvent("interaction.completed", {
        input: context.user,
        response: response.content,
        responseType: context.styleContext.responseType,
        platform: context.styleContext.platform,
        processingTime: Date.now() - context.startTime,
        messageId: context.messageId,
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        metrics: {
          tokenCount: response.metadata?.usage?.totalTokens || 0,
          promptTokens: response.metadata?.usage?.promptTokens || 0,
          completionTokens: response.metadata?.usage?.completionTokens || 0,
        },
        user: {
          id: options.userId,
          username: options.username,
        },
      }),
      this.memoryManager.addMemory(
        context.character!.id,
        response.content,
        context.user,
        {
          type: "interaction",
          context: context.styleContext,
          metadata: {
            responseType: context.styleContext.responseType,
            platform: context.styleContext.platform,
            userInput: context.user,
            sessionId: context.sessionId,
          },
        }
      ),
    ]);
  }

  private async createStartEvent(
    context: PromptContext,
    options: InteractionOptions
  ): Promise<void> {
    await this.eventService.createInteractionEvent("interaction.started", {
      input: context.user,
      responseType: context.styleContext.responseType,
      platform: context.styleContext.platform,
      timestamp: new Date().toISOString(),
      sessionId: context.sessionId,
      messageId: context.messageId,
      user: {
        id: options.userId,
        username: options.username,
      },
    });
  }

  private async handleError(
    error: unknown,
    options: InteractionOptions,
    input: string | { system: string; user: string }
  ): Promise<void> {
    if (options.characterId) {
      const eventType = this.determineErrorEventType(error);
      await this.eventService.createInteractionEvent(eventType, {
        input: typeof input === "string" ? input : JSON.stringify(input),
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
        sessionId: options.sessionId,
        messageId: options.messageId,
        user: {
          id: options.userId,
          username: options.username,
        },
      });
    }
  }

  // Utility methods
  private parseInput(input: string | { system: string; user: string }): {
    system: string;
    user: string;
  } {
    if (typeof input === "string") {
      const systemMatch = input.match(/<system>([\s\S]*?)<\/system>/);
      const userMatch = input.match(/<user>([\s\S]*?)<\/user>/);

      if (!systemMatch || !userMatch) {
        throw new Error(
          "Invalid XML format. Expected <system> and <user> tags."
        );
      }

      return {
        system: systemMatch[1].trim(),
        user: userMatch[1].trim(),
      };
    }

    return {
      system: input.system.trim(),
      user: input.user.trim(),
    };
  }

  private async resolveStyleSettings(options: any) {
    const responseType = (options.responseType ||
      "generic_chat") as ResponseType;
    const platform = await this.styleManager.getPlatformFromResponseType(
      options.characterId,
      responseType
    );

    const character = await this.characterManager.getCharacter(
      options.characterId
    );
    if (!character) throw new Error("Character not found");

    const styleSettings = await this.styleManager.getStyleSettings(
      character.responseStyles,
      platform,
      responseType
    );

    return {
      responseType,
      platform,
      styleSettings,
    };
  }

  private async injectCharacterInfo(
    system: string,
    character: Character
  ): Promise<string> {
    return `${system}\n\nCharacter Information:\n- Name: ${character.name}\n \
    - Bio: ${character.bio}`;
  }

  private async injectPersonality(
    system: string,
    character: Character
  ): Promise<string> {
    return `You are ${
      character.name
    }.\n\nPersonality: ${character.personalityTraits.join(", ")}\n\n${system}`;
  }

  private async injectIdentity(
    system: string,
    character: Character
  ): Promise<string> {
    if (!character.identity) return system;

    // Convert identity object to readable format
    const identityInfo = Object.entries(character.identity)
      .map(([key, value]) => {
        const formattedKey = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();

        // Handle both string and array values
        const formattedValue = Array.isArray(value) ? value.join(", ") : value;

        return `- ${formattedKey}: ${formattedValue}`;
      })
      .join("\n");

    return `${system}\n\nIdentity Information:\n${identityInfo}`;
  }

  private async injectStyle(
    system: string,
    styleContext: { styleSettings: StyleSettings }
  ): Promise<string> {
    const { styleSettings } = styleContext;

    // Convert the entire styleSettings object to a structured format
    let injection = "\nStyle Settings:";

    if (styleSettings.tone?.length) {
      injection += `\n- Tone: ${styleSettings.tone.join(", ")}`;
    }

    if (styleSettings.guidelines?.length) {
      injection += `\n- Guidelines:\n  ${styleSettings.guidelines
        .map((g) => `• ${g}`)
        .join("\n  ")}`;
    }

    if (styleSettings.formatting) {
      injection += "\n- Formatting:";
      if (styleSettings.formatting.maxLength) {
        injection += `\n  • Maximum Length: ${styleSettings.formatting.maxLength} characters`;
      }
      if (styleSettings.formatting.customRules?.length) {
        injection += `\n  • Rules:\n    ${styleSettings.formatting.customRules
          .map((r) => `• ${r}`)
          .join("\n    ")}`;
      }
      if (typeof styleSettings.formatting.allowMarkdown === "boolean") {
        injection += `\n  • Markdown: ${
          styleSettings.formatting.allowMarkdown ? "allowed" : "not allowed"
        }`;
      }
    }

    return system + injection;
  }

  private async injectOnchain(
    system: string,
    character: Character
  ): Promise<string> {
    if (!character.onchain || typeof character.onchain !== "object") {
      return system;
    }

    // Build onchain information dynamically
    const onchainInfo = Object.entries(character.onchain)
      .map(([key, value]) => {
        // Convert camelCase to Title Case with spaces
        const formattedKey = key
          .replace(/([A-Z])/g, " $1") // Add space before capital letters
          .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
          .trim();

        return `- ${formattedKey}: ${value}`;
      })
      .join("\n");

    return `${system}\n\nOnchain Information:\n${onchainInfo}`;
  }

  private async handleCustomInjections(
    system: string,
    injections: Array<{
      name: string;
      content: string;
      position: "before" | "after" | "replace";
    }>
  ): Promise<string> {
    return injections.reduce((result, injection) => {
      switch (injection.position) {
        case "before":
          return `${injection.content}\n\n${result}`;
        case "after":
          return `${result}\n\n${injection.content}`;
        case "replace":
          return injection.content;
        default:
          return result;
      }
    }, system);
  }

  private async buildLLMContext(
    context: PromptContext,
    options: any
  ): Promise<Record<string, any>> {
    return {
      ...options,
      character: context.character
        ? {
            name: context.character.name,
            personality: context.character.personalityTraits.join(", "),
            beliefs: context.character.beliefSystem?.join(", "),
          }
        : undefined,
      responseType: context.styleContext.responseType,
      platform: context.styleContext.platform,
      styleSettings: context.styleContext.styleSettings,
      mode: options.mode || "enhanced",
    };
  }

  private formatResult(
    response: LLMResponse,
    character: Character | null,
    styleContext: {
      responseType: ResponseType;
      platform: Platform;
      styleSettings: StyleSettings;
    },
    context: Record<string, any>
  ): InteractionResult {
    return {
      content: response.content,
      metadata: {
        characterId: character?.id || "",
        responseType: styleContext.responseType,
        platform: styleContext.platform,
        styleSettings: styleContext.styleSettings,
        contextUsed: context,
        llmMetadata: response.metadata,
      },
    };
  }

  private determineErrorEventType(error: unknown): InteractionEventType {
    if (error instanceof Error) {
      if (error.message.includes("rate limit"))
        return "interaction.rate_limited";
      if (error.message.includes("validation")) return "interaction.invalid";
    }
    return "interaction.failed";
  }
}
