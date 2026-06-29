import {
  aggregateGroupBehaviorProfile,
  aggregateGuidance,
  buildShortTermGroupState,
  extractInteractionSignals,
  guidanceSummary,
} from "../src/services/learning.ts";
import { buildChatPrompt } from "../src/services/prompt.ts";
import type { InteractionObservation } from "../src/types.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

function obs(
  signal_type: InteractionObservation["signal_type"],
  messageId: number,
  weight = 0.2,
  ageDays = 0,
): InteractionObservation {
  const observed = new Date(Date.now() - ageDays * 86_400_000).toISOString();
  return {
    chat_id: 1,
    user_id: 2,
    signal_type,
    weight,
    evidence_message_id: messageId,
    observed_at: observed,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  };
}

Deno.test("one short message does not create a personality preference", () => {
  const signals = extractInteractionSignals({
    chatId: 1,
    userId: 2,
    messageId: 1,
    text: "ok",
  });
  assertEquals(signals.length, 0);
  assertEquals(aggregateGuidance(1, 2, signals, null), null);
});

Deno.test("repeated technical questions gradually increase practical/detail preference", () => {
  const guidance = aggregateGuidance(1, 2, [
    obs("prefers_practical_answer", 1),
    obs("prefers_practical_answer", 2),
    obs("practical_solution", 3),
    obs("prefers_detailed_answer", 4, 0.2),
    obs("prefers_detailed_answer", 5, 0.2),
    obs("prefers_detailed_answer", 6, 0.2),
  ], null);
  assertEquals(guidance?.preferred_reply_style, "detailed");
  assertEquals(guidance?.tech_detail_preference, "detailed");
});

Deno.test("repeated positive banter increases humor tolerance only within safe bounds", () => {
  const guidance = aggregateGuidance(1, 2, [
    obs("positive_banter", 1),
    obs("positive_banter", 2),
    obs("positive_banter", 3),
    obs("positive_banter", 4),
  ], null);
  assert(
    guidance?.humor_tolerance === "light" ||
      guidance?.humor_tolerance === "medium",
    "humor remains bounded",
  );
});

Deno.test("explicit dontroast overrides inferred humor tolerance immediately", () => {
  const guidance = aggregateGuidance(1, 2, [
    obs("positive_banter", 1, 0.3),
    obs("explicit_no_roast", 2, 1),
  ], null);
  assertEquals(guidance?.explicit_no_roast, true);
  assertEquals(guidance?.humor_tolerance, "low");
  assert(
    guidance?.avoid_topics?.includes("personal jokes or roasting") === true,
    "avoid topic saved",
  );
});

Deno.test("myprofile summary reveals only safe profile fields", () => {
  const guidance = aggregateGuidance(1, 2, [
    obs("prefers_practical_answer", 1),
    obs("prefers_practical_answer", 2),
    obs("practical_solution", 3),
  ], null);
  const summary = guidanceSummary(guidance);
  assert(summary.includes("Reply style"), "safe field shown");
  assert(!summary.includes("evidence_message_id"), "internal evidence hidden");
  assert(!summary.includes("bad_person"), "unsafe labels absent");
});

Deno.test("myprofile summary is built only from requester guidance", () => {
  const requester = aggregateGuidance(1, 2, [
    obs("prefers_practical_answer", 1),
    obs("prefers_practical_answer", 2),
    obs("practical_solution", 3),
  ], null);
  const otherMember = aggregateGuidance(1, 3, [
    obs("positive_banter", 4),
    obs("positive_banter", 5),
    obs("positive_banter", 6),
  ], null);
  const summary = guidanceSummary(requester);
  assert(summary.includes("practical"), "requester guidance shown");
  assert(
    !summary.includes(otherMember?.humor_tolerance || "medium"),
    "other member guidance not included",
  );
});

Deno.test("sensitive topics never create learned profile fields", () => {
  const signals = extractInteractionSignals({
    chatId: 1,
    userId: 2,
    messageId: 1,
    text: "relationship ကိစ္စကြောင့် စိတ်ညစ်နေတယ်",
  });
  assertEquals(signals.length, 0);
});

