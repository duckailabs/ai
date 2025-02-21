import type { Character, Coin } from "@/db/schema/schema";
import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ImageGenerationResult } from "../types";
import { log } from "../utils/logger";
import type { CharacterManager } from "./character";
import type { MarketUpdateData } from "./fatduck";
import { QuantumStateManager } from "./quantum";
import {
  QuantumPersonalityMapper,
  type QuantumPersonalitySettings,
} from "./quantum-personality";

interface MarketCapTimelineData {
  symbol: string;
  handle: string;
  marketCapChange: number;
  priceChange: number;
  tweets: {
    text: string;
    createdAt: string;
  }[];
}

interface MarketCapAnalysisResult {
  insights: string;
}

export interface TimelineTweet {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: string;
}

export interface TokenTimelineData {
  symbol: string;
  priceChange: number;
  handle: string;
  tweets: {
    text: string;
    createdAt: string;
  }[];
}

interface TokenAnalysisResult {
  selectedTokens: {
    symbol: string;
    priceChange: number;
    analysis: string;
  }[];
}

interface TimelineContext {
  recentTweets: TimelineTweet[];
  tokenMetrics?: Record<string, any>;
}

interface ScheduledPostContext {
  timelineContext?: TimelineContext;
}

export interface ScheduledMarketUpdateContext {
  marketUpdateContext?: MarketUpdateData;
}

export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  llm: {
    model: string;
    temperature?: number;
  };
  analyzer: {
    model: string;
    temperature?: number;
  };
  imageGeneration?: {
    model?: string;
    moderationModel?: string;
    style?: string;
    description?: string;
  };
}

export interface ModerationResult {
  isAppropriate: boolean;
  reason: string;
}

const DEFAULT_CONFIG: Partial<LLMConfig> = {
  llm: {
    model: "gpt-4-turbo-preview",
    temperature: 0.7,
  },
  analyzer: {
    model: "gpt-3.5-turbo",
    temperature: 0.3,
  },
  imageGeneration: {
    model: "black-forest-labs/FLUX.1.1-pro",
    moderationModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  },
};

export class LLMManager {
  private openai: OpenAI;
  private config: LLMConfig;
  private characterManager: CharacterManager;
  private quantumStateManager?: QuantumStateManager;
  private quantumPersonalityMapper?: QuantumPersonalityMapper;
  private character?: Character;

