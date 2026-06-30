import {
  resolveTriggerKind,
  shouldHandleTextMessage,
} from "../src/handlers/messages.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("trigger gate accepts explicit mentions", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "hey @NekoBot help",
      botUsername: "NekoBot",
      fromBot: false,
    }),
    true,
  );
});

Deno.test("trigger gate accepts direct replies to the bot", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "ပြန်ရှင်းပြပါ",
      botUsername: "NekoBot",
      fromBot: false,
      replyFromBotUsername: "NekoBot",
    }),
    true,
  );
});

Deno.test("trigger gate accepts direct replies by bot id when username is absent", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "ဒါကိုပြန်ရှင်းပြ",
      botUsername: "NekoBot",
      botId: 42,
      fromBot: false,
      replyFromBotId: 42,
    }),
    true,
  );
  assertEquals(
    resolveTriggerKind({
      text: "ဒါကိုပြန်ရှင်းပြ",
      botUsername: "NekoBot",
      botId: 42,
      replyFromBotId: 42,
      ambientEligible: false,
    }),
    "reply_to_bot",
  );
});

Deno.test("trigger gate accepts ambient eligible messages", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "controller ဘာဝယ်သင့်လဲ",
      botUsername: "NekoBot",
      fromBot: false,
      ambientEligible: true,
    }),
    true,
  );
  assertEquals(
    resolveTriggerKind({
      text: "controller ဘာဝယ်သင့်လဲ",
      botUsername: "NekoBot",
      ambientEligible: true,
    }),
    "ambient",
  );
});

Deno.test("trigger gate ignores normal chatter, commands, and bots", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "normal chat",
      botUsername: "NekoBot",
      fromBot: false,
    }),
    false,
  );
  assertEquals(
    shouldHandleTextMessage({
      text: "/help",
      botUsername: "NekoBot",
      fromBot: false,
    }),
    false,
  );
  assertEquals(
    shouldHandleTextMessage({
      text: "@NekoBot hi",
      botUsername: "NekoBot",
      fromBot: true,
    }),
    false,
  );
});
