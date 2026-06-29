# Implementation Notes

## Runtime

Use Deno. Local polling mode:

```bash
cp .env.example .env
deno task serve
```

Set `WEBHOOK_URL` for webhook mode. `GET /health` returns a small health
response.

## Checks

Run before shipping:

```bash
deno fmt
deno lint
deno check src/bot.ts supabase/functions/telegram-bot/index.ts
deno test --allow-read --allow-write --allow-env
```

## LLM Provider

`src/services/llm.ts` defines a mockable provider interface. The default
provider calls an OpenAI-compatible `/chat/completions` API with timeout and
retry. Tests should use deterministic units or `MockLlmProvider`.

## Data Boundaries

`src/services/cache.ts` stores short-lived recent context in memory.
`src/db/local.ts` stores safe group settings, approved memories, and optional
caller guidance in `data/local_db.json`.

Ambient group replies are controlled by:

- `AMBIENT_REPLIES_ENABLED`
- `AMBIENT_MAX_PER_MINUTE`
- `AMBIENT_COOLDOWN_SECONDS`
- `AMBIENT_CONTEXT_MESSAGES`
- `AMBIENT_MIN_MESSAGE_LENGTH`

Telegram group privacy mode must be disabled through BotFather if ambient mode
needs to see normal group messages.

Long replies are split into Telegram-sized chunks by `safeReply()` instead of
being truncated in the sanitizer.

## Deployment Note

The Supabase Edge Function wrapper uses the same bot factory, but local JSON
state is not appropriate for multi-instance production memory. Use a real store
behind the same functions before scaling beyond a single instance.
