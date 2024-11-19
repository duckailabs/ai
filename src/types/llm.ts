export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  llm: {
    model: string;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    [key: string]: any;
  };
  analyzer: {
    model: string;
    temperature?: number;
    [key: string]: any;
  };
}

export interface LLMResponse {
  content: string;
  metadata: {
    model: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason?: string;
    [key: string]: any;
  };
}
