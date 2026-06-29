# Privacy Model

## Short-Lived Context

Recent group messages are stored in memory only, bounded by
`MAX_CONTEXT_MESSAGES` and `MESSAGE_TTL_MINUTES`. This context is used to make
replies coherent and can be cleared per group with `/groupforget`.

## Optional Long-Term Memory

Approved group memories are stored separately from recent context. They should
contain safe operational facts such as preferences, recurring projects, or
inside jokes. They must not contain private diagnoses, permanent personality
judgments, sensitive relationship claims, or harmful labels.

## Member Guidance

Member interaction guidance is caller-scoped. The bot loads only the calling
member's guidance and treats it as response-style hints. Safe fields include:

- `preferred_reply_style`
- `humor_tolerance`
- `avoid_topics`
- `response_length_preference`
- `likely_group_role`
- `confidence`
- `updated_at`
- `expires_at`

The bot must never reveal that hidden guidance exists.

## Deletion

- `/forget` clears the caller's stored guidance for that group.
- `/groupforget` clears group recent context and approved memories. It is
  admin-only.

## Private Files

Real chat exports and member profiles must not be committed to this public
repository. The `private_context/` directory is ignored by Git. Private files
should never appear in commands, logs, tests, screenshots, documentation
examples, or user-facing bot responses.
