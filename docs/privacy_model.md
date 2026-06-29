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
- `tech_detail_preference`
- `avoid_topics`
- `response_length_preference`
- `likely_group_role`
- `confidence`
- `evidence_count`
- `last_observed_at`
- `updated_at`
- `expires_at`

The bot must never reveal that hidden guidance exists.

## Interaction Learning

Learning is deterministic observation aggregation, not model training. The bot
does not modify LLM weights and does not call the LLM just to learn.

Temporary observations can record only safe interaction signals: practical
questions, requests for detail, short-reply requests, light banter, activity
starts, practical solutions, and explicit no-roast or allow-roast requests.
Sensitive topics such as health, mental health, relationships, family, finances,
religion, politics, ethnicity, sexuality, insults, weaknesses, and permanent
character judgments must not create learned fields.

Profiles change gradually after repeated compatible evidence. Old observations
decay, observations and learned guidance expire, and recent chat always
overrides older learned hints. Explicit user preferences such as `/dontroast`
override inferred behavior immediately.

Short-term group state and learned group behavior profile are per-group,
expiring, and clearable by `/groupforget`.

## Deletion

- `/forget` clears the caller's stored guidance for that group.
- `/dontroast` stores an explicit no-roast boundary for the caller.
- `/allowroast` removes that explicit no-roast boundary.
- `/myprofile` shows only the caller's safe hints, not hidden evidence messages.
- `/learning` explains learning behavior and controls in Burmese.
- `/groupforget` clears group recent context, approved memories, short-term
  group state, group behavior profile, observations, and member guidance for
  that group. It is admin-only.

## Private Files

Real chat exports and member profiles must not be committed to this public
repository. The `private_context/` directory is ignored by Git. Private files
should never appear in commands, logs, tests, screenshots, documentation
examples, or user-facing bot responses.
