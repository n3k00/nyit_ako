interface LimitState {
  timestamps: number[];
  lastReplyAt: number;
}

export class RateLimiter {
  private readonly states = new Map<string, LimitState>();

  constructor(
    private readonly perUserPerMinute: number,
    private readonly perGroupPerMinute: number,
    private readonly cooldownMs: number,
  ) {}

  check(
    chatId: number,
    userId: number,
  ): {
    allowed: boolean;
    reason: "ok" | "user_rate" | "group_rate" | "cooldown";
  } {
    const now = Date.now();
    const userKey = `u:${chatId}:${userId}`;
    const groupKey = `g:${chatId}`;

    const user = this.getState(userKey, now);
    const group = this.getState(groupKey, now);

    if (this.cooldownMs > 0 && now - group.lastReplyAt < this.cooldownMs) {
      return { allowed: false, reason: "cooldown" };
    }
    if (user.timestamps.length >= this.perUserPerMinute) {
      return { allowed: false, reason: "user_rate" };
    }
    if (group.timestamps.length >= this.perGroupPerMinute) {
      return { allowed: false, reason: "group_rate" };
    }

    user.timestamps.push(now);
    group.timestamps.push(now);
    user.lastReplyAt = now;
    group.lastReplyAt = now;
    this.states.set(userKey, user);
    this.states.set(groupKey, group);
    return { allowed: true, reason: "ok" };
  }

  private getState(key: string, now: number): LimitState {
    const windowMs = 60_000;
    const state = this.states.get(key) || { timestamps: [], lastReplyAt: 0 };
    state.timestamps = state.timestamps.filter((timestamp) =>
      now - timestamp < windowMs
    );
    return state;
  }
}
