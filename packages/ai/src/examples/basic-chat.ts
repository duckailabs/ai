import { PromptBuilder } from "../builder";

export default async function main() {
  const template =
    "<system>You are a helpful AI assistant.</system><user>Hello, my name is <name></user>";

  const builder = new PromptBuilder(template).withContext({
    name: "Alice",
  });

  const messages = await builder.build();
  console.log(JSON.stringify(messages, null, 2));
}
