# AI Character System

A flexible system for creating and managing AI characters with platform-specific response styles and personality traits.

## Features

- Character creation and management
- Platform-specific response formatting (Twitter, Discord)
- Tool integration for real-time data
- Multiple interaction modes
- Personality and style injection
- Memory management
- Event tracking

## Installation

```bash
npm install
# or
bun install
```

Create a `.env` file with:

```env
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_api_key
```

## Quick Start

```typescript
import { ai } from "../core/ai";

const assistant = new ai({
  databaseUrl: process.env.DATABASE_URL!,
  llmConfig: {
    apiKey: process.env.OPENAI_API_KEY!,
    llm: { model: "gpt-4-turbo-preview", temperature: 0.7 },
    analyzer: { model: "gpt-3.5-turbo", temperature: 0.3 },
  },
});
```

## Example Usage

### Character Management

```typescript
// Find or create character
const characters = await assistant.db
  .select()
  .from(schema.characters)
  .where(eq(schema.characters.name, "Ducky"));

let character;
if (characters.length > 0) {
  character = characters[0];
} else {
  const duckyConfig = await createDuckyCharacter();
  character = await assistant.createCharacter(duckyConfig);
}
```

### Platform-Specific Responses

#### Twitter Interactions

```typescript
// Basic Tweet
const twitterResponse = await assistant.interact(
  {
    system: "Create a thread analyzing BTC market conditions",
    user: "Give me a spicy take on BTC price action",
  },
  {
    characterId: character.id,
    mode: "enhanced",
    responseType: "tweet_thread",
    tools: ["btc-price"],
  }
);

// Reply to Tweet
const replyResponse = await assistant.interact(
  {
    system: "Reply with signature sass",
    user: "Responding to: 'Just bought the dip! 🚀'",
  },
  {
    characterId: character.id,
    mode: "enhanced",
    responseType: "reply",
    platform: "twitter",
  }
);
```

#### Discord Interactions

```typescript
// Technical Analysis
const technicalAnalysis = await assistant.interact(
  {
    system: "Provide detailed technical analysis",
    user: "Deep dive on BTC market structure",
  },
  {
    characterId: character.id,
    mode: "enhanced",
    responseType: "technical_analysis",
    platform: "discord",
    tools: ["btc-price"],
  }
);

// Alpha Calls
const alphaCall = await assistant.interact(
  {
    system: "Share market alpha",
    user: "What's your latest BTC alpha?",
  },
  {
    characterId: character.id,
    mode: "enhanced",
    responseType: "alpha_calls",
    platform: "discord",
  }
);

// Meme Response
const memeResponse = await assistant.interact(
  {
    system: "Create meme-worthy market commentary",
    user: "Thoughts on leverage traders getting rekt?",
  },
  {
    characterId: character.id,
    responseType: "meme_response",
    platform: "discord",
  }
);
```

### Different Interaction Modes

```typescript
// Raw Mode
const rawResponse = await assistant.interact(
  {
    system: "You are a market analyst",
    user: "Current BTC state?",
  },
  {
    mode: "raw",
    tools: ["btc-price"],
  }
);

// Enhanced Mode
const enhancedResponse = await assistant.interact(
  {
    system: "Analyze market conditions",
    user: "Technical analysis please",
  },
  {
    characterId: character.id,
    mode: "enhanced",
    responseType: "technical_analysis",
  }
);

// Mixed Mode with Custom Injection
const mixedResponse = await assistant.interact(
  {
    system: "Analyze market sentiment",
    user: "Unfiltered market thoughts?",
  },
  {
    characterId: character.id,
    mode: "mixed",
    platform: "discord",
    responseType: "general_chat",
    injections: {
      injectPersonality: true,
      injectStyle: false,
      customInjections: [
        {
          name: "market_sentiment",
          content: "You're feeling bearish but hiding it",
          position: "before",
        },
      ],
    },
    tools: ["btc-price"],
  }
);
```

## Response Types

### Twitter

- `tweet_thread`: Multi-tweet analysis (max 280 chars each)
- `reply`: Single tweet responses

### Discord

- `general_chat`: Casual conversation (max 1000 chars)
- `technical_analysis`: Detailed market analysis
- `alpha_calls`: Trading insights and calls
- `meme_response`: Meme-worthy commentary

## Character Configuration

Characters can be configured with:

- Base traits and personality
- Platform-specific response styles
- Formatting rules
- Interaction guidelines

See `createDuckyCharacter()` for a complete example of character configuration.

## Tools Integration

Tools can be used to fetch real-time data:

```typescript
const response = await assistant.interact(input, {
  tools: ["btc-price"],
  toolContext: {
    /* optional context */
  },
});
```

## Development

```bash
# Run tests
bun test

# Run example
bun run example/index.ts
```

## License

MIT