  constructor(
    config: LLMConfig & { quantumPersonalityMapper?: QuantumPersonalityMapper },
    characterManager: CharacterManager,
    quantumStateManager?: QuantumStateManager,
    character?: Character
  ) {
    this.config = config;
    this.characterManager = characterManager;
    this.quantumStateManager = quantumStateManager;
    this.quantumPersonalityMapper = config.quantumPersonalityMapper;
    this.character = character;
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });

    if (this.quantumPersonalityMapper) {
      log.info("LLM Manager initialized with quantum personality mapper");
    }
  }
  /**
   * @deprecated
   */
  async generateResponse(
    messages: ChatCompletionMessageParam[],
    options?: Record<string, any>
  ) {
    try {
      let temperature = this.config.llm.temperature ?? 0.7;
      let personalitySettings: QuantumPersonalitySettings | undefined;

      if (this.quantumPersonalityMapper) {
        personalitySettings =
          await this.quantumPersonalityMapper.mapQuantumToPersonality();
        temperature = personalitySettings.temperature;
        log.warn("Using quantum personality settings:", {
          temperature,
          traits: personalitySettings.personalityTraits,
          modifiers: personalitySettings.styleModifiers,
        });
      }

      // Get character's base personality and style settings
      const character = await this.characterManager.getCharacter();
      const baseSettings = character?.responseStyles?.default ?? {
        tone: [],
        personality: [],
        guidelines: [],
      };

      // Merge base settings with quantum settings
      const mergedSettings = {
        tone: [
          ...new Set([
            ...(baseSettings.tone ?? []),
            ...(personalitySettings?.styleModifiers.tone ?? []),
          ]),
        ],
        personality: [
          ...new Set([
            ...(baseSettings.personality ?? []),
            ...(personalitySettings?.personalityTraits ?? []),
          ]),
        ],
        guidelines: [
          ...new Set([
            ...baseSettings.guidelines,
            ...(personalitySettings?.styleModifiers.guidelines ?? []),
          ]),
        ],
      };

      // Construct system message with merged settings
      const systemMessage = messages.find((m) => m.role === "system");
      if (systemMessage && typeof systemMessage.content === "string") {
        const enhancedSystemPrompt = `
You are ${character?.name ?? "an AI assistant"}.

Personality traits: ${mergedSettings.personality.join(", ")}
Tone: ${mergedSettings.tone.join(", ")}

Core Guidelines:
${character.responseStyles.default.guidelines.map((g) => `- ${g}`).join("\n")}

Platform Guidelines:
${character.responseStyles.platforms.telegram?.defaultGuidelines
  .map((g) => `- ${g}`)
  .join("\n")}

Dynamic Guidelines:
${mergedSettings.guidelines
  .filter(
    (g) =>
      !character.responseStyles.default.guidelines.includes(g) &&
      !character.responseStyles.platforms.telegram?.defaultGuidelines.includes(
        g
      )
  )
  .map((g) => `- ${g}`)
  .join("\n")}

Base instruction: ${systemMessage.content}
`;

        /* log.warn("Final prompt construction:", {
          systemPrompt: enhancedSystemPrompt,
          temperature,
          mergedSettings,
        }); */

        // Update the system message with enhanced prompt
        systemMessage.content = enhancedSystemPrompt;
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        messages,
        temperature,
        ...options,
      });

      return {
        content: response.choices[0].message.content ?? "",
        metadata: {
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0].finish_reason,
          temperature,
          personalitySettings: mergedSettings,
        },
      };
    } catch (error) {
      console.error("Error generating response:", error);
      throw error;
    }
  }

  async generateResponsev2(
    messages: ChatCompletionMessageParam[],
    options?: Record<string, any>
  ) {
    try {
      // Get quantum personality settings if available
      let personalitySettings: QuantumPersonalitySettings | undefined;
      if (this.quantumPersonalityMapper) {
        personalitySettings =
          await this.quantumPersonalityMapper.mapQuantumToPersonality();

        // Use quantum temperature
        const temperature = personalitySettings.temperature;

        // Let's log what we're getting from InteractionService and what we're adding

        // Create response with quantum settings but keep InteractionService guidelines
        const response = await this.openai.chat.completions.create({
          model: this.config.llm.model,
          messages,
          temperature,
          ...options,
        });

        return {
          content: response.choices[0].message.content ?? "",
          metadata: {
            model: response.model,
            usage: response.usage,
            finishReason: response.choices[0].finish_reason,
            temperature,
            personalitySettings: {
              // Use quantum settings for these
              tone: personalitySettings.styleModifiers.tone,
              personality: personalitySettings.personalityTraits,
              // Keep the guidelines from InteractionService
              guidelines: options?.styleSettings?.guidelines || [],
              temperature,
            },
            context: {
              responseType: options?.responseType,
              characterId: options?.characterId,
            },
          },
        };
      } else {
        // No quantum, use default settings from InteractionService
        const response = await this.openai.chat.completions.create({
          model: this.config.llm.model,
          messages,
          temperature: this.config.llm.temperature,
          ...options,
        });

        log.warn("Final prompt construction:", {
          systemPrompt: messages,
          temperature: this.config.llm.temperature,
          mergedSettings: options?.styleSettings || {},
        });

        return {
          content: response.choices[0].message.content ?? "",
          metadata: {
            model: response.model,
            usage: response.usage,
            finishReason: response.choices[0].finish_reason,
            temperature: this.config.llm.temperature,
            // Use all settings from InteractionService
            personalitySettings: options?.styleSettings || {},
            context: {
              responseType: options?.responseType,
              characterId: options?.characterId,
            },
          },
        };
      }
    } catch (error) {
      console.error("Error generating response:", error);
      throw error;
    }
  }

  async moderateContent(text: string): Promise<ModerationResult> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.imageGeneration?.moderationModel!,
        messages: [
          {
            role: "system",
            content:
              'You are a content moderator. Analyze the following text for inappropriate content including: explicit material, violence, hate speech, or other unsafe content. Respond with a JSON object containing \'isAppropriate\' (boolean) and \'reason\' (string if inappropriate). Example response: {"isAppropriate": true} or {"isAppropriate": false, "reason": "Contains violent content"}',
          },
          {
            role: "user",
            content: text,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from moderation API");
      }

      const result = JSON.parse(content);
      if (typeof result.isAppropriate !== "boolean") {
        throw new Error(
          "Invalid response format: missing isAppropriate boolean"
        );
      }

      return {
        isAppropriate: result.isAppropriate,
        reason: result.reason,
      };
    } catch (error) {
      console.error("Error in content moderation:", error);
      return {
        isAppropriate: false,
        reason: `Moderation check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async generateImage(text: string): Promise<ImageGenerationResult> {
    try {
      // First moderate the content
      const moderationResult = await this.moderateContent(text);

      if (!moderationResult.isAppropriate) {
        return {
          success: false,
          error: `Content moderation failed: ${moderationResult.reason}`,
        };
      }

      // Get character settings if characterId is provided
      let style = this.config.imageGeneration?.style;
      let description = this.config.imageGeneration?.description;

      console.log("Getting character");
      const character = await this.characterManager.getCharacter();
      if (character?.identity) {
        style = (character.identity.imageStyle as string) || style;
        description =
          (character.identity.imageDescription as string) || description;
      }

      // Construct the safe prompt using config defaults
      const safePrompt = `${description} and ${text}. In a ${style}`.trim();
      `${this.config.imageGeneration?.description} and ${text}. In a ${this.config.imageGeneration?.style}`.trim();
      console.log("safePrompt", safePrompt);

      const response = await this.openai.images.generate({
        prompt: safePrompt,
        model: this.config.imageGeneration?.model,
        n: 1,
      });

      const imageUrl = response.data[0]?.url;

      if (!imageUrl) {
        throw new Error("No image URL received from API");
      }

      return {
        success: true,
        url: imageUrl,
      };
    } catch (error) {
      console.error("Error generating image:", error);
      return {
        success: false,
        error: `Image generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async analyzeImportanceTelegram(
    content: string,
    context: Record<string, any> = {}
  ): Promise<number> {
    const prompt = `Analyze this message's importance (0.0 to 1.0):

Content: "${content}"

Consider:
1. Is the message directed at Ducky? (Direct mentions, variations like "duck", questions/commands to AI, informal addressing)
   - If clearly directed at Ducky, score should be 0.9 or higher
2. Long-term significance
3. Emotional weight
4. Knowledge value
5. Relationship importance
6. Direct reference to Ducky such as hey ducky or duck, Ducky, Ducky!

Context provided:
${Object.entries(context)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.analyzer.model,
        temperature: this.config.analyzer.temperature,
        messages: [{ role: "user", content: prompt }],
      });

      const importance = parseFloat(response.choices[0].message.content ?? "0");
      if (isNaN(importance) || importance < 0 || importance > 1) {
        throw new Error("Invalid importance value received");
      }

      return importance;
    } catch (error) {
      console.error("Error analyzing importance:", error);
      throw error;
    }
  }

  async analyzeImportance(
    content: string,
    context: Record<string, any> = {}
  ): Promise<number> {
    const prompt = `Analyze this memory's importance (0.0 to 1.0):

Content: "${content}"

Consider:
1. Long-term significance
2. Character development impact
3. Emotional weight
4. Knowledge value
5. Relationship importance
6. Direct reference to the character

Context provided:
${Object.entries(context)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.analyzer.model,
        temperature: this.config.analyzer.temperature,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }

      const importance = parseFloat(content);
      if (isNaN(importance) || importance < 0 || importance > 1) {
        throw new Error("Invalid importance value received");
      }

      return importance;
    } catch (error) {
      console.error("Error analyzing importance:", error);
      throw error;
    }
  }

  async preparePrompt(
    template: string,
    context: Record<string, any>
  ): Promise<ChatCompletionMessageParam[]> {
    try {
      // Convert template and context into proper message format
      const systemMessage: ChatCompletionMessageParam = {
        role: "system",
        content: this.interpolateTemplate(template, context),
      };

      // Create messages array with system message
      const messages: ChatCompletionMessageParam[] = [systemMessage];

      // If there's a user message in the context, add it
      if (context.user) {
        messages.push({
          role: "user",
          content: context.user,
        });
      }

      return messages;
    } catch (error) {
      console.error("Error preparing prompt:", error);
      throw new Error(
        `Failed to prepare prompt: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async findToken(tag: string, recentCoins: Coin[]): Promise<string | null> {
    const prompt = `Given the Twitter cashtag or mention "${tag}", find the best matching cryptocurrency from the following list. Only return the exact ID if confident, otherwise return "none":

    ${recentCoins
      .map((c) => `${c.coingeckoId} (${c.symbol}: ${c.name})`)
      .join("\n")}
    
    [Additional context: Consider common nicknames, abbreviations, and variations]
    
    Return just the coin ID or "none".`;

    const completion = await this.openai.chat.completions.create({
      model: this.config.analyzer.model,
      temperature: this.config.analyzer.temperature,
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content;
  }

  private interpolateTemplate(
    template: string,
    context: Record<string, any>
  ): string {
    let result = template;

    // Replace simple placeholders
    for (const [key, value] of Object.entries(context)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
        result = result.replace(regex, String(value));
      }
    }

    // Handle nested objects
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === "object" && value !== null) {
        const flattenedObj = this.flattenObject(value, key);
        for (const [flatKey, flatValue] of Object.entries(flattenedObj)) {
          const regex = new RegExp(`\\{\\{\\s*${flatKey}\\s*\\}\\}`, "g");
          result = result.replace(regex, String(flatValue));
        }
      }
    }

    return result;
  }

  private flattenObject(
    obj: Record<string, any>,
    prefix = ""
  ): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        const nested = this.flattenObject(value, `${prefix}.${key}`);
        Object.assign(flattened, nested);
      } else {
        flattened[`${prefix}.${key}`] = String(value);
      }
    }

    return flattened;
  }

  async generateGluUpdates(context?: ScheduledPostContext): Promise<{
    tweetText: string;
  }> {
    try {
      const character = await this.characterManager.getCharacter();
      if (!character) throw new Error("Character not found");

      // Get quantum personality if available
      let personalitySettings: QuantumPersonalitySettings | undefined;
      if (this.quantumPersonalityMapper) {
        personalitySettings =
          await this.quantumPersonalityMapper.mapQuantumToPersonality();
      }

      // Construct timeline context if available
      const timelinePrompt = context?.timelineContext
        ? `
  Recent activity from 0xglu:
  ${context.timelineContext.recentTweets
    .map(
      (tweet) =>
        `- ${tweet.text} (${new Date(tweet.createdAt).toLocaleString()})`
    )
    .join("\n")}
  
  Token metrics and market data:
  ${JSON.stringify(context.timelineContext.tokenMetrics, null, 2)}
  

  Use this context to inform the tone and content of the tweet.
  `
        : "";

      // Construct prompt using character style and quantum mood
      const moodModifiers = personalitySettings?.styleModifiers.tone || [];
      const prompt = `${
        character.identity?.imageDescription
      } with ${moodModifiers.join(" and ")} mood and ${
        character.identity?.imageStyle
      } with ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
        ", "
      )}
  
      ${timelinePrompt}`.trim();

      // Generate image using FLUX
      const response = await this.openai.images.generate({
        prompt,
        model: this.config.imageGeneration?.model,
        n: 1,
      });
      if (!response.data[0]?.url) {
        throw new Error("Failed to generate image");
      }

      // Generate tweet with matching quantum personality and timeline context
      const tweetPrompt = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        temperature:
          personalitySettings?.temperature || this.config.llm.temperature,
        messages: [
          {
            role: "system",
            content: `You are ${character.name}. ${character.bio}
  Personality: ${
    personalitySettings?.personalityTraits.join(", ") ||
    character.personalityTraits.join(", ")
  }
  Mood: ${moodModifiers.join(", ")}
  
  Guidelines: ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
    ", "
  )}
  
  ${timelinePrompt}
  
  Write a short, engaging tweet.
  Consider the recent timeline context and token metrics in your response.
  Follow Twitter style guidelines.
  Match the current mood and market context in your response. RULES: NO QUOTES around the description just the description`,
          },
        ],
      });

      const tweetText = `🦆 $DUCKAI Updates 🦆 \n\n

