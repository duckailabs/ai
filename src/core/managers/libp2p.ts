import { log } from "@/core/utils/logger";
import type { InteractionDefaults } from "@/types";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify, identifyPush } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import { Turnkey } from "@turnkey/sdk-server";
import crypto from "crypto";
import { createLibp2p } from "libp2p";
import type { InteractionOptions } from "../types";
import type { CharacterManager } from "./character";
import { DuckAiTokenAirdrop } from "./wallet";

interface AgentMetadata {
  creators?: string;
  tokenAddress?: string;
}

interface P2PAgentMessage {
  messageId: string;
  fromAgentId: string;
  toAgentId?: string;
  content: string;
  timestamp: number;
  signature: string;
  conversationId?: string;
  replyTo?: string;
  isQuestion?: boolean; // New field to identify questions
  requiresReward?: boolean; // New field to indicate if message should be rewarded
  rewardAmount?: number; // Optional reward amount in tokens
}

interface P2PNetworkConfig {
  turnkeyClient: Turnkey | null | undefined;
  tokenMintAddress: string;
  rewardAmount: number;
  address: string;
}

export class P2PNetwork {
  private node: any;
  //private wallet: WalletClient;
  private account: any;
  private knownPeers: Set<string> = new Set();
  private agentMetadata: AgentMetadata;
  private processedMessages: Set<string> = new Set();
  private characterManager: CharacterManager;
  private defaults: InteractionDefaults | undefined;
  private tokenAirdrop: DuckAiTokenAirdrop;
  private pendingQuestions: Map<string, P2PAgentMessage> = new Map();
  private config: P2PNetworkConfig;
  private address: string;

  constructor(
    privateKey: string,
    private agentName: string,
    private version: string,
    private metadata: AgentMetadata,

    private aiInteract: (
      input: { system: string; user: string },
      options: InteractionOptions
    ) => Promise<any>,
    characterManager: CharacterManager,
    defaults: InteractionDefaults | undefined,
    config: P2PNetworkConfig
  ) {
    this.characterManager = characterManager;
    this.defaults = defaults;
    this.config = config;
    /* this.account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}`);
    this.wallet = createWalletClient({
      account: this.account,
      transport: custom({
        request: async (args) => {
          console.log("Request:", args);
        },
      }),
    }); */
    this.address = config.address;
    this.agentMetadata = metadata;

    // Initialize token airdrop
    if (!config.turnkeyClient) {
      throw new Error("Turnkey client is required for P2P network");
    }
    this.tokenAirdrop = new DuckAiTokenAirdrop(
      config.turnkeyClient,
      config.address,
      config.tokenMintAddress
    );
  }

  async sendQuestion(content: string): Promise<string> {
    const messageId = crypto.randomUUID();

    const messageData = {
      messageId,
      fromAgentId: this.address,
      content,
      timestamp: Date.now(),
      isQuestion: true,
      requiresReward: true,
      rewardAmount: this.config.rewardAmount,
    };

    /* const signature = await this.wallet.signMessage({
      message: JSON.stringify(messageData),
      account: this.account,
    }); */

    const message: P2PAgentMessage = {
      ...messageData,
      signature: "0x",
    };

    // Store the question for later verification
    this.pendingQuestions.set(messageId, message);

    // Publish to the agent-messages topic
    await this.node.services.pubsub.publish(
      "agent-messages",
      new TextEncoder().encode(JSON.stringify(message))
    );

    log.sent(`[SENDING QUESTION] ${content}\n`);
    return messageId;
  }

