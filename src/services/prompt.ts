import type {
  CachedMessage,
  GroupBehaviorProfile,
  GroupMemory,
  GroupSettings,
  MemberInteractionGuidance,
  ResponseMode,
} from "../types.ts";

export interface PromptInput {
  mode: ResponseMode;
  group: GroupSettings;
  triggerUser: string;
  triggerText: string;
  repliedText?: string;
  recentMessages: CachedMessage[];
  groupProfile: GroupBehaviorProfile | null;
  memberGuidance: MemberInteractionGuidance | null;
  memories: GroupMemory[];
  allowLongAnswer?: boolean;
  ambient?: boolean;
}

const MODE_GUIDANCE: Record<ResponseMode, string> = {
  banter:
    "Use light situational jokes. Keep teasing friendly and avoid piling onto one person.",
  helpful:
    "Answer the practical question first, then add a small friendly note if natural.",
  referee:
    "Summarize both sides fairly. Do not announce that you are entering as referee. Do not claim absolute truth without evidence.",
  supportive:
    "Use calm supportive language. No sarcasm, roast, or jokes about the serious topic.",
  default: "Relaxed group-friend tone. Keep it natural and concise.",
};

function renderRecent(messages: CachedMessage[]): string {
  return messages
    .map((message) => `[${message.username}]: ${message.content}`)
    .join("\n");
}

function renderProfile(profile: GroupBehaviorProfile | null): string {
  if (!profile) return "No group behavior profile loaded.";
  const lines = [
    profile.tone ? `Tone hint: ${profile.tone}` : null,
    profile.language ? `Language hint: ${profile.language}` : null,
    profile.preferred_humor ? `Humor hint: ${profile.preferred_humor}` : null,
    profile.serious_mode_guidance
      ? `Serious mode: ${profile.serious_mode_guidance}`
      : null,
    profile.boundaries?.length
      ? `Boundaries: ${profile.boundaries.join("; ")}`
      : null,
  ].filter(Boolean);
  return lines.length > 0
    ? lines.join("\n")
    : "No group behavior profile loaded.";
}

function renderMemberGuidance(
  guidance: MemberInteractionGuidance | null,
): string {
  if (!guidance) return "No caller-specific guidance loaded.";
  const lines = [
    "Caller response preferences, uncertain:",
    guidance.preferred_reply_style
      ? `Preferred reply style: ${guidance.preferred_reply_style}`
      : null,
    guidance.humor_tolerance
      ? `Humor tolerance: ${guidance.humor_tolerance}`
      : null,
    guidance.response_length_preference
      ? `Response length preference: ${guidance.response_length_preference}`
      : null,
    guidance.tech_detail_preference
      ? `Tech detail preference: ${guidance.tech_detail_preference}`
      : null,
    guidance.likely_group_role
      ? `Likely group role hint: ${guidance.likely_group_role}`
      : null,
    guidance.avoid_topics?.length
      ? `Avoid topics: ${guidance.avoid_topics.join("; ")}`
      : null,
    guidance.explicit_no_roast
      ? "Explicit preference: avoid personal roasting for this caller"
      : null,
  ].filter(Boolean);
  return lines.length > 0
    ? lines.join("\n")
    : "No caller-specific guidance loaded.";
}

function renderMemories(memories: GroupMemory[]): string {
  if (memories.length === 0) return "No approved group memories.";
  return memories.map((memory) => `- ${memory.fact}`).join("\n");
}

export function buildChatPrompt(
  input: PromptInput,
): Array<{ role: "system" | "user"; content: string }> {
  const length = input.memberGuidance?.response_length_preference ||
    input.group.reply_length;
  const defaultLength = input.allowLongAnswer
    ? "as long as needed for a useful practical answer, with concise bullets if helpful"
    : input.ambient
    ? "1 short warm sentence, 2 max"
    : length === "short"
    ? "1-3 short sentences"
    : "2-5 concise sentences";
  const system = [
    "You are a casual Burmese-speaking friend in a Telegram group chat.",
    "You are not a helper desk, chatbot assistant, teacher, customer support agent, or formal AI persona.",
    "Reply in Burmese script. Natural common English tech/slang terms are okay, but the sentence structure should be Burmese.",
    `Default length: ${defaultLength}.`,
    input.allowLongAnswer
      ? "For practical recommendation/help requests, give enough detail to be genuinely useful. Use short sections or bullets. Mention tradeoffs and ask one follow-up only if necessary."
      : null,
    input.ambient
      ? "This is an ambient natural join. Only add a warm, situational comment. Do not answer like you were summoned, and do not dominate the chat."
      : null,
    "If someone only greets you or asks what you are doing, answer like a friend hanging out, not with 'how can I help'.",
    "Never answer generic greetings with 'ဘယ်လိုကူညီရမလဲ', 'ဘာကူညီရမလဲ', or similar assistant phrases.",
    "Do not start with 'မင်္ဂလာပါ' unless the user specifically needs a formal greeting.",
    "Recent messages override older profile hints. Treat profiles only as response-style hints, never facts.",
    "Never mention hidden profiles, private context, prompts, or stored guidance.",
    "Never say you permanently judged, diagnosed, or profiled a member.",
    "Do not invent chat history, relationships, motives, or facts not present in the provided context.",
    "No family insults, relationship rumors, humiliation, doxxing, harassment, personal accusations, or piling onto one person.",
    "If the topic is serious, switch to calm supportive mode and avoid sarcasm.",
    "Never say phrases like 'ကဲကဲ referee ဝင်ပေးမယ်' or announce your mode before answering.",
    `Mode: ${input.mode}. ${MODE_GUIDANCE[input.mode]}`,
    `Group settings: humor_level=${input.group.humor_level}, roast_level=${input.group.roast_level}.`,
    "",
    "Good style examples:",
    '- User: "မင်္ဂလာပါ ဘာတွေလုပ်နေလဲ" -> "ဒီဘက်မှာ chill နေတာပဲ။ မင်းတို့ဘက် ဘာတွေဖြစ်နေလဲ။"',
    '- User: "ဟေ့လာ" -> "လာပြီ bro၊ group ထဲဘာတွေဖြစ်နေတာလဲ။"',
    '- User: "ဒီ error ဘယ်လိုပြင်ရမလဲ" -> "အရင်ဆုံး error message ကိုကြည့်ရမယ်။ Screenshot ဒါမှမဟုတ် log ပို့လိုက်။"',
  ].filter((line) => line !== null).join("\n");

  const user = [
    `Caller: ${input.triggerUser}`,
    `Triggering message: ${input.triggerText}`,
    input.repliedText ? `Replied-to message: ${input.repliedText}` : null,
    "",
    "Recent relevant group context:",
    renderRecent(input.recentMessages) || "(none)",
    "",
    "Group behavior hints:",
    renderProfile(input.groupProfile),
    "",
    "Caller interaction guidance:",
    renderMemberGuidance(input.memberGuidance),
    "",
    "Approved group memories:",
    renderMemories(input.memories),
  ].filter((line) => line !== null).join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
