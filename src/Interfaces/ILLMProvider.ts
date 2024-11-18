import { OpenAI } from "openai";

// Interface for LLM providers
export interface ILLMProvider {
  generateResponse(
    messages: any[],
    options?: Record<string, any>
  ): Promise<{
    content: string;
    metadata?: Record<string, any>;
  }>;
}

// Default OpenAI LLM implementation
export class OpenAIProvider implements ILLMProvider {
  private openai: OpenAI;
  private options: {
    model: string;
    temperature: number;
  };

  constructor(
    apiKey: string,
    options?: { model?: string; temperature?: number }
  ) {
    this.openai = new OpenAI({ apiKey });
    this.options = {
      model: options?.model || "gpt-4-turbo-preview",
      temperature: options?.temperature || 0.7,
    };
  }

  async generateResponse(messages: any[], options?: Record<string, any>) {
    const response = await this.openai.chat.completions.create({
      messages,
      model: options?.model || this.options.model,
      temperature: options?.temperature || this.options.temperature,
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
}
