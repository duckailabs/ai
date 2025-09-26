import { db } from "@/db";
import { characters, twitterMentions } from "@/db/schema/schema";
import { eq } from "drizzle-orm";
import type { TwitterMentionPayload } from "./schema";

export async function resolveCharacterId(
  requestedId: string | undefined,
  defaultId: string
): Promise<string> {
  const targetId = requestedId ?? defaultId;
  const [record] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.id, targetId))
    .limit(1);

  if (!record) {
    throw new Error(`Character ${targetId} not found`);
  }

  return record.id;
}

export async function findExistingMention(tweetId: string) {
  return db
    .select({ id: twitterMentions.id, status: twitterMentions.status })
    .from(twitterMentions)
    .where(eq(twitterMentions.tweetId, tweetId))
    .limit(1);
}

export async function recordMention(
  payload: TwitterMentionPayload,
  characterId: string,
  status: "pending" | "processed" | "skipped" | "failed",
  extra?: {
    skipReason?: string;
    responseTweetId?: string;
  }
) {
  const tweet = payload.tweet;
  const createdAt = tweet.createdAt ? new Date(tweet.createdAt) : new Date();
  const skipReason = extra?.skipReason
    ? extra.skipReason.slice(0, 250)
    : undefined;

  await db
    .insert(twitterMentions)
    .values({
      tweetId: tweet.id,
      authorId: tweet.authorId,
      authorUsername: tweet.authorUsername,
      characterId,
      createdAt,
      processedAt: status === "processed" ? new Date() : null,
      status,
      skipReason,
      responseTweetId: extra?.responseTweetId,
      isReply:
        typeof tweet.isReply === "boolean"
          ? tweet.isReply
          : Boolean(tweet.referencedTweets?.replied),
      isRetweet: tweet.isRetweet ?? false,
      conversationId: tweet.conversationId,
      metrics: tweet.metrics ?? {},
    })
    .onConflictDoUpdate({
      target: [twitterMentions.tweetId],
      set: {
        status,
        skipReason,
        responseTweetId: extra?.responseTweetId,
        processedAt: status === "processed" ? new Date() : null,
        authorId: tweet.authorId,
        authorUsername: tweet.authorUsername,
        characterId,
        createdAt,
        isReply:
          typeof tweet.isReply === "boolean"
            ? tweet.isReply
            : Boolean(tweet.referencedTweets?.replied),
        isRetweet: tweet.isRetweet ?? false,
        conversationId: tweet.conversationId,
        metrics: tweet.metrics ?? {},
      },
    });
}
