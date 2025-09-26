# DuckAI Labs agent: @askduckai

Code that runs the @askduckai agent on [X](https://x.com/askduckai).

## Requirements

- Bun v1.1+
- Postgres (reachable via `DATABASE_URL`)
- Running Twitter listener/executor service (pointed to by `TWITTER_EXECUTOR_URL`)

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment variables (`.env` or process env):

   ```env
   DATABASE_URL=postgres://user:pass@host:5432/db
   OPENPOND_BASE_URL=https://worker-host (default: http://localhost:3001)
   OPENPOND_API_KEY=your-worker-api-key
   OPENPOND_TEAM_ID=your-worker-team-id
   OPENPOND_MODEL=openai:gpt-5-mini
   OPENPOND_STREAM=true # optional, disable streaming with false
   DEFAULT_CHARACTER_ID=uuid-of-character
   TWITTER_AGENT_PORT=4000
   TWITTER_EXECUTOR_URL=http://localhost:4100
   TWITTER_BOT_SECRET=twitter-bot-secret
   TWITTER_SCHEDULE_MESSAGE=optional scheduled prompt
   TWITTER_SCHEDULE_CRON=optional cron (default 0 * * * *)
   TELEGRAM_BOT_TOKEN=optional telegram bot token
   TELEGRAM_CHARACTER_ID=optional override character id
   TELEGRAM_CONVERSATION_PREFIX=optional conversation prefix
   ```

   - `TWITTER_BOT_SECRET` is used both to authorize the listener’s calls into this service and the API’s calls back to the listener. Set the same value on the listener.

3. Run database migrations (if not already applied):

   ```bash
   bun run db:migrate
   ```

## Running

- Development (hot reload):

  ```bash
  bun run dev
  ```

- Single run:

  ```bash
  bun index.ts
  ```

The server listens on `http://localhost:${TWITTER_AGENT_PORT}` (default 4000) and exposes:

- `POST /twitter/mention` – accepts a `TwitterMentionPayload`, records it, calls the worker, and forwards publishing to the listener.

Optional features:

- Scheduler: if `TWITTER_SCHEDULE_MESSAGE` is set, a cron job will send the prompt through the worker according to `TWITTER_SCHEDULE_CRON`.
- Telegram relay: enabled when `TELEGRAM_BOT_TOKEN` is configured.

## Verifying

```bash
bun run typecheck
```

Send a sample mention (with the correct bearer token) to verify end-to-end:

```bash
curl -X POST http://localhost:4000/twitter/mention \
  -H "Authorization: Bearer $TWITTER_BOT_SECRET" \
  -H "Content-Type: application/json" \
  -d @payload.json
```
