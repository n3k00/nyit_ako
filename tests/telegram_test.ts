import { safeReply, splitTelegramMessage } from "../src/services/telegram.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("safeReply falls back to plain reply when reply target disappeared", async () => {
  const calls: Array<{ text: string; replyTo?: number }> = [];
  await safeReply(
    {
      reply(text, other) {
        calls.push({ text, replyTo: other?.reply_to_message_id });
        if (other?.reply_to_message_id) {
          return Promise.reject(
            new Error("Call failed: message to be replied not found"),
          );
        }
        return Promise.resolve();
      },
    },
    "hello",
    10,
  );

  assertEquals(calls.length, 2);
  assertEquals(calls[0].replyTo, 10);
  assertEquals(calls[1].replyTo, undefined);
});

Deno.test("splitTelegramMessage chunks long replies without dropping text", () => {
  const text = `${"စာပိုဒ် ".repeat(900)}ပြီးဆုံး`;
  const chunks = splitTelegramMessage(text, 1000);
  assertEquals(chunks.length > 1, true);
  assertEquals(chunks.every((chunk) => chunk.length <= 1000), true);
  assertEquals(chunks.join(" ").replace(/\s+/g, " ").includes("ပြီးဆုံး"), true);
});
