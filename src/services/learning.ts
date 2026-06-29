import {
  addInteractionObservation,
  getGroupBehaviorProfile,
  getInteractionObservations,
  saveGroupBehaviorProfile,
  saveMemberGuidance,
  saveShortTermGroupState,
} from "../db/local.ts";
import type {
  CachedMessage,
  GroupBehaviorProfile,
  InteractionObservation,
  InteractionSignalType,
  MemberInteractionGuidance,
  ShortTermGroupState,
} from "../types.ts";

const OBSERVATION_TTL_DAYS = 45;
const GUIDANCE_TTL_DAYS = 90;
const GROUP_STATE_TTL_HOURS = 6;
const GROUP_PROFILE_TTL_DAYS = 30;

const SENSITIVE_PATTERNS = [
  /ဆေး|နေမကောင်း|health|hospital|sick|စိတ်ညစ်|depress|suicide/i,
  /relationship|ရည်းစား|အိမ်ထောင်|family|မိသားစု|ပိုက်ဆံ|အကြွေး|ဘာသာ|politic/i,
];

function futureIso(amount: number, unit: "hour" | "day"): string {
  const ms = unit === "hour" ? amount * 3600_000 : amount * 24 * 3600_000;
  return new Date(Date.now() + ms).toISOString();
}

