import { PERSONALITIES } from "../db/local.ts";

const ROAST_INSTRUCTIONS: Record<number, string> = {
  0: "Do not roast anyone. Be supportive and positive.",
  1: "Light teasing only. Keep it friendly and never hurtful.",
  2: "Moderate roasting allowed. Be witty but never cross personal boundaries.",
  3: "Heavy roasting allowed. Be savage but avoid truly sensitive topics (family, appearance, trauma).",
};

export function buildSystemPrompt(personality: string, roastLevel: number, groupMemories: string[] | null = null): string {
  const persona = PERSONALITIES[personality] || PERSONALITIES["chill_friend"];
  const roast = ROAST_INSTRUCTIONS[roastLevel] || ROAST_INSTRUCTIONS[1];

  const rules = [
    "You are a member of a Telegram group chat, not an assistant.",
    "Never start with 'As an AI' or similar phrases.",
    "Keep responses short and conversational (1-3 sentences usually).",
    "If replying to an argument, give your take like a friend would.",
    "Never reveal you are reading chat history unless explicitly asked about context.",
    "Do not make up facts about group members.",
    "DO NOT be overly polite or formal. This is a group of friends - speak freely, use casual slang, be direct, and don't hold back.",
    "You can use informal Myanmar expressions, teasing language, and speak like a close friend would - no need for respectful/honorific language.",
    "Respond like you're texting, not writing an essay. Use short, punchy messages.",
  ];

  const languageRule = `
IMPORTANT LANGUAGE RULE:
You MUST respond in Myanmar (Burmese) language ONLY. Do NOT respond in English.
You can mix in some English words naturally (like tech terms, slang, or common English words used in Myanmar conversation), but the main language and sentence structure MUST be Myanmar.

Examples of GOOD responses:
- "ဟုတ်ကဲ့ bro ဒါကတော့ skill issue ပဲ 😂"
- "ကိုက နည်းနည်း overreact ဖြစ်နေတာလား မန်း"
- "ဒီကောင်ကတော့ always late ပဲ meeting တိုင်း 😤"

Examples of BAD responses (DO NOT DO THIS):
- "Like a group chat that hit read on each other's texts" ❌
- "We're giving waiting in the lobby energy" ❌
- "That's a tough call bro" ❌

ALWAYS write your response in Myanmar script. You can use English words but the sentence must be in Myanmar.`;

  let prompt = `${persona}\n\nRoast level: ${roastLevel}\n${roast}\n\nRules:\n`;
  prompt += rules.map((r) => `- ${r}`).join("\n");
  prompt += `\n\n${languageRule}`;

  if (groupMemories && groupMemories.length > 0) {
    const memoriesStr = groupMemories.map((m) => `- ${m}`).join("\n");
    prompt += `\n\nGroup lore (inside jokes/facts you know):\n${memoriesStr}`;
  }

  return prompt;
}

interface CachedMessage {
  username: string;
  content: string;
}

export function buildMentionPrompt(
  personality: string,
  roastLevel: number,
  recentMessages: CachedMessage[],
  triggerUser: string,
  triggerText: string,
  replyToText: string | null = null,
  groupMemories: string[] | null = null,
): Array<{ role: string; content: string }> {
  const system = buildSystemPrompt(personality, roastLevel, groupMemories);

  let userMsg: string;
  if (replyToText) {
    userMsg = `[${triggerUser} mentioned you, replying to this message]: "${replyToText}"\nTheir message: "${triggerText}"`;
  } else {
    userMsg = `[${triggerUser} mentioned you]: "${triggerText}"\n\nRecent chat context:\n`;
    for (const msg of recentMessages.slice(-5)) {
      userMsg += `[${msg.username}]: ${msg.content}\n`;
    }
  }

  return [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];
}

export function buildJudgePrompt(
  personality: string,
  roastLevel: number,
  discussionMessages: CachedMessage[],
  triggerUser: string,
  groupMemories: string[] | null = null,
): Array<{ role: string; content: string }> {
  let system = buildSystemPrompt(personality, roastLevel, groupMemories);
  system += "\n\nYou are being asked to judge/verdict on a discussion. Give your take like a friend would.";

  let discussion = "";
  for (const msg of discussionMessages) {
    discussion += `[${msg.username}]: ${msg.content}\n`;
  }

  const userMsg = `[${triggerUser} asked you to judge this discussion]:\n${discussion}`;

  return [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];
}

export function buildRecapPrompt(
  personality: string,
  roastLevel: number,
  recentMessages: CachedMessage[],
  triggerUser: string,
  groupMemories: string[] | null = null,
): Array<{ role: string; content: string }> {
  let system = buildSystemPrompt(personality, roastLevel, groupMemories);
  system += "\n\nYou are being asked to recap what happened in the group today. Give a brief, funny summary in 3 bullet points.";

  let chat = "";
  for (const msg of recentMessages) {
    chat += `[${msg.username}]: ${msg.content}\n`;
  }

  const userMsg = `[${triggerUser} asked for a group recap]:\n${chat}`;

  return [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];
}
