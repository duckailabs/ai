import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface AIConfig {
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
}

const DEFAULT_CONFIG: Partial<AIConfig> = {
  llm: {
    model: "gpt-4-turbo-preview",
    temperature: 0.7,
  },
  analyzer: {
    model: "gpt-3.5-turbo",
    temperature: 0.3,
  },
};

export class LLMManager {
  private openai: OpenAI;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      llm: { ...DEFAULT_CONFIG.llm, ...config.llm },
      analyzer: { ...DEFAULT_CONFIG.analyzer, ...config.analyzer },
    };

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  async generateResponse(
    messages: ChatCompletionMessageParam[],
    options?: Record<string, any>
  ) {
    if (!messages || messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.llm.model,
        temperature: this.config.llm.temperature,
        messages,
        ...options,
      });

      return {
        content: response.choices[0].message.content ?? "",
        metadata: {
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0].finish_reason,
        },
      };
    } catch (error) {
      console.error("Error generating response:", error);
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
}
