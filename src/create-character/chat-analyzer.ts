import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { OpenAI } from "openai";
import * as schema from "../db/schema";
import type { ResponseStyles } from "../types";
import type { ChatMessage } from "./gmail-chat-importer";

interface AnalyzedProfile {
  bio: string;
  traits: string[];
  responseStyles: ResponseStyles;
  preferences: {
    preferredTopics: string[];
    dislikedTopics: string[];
    [key: string]: any;
  };
}

export class ChatAnalyzer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeUserProfile(messages: ChatMessage[]): Promise<AnalyzedProfile> {
    // Prepare messages for analysis
    const messageContext = messages
      .map((m) => `${m.timestamp.toISOString()}: ${m.content}`)
      .join("\n");

    const prompt = `Analyze these chat messages and create a detailed user profile. Messages:
    ${messageContext}

    Create a profile with:
    1. Brief bio
    2. Key personality traits
    3. Communication style
    4. Topics they engage with
    5. Response patterns
    6. Tone preferences

    Format the response as JSON with these exact keys:
    {
      "bio": "string",
      "traits": ["trait1", "trait2"],
      "responseStyles": {
        "default": {
          "tone": ["tone1", "tone2"],
          "personality": ["trait1", "trait2"],
          "guidelines": ["pattern1", "pattern2"]
        }
      },
      "preferences": {
        "preferredTopics": ["topic1", "topic2"],
        "dislikedTopics": ["topic1", "topic2"],
        "communicationPreferences": ["pref1", "pref2"]
      }
    }`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content!);
  }

  async calculateImportance(
    message: string,
    context: {
      hasReplies?: boolean;
      reactionCount?: number;
      threadLength?: number;
    }
  ): Promise<number> {
    const prompt = `Analyze this message and its context to determine its importance (0.0 to 1.0):

    Message: "${message}"
    
    Context:
    - Has replies: ${context.hasReplies}
    - Reaction count: ${context.reactionCount}
    - Thread length: ${context.threadLength}

    Consider:
    1. Message substance/depth
    2. Emotional significance
    3. Conversation impact
    4. Information value
    
    Return only a number between 0 and 1.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return parseFloat(response.choices[0].message.content!);
  }

  async detectTopic(content: string): Promise<string> {
    const prompt = `What is the main topic of this message? 
    Respond with a single, specific topic word or short phrase.
    
    Message: "${content}"`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0].message.content!.trim();
  }

  async analyzeSentiment(content: string): Promise<number> {
    const prompt = `Analyze the sentiment of this message and return a score from -1 (very negative) to 1 (very positive).
    Return only the number.
    
    Message: "${content}"`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    return parseFloat(response.choices[0].message.content!);
  }

  // Batch processing to minimize API calls
  async batchAnalyzeMessages(messages: ChatMessage[], batchSize: number = 10) {
    const batches = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchContent = batch.map((m) => m.content).join("\n---\n");

      const prompt = `Analyze these ${batch.length} messages. For each message provide:
      1. Topic
      2. Sentiment (-1 to 1)
      3. Importance (0 to 1)

      Messages:
      ${batchContent}

      Return as JSON array:
      [
        {
          "topic": "string",
          "sentiment": number,
          "importance": number
        }
      ]`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      batches.push(JSON.parse(response.choices[0].message.content!));
    }

    return batches.flat();
  }
}

// Usage with ChatImporter:
export class ChatImporter {
  private db: PostgresJsDatabase<typeof schema>;
  private analyzer: ChatAnalyzer;

  constructor(db: PostgresJsDatabase<typeof schema>, openaiKey: string) {
    this.db = db;
    this.analyzer = new ChatAnalyzer(openaiKey);
  }

  private async analyzeUserProfile(messages: ChatMessage[]) {
    return await this.analyzer.analyzeUserProfile(messages);
  }

  private async processMessageBatch(
    characterId: string,
    messages: ChatMessage[]
  ) {
    const analyses = await this.analyzer.batchAnalyzeMessages(messages);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const analysis = analyses[i];

      // Create event
      const [event] = await this.db
        .insert(schema.events)
        .values({
          characterId,
          type: "historical:chat",
          payload: {
            content: message.content,
            analysis,
          },
          metadata: {
            timestamp: message.timestamp.toISOString(),
          },
        })
        .returning();

      // Create memory if important enough
      if (analysis.importance > 0.6) {
        await this.db.insert(schema.memories).values({
          characterId,
          type: "interaction",
          content: message.content,
          importance: analysis.importance,
          metadata: {
            topic: analysis.topic,
            sentiment: analysis.sentiment,
          },
          eventId: event.id,
        });
      }
    }
  }
}
