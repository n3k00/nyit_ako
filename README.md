# nyit_ako

A Telegram group bot that behaves like a casual, context-aware Burmese-speaking
friend. It only replies when explicitly invoked and keeps recent context
bounded.

## Features

- Replies only on mention, direct reply to the bot, or supported command.
- Uses recent bounded group context for natural Burmese replies.
- Can naturally join normal group chatter only when deterministic context checks
  and a grounded JSON LLM decision both pass.
- Selects a deterministic response mode before calling the LLM: `banter`,
  `helpful`, `referee`, `supportive`, or `default`.
- Supports optional private group/member guidance files without committing or
  exposing them.
- Uses an OpenAI-compatible LLM provider behind a mockable interface.
- Includes duplicate-update protection, user/group rate limiting, cooldowns,
  message length limits, and safe fallback replies.

## Setup

Install Deno, then create `.env`:

```bash
cp .env.example .env
```

Required values:

```env
BOT_TOKEN=your_telegram_bot_token_here
BOT_USERNAME=NekoBot
LLM_PROVIDER=openai_compatible
LLM_API_BASE=https://api.xiaomimimo.com/v1
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=mimo-v2.5-pro
```

For local mock testing without a cloud model, set:

```env
LLM_PROVIDER=mock
LLM_API_KEY=mock
```

## Run

Polling mode:

```bash
deno task serve
```

Development watch mode:

```bash
deno task dev
```

Startup diagnostics without contacting Telegram:

```powershell
$env:BOT_TOKEN="test"; $env:LLM_PROVIDER="mock"; $env:LLM_API_KEY="mock"; $env:BOT_STARTUP_CHECK_ONLY="true"; deno task serve
```

Shell equivalent:

```bash
BOT_TOKEN=test LLM_PROVIDER=mock LLM_API_KEY=mock BOT_STARTUP_CHECK_ONLY=true deno task serve
```

Webhook mode:

```env
WEBHOOK_URL=https://your-domain.example/webhook
WEBHOOK_PORT=8080
```

Then run:

```bash
deno task serve
```

Health check:

```bash
curl http://localhost:8080/health
```

## Commands

- `/help` - short usage summary.
- `/status` - safe runtime status.
- `/debug_llm` - admin-only safe LLM diagnostics.
- `/recap` - short chat recap.
- `/judge` - judge a replied-to message fairly.
- `/vibe` - current group mood.
- `/privacy` - retention and privacy behavior.
- `/forget` - clear the caller's stored interaction guidance.
- `/groupforget` - admin-only clear of group recent context and approved
  memories.
- `/botstyle` - show or update safe group settings.

Examples:

```text
/botstyle
/botstyle reply_length short
/botstyle humor_level 1
/botstyle roast_level 0
```

## Private Context Files

## Ambient Group Replies

Ambient replies are enabled by default and are meant to feel like a friend
naturally joining the conversation, not a bot answering every line. Silence is
the default. The bot first builds a relevant recent-message bundle and only
calls the LLM when there are at least three meaningful human messages, at least
two speakers, and a coherent allowed topic category. The model must return valid
grounded JSON before anything is sent.

Long helpful answers are sent in Telegram-sized chunks instead of being cut off
mid-response.

If the bot does not see normal group messages, disable Telegram privacy mode in
BotFather:

```text
/setprivacy -> choose bot -> Disable
```

Optional private files:

- `private_context/telegram_group_behavior_profile.json`
- `private_context/telegram_member_interaction_profiles.json`

Do not commit these files. The repository ignores `private_context/` by default.
The bot schema-filters these files and loads only the caller's guidance for a
request.

## Checks

```bash
deno fmt
deno lint
deno task check
deno task test
```

## Architecture

- `src/bot.ts` - runtime entry point for polling/webhook.
- `src/app.ts` - shared bot factory.
- `src/handlers/messages.ts` - mention/reply trigger routing.
- `src/handlers/commands.ts` - minimal command set.
- `src/services/prompt.ts` - prompt construction and response boundaries.
- `src/services/llm.ts` - provider-agnostic LLM layer.
- `src/services/cache.ts` - bounded short-lived context cache.
- `src/db/local.ts` - local JSON group settings, memories, and safe guidance.

More detail is in:

- `docs/architecture_audit.md`
- `docs/bot_behavior.md`
- `docs/privacy_model.md`
- `docs/implementation_notes.md`
