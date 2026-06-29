import {
  addMessage,
  clearMessages,
  configureCache,
  getRecentMessages,
} from "../src/services/cache.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("context cache is bounded and ignores duplicate message ids", () => {
  configureCache({ ttlMs: 60_000, maxMessages: 3 });
  clearMessages(1);
  addMessage(1, { message_id: 1, user_id: 1, username: "a", content: "one" });
  addMessage(1, {
    message_id: 1,
    user_id: 1,
    username: "a",
    content: "one duplicate",
  });
  addMessage(1, { message_id: 2, user_id: 2, username: "b", content: "two" });
  addMessage(1, { message_id: 3, user_id: 3, username: "c", content: "three" });
  addMessage(1, { message_id: 4, user_id: 4, username: "d", content: "four" });

  const recent = getRecentMessages(1, 10);
  assertEquals(recent.length, 3);
  assertEquals(recent[0].content, "two");
  assertEquals(recent[2].content, "four");
});
