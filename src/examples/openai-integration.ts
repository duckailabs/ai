//import OpenAI from "openai";
import { PromptBuilder } from "../builder";

async function main() {
  const template = `
    <system>You are a code review assistant.</system>
    <user>Review this code:
<code>

Focus on: <focus></user>
  `;

  const builder = new PromptBuilder(template).withContext({
    code: `function add(a: number, b: number): number {
  return a + b;
}`,
    focus: "type safety and error handling",
  });

  const messages = await builder.build();

  /*   const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
    });

    console.log(completion.choices[0].message); */
}
