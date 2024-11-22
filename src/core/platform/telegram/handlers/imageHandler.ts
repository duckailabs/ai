import type { ai } from "@/core/ai";
import type { ImageManager } from "@/core/managers/image";
import type { Context } from "telegraf";

export class ImageHandler {
  constructor(
    private imageManager: ImageManager,
    private ai: ai // Your existing AI instance
  ) {}

  async handleImageGeneration(ctx: Context) {
    try {
      if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Please send a text message.");
        return;
      }

      const text = ctx.message.text.replace(/^\/img\s*/, "").trim();

      if (!text) {
        await ctx.reply("Please provide a description after the /img command.");
        return;
      }

      const result = await this.imageManager.generateImage(text, {
        messageId: ctx.message.message_id.toString(),
        platform: "telegram",
        sessionId: `${ctx.chat?.id}-${Date.now()}`,
        user: {
          id: ctx.from?.id.toString() || "",
          username: ctx.from?.username,
        },
      });

      if (result.success && result.url) {
        await ctx.replyWithPhoto(result.url);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error in handleImageGeneration:", error);
      await ctx.reply(
        "Sorry, there was an error generating your image. Please try again later."
      );
    }
  }
}
