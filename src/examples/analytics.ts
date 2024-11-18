import { PromptBuilder } from "../builder";

export default async function main() {
  const metrics = [
    { date: "2024-03-13", metric: "users", value: 1000 },
    { date: "2024-03-14", metric: "users", value: 1200 },
    { date: "2024-03-15", metric: "users", value: 1150 },
  ];

  const template = `<system>You are a data analyst AI.</system>
<user>Analyze this metrics data:
<data>

What are the key trends?</user>`;

  const formattedData = metrics
    .map((row) => `${row.date}: ${row.metric} = ${row.value}`)
    .join("\n");
  console.log("before");
  const builder = new PromptBuilder(template, {
    allowEmptyContent: false,
  }).withContext({ data: null });
  const validation = await builder.validate();
  console.log("validation", validation);
  const messages = await builder.build();
  console.log("here");
  console.log(JSON.stringify(messages, null, 2));
}
