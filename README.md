# @fatduckai/ai

A character management and prompt handling system for AI agents. Manages character personalities, chat histories, and dynamic response generation across multiple platforms.

## Features

- 🧠 Character personality management
- 💬 Multi-platform response handling (Twitter, Discord, Telegram, Slack)
- 📚 Chat history importing and analysis
- 🤖 OpenAI-powered message analysis
- 🎯 Dynamic context generation
- 💾 Event and memory tracking
- ⚡ Importance analysis system

## Installation

```bash
npm install @fatduckai/ai
```

## Quick Start

```typescript
import { ai } from "@fatduckai/ai";
import { db } from "./your-db-setup";

// Initialize
const ai = new ai(db);

// Create a character
const character = await ai.createCharacter({
  name: "AI Assistant",
  bio: "Helpful AI assistant with expertise in tech",
  personalityTraits: ["friendly", "knowledgeable"],
  responseStyles: defaultResponseStyles, // Import from @fatduckai/ai
  preferences: {
    preferredTopics: ["technology"],
    dislikedTopics: [],
    preferredTimes: [],
    dislikedTimes: [],
    preferredDays: [],
    dislikedDays: [],
    preferredHours: [],
    dislikedHours: [],
    generalLikes: ["helping"],
    generalDislikes: [],
  },
});
```

## Response System

### Preparing Prompts

```typescript
// Generate a response
const prepared = await ai.preparePrompt(
  characterId,
  YOUR_TEMPLATE,
  "tweet_reply", // Response type
  {
    replyTo: "Original message",
    tone: "casual",
  }
);

// Use with your LLM
const response = await llm.chat.completions.create({
  messages: prepared.messages,
  model: "gpt-4-turbo-preview",
});

// Record the interaction
await ai.recordInteraction(
  characterId,
  prepared,
  response.choices[0].message.content,
  "tweet_reply"
);
```

### Response Types

The system supports various response types across platforms:

#### Twitter

- `tweet_create` - Original tweets
- `tweet_reply` - Tweet replies
- `tweet_thread` - Thread creation

#### Discord

- `discord_chat` - General chat
- `discord_mod` - Moderation responses
- `discord_help` - Help/support responses
- `discord_welcome` - Welcome messages

#### Telegram

- `telegram_chat` - Direct messages
- `telegram_group` - Group messages
- `telegram_broadcast` - Channel posts

#### Slack

- `slack_chat` - General messages
- `slack_thread` - Thread replies
- `slack_channel` - Channel messages
- `slack_dm` - Direct messages

## Memory System

### Adding Memories

```typescript
// Add single memory
await ai.addMemory(characterId, "Learned about quantum computing", {
  type: "learning",
  metadata: {
    topic: "quantum_computing",
    sentiment: 0.8,
  },
});

// Batch add memories
await ai.addMemoryBatch(characterId, [
  { content: "Memory 1", type: "interaction" },
  {
    content: "Memory 2",
    importance: 0.8,
    type: "achievement",
  },
]);
```

### Importance Analysis

The system includes a flexible importance analysis system:

#### Default OpenAI Analyzer

```typescript
import { ai, OpenAIImportanceAnalyzer } from "@fatduckai/ai";

// Configure analyzer
const analyzer = new OpenAIImportanceAnalyzer(process.env.OPENAI_API_KEY, {
  model: "gpt-4-turbo-preview",
  temperature: 0.3,
});

const ai = new ai(db, analyzer);
```

#### Custom Analyzer

```typescript
import { IImportanceAnalyzer } from "@fatduckai/ai";

class CustomAnalyzer implements IImportanceAnalyzer {
  async analyzeImportance(
    content: string,
    context?: Record<string, any>
  ): Promise<number> {
    // Your custom logic here
    return 0.5;
  }
}

const ai = new ai(db, new CustomAnalyzer());
```

## Chat History Import

```typescript
import { ChatImporter } from "@fatduckai/ai";

const importer = new ChatImporter(db, process.env.OPENAI_API_KEY);

await importer.importGoogleChat(chatLogs, {
  batchSize: 100,
  processMemories: true,
});
```

## Database Schema

The system uses the following tables:

### Characters

- Core personality data
- Response styles
- Preferences
- Traits

### Events

- Interaction history
- Message logs
- System events

### Memories

- Important information
- Learning experiences
- Key interactions

### Social Relations

- User relationships
- Interaction history
- Preferences

### Goals

- Character objectives
- Progress tracking
- Completion criteria

## Environment Variables

```env
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key  # If using default analyzer
```

## TypeScript Types

```typescript
import type {
  Character,
  Event,
  Memory,
  SocialRelation,
  ResponseStyles,
  StyleSettings,
} from "@fatduckai/ai";
```

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  await ai.addMemory(characterId, content);
} catch (error) {
  if (error instanceof AIValidationError) {
    // Handle validation errors
  } else if (error instanceof AnalyzerError) {
    // Handle analyzer errors
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT

## Authors

- Fat Duck AI
- [GitHub](https://github.com/fatduckai)

## Acknowledgments

- OpenAI for GPT models
- DrizzleORM for database management

## Related Projects

- [@fatduckai/prompts](https://github.com/fatduckai/prompts) - Prompt management system
- [@fatduckai/memory](https://github.com/fatduckai/memory) - Advanced memory systems

## Support

For support, email support@fatduckai.com or join our [Discord](https://discord.gg/fatduckai)

## API Documentation

For detailed API documentation, visit [docs/api.md](./docs/api.md)
