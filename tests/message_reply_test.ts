import { generateModelReply } from "../src/services/message_reply.ts";
import type { ChatMessage, LlmProvider } from "../src/services/llm.ts";
import type { GroupSettings } from "../src/types.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

const group: GroupSettings = {
  chat_id: 1,
  name: "test",
  reply_length: "short",
  humor_level: 1,
  roast_level: 1,
  memory_enabled: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

class CapturingProvider implements LlmProvider {
  calls: ChatMessage[][] = [];
  constructor(private readonly response: string) {}
  complete(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    return Promise.resolve(this.response);
  }
}

Deno.test("different mention text produces different LLM request content", async () => {
  const llm = new CapturingProvider("model reply");
  await generateModelReply({
    llm,
    mode: "default",
    group,
    triggerUser: "user",
    triggerText: "မင်းကို မေးမယ်နော်",
    recentMessages: [],
    groupProfile: null,
    memberGuidance: null,
    memories: [],
  });
  await generateModelReply({
    llm,
    mode: "default",
    group,
    triggerUser: "user",
    triggerText: "ဘာလုပ်လို့ရလဲ",
    recentMessages: [],
    groupProfile: null,
    memberGuidance: null,
    memories: [],
  });

  assert(
    llm.calls[0][1].content !== llm.calls[1][1].content,
    "prompt user content should differ",
  );
  assert(
    llm.calls[0][1].content.includes("မင်းကို မေးမယ်နော်"),
    "first prompt should include first text",
  );
  assert(
    llm.calls[1][1].content.includes("ဘာလုပ်လို့ရလဲ"),
    "second prompt should include second text",
  );
});

Deno.test("successful provider result is returned unchanged", async () => {
  const llm = new CapturingProvider("ဒါက model ကပြန်တဲ့ actual answer ပါ။");
  const result = await generateModelReply({
    llm,
    mode: "default",
    group,
    triggerUser: "user",
    triggerText: "မေးမယ်",
    recentMessages: [],
    groupProfile: null,
    memberGuidance: null,
    memories: [],
  });
  assertEquals(result.response, "ဒါက model ကပြန်တဲ့ actual answer ပါ။");
});