Deno.test("recent chat is explicitly prioritized over older guidance in prompts", () => {
  const prompt = buildChatPrompt({
    mode: "helpful",
    group: {
      chat_id: 1,
      name: "g",
      reply_length: "short",
      humor_level: 1,
      roast_level: 1,
      memory_enabled: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    triggerUser: "u",
    triggerText: "အသေးစိတ်ရှင်းပြ",
    recentMessages: [{
      message_id: 1,
      user_id: 2,
      username: "u",
      content: "အခုတော့ အသေးစိတ်ရှင်းပြပါ",
      timestamp: Date.now(),
    }],
    groupProfile: null,
    memberGuidance: {
      user_id: 2,
      chat_id: 1,
      response_length_preference: "short",
    },
    memories: [],
  });
  assert(
    prompt[0].content.includes("Recent messages override older profile hints"),
    "recent override rule present",
  );
});

Deno.test("forget removes user guidance and group isolation is preserved", async () => {
  Deno.env.set("LOCAL_DB_PATH", "data/test-learning-db.json");
  const local = await import(`../src/db/local.ts?learning=${Date.now()}`);
  await local.initLocalDB();
  await local.saveMemberGuidance({
    user_id: 1,
    chat_id: 100,
    preferred_reply_style: "practical",
  });
  await local.saveMemberGuidance({
    user_id: 1,
    chat_id: 200,
    preferred_reply_style: "playful",
  });
  await local.clearMemberGuidance(100, 1);
  assertEquals(local.getMemberGuidance(100, 1), null);
  assertEquals(
    local.getMemberGuidance(200, 1)?.preferred_reply_style,
    "playful",
  );
  await Deno.remove("data/test-learning-db.json").catch(() => {});
});

Deno.test("groupforget clears short-term state, group profile, and member guidance", async () => {
  Deno.env.set("LOCAL_DB_PATH", "data/test-learning-groupforget-db.json");
  const local = await import(`../src/db/local.ts?groupforget=${Date.now()}`);
  await local.initLocalDB();
  await local.saveShortTermGroupState({
    chat_id: 900,
    current_topics: [{
      label: "game setup",
      confidence: 0.7,
      last_seen_at: new Date().toISOString(),
    }],
    conversation_tone: "playful",
    recent_participants: [1, 2],
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  await local.saveGroupBehaviorProfile({
    chat_id: 900,
    tone: "playful",
    confidence: 0.5,
    evidence_count: 3,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  await local.saveMemberGuidance({
    user_id: 1,
    chat_id: 900,
    preferred_reply_style: "playful",
  });
  await local.clearGroupData(900);
  assertEquals(local.getShortTermGroupState(900), null);
  assertEquals(local.getGroupBehaviorProfile(900), null);
  assertEquals(local.getMemberGuidance(900, 1), null);
  await Deno.remove("data/test-learning-groupforget-db.json").catch(() => {});
});

Deno.test("old observations expire from persistent learning storage", async () => {
  Deno.env.set("LOCAL_DB_PATH", "data/test-learning-expiry-db.json");
  const local = await import(`../src/db/local.ts?expiry=${Date.now()}`);
  await local.initLocalDB();
  await local.addInteractionObservation({
    chat_id: 300,
    user_id: 1,
    signal_type: "prefers_practical_answer",
    weight: 0.2,
    evidence_message_id: 1,
    observed_at: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    expires_at: new Date(Date.now() - 1_000).toISOString(),
  });
  await local.cleanupExpiredLearning();
  assertEquals(local.getInteractionObservations(300, 1).length, 0);
  await Deno.remove("data/test-learning-expiry-db.json").catch(() => {});
});

Deno.test("old learned guidance expires from persistent learning storage", async () => {
  Deno.env.set("LOCAL_DB_PATH", "data/test-learning-guidance-expiry-db.json");
  const local = await import(`../src/db/local.ts?guidanceExpiry=${Date.now()}`);
  await local.initLocalDB();
  await local.saveMemberGuidance({
    user_id: 1,
    chat_id: 400,
    preferred_reply_style: "practical",
    expires_at: new Date(Date.now() - 1_000).toISOString(),
  });
  await local.cleanupExpiredLearning();
  assertEquals(local.getMemberGuidance(400, 1), null);
  await Deno.remove("data/test-learning-guidance-expiry-db.json").catch(
    () => {},
  );
});

Deno.test("group behavior profile updates only after repeated group evidence", () => {
  const state = buildShortTermGroupState(700, [
    {
      message_id: 1,
      user_id: 1,
      username: "a",
      content: "uno game စမလား",
      timestamp: Date.now(),
    },
    {
      message_id: 2,
      user_id: 2,
      username: "b",
      content: "haha လာမယ်",
      timestamp: Date.now(),
    },
  ]);
  const first = aggregateGroupBehaviorProfile(700, state, null);
  assertEquals(first?.tone, "mixed");
  const second = aggregateGroupBehaviorProfile(700, state, first);
  const third = aggregateGroupBehaviorProfile(700, state, second);
  assertEquals(third?.tone, state.conversation_tone);
});
