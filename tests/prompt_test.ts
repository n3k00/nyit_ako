import { buildChatPrompt } from "../src/services/prompt.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("prompt includes boundaries without exposing hidden profile language", () => {
  const messages = buildChatPrompt({
    mode: "supportive",
    group: {
      chat_id: 1,
      name: "test",
      reply_length: "short",
      humor_level: 1,
      roast_level: 1,
      memory_enabled: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    triggerUser: "caller",
    triggerText: "စိတ်ညစ်နေတာ",
    recentMessages: [],
    groupProfile: { boundaries: ["no family insults"] },
    memberGuidance: {
      user_id: 2,
      preferred_reply_style: "practical",
      avoid_topics: ["relationships"],
    },
    memories: [],
  });

  const full = messages.map((message) => message.content).join("\n");
  assert(
    full.includes("Never mention hidden profiles"),
    "prompt should include non-disclosure rule",
  );
  assert(
    full.includes("relationships"),
    "safe operational avoid_topics should be included",
  );
  assert(
    !full.includes("bad person"),
    "unsafe labels should not be introduced",
  );
});
