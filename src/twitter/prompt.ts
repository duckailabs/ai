import type { WorkerPrompt } from "./worker";
import type { TwitterMentionPayload } from "./schema";

const TWITTER_SYSTEM_PROMPT =
  "You are responding to a tweet mention. There is no existing plan for this request—propose and execute the steps needed to deliver the final tweet yourself. Use the supplied context to craft a natural, on-brand reply in a single tweet (<=280 characters). Avoid leading/trailing quotes and only include hashtags if explicitly requested.";

export function buildPrompt(payload: TwitterMentionPayload): WorkerPrompt {
  const { tweet, thread } = payload;
  const messageSections: string[] = [];

  messageSections.push("Incoming Tweet:");
  messageSections.push(`@${tweet.authorUsername}: ${tweet.text}`);

  if (Array.isArray(thread) && thread.length > 0) {
    const formattedThread = thread
      .map((item) => {
        const author = item.authorUsername ? `@${item.authorUsername}` : "Unknown";
        return `- ${author}: ${item.text}`;
      })
      .join("\n");

    messageSections.push("Thread Context (oldest → newest):");
    messageSections.push(formattedThread);
  }

  const message = messageSections.join("\n\n");

  return {
    instructions: TWITTER_SYSTEM_PROMPT,
    message,
  };
}
