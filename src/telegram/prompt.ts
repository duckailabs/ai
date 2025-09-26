import type { WorkerPrompt } from "@/twitter/worker";

export function buildTelegramPrompt(
  message: string,
  context?: { username?: string }
): WorkerPrompt {
  const header = context?.username
    ? `@${context.username} sent the following message on Telegram:`
    : "A Telegram user sent the following message:";

  const instructions = [
    "You are replying in a Telegram chat. Keep the response conversational, concise, and friendly.",
    "Avoid markdown beyond simple emphasis.",
  ].join("\n");

  const body = [header, message].join("\n\n");

  return {
    instructions,
    message: body,
  };
}