  private async handleAgentMessage(message: P2PAgentMessage) {
    try {
      if (this.processedMessages.has(message.messageId)) {
        return;
      }

      /* if (message.toAgentId && message.toAgentId !== this.account.address) {
        return;
      } */

      // Verify the message signature
      /*  const messageHash = await this.wallet.signMessage({
        message: JSON.stringify({
          messageId: message.messageId,
          fromAgentId: message.fromAgentId,
          toAgentId: message.toAgentId,
          content: message.content,
          timestamp: message.timestamp,
          conversationId: message.conversationId,
          replyTo: message.replyTo,
          isQuestion: message.isQuestion,
          requiresReward: message.requiresReward,
          rewardAmount: message.rewardAmount,
        }),
        account: this.account,
      }); */

      /* if (message.signature !== messageHash) {
        console.warn("Invalid message signature");
        return;
      }
 */
      this.processedMessages.add(message.messageId);

      if (message.isQuestion) {
        // Handle incoming question
        log.receiving(`[RECEIVING QUESTION] ${message.content}\n`);

        const character = await this.characterManager.getCharacter();
        if (!character) {
          log.error("No character found");
          return;
        }

        const response = await this.aiInteract(
          {
            system: `Question from ${message.fromAgentId.substring(0, 5)}`,
            user: message.content,
          },
          {
            mode: "enhanced",
            platform: "telegram",
            responseType: "telegram_chat",
            userId: message.fromAgentId,
            characterId: character.id,
            chatId: message.conversationId || message.fromAgentId,
            messageId: message.messageId,
            replyTo: message.replyTo,
          }
        );

        if (response?.content) {
          await this.sendMessage(
            response.content,
            message.fromAgentId,
            message.conversationId,
            message.messageId,
            false, // Not a question
            true // This is an answer
          );
          log.sent(`[SENDING ANSWER]\n`);
        }
      } else {
        // Handle answer to our question
        const originalQuestion = this.pendingQuestions.get(message.replyTo!);
        if (originalQuestion && originalQuestion.requiresReward) {
          log.receiving(`[RECEIVED ANSWER] ${message.content}\n`);

          // Send reward
          try {
            const signature = await this.tokenAirdrop.airdropTokens(
              message.fromAgentId
            );
            log.sent(
              `Processed payment to ${message.fromAgentId}.\n Tx: https://explorer.solana.com/tx/${signature}?cluster=devnet`
            );
            await this.sendMessage(
              `Receipt https://explorer.solana.com/tx/${signature}?cluster=devnet`,
              message.fromAgentId,
              message.conversationId,
              message.messageId,
              false,
              true
            );
            this.pendingQuestions.delete(message.replyTo!);
          } catch (error) {
            log.error(`Failed to send reward tokens: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error("Error processing agent message:", error);
    }
  }

  async start(port: number, initialPeers: string[] = []) {
    log.info("Starting P2P network setup...");
    try {
      this.node = await createLibp2p({
        addresses: {
          listen: [`/ip4/0.0.0.0/tcp/${port}`],
        },
        transports: [tcp()],
        streamMuxers: [yamux()],
        connectionEncrypters: [noise()],
        services: {
          pubsub: gossipsub({
            emitSelf: false,
            fallbackToFloodsub: true,
            allowPublishToZeroTopicPeers: true,
          }),
          identify: identify(),
          identifyPush: identifyPush(),
        },
      });

      await this.node.start();
      await this.setupPubSub();

      log.info("P2P Network started with ID:", this.node.peerId.toString());
      log.info("Agent address:", this.address);

      // Connect to initial peers
      if (initialPeers.length > 0) {
        for (const addr of initialPeers) {
          try {
            await this.node.dial(multiaddr(addr));
            this.knownPeers.add(addr);
            console.log(`Connected to peer: ${addr}`);
          } catch (err) {}
        }
      }

      await this.announcePresence();
    } catch (error) {
      console.error("Error starting P2P network:", error);
      throw error;
    }
  }

  private async setupPubSub() {
    // Subscribe to agent announcements
    await this.node.services.pubsub.subscribe("agent-announcements");
    log.info("Subscribed to agent-announcements");

    // Subscribe to agent messages
    await this.node.services.pubsub.subscribe("agent-messages");
    log.info("Subscribed to agent-messages");

    // Handle incoming messages
    this.node.services.pubsub.addEventListener("message", async (evt: any) => {
      if (evt.detail.topic === "agent-announcements") {
        const announcement = JSON.parse(evt.detail.data.toString());
        await this.verifyAndProcessAnnouncement(announcement);
      } else if (evt.detail.topic === "agent-messages") {
        const message = JSON.parse(evt.detail.data.toString());
        await this.handleAgentMessage(message);
      }
    });
  }

  public async sendMessage(
    content: string,
    toAgentId?: string,
    conversationId?: string,
    replyTo?: string,
    isQuestion: boolean = false,
    isAnswer: boolean = false
  ) {
    const messageId = crypto.randomUUID();

    const messageData = {
      messageId,
      fromAgentId: this.address,
      toAgentId,
      content,
      timestamp: Date.now(),
      conversationId,
      replyTo,
      isQuestion,
      requiresReward: false,
      rewardAmount: isQuestion ? this.config.rewardAmount : undefined,
    };

    // Sign the message
    /*  const signature = await this.wallet.signMessage({
      message: JSON.stringify(messageData),
      account: this.account,
    }); */

    const message: P2PAgentMessage = {
      ...messageData,
      signature: "0x",
    };

    // Publish to the agent-messages topic
    await this.node.services.pubsub.publish(
      "agent-messages",
      new TextEncoder().encode(JSON.stringify(message))
    );

    return messageId;
  }

  async announcePresence() {
    const message = {
      agentId: this.address,
      name: this.agentName,
      version: this.version,
      timestamp: Date.now(),
      addrs: this.node.getMultiaddrs().map(String),
      metadata: this.agentMetadata,
    };

    /* const signature = await this.wallet.signMessage({
      message: JSON.stringify(message),
      account: this.account,
    });
 */
    const announcement = { ...message, signature: "0x" };

    await this.node.services.pubsub.publish(
      "agent-announcements",
      new TextEncoder().encode(JSON.stringify(announcement))
    );
    console.log("Presence announced successfully");
  }

  private async verifyAndProcessAnnouncement(announcement: any) {
    try {
      if (announcement.agentId === this.address) {
        return;
      }

      console.log("New agent announced:", {
        agentId: announcement.agentId,
        name: announcement.name,
      });

      // Connect to new peers
      for (const addr of announcement.addrs) {
        if (!this.knownPeers.has(addr)) {
          try {
            await this.node.dial(multiaddr(addr));
            this.knownPeers.add(addr);
            console.log(`Connected to new peer: ${addr}`);
          } catch (err) {
            console.warn(`Failed to dial ${addr}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("Error processing announcement:", err);
    }
  }

  async stop() {
    if (this.node) {
      try {
        await this.node.stop();
        console.log("P2P network stopped successfully");
      } catch (error) {
        console.error("Error stopping P2P network:", error);
      }
    }
  }
}
