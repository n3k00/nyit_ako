import {
  AmbientLimiter,
  shouldConsiderAmbientReply,
} from "../src/services/ambient.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("ambient selector accepts natural question signals", () => {
  assert(
    shouldConsiderAmbientReply({
      text: "controller ဘာဝယ်သင့်လဲ",
      recentMessageCount: 3,
      minMessageLength: 3,
    }),
    "recommendation questions should be ambient candidates",
  );
});

Deno.test("ambient selector rejects low value short chatter", () => {
  assertEquals(
    shouldConsiderAmbientReply({
      text: "ok",
      recentMessageCount: 20,
      minMessageLength: 3,
    }),
    false,
  );
});

Deno.test("ambient limiter caps replies per minute", () => {
  const limiter = new AmbientLimiter(2, 0);
  assert(limiter.check(1), "first ambient reply should pass");
  assert(limiter.check(1), "second ambient reply should pass");
  assertEquals(limiter.check(1), false);
});

Deno.test("ambient limiter applies cooldown", () => {
  const limiter = new AmbientLimiter(2, 60_000);
  assert(limiter.check(1), "first ambient reply should pass");
  assertEquals(limiter.check(1), false);
});
