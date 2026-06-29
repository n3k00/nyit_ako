import { stripBotMention } from "../src/services/text.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("stripBotMention removes bot username before prompt building", () => {
  assertEquals(
    stripBotMention("@nyit_ako_bot မင်္ဂလာပါ", "nyit_ako_bot"),
    "မင်္ဂလာပါ",
  );
});
