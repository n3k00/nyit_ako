import {
  buildAmbientContextBundle,
  decideAmbientReply,
  validateAmbientDecision,
} from "../src/services/ambient.ts";
import type { ChatMessage, LlmProvider } from "../src/services/llm.ts";
import type { CachedMessage } from "../src/types.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

function msg(id: number, user: number, content: string): CachedMessage {
  return {
    message_id: id,
    user_id: user,
    username: `u${user}`,
    content,
    timestamp: Date.now() + id,
  };
}

class StaticProvider implements LlmProvider {
  calls: ChatMessage[][] = [];
  constructor(private readonly output: string) {}
  complete(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    return Promise.resolve(this.output);
  }
}

Deno.test("three users discussing a game can generate an ambient candidate", () => {
  const result = buildAmbientContextBundle([
    msg(1, 1, "UNO game စမလား"),
    msg(2, 2, "ငါ join မယ် voice ထဲလည်းဝင်မယ်"),
    msg(3, 3, "rules မေ့နေပြီ draw card ဘယ်လိုလဲ"),
  ]);

  assert(result.eligible, result.reason);
  assertEquals(result.bundle?.category, "shared_game_or_activity");
  assertEquals(result.bundle?.speakerCount, 3);
});

Deno.test("command spam does not create ambient candidate unless humans discuss the bot", () => {
  const spam = buildAmbientContextBundle([
    msg(1, 1, "/help"),
    msg(2, 2, "/vibe"),
    msg(3, 3, "/recap"),
  ]);
  assertEquals(spam.eligible, false);

  const botTalk = buildAmbientContextBundle([
    msg(10, 1, "ဒီ bot reply က polite ဖြစ်နေတယ်"),
    msg(11, 2, "setting ပြင်ရမယ်ထင်တယ်"),
    msg(12, 3, "nyit_ako bot က command ဘာတွေရှိလဲ"),
  ]);
  assert(botTalk.eligible, botTalk.reason);
  assertEquals(botTalk.bundle?.category, "bot_self_reference");
});

Deno.test("one person sending short messages does not create ambient candidate", () => {
  const result = buildAmbientContextBundle([
    msg(1, 1, "ok"),
    msg(2, 1, "ဟုတ်"),
    msg(3, 1, "အင်း"),
    msg(4, 1, "လာ"),
  ]);
  assertEquals(result.eligible, false);
});

Deno.test("serious conflict or sensitive topic stays silent", () => {
  const result = buildAmbientContextBundle([
    msg(1, 1, "သူငါ့ကို အပြစ်တင်နေတာ"),
    msg(2, 2, "ရန်ဖြစ်နေကြတာမကောင်းဘူး"),
    msg(3, 3, "ဒီ relationship ကိစ္စကို မစပါနဲ့"),
  ]);
  assertEquals(result.eligible, false);
  assertEquals(result.reason, "sensitive_or_conflict_topic");
});

Deno.test("invalid model JSON remains silent", async () => {
  const bundle = buildAmbientContextBundle([
    msg(1, 1, "controller ဘာဝယ်ရမလဲ"),
    msg(2, 2, "battery ကြာတာလိုချင်တယ်"),
    msg(3, 3, "vibration ကောင်းတာစစ်ကြည့်"),
  ]).bundle!;

  const result = await decideAmbientReply(
    new StaticProvider("not json"),
    bundle,
  );
  assertEquals(result.ok, false);
  assertEquals(result.reason, "invalid_json");
});

Deno.test("low-quality output, missing evidence, English-only, and unrelated replies are rejected", () => {
  const bundle = buildAmbientContextBundle([
    msg(1, 1, "controller ဘာဝယ်ရမလဲ"),
    msg(2, 2, "battery ကြာတာလိုချင်တယ်"),
    msg(3, 3, "vibration ကောင်းတာစစ်ကြည့်"),
  ]).bundle!;

  assertEquals(
    validateAmbientDecision({
      should_reply: true,
      confidence: 0.9,
      reply: "waiting in the lobby energy",
      topic: "controller",
      evidence_message_ids: [1],
      reason: "bad meme",
    }, bundle).ok,
    false,
  );
  assertEquals(
    validateAmbientDecision({
      should_reply: true,
      confidence: 0.9,
      reply: "Controller ဝယ်ရင် battery စစ်ကြည့်။",
      topic: "controller",
      evidence_message_ids: [999],
      reason: "bad evidence",
    }, bundle).reason,
    "invalid_evidence",
  );
  assertEquals(
    validateAmbientDecision({
      should_reply: true,
      confidence: 0.9,
      reply: "Buy the controller with better battery.",
      topic: "controller",
      evidence_message_ids: [1],
      reason: "english",
    }, bundle).reason,
    "not_burmese_first",
  );
});

Deno.test("valid grounded ambient JSON is accepted", async () => {
  const bundle = buildAmbientContextBundle([
    msg(1, 1, "controller ဘာဝယ်ရမလဲ"),
    msg(2, 2, "battery ကြာတာလိုချင်တယ်"),
    msg(3, 3, "vibration ကောင်းတာစစ်ကြည့်"),
  ]).bundle!;
  const provider = new StaticProvider(JSON.stringify({
    should_reply: true,
    confidence: 0.8,
    reply: "Controller ဝယ်မယ်ဆို battery နဲ့ vibration ကို အရင်စစ်တာအကောင်းဆုံးပဲ။",
    topic: "controller",
    evidence_message_ids: [1, 2],
    reason: "grounded",
  }));

  const result = await decideAmbientReply(provider, bundle);
  assertEquals(result.ok, true);
  assert(
    provider.calls[0][0].content.includes("Return JSON only"),
    "LLM contract should request JSON only",
  );
});
