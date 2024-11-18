import { PromptBuilder } from "@fatduckai/prompt-utils";
import { OpenAI } from "openai";

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

  async generateResponse(messages: any[], options?: Record<string, any>) {
    const response = await this.openai.chat.completions.create({
      ...this.config.llm,
      messages,
      ...options,
    });

    return {
      content: response.choices[0].message.content!,
      metadata: {
        model: response.model,
        usage: response.usage,
        finishReason: response.choices[0].finish_reason,
      },
    };
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

Context provided:
${Object.entries(context)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

Return only a number between 0 and 1.`;

    const response = await this.openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      ...this.config.analyzer,
    });

    return parseFloat(response.choices[0].message.content!);
  }

  async preparePrompt(template: string, context: Record<string, any>) {
    try {
      const builder = new PromptBuilder(template, {
        validateOnBuild: false,
        throwOnWarnings: false,
        allowEmptyContent: true,
      });

      const b = builder.withContext(context).build();
      return b;
    } catch (error) {
      console.error("Error preparing prompt:", error);
      throw new Error(
        `Failed to prepare prompt: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
