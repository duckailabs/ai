import { sql } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";

export interface ChatMessage {
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  threadId?: string;
  replyTo?: string;
}

interface ImportConfig {
  batchSize?: number;
  startDate?: Date;
  endDate?: Date;
  processMemories?: boolean;
}

interface EventPayload {
  content: string;
  threadId?: string;
  replyTo?: string;
}

export class ChatImporter {
  private db: PostgresJsDatabase<typeof schema>;

  constructor(db: PostgresJsDatabase<typeof schema>) {
    this.db = db;
  }

  async importGoogleChat(chatLog: ChatMessage[], config: ImportConfig = {}) {
    // Track unique users and their messages
    const userMessages = new Map<string, ChatMessage[]>();

    // Group messages by user
    chatLog.forEach((msg) => {
      if (!userMessages.has(msg.senderId)) {
        userMessages.set(msg.senderId, []);
      }
      userMessages.get(msg.senderId)!.push(msg);
    });

    // Process each user's messages
    for (const [userId, messages] of Array.from(userMessages.entries())) {
      // Create or get character
      const characterId = await this.ensureCharacter(userId, messages);

      // Import messages as events
      await this.importMessages(characterId, messages, config);

      // Process memories if configured
      if (config.processMemories) {
        await this.processMemories(characterId, messages);
      }
    }

    return Array.from(userMessages.keys());
  }

  private async ensureCharacter(userId: string, messages: ChatMessage[]) {
    // Check if character exists
    const [existing] = await this.db
      .select()
      .from(schema.characters)
      .where(sql`name = ${messages[0].senderName}`);

    if (existing) {
      return existing.id;
    }

    // Analyze messages to build character profile
    const profile = await this.analyzeUserProfile(messages);

    // Create new character
    const [character] = await this.db
      .insert(schema.characters)
      .values({
        name: messages[0].senderName,
        bio: profile.bio,
        personalityTraits: profile.traits,
        responseStyles: profile.responseStyles,
        preferences: profile.preferences,
        styles: {},
        shouldRespond: {
          rules: [],
          examples: [],
        },
      })
      .returning();

    return character.id;
  }

  private async importMessages(
    characterId: string,
    messages: ChatMessage[],
    config: ImportConfig
  ) {
    // Batch messages for import
    const batches = this.batchMessages(messages, config.batchSize || 100);

    for (const batch of batches) {
      await this.db.insert(schema.events).values(
        batch.map((msg) => ({
          characterId,
          type: "historical:chat",
          payload: {
            content: msg.content,
            threadId: msg.threadId,
            replyTo: msg.replyTo,
          },
          metadata: {
            timestamp: msg.timestamp.toISOString(),
            source: "google_chat",
            originalId: `${msg.senderId}_${msg.timestamp.getTime()}`,
            processed: false,
          },
        }))
      );
    }
  }

  private async processMemories(characterId: string, messages: ChatMessage[]) {
    const events = (await this.db.select().from(schema.events).where(sql`
        character_id = ${characterId} 
        AND type = 'historical:chat' 
        AND metadata->>'processed' = 'false'
      `)) as (typeof schema.events.$inferSelect & { payload: EventPayload })[];

    // Process events into memories
    for (const event of events) {
      // Analyze event importance
      const importance = this.calculateImportance(event);

      if (importance > 0.5) {
        // Only create memories for significant events
        await this.db.insert(schema.memories).values({
          characterId,
          type: "interaction",
          content: event.payload.content,
          importance,
          metadata: {
            eventId: event.id,
            timestamp: event.metadata.timestamp,
            topic: await this.detectTopic(event.payload.content),
            sentiment: await this.analyzeSentiment(event.payload.content),
          },
        });
      }

      // Mark event as processed
      await this.db
        .update(schema.events)
        .set({
          metadata: {
            ...event.metadata,
          },
        })
        .where(sql`id = ${event.id}`);
    }
  }

  private async analyzeUserProfile(messages: ChatMessage[]) {
    // Analyze messages to build user profile
    // This would use NLP/ML to detect:
    // - Common topics
    // - Writing style
    // - Personality traits
    // - Response patterns
    return {
      bio: `Profile based on ${messages.length} messages`,
      traits: ["detected_trait_1", "detected_trait_2"],
      responseStyles: {
        default: {
          tone: ["detected_tone"],
          personality: ["detected_personality"],
          guidelines: ["detected_pattern"],
        },
        platforms: {},
      },
      preferences: {
        preferredTopics: ["detected_topic_1"],
        dislikedTopics: [],
        preferredTimes: [],
        dislikedTimes: [],
        preferredDays: [],
        dislikedDays: [],
        preferredHours: [],
        dislikedHours: [],
        generalLikes: [],
        generalDislikes: [],
      },
    };
  }

  private batchMessages(messages: ChatMessage[], size: number) {
    const batches: ChatMessage[][] = [];
    for (let i = 0; i < messages.length; i += size) {
      batches.push(messages.slice(i, i + size));
    }
    return batches;
  }

  private calculateImportance(event: schema.Event): number {
    // Calculate importance based on:
    // - Message length
    // - Reactions/replies
    // - Topic significance
    // - Sentiment strength
    return 0.7; // Placeholder
  }

  private async detectTopic(content: string): Promise<string> {
    // Use NLP to detect message topic
    return "detected_topic";
  }

  private async analyzeSentiment(content: string): Promise<number> {
    // Analyze message sentiment
    return 0.5;
  }
}

// Usage:
/* const importer = new ChatImporter(db);

const chatLog = [
  {
    senderId: "user1",
    senderName: "Alice",
    content: "Hey team, what do you think about...",
    timestamp: new Date(),
    threadId: "thread1",
  },
  // ... more messages
];

await importer.importGoogleChat(chatLog, {
  batchSize: 100,
  processMemories: true,
});
 */