function hasSensitiveText(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function extractInteractionSignals(input: {
  chatId: number;
  userId: number;
  messageId: number;
  text: string;
}): InteractionObservation[] {
  const text = input.text.trim();
  if (!text || text.startsWith("/") || hasSensitiveText(text)) return [];

  const signals: Array<{ type: InteractionSignalType; weight: number }> = [];
  if (/မစနဲ့|မနောက်နဲ့|roast\s*မလုပ်|don't\s*roast|no\s*roast/i.test(text)) {
    signals.push({ type: "explicit_no_roast", weight: 1 });
  }
  if (/roast\s*ရတယ်|စလို့ရ|နောက်လို့ရ|allow\s*roast/i.test(text)) {
    signals.push({ type: "explicit_allow_roast", weight: 1 });
  }
  if (/ဘယ်လို|ဘာလို့|error|bug|setup|install|code|api|controller|ဝယ်သင့်/i.test(text)) {
    signals.push({ type: "prefers_practical_answer", weight: 0.2 });
  }
  if (
    /အသေးစိတ်|ရှင်းပြ|detail|ဘာကြောင့်|နားလည်အောင်/i.test(text) || text.length > 160
  ) {
    signals.push({ type: "prefers_detailed_answer", weight: 0.18 });
  }
  if (/တိုတို|short|အတိုချုံး/i.test(text)) {
    signals.push({ type: "prefers_short_reply", weight: 0.24 });
  }
  if (/😂|🤣|lol|haha|စတာ|နောက်တာ/i.test(text)) {
    signals.push({ type: "positive_banter", weight: 0.12 });
  }
  if (/game|uno|voice|match|movie|စားမလား|သွားမလား|စမလား/i.test(text)) {
    signals.push({ type: "starts_activity", weight: 0.16 });
  }
  if (/လုပ်လိုက်|စစ်ကြည့်|ပြင်|ဖြေရှင်း|solution|try/i.test(text)) {
    signals.push({ type: "practical_solution", weight: 0.14 });
  }

  const observedAt = new Date().toISOString();
  return signals.map((signal) => ({
    chat_id: input.chatId,
    user_id: input.userId,
    signal_type: signal.type,
    weight: signal.weight,
    evidence_message_id: input.messageId,
    observed_at: observedAt,
    expires_at: futureIso(OBSERVATION_TTL_DAYS, "day"),
  }));
}

function score(
  observations: InteractionObservation[],
  type: InteractionSignalType,
): number {
  const now = Date.now();
  return observations
    .filter((item) => item.signal_type === type)
    .reduce((total, item) => {
      const ageDays = Math.max(
        0,
        (now - Date.parse(item.observed_at)) / 86_400_000,
      );
      const decay = Math.max(0.25, 1 - ageDays / OBSERVATION_TTL_DAYS);
      return total + item.weight * decay;
    }, 0);
}

export function aggregateGuidance(
  chatId: number,
  userId: number,
  observations: InteractionObservation[],
  existing: MemberInteractionGuidance | null,
): MemberInteractionGuidance | null {
  const explicitNoRoast =
    observations.some((item) => item.signal_type === "explicit_no_roast") ||
    existing?.explicit_no_roast === true;
  const explicitAllowRoast = observations.some((item) =>
    item.signal_type === "explicit_allow_roast"
  );
  const evidenceCount = observations.length;

  if (evidenceCount < 3 && !explicitNoRoast && !explicitAllowRoast) {
    return existing;
  }

  const practical = score(observations, "prefers_practical_answer") +
    score(observations, "practical_solution");
  const detailed = score(observations, "prefers_detailed_answer");
  const short = score(observations, "prefers_short_reply");
  const banter = score(observations, "positive_banter");
  const activity = score(observations, "starts_activity");

  const guidance: MemberInteractionGuidance = {
    user_id: userId,
    chat_id: chatId,
    preferred_reply_style: existing?.preferred_reply_style || "medium",
    humor_tolerance: existing?.humor_tolerance || "low",
    tech_detail_preference: existing?.tech_detail_preference || "basic",
    likely_group_role: existing?.likely_group_role || "unknown",
    avoid_topics: [...(existing?.avoid_topics || [])],
    confidence: existing?.confidence || 0,
    evidence_count: evidenceCount,
    last_observed_at: observations.at(-1)?.observed_at ||
      new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: futureIso(GUIDANCE_TTL_DAYS, "day"),
    explicit_no_roast: explicitNoRoast && !explicitAllowRoast,
  };

  if (practical >= 0.45) {
    guidance.preferred_reply_style = "practical";
    guidance.tech_detail_preference = detailed >= 0.36
      ? "detailed"
      : "practical";
  }
  if (detailed >= 0.42) {
    guidance.response_length_preference = "detailed";
    guidance.preferred_reply_style = "detailed";
  } else if (short >= 0.36) {
    guidance.response_length_preference = "short";
    guidance.preferred_reply_style = "short";
  }
  if (banter >= 0.36 && !guidance.explicit_no_roast) {
    guidance.humor_tolerance = banter >= 0.72 ? "medium" : "light";
  }
  if (activity >= 0.32) guidance.likely_group_role = "activity_starter";
  else if (practical >= 0.42) guidance.likely_group_role = "tech_helper";

  const avoidTopics = guidance.avoid_topics ?? [];
  guidance.avoid_topics = avoidTopics;
  if (
    guidance.explicit_no_roast &&
    !avoidTopics.includes("personal jokes or roasting")
  ) {
    avoidTopics.push("personal jokes or roasting");
    guidance.humor_tolerance = "low";
  }
  if (explicitAllowRoast) {
    guidance.explicit_no_roast = false;
    guidance.avoid_topics = avoidTopics.filter((topic) =>
      topic !== "personal jokes or roasting"
    );
  }

  guidance.confidence = Math.min(
    0.95,
    Math.max(guidance.confidence || 0, evidenceCount / 10),
  );
  return guidance;
}

export async function observeAndLearnFromMessage(input: {
  chatId: number;
  userId: number;
  messageId: number;
  text: string;
  recentMessages: CachedMessage[];
  existingGuidance: MemberInteractionGuidance | null;
}): Promise<void> {
  const observations = extractInteractionSignals(input);
  for (const observation of observations) {
    await addInteractionObservation(observation);
  }
  const all = getInteractionObservations(input.chatId, input.userId);
  const guidance = aggregateGuidance(
    input.chatId,
    input.userId,
    all,
    input.existingGuidance,
  );
  if (guidance) await saveMemberGuidance(guidance);
  await updateShortTermGroupState(input.chatId, input.recentMessages);
}

export function buildShortTermGroupState(
  chatId: number,
  recentMessages: CachedMessage[],
): ShortTermGroupState {
  const human = recentMessages.filter((message) =>
    !message.content.startsWith("/")
  ).slice(-12);
  const text = human.map((message) => message.content).join(" ");
  const conversationTone = hasSensitiveText(text)
    ? "serious"
    : /ငြင်း|မှန်လား|မှားလား|ရန်ဖြစ်/i.test(text)
    ? "argumentative"
    : /error|bug|code|api|controller|ဘယ်လို/i.test(text)
    ? "practical"
    : /😂|🤣|lol|game|uno|စတာ/i.test(text)
    ? "playful"
    : "mixed";
  const topicLabel = /error|bug|code|api|controller/i.test(text)
    ? "technical help"
    : /game|uno|voice|match|movie/i.test(text)
    ? "group activity"
    : conversationTone === "serious"
    ? "serious topic"
    : conversationTone === "argumentative"
    ? "tense discussion"
    : "current chat";

  return {
    chat_id: chatId,
    current_topics: human.length
      ? [{
        label: topicLabel,
        confidence: 0.55,
        last_seen_at: new Date().toISOString(),
      }]
      : [],
    conversation_tone: conversationTone,
    recent_participants: [...new Set(human.map((message) => message.user_id))]
      .slice(-12),
    updated_at: new Date().toISOString(),
    expires_at: futureIso(GROUP_STATE_TTL_HOURS, "hour"),
  };
}

export async function updateShortTermGroupState(
  chatId: number,
  recentMessages: CachedMessage[],
): Promise<void> {
  const state = buildShortTermGroupState(chatId, recentMessages);
  await saveShortTermGroupState(state);
  const profile = aggregateGroupBehaviorProfile(
    chatId,
    state,
    getGroupBehaviorProfile(chatId),
  );
  if (profile) await saveGroupBehaviorProfile(profile);
}

export function aggregateGroupBehaviorProfile(
  chatId: number,
  state: ShortTermGroupState,
  existing: GroupBehaviorProfile | null,
): GroupBehaviorProfile | null {
  if (state.current_topics.length === 0) return existing;
  const nextEvidenceCount = (existing?.evidence_count || 0) + 1;
  const previousConfidence = existing?.confidence || 0;
  const confidence = Math.min(
    0.85,
    Math.max(previousConfidence * 0.92, nextEvidenceCount / 12),
  );
  const tone = nextEvidenceCount >= 3
    ? state.conversation_tone
    : existing?.tone || "mixed";
  const preferredHumor = tone === "playful"
    ? "light situational banter"
    : tone === "serious" || tone === "argumentative"
    ? "avoid jokes unless the recent chat clearly becomes playful"
    : existing?.preferred_humor;
  return {
    chat_id: chatId,
    tone,
    language: existing?.language || "Burmese-first casual group chat",
    boundaries: existing?.boundaries || [],
    preferred_humor: preferredHumor,
    serious_mode_guidance: tone === "serious" || tone === "argumentative"
      ? "Recent serious or tense chat overrides older playful hints."
      : existing?.serious_mode_guidance,
    confidence,
    evidence_count: nextEvidenceCount,
    updated_at: new Date().toISOString(),
    expires_at: futureIso(GROUP_PROFILE_TTL_DAYS, "day"),
  };
}

export function guidanceSummary(
  guidance: MemberInteractionGuidance | null,
): string {
  if (!guidance) return "သိမ်းထားတဲ့ safe reply-style hint မရှိသေးပါ။";
  const lines = [
    "သင့် safe reply-style hints:",
    `- Reply style: ${guidance.preferred_reply_style || "unknown"}`,
    `- Humor tolerance: ${guidance.humor_tolerance || "unknown"}`,
    `- Tech detail: ${guidance.tech_detail_preference || "unknown"}`,
    `- Group role hint: ${guidance.likely_group_role || "unknown"}`,
    guidance.avoid_topics?.length
      ? `- Avoid: ${guidance.avoid_topics.join(", ")}`
      : null,
    `- Confidence: ${Math.round((guidance.confidence || 0) * 100)}%`,
  ].filter(Boolean);
  return lines.join("\n");
}
