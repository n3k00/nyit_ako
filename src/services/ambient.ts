const AMBIENT_SIGNALS = [
  "?",
  "？",
  "ဘယ်လို",
  "ဘာလို့",
  "ဘာဝယ်",
  "ဝယ်သင့်",
  "ကောင်းလား",
  "လုပ်ရ",
  "ရမလဲ",
  "help",
  "error",
  "bug",
  "recommend",
  "controller",
  "ငြင်း",
  "မှန်လား",
  "မှားလား",
  "lol",
  "haha",
];

const LOW_VALUE_TEXTS = new Set([
  "ok",
  "okay",
  "ဟုတ်",
  "ဟ",
  "အင်း",
  "အိုကေ",
  "👍",
  "😂",
  "🤣",
]);

export interface AmbientDecisionInput {
  text: string;
  recentMessageCount: number;
  minMessageLength: number;
}

export function shouldConsiderAmbientReply(
  input: AmbientDecisionInput,
): boolean {
  const text = input.text.trim();
  if (text.length < input.minMessageLength) return false;
  if (LOW_VALUE_TEXTS.has(text.toLowerCase()) || text.length <= 1) {
    return false;
  }

  const lower = text.toLowerCase();
  const hasSignal = AMBIENT_SIGNALS.some((signal) =>
    lower.includes(signal.toLowerCase())
  );
  if (hasSignal) return true;

  // Join quiet runs occasionally, but avoid speaking after every ordinary line.
  return input.recentMessageCount >= 6 && input.recentMessageCount % 5 === 0;
}

export class AmbientLimiter {
  private timestamps = new Map<number, number[]>();
  private lastReplyAt = new Map<number, number>();

  constructor(
    private readonly maxPerMinute: number,
    private readonly cooldownMs: number,
  ) {}

  check(chatId: number): boolean {
    if (this.maxPerMinute <= 0) return false;

    const now = Date.now();
    const previous = this.lastReplyAt.get(chatId) || 0;
    if (this.cooldownMs > 0 && now - previous < this.cooldownMs) return false;

    const timestamps = (this.timestamps.get(chatId) || []).filter((time) =>
      now - time < 60_000
    );
    if (timestamps.length >= this.maxPerMinute) {
      this.timestamps.set(chatId, timestamps);
      return false;
    }

    timestamps.push(now);
    this.timestamps.set(chatId, timestamps);
    this.lastReplyAt.set(chatId, now);
    return true;
  }
}
