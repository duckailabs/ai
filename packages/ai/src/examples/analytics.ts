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

  const builder = new PromptBuilder(template).withContext({
    data: formattedData,
  });

  const messages = await builder.build();
  console.log(JSON.stringify(messages, null, 2));
}