${tweetPrompt.choices[0]?.message?.content}`;
      if (!tweetText) throw new Error("Failed to generate tweet text");

      return {
        tweetText,
      };
    } catch (error) {
      console.error("Error generating scheduled image post:", error);
      throw error;
    }
  }

  async generateScheduledImagePost(context?: ScheduledPostContext): Promise<{
    imageUrl: string;
    tweetText: string;
  }> {
    try {
      const character = await this.characterManager.getCharacter();
      if (!character) throw new Error("Character not found");

      // Get quantum personality if available
      let personalitySettings: QuantumPersonalitySettings | undefined;
      if (this.quantumPersonalityMapper) {
        personalitySettings =
          await this.quantumPersonalityMapper.mapQuantumToPersonality();
      }

      // Construct timeline context if available
      const timelinePrompt = context?.timelineContext
        ? `
  Recent activity from 0xglu:
  ${context.timelineContext.recentTweets
    .map(
      (tweet) =>
        `- ${tweet.text} (${new Date(tweet.createdAt).toLocaleString()})`
    )
    .join("\n")}
  
  Token metrics and market data:
  ${JSON.stringify(context.timelineContext.tokenMetrics, null, 2)}
  

  Use this context to inform the tone and content of the image and tweet.
  `
        : "";

      // Construct prompt using character style and quantum mood
      const moodModifiers = personalitySettings?.styleModifiers.tone || [];
      const prompt = `${
        character.identity?.imageDescription
      } with ${moodModifiers.join(" and ")} mood and ${
        character.identity?.imageStyle
      } with ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
        ", "
      )}
  
      ${timelinePrompt}`.trim();

      // Content moderation
      const moderationResult = await this.moderateContent(prompt);
      if (!moderationResult.isAppropriate) {
        throw new Error(
          `Content moderation failed: ${moderationResult.reason}`
        );
      }

      // Generate image using FLUX
      const response = await this.openai.images.generate({
        prompt,
        model: this.config.imageGeneration?.model,
        n: 1,
      });
      if (!response.data[0]?.url) {
        throw new Error("Failed to generate image");
      }

      // Generate tweet with matching quantum personality and timeline context
      const tweetPrompt = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        temperature:
          personalitySettings?.temperature || this.config.llm.temperature,
        messages: [
          {
            role: "system",
            content: `You are ${character.name}. ${character.bio}
  Personality: ${
    personalitySettings?.personalityTraits.join(", ") ||
    character.personalityTraits.join(", ")
  }
  Mood: ${moodModifiers.join(", ")}
  
  Guidelines: ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
    ", "
  )}
  
  ${timelinePrompt}
  
  Write a short, engaging tweet to accompany your latest generated image.
  Consider the recent timeline context and token metrics in your response.
  Follow Twitter style guidelines. Keep it under 200 characters to leave room for the image.
  Match the current mood and market context in your response. RULES: NO QUOTES around the image description just the description`,
          },
        ],
      });

      const tweetText = tweetPrompt.choices[0]?.message?.content;
      if (!tweetText) throw new Error("Failed to generate tweet text");

      return {
        imageUrl: response.data[0]?.url,
        tweetText,
      };
    } catch (error) {
      console.error("Error generating scheduled image post:", error);
      throw error;
    }
  }

  async generateScheduledMarketUpdate(
    context?: ScheduledMarketUpdateContext
  ): Promise<{
    tweetText: string;
  }> {
    try {
      const character = await this.characterManager.getCharacter();
      if (!character) throw new Error("Character not found");

      // Get quantum personality if available
      let personalitySettings: QuantumPersonalitySettings | undefined;
      if (this.quantumPersonalityMapper) {
        personalitySettings =
          await this.quantumPersonalityMapper.mapQuantumToPersonality();
      }

      // Construct timeline context if available
      const marketUpdatePrompt = context?.marketUpdateContext
        ? `
    Recent Market and Token News:
    ${context.marketUpdateContext.marketAnalysis
      .map(
        (analysis, index) =>
          `${index}: ${JSON.stringify(
            {
              summary: analysis.summary,
              sentiment: analysis.sentiment,
              keyTopics: analysis.keyTopics,
              marketImpact: analysis.marketImpact,
              mentionedCoins: analysis.mentionedCoins,
              metrics: analysis.metrics,
            },
            null,
            2
          )}`
      )
      .join("\n")}
  

  Use this context to inform the tone and content of the tweet.
  `
        : "";

      // Construct prompt using character style and quantum mood
      const moodModifiers = personalitySettings?.styleModifiers.tone || [];
      const messages = [
        {
          role: "system",
          content: `You are ${character.name}. ${character.bio}
