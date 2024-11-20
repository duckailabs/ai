import { LLMManager } from "@/core/managers/llm";
import type { CreateCharacterInput, ResponseStyles } from "@/types";
import { CHAT_TO_CHARACTER_PROMPT, TWEET_TO_CHARACTER_PROMPT } from "./base";
import type { ChatMessage, Tweet } from "./types";

interface DataAnalysisInput {
  data: ChatMessage[] | Tweet[];
  type: "chat" | "tweet";
  options?: {
    minConfidence?: number;
    mergingStrategy?: "weighted" | "latest" | "highest_confidence";
  };
}

interface AnalysisMetadata {
  confidence: Record<keyof CreateCharacterInput, number>;
  source: {
    type: "chat" | "tweet";
    messageCount: number;
    timeframe: {
      start: Date;
      end: Date;
    };
  };
}

export class CharacterBuilder {
  constructor(private llm: LLMManager) {}

  async analyzeData(input: DataAnalysisInput): Promise<CreateCharacterInput> {
    try {
      // Prepare data for analysis
      const preparedData = this.prepareDataForAnalysis(input);

      const result = await this.llm.generateResponse(
        await this.llm.preparePrompt(this.getPromptForType(input.type), {
          chatHistory: preparedData,
        })
      );

      // Parse the JSON string response into an object
      let profile: CreateCharacterInput;
      try {
        const cleanJson = this.cleanJsonResponse(result.content);

        profile = JSON.parse(cleanJson);
      } catch (error) {
        console.error("Failed to parse LLM response as JSON:", result.content);
        throw new Error("Failed to parse character profile JSON");
      }

      // Validate and process result
      const validatedProfile = this.validateProfile(profile);

      // Calculate confidence scores
      const metadata = this.calculateMetadata(validatedProfile, input);

      // Check confidence threshold
      if (
        !this.meetsConfidenceThreshold(metadata, input.options?.minConfidence)
      ) {
        throw new Error("Analysis confidence below threshold");
      }

      return validatedProfile;
    } catch (error) {
      console.error("Error in character analysis:", error);
      throw error;
    }
  }

