import { UpdateDeduplicator } from "../src/services/idempotency.ts";
import { RateLimiter } from "../src/services/rate_limit.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("update deduplicator rejects repeated update ids", () => {
  const deduper = new UpdateDeduplicator();
  assert(!deduper.seenBefore(100), "first update should pass");
  assert(deduper.seenBefore(100), "duplicate update should be rejected");
});

Deno.test("rate limiter enforces per-user limits", () => {
  const limiter = new RateLimiter(2, 10, 0);
  assert(limiter.check(1, 1).allowed, "first request should pass");
  assert(limiter.check(1, 1).allowed, "second request should pass");
  const third = limiter.check(1, 1);
  assert(
    !third.allowed && third.reason === "user_rate",
    "third request should hit user rate limit",
  );
});

Deno.test("rate limiter enforces group cooldown", () => {
  const limiter = new RateLimiter(10, 10, 60_000);
  assert(limiter.check(1, 1).allowed, "first request should pass");
  const second = limiter.check(1, 2);
  assert(
    !second.allowed && second.reason === "cooldown",
    "second group request should hit cooldown",
  );
});
