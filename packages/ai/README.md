# @fatduckai/ai

A lightweight and efficient prompt builder for LLM chat completions.

## Features

- 🚀 Simple, declarative chat prompt templates
- 🔍 Variable substitution with validation
- ✅ Built-in lint checks
- 📝 TypeScript support

## Installation

```bash
npm install @fatduckai/ai
# or
yarn add @fatduckai/ai
# or
bun add @fatduckai/ai
```

## Quick Start

```typescript
import { PromptBuilder } from "@fatduckai/ai";
import OpenAI from "openai";

async function main() {
  const template = `
    <system>You are a helpful AI assistant.</system>
    <user>My name is <name> and I need help with <task></user>
  `;

  const builder = new PromptBuilder(template).withContext({
    name: "Alice",
    task: "writing code",
  });

  const messages = await builder.build();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
  });

  console.log(completion.choices[0].message);
}
```

## Template Format

Templates use a simple XML-like syntax supporting system, user, and assistant messages:

```typescript
const template = `
  <system>System message here</system>
  <user>User message with <variable></user>
  <assistant>Assistant response here</assistant>
`;
```

## Configuration

```typescript
const builder = new PromptBuilder(template, {
  validateOnBuild: true, // Validate before building (default: true)
  throwOnWarnings: false, // Throw error on warnings (default: false)
  allowEmptyContent: false, // Allow empty messages (default: false)
});
```

## Examples

The repository includes several examples demonstrating different use cases:

### Basic Chat

```bash
bun examples/basic-chat.ts
```

Shows simple variable substitution and message building.

### Multi-turn Conversations

```bash
bun examples/multi-turn.ts
```

Demonstrates how to create conversations with multiple turns.

### Database Integration

```bash
bun examples/analytics.ts
```

Shows how to use the builder with database content.

### OpenAI Integration

```bash
bun examples/openai-integration.ts
```

Complete example of using the builder with OpenAI's API.

Check the [examples](./examples) directory for the full source code and more examples.

## Error Handling

The builder validates:

- Template structure
- Undefined variables
- Empty content (when not allowed)
- Invalid context values

```typescript
// Get validation results
const validation = await builder.validate();
if (!validation.isValid) {
  console.error("Validation errors:", validation.errors);
  console.warn("Warnings:", validation.warnings);
}
```

## License

MIT

## Author

FatDuckAI

## Support

- Issues: [GitHub Issues](https://github.com/fatduckai/ai/issues)
