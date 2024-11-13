import { Linter, Parser } from "./src/index";

async function main() {
  const template = `{{#system}}
You are a helpful AI assistant.
{{/system}}

{{#user}}
Help me with {{task}}
{{/user}}`;

  // Test parsing
  const parsed = Parser.parse(template);
  console.log("Parsed Template:", parsed);

  // Test linting
  const linter = new Linter();
  const suggestions = await linter.lint(parsed);
  console.log("Lint Results:", suggestions);
}

main().catch(console.error);
