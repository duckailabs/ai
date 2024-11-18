export const CHARACTER_SCHEMA_PROMPT = `
You will analyze data to create a character profile.
Output must be valid JSON matching this exact structure (all fields required):

{
  "name": string,
  "bio": string,
  "personalityTraits": string[],
  "responseStyles": {
    "default": {
      "tone": string[],
      "personality": string[],
      "guidelines": string[]
    },
    "platforms": Record<string, {
      "enabled": boolean,
      "defaultTone": string[],
      "defaultGuidelines": string[],
      "styles": Record<string, {
        "enabled": boolean,
        "tone": string[],
        "formatting": {
          "maxLength"?: number,
          "allowEmojis"?: boolean,
          "allowMarkdown"?: boolean,
          "allowMentions"?: boolean,
          "customRules"?: string[]
        },
        "contextRules": string[],
        "examples": string[],
        "guidelines": string[]
      }>
    }>
  },
  "styles": Record<string, {
    "rules": string[],
    "examples": string[]
  }>,
  "shouldRespond": {
    "rules": string[],
    "examples": string[]
  },
  "hobbies": Array<{
    "name": string,
    "proficiency"?: number,
    "lastPracticed"?: string,
    "relatedTopics"?: string[]
  }>,
  "beliefSystem": string[],
  "preferences": {
    "preferredTopics": string[],
    "dislikedTopics": string[],
    "preferredTimes": string[],
    "dislikedTimes": string[],
    "preferredDays": string[],
    "dislikedDays": string[],
    "preferredHours": string[],
    "dislikedHours": string[],
    "generalLikes": string[],
    "generalDislikes": string[]
  }
}

Each field must be populated based on observable data, not assumptions.
Include confidence scores (0-1) for each major field in metadata
`;

// prompts/character/chat.ts
export const CHAT_TO_CHARACTER_PROMPT = `
<system>
Analyze these chat messages to create a complete character profile.
Messages will show consistent patterns in:
1. Communication style and tone
2. Response patterns and timing
3. Topic preferences and expertise
4. Expression and emotion
5. Social interaction patterns
6. Platform-specific behaviors

Chat History:
<chatHistory>

${CHARACTER_SCHEMA_PROMPT}
</system>`;

// prompts/character/tweet.ts
export const TWEET_TO_CHARACTER_PROMPT = `Analyze these tweets to create a complete character profile.
Focus on identifying:
1. Writing style and voice
2. Platform behaviors (hashtags, mentions, threads)
3. Engagement patterns
4. Content preferences
5. Temporal patterns
6. Social dynamics

Tweet History:
<tweetHistory>

${CHARACTER_SCHEMA_PROMPT}`;

export const MERGE_PROFILES_PROMPT = `Merge these character profiles into a single consistent profile.
Merging rules:
1. Prefer higher confidence data points
2. Maintain consistency across all fields
3. Combine unique traits/preferences
4. Preserve platform-specific behaviors
5. Weight recent data more heavily
6. Keep all required fields populated

Input Profiles:
<profiles>

${CHARACTER_SCHEMA_PROMPT}`;
