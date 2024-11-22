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
      activeParticipants: new Set<string>(),
      messageCount: 0,
      lastMessageTime: new Date(),
    };

    state.activeParticipants.add(event.senderId);
    state.messageCount++;
    state.lastMessageTime = event.timestamp;

    this.activeConversations.set(chatId, state);
  }

  private recordResponseInState(chatId: string) {
    const state = this.activeConversations.get(chatId);
    if (state) {
      state.lastDuckyMessage = new Date();
      this.activeConversations.set(chatId, state);
    }
  }

  /**
   * 4:00:00 PM: Ducky responds to message
   * 4:00:05 PM: New message → No response (< 10 seconds)
   * 4:00:15 PM: New message → No response (30% chance failed)
   * 4:00:30 PM: New message → Responds (30% chance succeeded)
   * 4:00:35 PM: New message → No response (< 10 seconds since last response)
   * 4:05:30 PM: New message → Will definitely respond (5+ minutes passed)
   *
   * 2:00 PM: Ducky responds
   * 2:01 PM: [silence - nothing happens]
   * 2:02 PM: [silence - nothing happens]
   * 2:03 PM: User sends message → shouldRespond() is called now
   *         - Checks if it's been 5 mins since Ducky's last message (no)
   *         - Checks if it's been > 10s and rolls 30% chance
   *         - Ducky responds
   */
  private async shouldRespond(
    group: typeof telegramGroups.$inferSelect,
    hasMention: boolean,
    messageContent: string
  ): Promise<boolean> {
    // Always respond to mentions
    if (hasMention) return true;

    const isPrivateChat = !group.telegramId.startsWith("-");
    if (isPrivateChat) {
      return true;
    }

    const state = this.activeConversations.get(group.telegramId);
    if (!state) return false;

    // Check if conversation is still active
    const conversationAge = Date.now() - state.lastMessageTime.getTime();
    if (conversationAge > this.CONVERSATION_TIMEOUT_MS) {
      this.activeConversations.delete(group.telegramId);
      return false;
    }

    // Try LLM analysis first
    try {
      const importance = await this.llm.analyzeImportance(messageContent);
      if (importance > 0.7) return true; // Respond immediately to important messages
    } catch (error) {
      console.error("Error analyzing message importance:", error);
    }

    // Natural response factors (if message wasn't important enough)
    const timeSinceLastDucky = state.lastDuckyMessage
      ? Date.now() - state.lastDuckyMessage.getTime()
      : Infinity;

    return (
      timeSinceLastDucky > 5 * 60 * 1000 || // Been quiet for 5 minutes
      (Math.random() < 0.5 && timeSinceLastDucky > 10 * 1000) // Random chance if not recent
    );
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

    return {
      conversationState: {
        activeParticipants: state ? Array.from(state.activeParticipants) : [],
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