  private validateProfile(profile: any): CreateCharacterInput {
    if (!profile || typeof profile !== "object") {
      throw new Error("Profile must be an object");
    }

    // Ensure all required fields exist
    const requiredFields: Array<keyof CreateCharacterInput> = [
      "name",
      "bio",
      "personalityTraits",
      "responseStyles",
      "styles",
      "shouldRespond",
      "hobbies",
      "beliefSystem",
      "preferences",
      "goals",
    ];

    for (const field of requiredFields) {
      if (!(field in profile)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate responseStyles
    this.validateResponseStyles(profile.responseStyles);

    // Validate goals
    this.validateGoals(profile.goals);

    return profile as CreateCharacterInput;
  }

  private validateGoals(goals: any[]) {
    if (!Array.isArray(goals)) {
      throw new Error("Goals must be an array");
    }

    goals.forEach((goal, index) => {
      if (!goal.description) {
        throw new Error(`Goal at index ${index} missing description`);
      }

      if (
        goal.status &&
        !["active", "completed", "paused"].includes(goal.status)
      ) {
        throw new Error(`Invalid status for goal at index ${index}`);
      }

      if (
        goal.progress !== undefined &&
        (goal.progress < 0 || goal.progress > 100)
      ) {
        throw new Error(`Invalid progress for goal at index ${index}`);
      }
    });
  }

  private calculateFieldConfidence(field: string, value: any): number {
    // Add goals to confidence calculation
    switch (field) {
      case "name":
        return 1;
      case "bio":
        return typeof value === "string" && value.length > 50 ? 0.8 : 0.6;
      case "personalityTraits":
        return Array.isArray(value) && value.length > 0 ? 0.7 : 0.5;
      case "responseStyles":
        return this.calculateResponseStylesConfidence(value);
      case "preferences":
        return this.calculatePreferencesConfidence(value);
      case "goals":
        return this.calculateGoalsConfidence(value);
      default:
        return 0.6;
    }
  }

  private calculateGoalsConfidence(goals: any[]): number {
    if (!Array.isArray(goals)) return 0;

    const validGoals = goals.filter(
      (goal) =>
        goal.description &&
        (!goal.status ||
          ["active", "completed", "paused"].includes(goal.status)) &&
        (!goal.progress || (goal.progress >= 0 && goal.progress <= 100))
    );

    return validGoals.length > 0 ? 0.7 : 0.4;
  }

  private validateResponseStyles(styles: ResponseStyles) {
    if (!styles || typeof styles !== "object") {
      throw new Error("ResponseStyles must be an object");
    }

    if (!styles.default) {
      throw new Error("Default response styles are required");
    }

    if (!styles.default.tone || !Array.isArray(styles.default.tone)) {
      throw new Error("Default tone must be an array");
    }

    if (
      !styles.default.personality ||
      !Array.isArray(styles.default.personality)
    ) {
      throw new Error("Default personality must be an array");
    }

    if (
      !styles.default.guidelines ||
      !Array.isArray(styles.default.guidelines)
    ) {
      throw new Error("Default guidelines must be an array");
    }
  }

  private prepareDataForAnalysis(input: DataAnalysisInput) {
    if (input.type === "chat") {
      return this.prepareChatData(input.data as ChatMessage[]);
    } else {
      return this.prepareTweetData(input.data as Tweet[]);
    }
  }

  private prepareChatData(messages: ChatMessage[]) {
    return messages
      .map((msg) => `${new Date(msg.timestamp).toISOString()}: ${msg.content}`)
      .join("\n");
  }

  private prepareTweetData(tweets: Tweet[]) {
    return tweets
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map((tweet) => ({
        content: tweet.text,
        timestamp: tweet.created_at,
        metadata: {
          retweets: tweet.retweet_count,
          likes: tweet.favorite_count,
          replies: tweet.reply_count,
        },
      }));
  }

  private getPromptForType(type: "chat" | "tweet"): string {
    return type === "chat"
      ? CHAT_TO_CHARACTER_PROMPT
      : TWEET_TO_CHARACTER_PROMPT;
  }

  private calculateMetadata(
    profile: CreateCharacterInput,
    input: DataAnalysisInput
  ): AnalysisMetadata {
    const data = input.data;
    const timestamps =
      input.type === "chat"
        ? (data as ChatMessage[]).map((m) => m.timestamp)
        : (data as Tweet[]).map((t) => new Date(t.created_at));

    return {
      confidence: this.calculateConfidenceScores(profile),
      source: {
        type: input.type,
        messageCount: data.length,
        timeframe: {
          start: new Date(Math.min(...timestamps.map((t) => t.getTime()))),
          end: new Date(Math.max(...timestamps.map((t) => t.getTime()))),
        },
      },
    };
  }

  private calculateConfidenceScores(
    profile: CreateCharacterInput
  ): Record<keyof CreateCharacterInput, number> {
    const scores: Record<string, number> = {};

    // Calculate confidence based on data completeness and quality
    for (const [key, value] of Object.entries(profile)) {
      scores[key] = this.calculateFieldConfidence(key, value);
    }

    return scores as Record<keyof CreateCharacterInput, number>;
  }

  private calculateResponseStylesConfidence(styles: ResponseStyles): number {
    if (!styles.default) return 0;

    const hasRequiredFields =
      Array.isArray(styles.default.tone) &&
      Array.isArray(styles.default.personality) &&
      Array.isArray(styles.default.guidelines);

    return hasRequiredFields ? 0.7 : 0.4;
  }

  private calculatePreferencesConfidence(preferences: any): number {
    if (!preferences) return 0;

    const hasPreferences =
      Array.isArray(preferences.preferredTopics) ||
      Array.isArray(preferences.dislikedTopics);

    return hasPreferences ? 0.6 : 0.3;
  }

  private meetsConfidenceThreshold(
    metadata: AnalysisMetadata,
    threshold: number = 0.5
  ): boolean {
    const scores = Object.values(metadata.confidence);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    return average >= threshold;
  }

  private cleanJsonResponse(content: string): string {
    // Remove markdown code block markers
    content = content.replace(/```json\n?/g, "");
    content = content.replace(/```\n?/g, "");

    // Trim any whitespace
    content = content.trim();

    // Handle any potential BOM or special characters at the start
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    return content;
  }
}
