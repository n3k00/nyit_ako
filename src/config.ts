export interface AppConfig {
  botToken: string;
  botUsername: string;
  webhookUrl: string | null;
  webhookPort: number;
  llmProvider: "openai_compatible" | "mock";
  llmApiBase: string;
  llmApiKey: string;
  llmModel: string;
  llmTimeoutMs: number;
  llmRetries: number;
  maxContextMessages: number;
  recentContextLimit: number;
  messageTtlMinutes: number;
  rateLimitPerMinute: number;
  groupRateLimitPerMinute: number;
  cooldownMs: number;
  maxMessageLength: number;
  defaultReplyLength: "short" | "medium";
  defaultHumorLevel: number;
  defaultRoastLevel: number;
  groupProfilePath: string;
  memberProfilesPath: string;
  startupCheckOnly: boolean;
  ambientRepliesEnabled: boolean;
  ambientMaxPerMinute: number;
  ambientCooldownSeconds: number;
  ambientContextMessages: number;
  ambientMinMessageLength: number;
}

function intFromEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function stringFromEnv(name: string, fallback = ""): string {
  return Deno.env.get(name)?.trim() || fallback;
}

export function loadConfig(): AppConfig {
  const botToken = stringFromEnv("BOT_TOKEN");
  const botUsername = stringFromEnv("BOT_USERNAME", "NekoBot").replace(
    /^@/,
    "",
  );
  const llmProvider = stringFromEnv("LLM_PROVIDER", "openai_compatible");
  const defaultReplyLength = stringFromEnv("DEFAULT_REPLY_LENGTH", "short");

  if (!botToken) {
    throw new Error("BOT_TOKEN is required");
  }
  if (!["openai_compatible", "mock"].includes(llmProvider)) {
    throw new Error("LLM_PROVIDER must be openai_compatible or mock");
  }
  if (!["short", "medium"].includes(defaultReplyLength)) {
    throw new Error("DEFAULT_REPLY_LENGTH must be short or medium");
  }

  const llmApiKey = stringFromEnv("LLM_API_KEY", stringFromEnv("MIMO_API_KEY"));
  if (llmProvider === "openai_compatible" && !llmApiKey) {
    throw new Error("LLM_API_KEY is required for openai_compatible provider");
  }

  return {
    botToken,
    botUsername,
    webhookUrl: stringFromEnv("WEBHOOK_URL") || null,
    webhookPort: intFromEnv("WEBHOOK_PORT", 8080, 1, 65535),
    llmProvider: llmProvider as AppConfig["llmProvider"],
    llmApiBase: stringFromEnv(
      "LLM_API_BASE",
      stringFromEnv("MIMO_API_BASE", "https://api.xiaomimimo.com/v1"),
    ),
    llmApiKey,
    llmModel: stringFromEnv(
      "LLM_MODEL",
      stringFromEnv("MIMO_MODEL", "mimo-v2.5-pro"),
    ),
    llmTimeoutMs: intFromEnv("LLM_TIMEOUT_MS", 20_000, 1_000, 120_000),
    llmRetries: intFromEnv("LLM_RETRIES", 1, 0, 5),
    maxContextMessages: intFromEnv("MAX_CONTEXT_MESSAGES", 80, 20, 200),
    recentContextLimit: intFromEnv("RECENT_CONTEXT_LIMIT", 30, 5, 40),
    messageTtlMinutes: intFromEnv("MESSAGE_TTL_MINUTES", 180, 5, 24 * 60),
    rateLimitPerMinute: intFromEnv("RATE_LIMIT_PER_MINUTE", 3, 1, 60),
    groupRateLimitPerMinute: intFromEnv(
      "GROUP_RATE_LIMIT_PER_MINUTE",
      20,
      1,
      300,
    ),
    cooldownMs: intFromEnv("COOLDOWN_MS", 4_000, 0, 60_000),
    maxMessageLength: intFromEnv("MAX_MESSAGE_LENGTH", 2_000, 100, 8_000),
    defaultReplyLength: defaultReplyLength as AppConfig["defaultReplyLength"],
    defaultHumorLevel: intFromEnv("DEFAULT_HUMOR_LEVEL", 1, 0, 3),
    defaultRoastLevel: intFromEnv("DEFAULT_ROAST_LEVEL", 1, 0, 2),
    groupProfilePath: stringFromEnv(
      "GROUP_PROFILE_PATH",
      "private_context/telegram_group_behavior_profile.json",
    ),
    memberProfilesPath: stringFromEnv(
      "MEMBER_PROFILES_PATH",
      "private_context/telegram_member_interaction_profiles.json",
    ),
    startupCheckOnly: stringFromEnv("BOT_STARTUP_CHECK_ONLY", "false") ===
      "true",
    ambientRepliesEnabled: stringFromEnv("AMBIENT_REPLIES_ENABLED", "true") ===
      "true",
    ambientMaxPerMinute: intFromEnv("AMBIENT_MAX_PER_MINUTE", 2, 0, 20),
    ambientCooldownSeconds: intFromEnv("AMBIENT_COOLDOWN_SECONDS", 25, 0, 300),
    ambientContextMessages: intFromEnv("AMBIENT_CONTEXT_MESSAGES", 20, 5, 40),
    ambientMinMessageLength: intFromEnv(
      "AMBIENT_MIN_MESSAGE_LENGTH",
      3,
      1,
      200,
    ),
  };
}
