import { env } from "@/env";
import { startMessageScheduler } from "@/scheduler";
import { sendTweetReply } from "@/twitter/executor";
import {
  findExistingMention,
  recordMention,
  resolveCharacterId,
} from "@/twitter/mentions";
import { buildPrompt } from "@/twitter/prompt";
import {
  twitterMentionSchema,
  type TwitterMentionPayload,
} from "@/twitter/schema";
import { callWorker } from "@/twitter/worker";
import { serve } from "bun";
import { z } from "zod";

const TWITTER_DEFAULT_RESPONSE_TYPE = "tweet_reply";

async function handleMention(
  payload: TwitterMentionPayload
): Promise<Response> {
  const characterId = await resolveCharacterId(
    payload.characterId,
    env.characters.defaultId
  );

  const existing = await findExistingMention(payload.tweet.id);
  if (existing.length > 0 && !payload.force) {
    return json({ status: "skipped", reason: "already_processed" });
  }

  await recordMention(payload, characterId, "pending");

  try {
    const prompt = buildPrompt(payload);
    const reply = await callWorker(prompt, {
      sessionContext: {
        conversationId: payload.tweet.conversationId || payload.tweet.id,
        userMessageId: payload.tweet.id,
      },
      toolOptions: {
        autoExecutePlanned: true,
        requireApprovalForPaid: false,
        approvals: { allowAllPaid: true },
      },
    });

    const tweetContent = enforceTweetLength(reply);
    if (tweetContent !== reply) {
      const originalLength = Array.from(reply).length;
      const truncatedLength = Array.from(tweetContent).length;
      console.warn("[twitter-mention] reply_truncated", {
        originalLength,
        truncatedLength,
      });
    }

    const command = {
      content: tweetContent,
      inReplyTo: payload.tweet.id,
      postAs: payload.postAs,
      metadata: {
        conversationId: payload.tweet.conversationId,
        responseType: payload.responseType || TWITTER_DEFAULT_RESPONSE_TYPE,
        authorUsername: payload.tweet.authorUsername,
        postAs: payload.postAs,
      },
    } as const;

    const tweetLength = Array.from(tweetContent).length;
    console.log("[twitter-mention] sendTweetReply", {
      tweetId: command.inReplyTo,
      postAs: command.postAs,
      contentPreview: tweetContent.slice(0, 120),
      length: tweetLength,
    });

    const { tweetId: responseTweetId } = await sendTweetReply(command);

    await recordMention(payload, characterId, "processed", {
      responseTweetId,
    });

    return json({
      status: "ok",
      reply: tweetContent,
      prompt,
      responseType: payload.responseType || TWITTER_DEFAULT_RESPONSE_TYPE,
      tweetId: payload.tweet.id,
      conversationId: payload.tweet.conversationId || null,
      responseTweetId,
    });
  } catch (error) {
    console.error("[twitter-mention] failed", {
      tweetId: payload.tweet.id,
      error,
    });
    await recordMention(payload, characterId, "failed", {
      skipReason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MAX_TWEET_LENGTH = 280;

function enforceTweetLength(input: string): string {
  const graphemes = Array.from(input);
  if (graphemes.length <= MAX_TWEET_LENGTH) {
    return input;
  }

  const ellipsis = "…";
  if (MAX_TWEET_LENGTH <= Array.from(ellipsis).length) {
    return graphemes.slice(0, MAX_TWEET_LENGTH).join("");
  }

  const allowance = MAX_TWEET_LENGTH - Array.from(ellipsis).length;
  const truncated = graphemes.slice(0, allowance).join("").trimEnd();
  return `${truncated}${ellipsis}`;
}

const server = serve({
  port: env.http.port,
  fetch: async (request) => {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/twitter/mention") {
      const auth = request.headers.get("authorization");
      if (!auth || auth !== `Bearer ${env.ingest.token}`) {
        return json({ error: "unauthorized" }, 401);
      }
      try {
        const raw = await request.json();
        console.log("[twitter-mention] received", {
          id: raw?.tweet?.id,
          author: raw?.tweet?.authorUsername,
          hasThread: Array.isArray(raw?.thread) ? raw.thread.length : 0,
        });
        const payload = twitterMentionSchema.parse(raw);
        console.log("[twitter-mention] parsed", {
          id: payload.tweet.id,
          author: payload.tweet.authorUsername,
          metrics: payload.tweet.metrics,
          thread: payload.thread?.length ?? 0,
        });
        return await handleMention(payload);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("[twitter-mention] validation_error", error.flatten());
          return json({ error: error.flatten() }, 400);
        }
        console.error("twitter_mention_error", error);
        return json({ error: "internal_error" }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `Twitter mention service listening on http://localhost:${server.port}`
);

if (env.schedule) {
  startMessageScheduler({
    message: env.schedule.message,
    cron: env.schedule.cron,
    async onMessage(message) {
      const reply = await callWorker({ message }, {
        sessionContext: { conversationId: `scheduled-${Date.now()}` },
      });
      console.log(`[scheduler] ${reply}`);
    },
  });
}
