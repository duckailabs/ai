import { env } from "@/env";

export interface TweetReplyCommand {
  content: string;
  inReplyTo: string;
  postAs?: string;
  metadata?: Record<string, unknown>;
}

export interface TweetReplyResult {
  tweetId: string;
}

function authHeader() {
  return `Bearer ${env.twitterExecutor.token}`;
}

export async function sendTweetReply(
  command: TweetReplyCommand
): Promise<TweetReplyResult> {
  console.log("[executor] target", env.twitterExecutor.url);
  let response: Response;
  try {
    response = await fetch(`${env.twitterExecutor.url}/tweets/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify(command),
    });
  } catch (error) {
    console.error("[executor] fetch_error", error);
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twitter executor request failed: ${response.status} ${errorText}`
    );
  }

  const raw = await response.text();
  let data: Partial<TweetReplyResult>;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Twitter executor returned invalid JSON: ${raw}`);
  }
  if (!data.tweetId) {
    throw new Error("Twitter executor response missing tweetId");
  }

  return { tweetId: data.tweetId };
}
