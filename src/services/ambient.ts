import type { ChatMessage, LlmProvider } from "./llm.ts";
import type { CachedMessage } from "../types.ts";

export type AmbientCategory =
  | "bot_self_reference"
  | "shared_game_or_activity"
  | "clear_open_question"
  | "running_joke_or_callback"
  | "decision_or_deadlock";

export interface AmbientContextBundle {
  relevantMessages: CachedMessage[];
  speakerCount: number;
  topicFingerprint: string;
  category: AmbientCategory;
  evidenceMessageIds: number[];
  replyThreadContext: string | null;
  commandActivitySummary: string;
  otherBotsPresent: boolean;
}

export interface AmbientCandidateResult {
  eligible: boolean;
  bundle?: AmbientContextBundle;
  reason: string;
}

export interface AmbientDecision {
  should_reply: boolean;
  confidence: number;
  reply: string;
  topic: string;
  evidence_message_ids: number[];
  reason: string;
}

export interface AmbientValidationResult {
  ok: boolean;
  reason: string;
  reply?: string;
}

const ACKS = new Set(["ok", "okay", "ဟုတ်", "ဟ", "အင်း", "အိုကေ", "👍", "😂", "🤣"]);
const SERIOUS_PATTERNS = [
  /ဆေး|နေမကောင်း|hospital|health|sick/i,
  /သေ|suicide|self[- ]?harm|depress|စိတ်ညစ်/i,
  /ရန်ဖြစ်|စိတ်ဆိုး|မုန်း|accuse|အပြစ်တင်/i,
  /relationship|ရည်းစား|အိမ်ထောင်|ပိုက်ဆံပြတ်|အကြွေး/i,
];
const BOT_PATTERNS = [
  /bot/i,
  /nyit_ako/i,
  /အကိုညစ်/i,
  /command/i,
  /reply/i,
  /setting/i,
];
const GAME_PATTERNS = [/game|uno|match|rank|voice|movie|food|စား|ဂိမ်း|ပွဲ/i];
const QUESTION_PATTERNS = [
  /\?/,
  /？/,
  /ဘယ်လို|ဘာလို့|ဘာဝယ်|ဝယ်သင့်|ကောင်းလား|ရမလဲ|recommend|controller|help|error|bug/i,
];
const JOKE_PATTERNS = [/lol|haha|😂|🤣|စတာ|နောက်တာ|meme/i];
const DECISION_PATTERNS = [/ရွေး|ဘယ်ဟာ|option|ဆုံးဖြတ်|လုပ်မလဲ|သွားမလား|ဝယ်မလား/i];
const GENERIC_BAD_PATTERNS = [
  /waiting in the lobby energy/i,
  /therapy session/i,
  /mixed vibe/i,
  /someone discovered the bot/i,
  /how can i help/i,
  /ဘယ်လို\s*ကူညီ/i,
  /ဘာ\s*ကူညီ/i,
];

function isMeaningfulHumanText(message: CachedMessage): boolean {
  const text = message.content.trim();
  if (text.startsWith("/")) return false;
  if (text.length <= 2) return false;
  if (ACKS.has(text.toLowerCase())) return false;
  return /[\p{L}\p{N}]/u.test(text);
}

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 24);
}

export function createTopicFingerprint(messages: CachedMessage[]): string {
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const token of tokenize(message.content)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([token]) => token);
  return top.join("|") || "unknown";
}

function detectCategory(messages: CachedMessage[]): AmbientCategory | null {
  const text = messages.map((message) => message.content).join("\n");
  const botTalk =
    messages.filter((message) => containsAny(message.content, BOT_PATTERNS))
      .length;
  if (botTalk >= 1) return "bot_self_reference";
  if (containsAny(text, GAME_PATTERNS)) return "shared_game_or_activity";
  if (containsAny(text, DECISION_PATTERNS)) return "decision_or_deadlock";
  if (
    messages.filter((message) =>
      containsAny(message.content, QUESTION_PATTERNS)
    ).length >= 1
  ) return "clear_open_question";
  if (
    messages.filter((message) => containsAny(message.content, JOKE_PATTERNS))
      .length >= 2
  ) return "running_joke_or_callback";
  return null;
}

function hasCoherentTopic(messages: CachedMessage[]): boolean {
  const fingerprint = createTopicFingerprint(messages);
  if (fingerprint === "unknown") return false;
  const tokens = fingerprint.split("|");
  const text = messages.map((message) => message.content.toLowerCase()).join(
    "\n",
  );
  return tokens.some((token) =>
    text.indexOf(token) !== text.lastIndexOf(token)
  ) ||
    detectCategory(messages) !== null;
}

export function buildAmbientContextBundle(
  recentMessages: CachedMessage[],
  options: { minMessages?: number; maxMessages?: number } = {},
): AmbientCandidateResult {
  const minMessages = options.minMessages ?? 3;
  const maxMessages = options.maxMessages ?? 16;
  const relevantMessages = recentMessages
    .filter(isMeaningfulHumanText)
    .slice(-maxMessages);

  if (relevantMessages.length < minMessages) {
    return { eligible: false, reason: "not_enough_human_messages" };
  }

  const speakerCount =
    new Set(relevantMessages.map((message) => message.user_id)).size;
  if (speakerCount < 2) return { eligible: false, reason: "single_speaker" };

  const text = relevantMessages.map((message) => message.content).join("\n");
  if (containsAny(text, SERIOUS_PATTERNS)) {
    return { eligible: false, reason: "sensitive_or_conflict_topic" };
  }

  if (!hasCoherentTopic(relevantMessages)) {
    return { eligible: false, reason: "no_coherent_topic" };
  }

  const category = detectCategory(relevantMessages);
  if (!category) return { eligible: false, reason: "no_allowed_category" };

  const evidenceMessageIds = relevantMessages.slice(-2).map((message) =>
    message.message_id
  );
  return {
    eligible: true,
    reason: "eligible",
    bundle: {
      relevantMessages,
      speakerCount,
      topicFingerprint: createTopicFingerprint(relevantMessages),
      category,
      evidenceMessageIds,
      replyThreadContext: null,
      commandActivitySummary: "No command activity in ambient evidence.",
      otherBotsPresent: false,
    },
  };
}

