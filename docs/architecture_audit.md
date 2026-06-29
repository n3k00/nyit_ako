# Architecture Audit

## Current Architecture Summary

The project is a Deno TypeScript Telegram group bot using grammY. The runtime
entry point is `src/bot.ts`; shared setup lives in `src/app.ts`. Local
development uses polling when `WEBHOOK_URL` is empty. Supabase Edge Function
deployment uses `supabase/functions/telegram-bot/index.ts` and the same bot
factory. The active data store is a local JSON file for group settings, approved
memories, and optional caller guidance, plus an in-memory bounded recent-message
cache for short-lived context.

The bot uses an OpenAI-compatible LLM provider abstraction in
`src/services/llm.ts`. Prompt construction is isolated in
`src/services/prompt.ts`. Trigger routing is centralized in
`src/handlers/messages.ts`, and commands are in `src/handlers/commands.ts`.

Private seed files are expected at:

- `private_context/telegram_group_behavior_profile.json`
- `private_context/telegram_member_interaction_profiles.json`

These files are ignored by Git and loaded only through schema-filtering helpers.

## Critical Findings

- `src/handlers/mention.ts` and `src/handlers/reply.ts`: separate text handlers
  could both reply to a message that mentioned the bot while replying to the
  bot. Replaced with a single router in `src/handlers/messages.ts`.
- `src/handlers/middleware.ts`: no Telegram update deduplication existed, so
  retry delivery could produce duplicate replies. Added `UpdateDeduplicator` and
  middleware.
- `.gitignore`: private profile seed files were not ignored. Added
  `private_context/` and stricter env ignores.

## High Findings

- `src/config.ts`: missing required env validation meant the bot could start
  with empty secrets and fail later. Replaced with `loadConfig()` fail-fast
  validation.
- `src/services/llm.ts`: LLM code was hardwired to MiMo naming and lacked
  timeout/retry/fallback separation. Replaced with a provider interface,
  OpenAI-compatible provider, mock provider, timeout, retry, and safe fallback.
- `src/services/prompt.ts`: prompts did not clearly enforce privacy boundaries
  or response modes. Replaced with a bounded prompt builder that treats profiles
  as hints and forbids revealing hidden guidance.
- `src/db/supabase.ts`: duplicated the local DB layer but was not used by active
  handlers. Deleted to reduce false architecture signals.

## Medium Findings

- `deno.json`: dev tasks lacked `--allow-write` even though local state writes
  to `data/local_db.json`. Added write permission and check/test/lint/fmt tasks.
- `src/services/cache.ts`: context cache was in-memory but not explicitly
  configurable as short-lived bounded context. Replaced with configurable TTL
  and max-message bounds.
- `src/db/local.ts`: old store mixed personality concepts with memory without
  privacy-oriented guidance boundaries. Replaced with group settings, approved
  memories, and safe member guidance schema.
- `src/handlers/commands.ts`: old command set exposed playful features before
  privacy controls. Replaced with `/help`, `/privacy`, `/forget`,
  `/groupforget`, and `/botstyle`.

## Low Findings

- `README.md`: architecture and env names were stale. Updated to reflect the
  current runtime.
- `run.sh`: invoked raw `deno run` with duplicated flags. Updated to call
  `deno task serve`.
- `supabase/migrations/001_initial.sql`: retained as historical/future optional
  schema, but current v1 runtime does not depend on Supabase tables.

## Retain, Refactor, Replace, Delete

- Retained: Deno, grammY, polling/webhook deployment, Telegram command model,
  local lightweight storage for v1.
- Refactored: config, middleware, prompt building, LLM integration, cache, local
  store, commands.
- Replaced: duplicate mention/reply handlers with a single trigger router.
- Deleted: unused `src/db/supabase.ts`, stale split response handlers.

## Recommended Next Changes

- Add a durable production store before using multiple bot instances; local JSON
  and in-memory dedupe are suitable for single-instance v1 only.
- Add integration tests around Telegram update payloads with a mocked grammY
  context.
- Decide whether Supabase is a real v1 dependency. If yes, reintroduce it behind
  the same store interface rather than duplicating logic.
