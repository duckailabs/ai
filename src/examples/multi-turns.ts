// src/examples/multi-turn.ts
import { PromptBuilder } from "../builder";

export default async function main() {
  const template = `<system>You are an AI assistant.</system>
<user>Hi, I'm <name></user>
<assistant>Hello <name>, how can I help you today?</assistant>
<user>I need help with <topic></user>`;

  const builder = new PromptBuilder(template).withContext({
    name: "Bob",
    topic: "prompt engineering",
  });

  const messages = await builder.build();
  console.log(JSON.stringify(messages, null, 2));
}