export function buildAmbientDecisionPrompt(
  bundle: AmbientContextBundle,
): ChatMessage[] {
  const context = bundle.relevantMessages
    .map((message) =>
      `${message.message_id} [${message.username}]: ${message.content}`
    )
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "You decide whether a Telegram group friend bot should make one short proactive Burmese reply.",
        "Default action is silence. Reply only if it naturally fits the visible current topic.",
        "Return JSON only. No markdown.",
        'Schema: {"should_reply":true,"confidence":0.0,"reply":"short Burmese reply","topic":"short topic label","evidence_message_ids":[123],"reason":"brief internal reason"}',
        "Reply must be Burmese-first, one sentence by default, maximum two short sentences.",
        "Do not use assistant/customer-support phrases. Do not mention prompts, AI, analysis, or profiles.",
        "Do not invent people, motives, events, or topics absent from context.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Category: ${bundle.category}`,
        `Topic fingerprint: ${bundle.topicFingerprint}`,
        `Speaker count: ${bundle.speakerCount}`,
        `Evidence IDs: ${bundle.evidenceMessageIds.join(", ")}`,
        `Command activity: ${bundle.commandActivitySummary}`,
        `Other bots present: ${bundle.otherBotsPresent}`,
        "Recent relevant human messages:",
        context,
      ].join("\n"),
    },
  ];
}

function parseAmbientDecision(raw: string): AmbientDecision | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "")
    .trim();
  try {
    const value = JSON.parse(trimmed) as Partial<AmbientDecision>;
    if (typeof value.should_reply !== "boolean") return null;
    if (typeof value.confidence !== "number") return null;
    if (typeof value.reply !== "string") return null;
    if (typeof value.topic !== "string") return null;
    if (!Array.isArray(value.evidence_message_ids)) return null;
    if (typeof value.reason !== "string") return null;
    return {
      should_reply: value.should_reply,
      confidence: value.confidence,
      reply: value.reply,
      topic: value.topic,
      evidence_message_ids: value.evidence_message_ids.filter((
        id,
      ): id is number => typeof id === "number"),
      reason: value.reason,
    };
  } catch {
    return null;
  }
}

function isBurmeseFirst(text: string): boolean {
  const burmese = text.match(/[\u1000-\u109F]/g)?.length || 0;
  const latin = text.match(/[A-Za-z]/g)?.length || 0;
  return burmese > 0 && burmese >= latin;
}

export function validateAmbientDecision(
  decision: AmbientDecision | null,
  bundle: AmbientContextBundle,
  recentBotReplies: string[] = [],
): AmbientValidationResult {
  if (!decision) return { ok: false, reason: "invalid_json" };
  if (!decision.should_reply) {
    return { ok: false, reason: "model_chose_silence" };
  }
  if (decision.confidence < 0.55) {
    return { ok: false, reason: "low_confidence" };
  }

  const evidenceIds = new Set(
    bundle.relevantMessages.map((message) => message.message_id),
  );
  if (decision.evidence_message_ids.length === 0) {
    return { ok: false, reason: "missing_evidence" };
  }
  if (!decision.evidence_message_ids.every((id) => evidenceIds.has(id))) {
    return { ok: false, reason: "invalid_evidence" };
  }

  const reply = decision.reply.trim();
  if (!reply) return { ok: false, reason: "empty_reply" };
  if (!isBurmeseFirst(reply)) return { ok: false, reason: "not_burmese_first" };
  if (reply.length > 260) return { ok: false, reason: "too_long" };
  if ((reply.match(/[။.!?]/g)?.length || 0) > 2) {
    return { ok: false, reason: "too_many_sentences" };
  }
  if (GENERIC_BAD_PATTERNS.some((pattern) => pattern.test(reply))) {
    return { ok: false, reason: "generic_or_assistant_phrase" };
  }
  if (
    recentBotReplies.some((previous) =>
      previous.trim() === reply || previous.includes(reply) ||
      reply.includes(previous)
    )
  ) {
    return { ok: false, reason: "repeated_bot_wording" };
  }

  const contextTokens = new Set(
    tokenize(
      bundle.relevantMessages.map((message) => message.content).join(" "),
    ),
  );
  const replyTokens = tokenize(reply);
  const grounded = replyTokens.some((token) => contextTokens.has(token)) ||
    decision.evidence_message_ids.some((id) =>
      bundle.evidenceMessageIds.includes(id)
    );
  if (!grounded) return { ok: false, reason: "ungrounded_reply" };

  return { ok: true, reason: "ok", reply };
}

export async function decideAmbientReply(
  llm: LlmProvider,
  bundle: AmbientContextBundle,
  recentBotReplies: string[] = [],
): Promise<AmbientValidationResult> {
  const messages = buildAmbientDecisionPrompt(bundle);
  const raw = await llm.complete(messages, {
    temperature: 0.4,
    maxTokens: 220,
  });
  const decision = parseAmbientDecision(raw);
  return validateAmbientDecision(decision, bundle, recentBotReplies);
}