Personality: ${
            personalitySettings?.personalityTraits.join(", ") ||
            character.personalityTraits.join(", ")
          }
Mood: ${moodModifiers.join(", ")}

Guidelines: ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
            ", "
          )}

${marketUpdatePrompt}

Write a summary of the recent market news and token metrics.

Follow Twitter style guidelines.
If refering to marketcap use millions or billions.
You do not have to respond to every news story, if major news stories are mentioned, definitely include those.
Preferece the analysis with 📰 News and Market Updates 📰
Stick to your character
Be verbose.
Use line breaks (two lines breaks) these do not count towards the character limit. 
Keep response under 800 characters. 
USE cashtags for coins.
Do not make up data, only use the data from the market update.
RULES: NO QUOTATION MARKS around the response just give the response`,
        },
      ];
      // Generate tweet with matching quantum personality and timeline context
      const tweetPrompt = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        temperature:
          personalitySettings?.temperature || this.config.llm.temperature,
        messages: messages as ChatCompletionMessageParam[],
      });

      const tweetText = tweetPrompt.choices[0]?.message?.content;
      if (!tweetText) throw new Error("Failed to generate tweet text");

      return {
        tweetText,
      };
    } catch (error) {
      console.error("Error generating scheduled image post:", error);
      throw error;
    }
  }

  /**
   * You have a list of goals or tools to use, make an llm call to select the best goal or tool to use.
   */
  async generateResponseV3(prompt: string) {
    let personalitySettings: QuantumPersonalitySettings | undefined;
    let temperature: number;
    if (this.quantumPersonalityMapper) {
      personalitySettings =
        await this.quantumPersonalityMapper.mapQuantumToPersonality();

      // Use quantum temperature
      temperature = personalitySettings.temperature;
    } else {
      temperature = this.config.llm.temperature || 0.7;
    }

    const response = await this.openai.chat.completions.create({
      model: this.config.llm.model,
      messages: [{ role: "user", content: prompt }],
      temperature,
    });
    log.info("Response V3", {
      response: response.choices[0].message.content,
    });
    return response.choices[0].message.content;
  }

  async analyzeTokenTimelines(
    timelineData: TokenTimelineData[]
  ): Promise<TokenAnalysisResult> {
    try {
      const character = await this.characterManager.getCharacter();
      if (!character) throw new Error("Character not found");

      // Get personality settings
      const personalitySettings = this.quantumPersonalityMapper
        ? await this.quantumPersonalityMapper.mapQuantumToPersonality()
        : undefined;

      const moodModifiers = personalitySettings?.styleModifiers.tone || [];

      const completion = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        messages: [
          {
            role: "system",
            content: `You are a JSON-only responder. You must return a valid JSON object matching this exact structure:
  {
    "selectedTokens": [
      {
        "symbol": "string",
        "priceChange": number,
        "analysis": "string"
      }
    ]
  }
  
