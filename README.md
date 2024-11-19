# @fatduckai/ai

A character management and prompt handling system for AI agents. Manages character personalities, chat histories, and dynamic response generation across multiple platforms.

## Features

- 🧠 Character personality management
- 💬 Multi-platform response handling (Twitter, Discord, Telegram, Slack)
- 📚 Chat history importing and analysis
- 🤖 LLM-powered message analysis (OpenAI, Anthropic, Mistral compatible)
- 🎯 Dynamic context generation
- 💾 Event and memory tracking
- ⚡ Importance analysis system

## Installation

```bash
npm install @fatduckai/ai
```

## Quick Start

```typescript
import { AI } from "@fatduckai/ai";
import { db } from "./your-db-setup";

// Initialize with OpenAI
const ai = new AI(db, {
  apiKey: process.env.OPENAI_API_KEY!,
  llm: {
    model: "gpt-4-turbo-preview",
    temperature: 0.7,
  },
  analyzer: {
    model: "gpt-3.5-turbo",
    temperature: 0.3,
  },
});

// Initialize with Anthropic
const anthropicAI = new AI(db, {
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: "https://api.anthropic.com/v1",
  llm: {
    model: "claude-3-opus-20240229",
    temperature: 0.7,
  },
  analyzer: {
    model: "claude-3-sonnet-20240229",
    temperature: 0.3,
  },
});

// Create a character (minimal)
const basicCharacter = await ai.createCharacter({
  name: "AI Assistant",
  bio: "A helpful AI assistant",
  personalityTraits: ["friendly", "helpful"],
});

// Create a character (with full configuration)
const fullCharacter = await ai.createCharacter({
  name: "AI Assistant",
  bio: "A helpful AI assistant",
  personalityTraits: ["friendly", "helpful"],
  styles: {
    chat: {
      rules: ["Be conversational"],
      examples: ["Hello!"],
    },
    professional: {
      rules: ["Be formal"],
      examples: ["Good morning."],
    },
  },
  preferences: {
    preferredTopics: ["technology"],
    dislikedTopics: [],
    generalLikes: ["helping"],
    generalDislikes: [],
  },
  hobbies: [
    {
      name: "coding",
      proficiency: 8,
    },
  ],
});
```

## Interaction System

```typescript
// Generate a response
const result = await ai.interact(
  characterId,
  YOUR_TEMPLATE,
  "tweet_reply",
  {
    replyTo: "Original message",
    tone: "casual",
  },
  {
    temperature: 0.8, // Optional LLM-specific options
  }
);

console.log(result.content); // The generated response
console.log(result.metadata); // Response metadata and context
```

### Response Types

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
  { content: "Memory 2", type: "achievement" },
]);
```

## System Architecture

The system uses a modular architecture with specialized managers:

## Character Creation

### From Chat History

```typescript
// Import chat messages
const messages: ChatMessage[] = [
  {
    senderId: "user123",
    senderName: "John Doe",
    content: "Hello world!",
    timestamp: new Date(),
    metadata: {
      reactions: [{ type: "like", count: 2, users: ["user1", "user2"] }],
    },
  },
  // ... more messages
];

// Create character from chat history
const character = await ai.createCharacterFromData({
  data: messages,
  type: "chat",
  options: {
    minConfidence: 0.6,
  },
});
```

### From Twitter History

```typescript
// Import tweets
const tweets: Tweet[] = [
  {
    id: "123456",
    text: "Just launched our new product!",
    created_at: "2024-03-18T12:00:00Z",
    retweet_count: 50,
    favorite_count: 100,
    reply_count: 25,
    user: {
      id: "user123",
      screen_name: "johndoe",
      name: "John Doe",
    },
    entities: {
      hashtags: [{ text: "launch" }],
      user_mentions: [],
    },
  },
  // ... more tweets
];

// Create character from tweets
const character = await ai.createCharacterFromData({
  data: tweets,
  type: "tweet",
  options: {
    minConfidence: 0.6,
  },
});
```

### Character Analysis

The system uses LLM-powered analysis to create rich character profiles from social data:

- Personality trait detection
- Communication style analysis
- Topic preference identification
- Platform-specific behavior patterns
- Temporal activity patterns
- Social interaction analysis

````

### Style Manager

Handles response formatting and platform-specific styles:

```typescript
// Update platform-specific styles
await ai.updatePlatformStyles(characterId, "twitter", {
  enabled: true,
  defaultTone: ["casual", "friendly"],
  defaultGuidelines: ["Use hashtags sparingly"],
  styles: {
    tweet_create: {
      enabled: true,
      tone: ["engaging"],
      formatting: {
        maxLength: 280,
        allowEmojis: true,
      },
      contextRules: ["Consider trends"],
      examples: ["Example tweet"],
      guidelines: ["Be concise"],
    },
  },
});
````

### Memory Manager

Handles memory storage and importance analysis:

```typescript
await ai.addMemory(characterId, content, {
  type: "learning",
  metadata: {
    topic: "ai",
    sentiment: 0.9,
  },
});
```

### LLM Manager

Handles interactions with language models:

```typescript
const response = await ai.interact(
  characterId,
  template,
  responseType,
  context,
  { temperature: 0.7 }
);
```

## Environment Variables

```env
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key
# Or for other providers
ANTHROPIC_API_KEY=your_anthropic_key
MISTRAL_API_KEY=your_mistral_key
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
  AIConfig,
  CreateCharacterInput,
  Preferences,
  Hobby,
} from "@fatduckai/ai";
```

## Error Handling

```typescript
try {
  await ai.interact(characterId, template, "tweet_reply", context);
} catch (error) {
  if (error instanceof AIValidationError) {
    // Handle validation errors
  } else if (error instanceof LLMError) {
    // Handle LLM-related errors
  }
}
```
