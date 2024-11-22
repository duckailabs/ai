interface ChatHistory {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  messageId: number;
  username?: string;
}

export class PromptService {
  private readonly MAX_HISTORY_LENGTH = 10;
  private chatHistory: Map<number, ChatHistory[]> = new Map();

  constructor() {}

  public addToHistory(chatId: number, message: ChatHistory) {
    if (!this.chatHistory.has(chatId)) {
      this.chatHistory.set(chatId, []);
    }

    const history = this.chatHistory.get(chatId)!;
    history.push(message);

    if (history.length > this.MAX_HISTORY_LENGTH) {
      history.shift();
    }

    this.chatHistory.set(chatId, history);
  }

  public formatChatHistory(chatId: number): string {
    const history = this.chatHistory.get(chatId) || [];
    if (history.length === 0) return "";

    return history
      .map((msg) => {
        const timestamp = new Date(msg.timestamp * 1000).toLocaleTimeString();
        return `[${timestamp}] ${msg.username} (${msg.role}): ${msg.content}`;
      })
      .join("\n\n");
  }

  public buildSystemPrompt(
    username: string,
    firstName?: string,
    lastName?: string,
    isReply?: boolean,
    chatHistory?: string
  ): string {
    const userContext = username
      ? `User @${username}`
      : `User ${firstName}${lastName ? ` ${lastName}` : ""}`;

    const replyContext = isReply
      ? ` The user is replying to a previous message.`
      : "";

    const historyContext = chatHistory
      ? `\n\nChat History:\n${chatHistory}`
      : "\n\nThis is the start of the conversation.";

    return `Private chat with ${userContext}.${replyContext}${historyContext}`;
  }

  public cleanupOldHistories() {
    const now = Date.now();
    for (const [chatId, history] of this.chatHistory) {
      const oneDayAgo = now / 1000 - 86400;
      const recentHistory = history.filter((msg) => msg.timestamp > oneDayAgo);
      if (recentHistory.length !== history.length) {
        this.chatHistory.set(chatId, recentHistory);
      }
    }
  }

  public getHistoryContext(chatId: number): Array<ChatHistory> {
    return this.chatHistory.get(chatId) || [];
  }
}