You are ${character.name}. ${character.bio}
Personality: ${
              personalitySettings?.personalityTraits.join(", ") ||
              character.personalityTraits.join(", ")
            }
Mood: ${moodModifiers.join(", ")}

Guidelines: ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
              ", "
            )}

  Analyze these token movements and include key developments:
  ${JSON.stringify(timelineData, null, 2)}
  
  Your JSON analysis should:
  1. Pick 1-2 most interesting tokens
  2. Be playful but informative
  3. Focus on major news and updates
  4. No emojis
  5. No quotes around the response
  6. If you mention the twitter handle, use the @ symbol

  IMPORTANT: Return ONLY valid JSON, no other text.`,
          },
        ],
        temperature:
          personalitySettings?.temperature ||
          this.config.llm.temperature ||
          0.7,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message?.content;
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      try {
        const response = JSON.parse(content);
        if (!response.selectedTokens?.length) {
          throw new Error("Invalid response structure");
        }
        return response as TokenAnalysisResult;
      } catch (parseError) {
        log.error("Failed to parse LLM response:", content);
        // Return a safe fallback response
        return {
          selectedTokens: [
            {
              symbol: timelineData[0].symbol,
              priceChange: timelineData[0].priceChange,
              analysis: "Notable price movement and community activity 📈",
            },
          ],
        };
      }
    } catch (error) {
      console.error("Error analyzing token timelines:", error);
      // Return a safe fallback if anything fails
      return {
        selectedTokens: [
          {
            symbol: timelineData[0].symbol,
            priceChange: timelineData[0].priceChange,
            analysis: "Significant market activity detected 📊",
          },
        ],
      };
    }
  }

  async analyzeMarketCapMovers(
    timelineData: MarketCapTimelineData[]
  ): Promise<MarketCapAnalysisResult> {
    try {
      const character = await this.characterManager.getCharacter();
      if (!character) throw new Error("Character not found");

      // Get personality settings
      const personalitySettings = this.quantumPersonalityMapper
        ? await this.quantumPersonalityMapper.mapQuantumToPersonality()
        : undefined;

      const moodModifiers = personalitySettings?.styleModifiers.tone || [];

      const completion = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        messages: [
          {
            role: "system",
            content: `You are ${character.name}. ${character.bio}
  Personality: ${
    personalitySettings?.personalityTraits.join(", ") ||
    character.personalityTraits.join(", ")
  }
  Mood: ${moodModifiers.join(", ")}
  
  Guidelines: ${character.responseStyles.platforms.twitter?.styles.tweet_reply?.guidelines.join(
    ", "
  )}
  
  Analyze these market cap movements and social activity:
  ${JSON.stringify(timelineData, null, 2)}
  
  Provide a brief, insightful analysis:
  1. Focus on strongest market cap gainers
  2. Identify key trends or catalysts from tweets
  3. Note any correlation between social activity and market cap changes
  4. Keep total response under 280 characters
  5. Use cashtags for tokens ($)
  6. Use @ for Twitter handles
  7. No quotation marks in the response
  
  Return a JSON object with format:
  {
    "insights": "string"
  }`,
          },
        ],
        temperature:
          personalitySettings?.temperature ||
          this.config.llm.temperature ||
          0.7,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message?.content;
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      try {
        const response = JSON.parse(content);
        if (!response.insights) {
          throw new Error("Invalid response structure");
        }
        return response as MarketCapAnalysisResult;
      } catch (parseError) {
        log.error("Failed to parse LLM response:", content);
        // Return a safe fallback response
        return {
          insights: `Notable market cap movement for $${timelineData[0].symbol} with strong community engagement.`,
        };
      }
    } catch (error) {
      console.error("Error analyzing market cap movements:", error);
      // Return a safe fallback if anything fails
      return {
        insights: `Significant market activity detected for multiple tokens.`,
      };
    }
  }
}
