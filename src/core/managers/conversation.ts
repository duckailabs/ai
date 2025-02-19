/**
 * ConversationManager
 * Handles conversation state management, timing, and orchestrates interactions
 */
import type { dbSchemas } from "@/db";
import { events, socialRelations, telegramGroups } from "@/db/schema/schema";
import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventService } from "../services/Event";
import { InteractionService } from "../services/Interaction";
import type {
  ConversationState,
  InteractionEventPayload,
  InteractionOptions,
  InteractionResult,
  MessageEvent,
} from "../types";
import type { LLMManager } from "./llm";

export class ConversationManager {
  private activeConversations = new Map<string, ConversationState>();
  private readonly MIN_REPLY_DELAY_MS = 500;
  private readonly MAX_REPLY_DELAY_MS = 3000;
  private readonly CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private db: PostgresJsDatabase<typeof dbSchemas>,
    private interactionService: InteractionService,
    private eventService: EventService,
    private llm: LLMManager
  ) {
    setInterval(() => this.cleanupStaleConversations(), 60 * 60 * 1000);
  }

  async handleMessage(
    input: string | { system: string; user: string },
    options: InteractionOptions
  ): Promise<InteractionResult | null> {
    const startTime = Date.now();
    const sessionId = crypto.randomUUID();

    console.log(`[HandleMessage] Processing message:`, {
      input: typeof input === "string" ? input : input.user,
      hasMention: options.hasMention,
      chatId: options.chatId,
      messageId: options.messageId,
    });

    try {
      // Get or validate group
      const group = await this.getGroup(options.chatId);
      if (!group?.isActive) {
        await this.eventService.createInteractionEvent(
          "interaction.processed",
          {
            input: typeof input === "string" ? input : input.user,
            messageId: options.messageId,
            processingResults: { status: "skipped" },
            timestamp: new Date().toISOString(),
            sessionId,
            decision: "no_response",
            reason: "inactive_group",
            user: {
              id: options.userId,
              username: options.username,
            },
          }
        );
        return null;
      }

      // Update conversation state
      const messageEvent: MessageEvent = {
        id: crypto.randomUUID(),
        chatId: options.chatId,
        messageId: options.messageId,
        senderId: options.userId,
        content: typeof input === "string" ? input : input.user,
        timestamp: new Date(),
        replyToId: options.replyTo,
        hasMention: options.hasMention ?? false,
        isFromDucky: false,
      };
      this.updateConversationState(options.chatId, messageEvent);

      // Check if we should respond
      const shouldRespond = await this.shouldRespond(
        group,
        options.hasMention ?? false,
        messageEvent.content
      );
      if (!shouldRespond) {
        await this.eventService.createInteractionEvent(
          "interaction.processed",
          {
            input: typeof input === "string" ? input : input.user,
            messageId: options.messageId,
            processingResults: { status: "skipped" },
            timestamp: new Date().toISOString(),
            sessionId,
            decision: "no_response",
            reason: "natural_conversation_flow",
            user: {
              id: options.userId,
              username: options.username,
            },
          }
        );
        return null;
      }

      // Calculate and apply response delay
      const responseDelay = this.calculateResponseDelay(options.chatId);
      await new Promise((resolve) => setTimeout(resolve, responseDelay));

      // Build conversation context
      const context = await this.buildConversationContext(group, messageEvent);

      const updateResult = await this.db
        .update(socialRelations)
        .set({
          interactionCount: sql`interaction_count + 1`,
          lastInteraction: new Date(),
          metadata: sql`
          jsonb_set(
            metadata,
            '{lastInteraction}',
            to_jsonb(now())
          )
        `,
        })
        .where(
          and(
            eq(socialRelations.characterId, options.characterId),
            eq(socialRelations.userId, options.userId)
          )
        )
        .returning();

      // If no record was updated, create a new one
      if (!updateResult.length) {
        await this.db.insert(socialRelations).values({
          characterId: options.characterId,
          userId: options.userId,
          status: "neutral",
          interactionCount: 1,
          lastInteraction: new Date(),
          metadata: {
            lastTopics: [],
            preferences: {},
            notes: [],
          },
        });
      }

      // Create started event
      await this.eventService.createInteractionEvent("interaction.started", {
        input: typeof input === "string" ? input : input.user,
        responseType: options.responseType ?? "chat",
        platform: options.platform,
        timestamp: new Date().toISOString(),
        sessionId,
        messageId: options.messageId,
        replyTo: options.replyTo,
        hasMention: options.hasMention,
        user: {
          id: options.userId,
          username: options.username,
        },
      });

      // Delegate to InteractionService for the complex LLM work
      const response = await this.interactionService.handleInteraction(input, {
        ...options,
        context,
        sessionId,
      });

      // Record successful response
      this.recordResponseInState(options.chatId);

      // Create completion event
      await this.eventService.createInteractionEvent("interaction.completed", {
        input: typeof input === "string" ? input : input.user,
        response: response.content,
        responseType: options.responseType ?? "chat",
        platform: options.platform,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        sessionId,
        messageId: options.messageId,
        replyTo: options.replyTo,
        metrics: response.metadata?.llmMetadata?.usage,
        user: {
          id: options.userId,
          username: options.username,
        },
      });

      return response;
    } catch (error) {
      await this.eventService.createInteractionEvent("interaction.failed", {
        input: typeof input === "string" ? input : input.user,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
        sessionId,
        messageId: options.messageId,
        attemptCount: 1,
        stage: "conversation_handling",
        user: {
          id: options.userId,
          username: options.username,
        },
      });
      throw error;
    }
  }

  private async getGroup(chatId: string) {
    let group: typeof telegramGroups.$inferSelect | null = null;
    [group] = await this.db
      .select()
      .from(telegramGroups)
      .where(eq(telegramGroups.telegramId, chatId))
      .limit(1);

    // if no group create one
    if (!group) {
      [group] = await this.db
        .insert(telegramGroups)
        .values({
          telegramId: chatId,
          metadata: {
            title: "New Group",
            joinedAt: new Date(),
            lastActive: new Date(),
            addedBy: "Admin",
          },
        })
        .returning();
    }

    return group;
  }

  private updateConversationState(chatId: string, event: MessageEvent) {
    const state = this.activeConversations.get(chatId) ?? {
      activeParticipants: new Map<string, Date>(),
      messageCount: 0,
      lastMessageTime: new Date(),
    };

    state.activeParticipants.set(event.senderId, event.timestamp);
    state.messageCount++;
    state.lastMessageTime = event.timestamp;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [
      participantId,
      lastActive,
    ] of state.activeParticipants.entries()) {
      if (lastActive < fiveMinutesAgo) {
        state.activeParticipants.delete(participantId);
      }
    }

    this.activeConversations.set(chatId, state);
  }

  private getRecentParticipantCount(state: ConversationState): number {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return Array.from(state.activeParticipants.values()).filter(
      (time) => time >= fiveMinutesAgo
    ).length;
  }

  private recordResponseInState(chatId: string) {
    const state = this.activeConversations.get(chatId);
    if (state) {
      state.lastDuckyMessage = new Date();
      this.activeConversations.set(chatId, state);
    }
  }

  /**
   * How Ducky decides when to respond:
   *
   * Always Responds To:
   * - Direct mentions
   * - Private messages
   * - Important messages/questions (LLM score > 0.7)
   *
   * Never Responds To:
   * - 1-on-1 conversations between others
   * - Regular group chat messages
   *
   * Response Timing:
   * - Active chats: Quick response (500ms)
   * - New chats: Slower response (3s)
   * - Plus 0-1s random delay for natural feel
   */
  private async shouldRespond(
    group: typeof telegramGroups.$inferSelect,
    hasMention: boolean,
    messageContent: string
  ): Promise<boolean> {
    console.log(`[ResponseDecision] Analyzing message: "${messageContent}"`);
    console.log(`[ResponseDecision] Has mention flag: ${hasMention}`);
    console.log(`[ResponseDecision] Group ID: ${group.telegramId}`);

    // Always respond to mentions
    if (hasMention) {
      console.log("[ResponseDecision] Responding due to mention");
      return true;
    }

    // Check for @duckyai_ai_bot in the message content as backup
    if (messageContent.toLowerCase().includes("@duckyai_ai_bot")) {
      console.log(
        "[ResponseDecision] Responding due to @duckyai_ai_bot in message"
      );
      return true;
    }

    const isPrivateChat = !group.telegramId.startsWith("-");
    if (isPrivateChat) {
      console.log("[ResponseDecision] Responding due to private chat");
      return true;
    }

    const state = this.activeConversations.get(group.telegramId);
    if (!state) {
      console.log("[ResponseDecision] No conversation state found");
      return false;
    }

    // Check if conversation is still active
    const conversationAge = Date.now() - state.lastMessageTime.getTime();
    console.log(`[ResponseDecision] Conversation age: ${conversationAge}ms`);

    if (conversationAge > this.CONVERSATION_TIMEOUT_MS) {
      console.log("[ResponseDecision] Conversation timed out");
      this.activeConversations.delete(group.telegramId);
      return false;
    }

    // Get number of active participants in last 5 minutes
    const recentParticipants = this.getRecentParticipantCount(state);
    console.log(
      `[ResponseDecision] Recent participants: ${recentParticipants}`
    );

    // If exactly 2 participants and Ducky isn't one of them, likely a 1-on-1 conversation
    if (recentParticipants === 2 && !state.lastDuckyMessage) {
      console.log(
        "[ResponseDecision] Skipping due to likely 1-on-1 conversation"
      );
      return false;
    }

    // Check for direct greetings
    const lowerContent = messageContent.toLowerCase();
    const greetings = [
      "hey ducky",
      "hi ducky",
      "hello ducky",
      "yo ducky",
      "hey @duckyai_ai_bot",
      "hi @duckyai_ai_bot",
      "hello @duckyai_ai_bot",
      "yo @duckyai_ai_bot",
    ];

    console.log("[ResponseDecision] Checking greetings...");
    for (const greeting of greetings) {
      if (lowerContent.includes(greeting)) {
        console.log(
          `[ResponseDecision] Responding due to greeting: ${greeting}`
        );
        return true;
      }
    }

    // Only respond to important messages or questions
    try {
      console.log("[ResponseDecision] Analyzing message importance...");
      const importance = await this.llm.analyzeImportance(messageContent);
      console.log(`[ResponseDecision] Message importance score: ${importance}`);
      return importance > 0.7;
    } catch (error) {
      console.error(
        "[ResponseDecision] Error analyzing message importance:",
        error
      );
      return false;
    }
  }

  private calculateResponseDelay(chatId: string): number {
    const state = this.activeConversations.get(chatId);
    if (!state) return this.MIN_REPLY_DELAY_MS;

    // Faster responses in active conversations
    const baseDelay =
      state.messageCount > 5
        ? this.MIN_REPLY_DELAY_MS
        : this.MAX_REPLY_DELAY_MS;

    // Add some randomness
    return baseDelay + Math.random() * 1000;
  }

  private async buildConversationContext(
    group: typeof telegramGroups.$inferSelect,
    currentEvent: MessageEvent
  ): Promise<Record<string, any>> {
    // Get recent messages from events
    const recentEvents = await this.db
      .select()
      .from(events)
      .where(
        and(
          sql`metadata->>'chatId' = ${group.telegramId}`,
          sql`metadata->>'timestamp' > ${new Date(
            Date.now() - 30 * 60 * 1000
          ).toISOString()}`
        )
      )
      .orderBy(desc(sql`metadata->>'timestamp'`))
      .limit(10);

    const messages = recentEvents
      .map((e) => {
        if (e.type === "interaction.completed") {
          return {
            content: (
              e.payload as InteractionEventPayload["interaction.completed"]
            ).response,
            senderId: e.metadata.userId,
            timestamp: e.metadata.timestamp,
            isFromDucky: true,
          };
        } else if (e.type === "interaction.started") {
          return {
            content: (
              e.payload as InteractionEventPayload["interaction.started"]
            ).input,
            senderId: e.metadata.userId,
            timestamp: e.metadata.timestamp,
            isFromDucky: false,
          };
        }
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const state = this.activeConversations.get(currentEvent.chatId);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return {
      conversationState: {
        activeParticipants: state
          ? Array.from(state.activeParticipants.entries())
              .filter(([_, lastActive]) => lastActive >= fiveMinutesAgo)
              .map(([id]) => id)
          : [],
        messageCount: state?.messageCount ?? 0,
        isActiveConversation: !!state,
      },
      recentMessages: messages.reverse(),
      group: {
        id: group.id,
        tier: group.tier,
        metadata: group.metadata,
      },
    };
  }

  private cleanupStaleConversations() {
    const now = Date.now();
    for (const [chatId, state] of this.activeConversations.entries()) {
      if (
        now - state.lastMessageTime.getTime() >
        this.CONVERSATION_TIMEOUT_MS
      ) {
        this.activeConversations.delete(chatId);
      }
    }
  }

  async cleanupOldEvents() {
    await this.db.delete(events).where(sql`
        EXISTS (
          SELECT 1 FROM telegram_groups tg 
          WHERE tg.tier = 'temporary'
          AND metadata->>'chatId' = tg.telegram_id
        )
        AND metadata->>'timestamp' < ${new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000
        ).toISOString()}
        AND type NOT IN ('interaction.completed')
        AND NOT payload->>'hasMention' = 'true'
        AND processed = true
    `);
  }
}
