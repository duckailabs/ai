import { OpenAI } from "openai";

// Interface for custom implementations
export interface IImportanceAnalyzer {
  analyzeImportance(
    content: string,
    context?: Record<string, any>
  ): Promise<number>;
}

interface AnalyzerOptions {
  model?: string;
  temperature?: number;
}

// Default OpenAI implementation
export class OpenAIImportanceAnalyzer implements IImportanceAnalyzer {
  private openai: OpenAI;
  private options: Required<AnalyzerOptions>;

  constructor(apiKey: string, options: AnalyzerOptions = {}) {
    this.openai = new OpenAI({ apiKey });
    this.options = {
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      ...options,
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
      model: this.options.model,
      messages: [{ role: "user", content: prompt }],
      temperature: this.options.temperature,
    });

    return parseFloat(response.choices[0].message.content!);
  }
}
