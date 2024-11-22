import type { InteractionDefaults } from "@/types";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify, identifyPush } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import chalk from "chalk";
import { createLibp2p } from "libp2p";
import { createWalletClient, custom, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { InteractionOptions } from "../types";
import type { CharacterManager } from "./character";

// Console logging utility
export const log = {
  info: (message: string, data?: any) => {
    console.log(
      chalk.blue("ℹ"),
      chalk.blue(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  sent: (message: string, data?: any) => {
    console.log(
      chalk.green("⚡"),
      chalk.green(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  receiving: (message: string, data?: any) => {
    console.log(
      chalk.yellow("✉️"),
      chalk.yellow(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      chalk.red("✖"),
      chalk.red(message),
      error ? chalk.gray(error.message || JSON.stringify(error)) : ""
    );
  },
  network: (message: string, data?: any) => {
    console.log(
      chalk.magenta("⚡"),
      chalk.magenta(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
  message: (message: string, data?: any) => {
    console.log(
      chalk.cyan("💬"),
      chalk.cyan(message),
      data ? chalk.gray(JSON.stringify(data)) : ""
    );
  },
};

interface AgentMetadata {
  creators?: string;
  tokenAddress?: string;
}

interface P2PAgentMessage {
  messageId: string;
  fromAgentId: string; // Address
  toAgentId?: string; // Optional - if not set, broadcast
  content: string;
  timestamp: number;
  signature: string;
  conversationId?: string;
  replyTo?: string;
}

export class P2PNetwork {
  private node: any;
  private wallet: WalletClient;
  private account: any;
  private knownPeers: Set<string> = new Set();
  private agentMetadata: AgentMetadata;
  private processedMessages: Set<string> = new Set();
  private characterManager: CharacterManager;
  private defaults: InteractionDefaults | undefined;
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
    defaults: InteractionDefaults | undefined
  ) {
    this.characterManager = characterManager;
    this.defaults = defaults;
    this.account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}`);
    this.wallet = createWalletClient({
      account: this.account,
      transport: custom({
        request: async (args) => {
          console.log("Request:", args);
        },
      }), // Use custom empty transport since we only need signing
    });
    this.agentMetadata = metadata;
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
      log.info("Agent address:", this.account.address);

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

  private async handleAgentMessage(message: P2PAgentMessage) {
    try {
      // Skip if we've already processed this message
      if (this.processedMessages.has(message.messageId)) {
        return;
      }

      // Skip if message is not for us and not a broadcast
      if (message.toAgentId && message.toAgentId !== this.account.address) {
        return;
      }

      // Verify the message
      const messageHash = await this.wallet.signMessage({
        message: JSON.stringify({
          messageId: message.messageId,
          fromAgentId: message.fromAgentId,
          toAgentId: message.toAgentId,
          content: message.content,
          timestamp: message.timestamp,
          conversationId: message.conversationId,
          replyTo: message.replyTo,
        }),
        account: this.account,
      });

      if (message.signature !== messageHash) {
        console.warn("Invalid message signature");
        return;
      }

      // Mark as processed
      this.processedMessages.add(message.messageId);
      log.receiving(
        ` [RECEIVING TRANSMISSION]
        \n ${message.content}\n`
      );

      // Process with AI
      const character = await this.characterManager.getCharacter();

      const systemPrompt = `Private chat with ${message.fromAgentId.substring(
        0,
        5
      )}. ${message.content}`;

      const defaultOptions = {
        mode: "enhanced" as const,
        platform: "telegram" as const,
        responseType: "telegram_chat",
        characterId: character.id,
      };
      const response = await this.aiInteract(
        {
          system: systemPrompt,
          user: message.content,
        },
        {
          ...defaultOptions,
          userId: message.fromAgentId,
          characterId: character.id,
          chatId: message.conversationId || message.fromAgentId,
          messageId: message.messageId,
          replyTo: message.replyTo,
        }
      );

      // If we got a response, send it back
      if (response?.content) {
        await this.sendMessage(
          response.content,
          message.fromAgentId,
          message.conversationId,
          message.messageId
        );
        log.sent(`[RESPONDING]`);
      }
    } catch (error) {
      console.error("Error processing agent message:", error);
    }
  }

  public async sendMessage(
    content: string,
    toAgentId?: string,
    conversationId?: string,
    replyTo?: string
  ) {
    const messageId = crypto.randomUUID();

    const messageData = {
      messageId,
      fromAgentId: this.account.address,
      toAgentId,
      content,
      timestamp: Date.now(),
      conversationId,
      replyTo,
    };

    // Sign the message
    const signature = await this.wallet.signMessage({
      message: JSON.stringify(messageData),
      account: this.account,
    });

    const message: P2PAgentMessage = {
      ...messageData,
      signature,
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
      agentId: this.account.address,
      name: this.agentName,
      version: this.version,
      timestamp: Date.now(),
      addrs: this.node.getMultiaddrs().map(String),
      metadata: this.agentMetadata,
    };

    const signature = await this.wallet.signMessage({
      message: JSON.stringify(message),
      account: this.account,
    });

    const announcement = { ...message, signature };

    await this.node.services.pubsub.publish(
      "agent-announcements",
      new TextEncoder().encode(JSON.stringify(announcement))
    );
    console.log("Presence announced successfully");
  }

  private async verifyAndProcessAnnouncement(announcement: any) {
    try {
      if (announcement.agentId === this.account.address) {
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
