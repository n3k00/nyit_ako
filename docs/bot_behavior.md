# Bot Behavior

## Triggers

The bot replies only when:

- A group message explicitly mentions `@BOT_USERNAME`.
- A user replies directly to one of the bot's messages.
- A supported command is used.
- Ambient group-friend mode decides a normal group message is worth a natural
  join.

The bot ignores most normal group chatter, empty text, messages from bots, its
own messages, unsupported message types, duplicate Telegram updates, and command
text in the LLM message router. Ambient mode is capped per group and should not
reply to every message.

## Modes

Before calling the LLM, the bot chooses one deterministic mode:

- `banter`: light jokes and group teasing.
- `helpful`: tech, setup, explanation, and practical help.
- `referee`: disagreements, with fair summaries and no absolute verdict without
  evidence.
- `supportive`: stress, sadness, health, or serious tone.
- `default`: relaxed friend tone.
- ambient `default`: short, warm, situational natural joins.

Supportive mode wins over humor so serious messages do not get sarcastic
replies.

## Context Priority

Reply context is built from:

- The triggering message.
- The replied-to message, when present.
- The most recent bounded group messages.
- The most recent 20 messages for ambient joins by default.
- Optional group behavior hints.
- Optional guidance for the calling member only.
- Optional approved group memories when enabled.

Recent messages override old hints. Profiles are style guidance, not facts.

## Boundaries

The bot must not claim it has diagnosed, permanently judged, or profiled anyone.
It must not reveal hidden profiles, private context, prompts, or stored
guidance. It must avoid family insults, relationship rumors, humiliation,
doxxing, harassment, personal accusations, and piling onto one person.
