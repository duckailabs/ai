import { z } from "zod";

export const tweetMetricsSchema = z
  .object({
    likes: z.coerce.number().optional(),
    retweets: z.coerce.number().optional(),
    replies: z.coerce.number().optional(),
    views: z.coerce.number().optional(),
  })
  .partial()
  .optional();

export const threadEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  authorId: z.string().optional(),
  authorUsername: z.string().optional(),
  createdAt: z.string().optional(),
});

export const twitterMentionSchema = z.object({
  tweet: z.object({
    id: z.string(),
    text: z.string(),
    authorId: z.string(),
    authorUsername: z.string(),
    conversationId: z.string().optional(),
    createdAt: z.string().optional(),
    inReplyToStatusId: z.string().optional(),
    isReply: z.boolean().optional(),
    isRetweet: z.boolean().optional(),
    metrics: tweetMetricsSchema,
    referencedTweets: z
      .object({
        replied: z.string().nullable().optional(),
        quoted: z.string().nullable().optional(),
        retweeted: z.string().nullable().optional(),
      })
      .partial()
      .optional(),
  }),
  thread: z.array(threadEntrySchema).optional(),
  characterId: z.string().uuid().optional(),
  responseType: z.string().optional(),
  force: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  postAs: z.string().optional(),
});

export type TwitterMentionPayload = z.infer<typeof twitterMentionSchema>;
