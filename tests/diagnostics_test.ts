import type { AppConfig } from "../src/config.ts";
import { formatDebugLlmStatus } from "../src/services/diagnostics.ts";
import { fallbackResponse } from "../src/services/llm.ts";
import { logger } from "../src/logging.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const config: AppConfig = {
  botToken: "bot-token-secret",
  botUsername: "nyit_ako_bot",
  webhookUrl: null,
  webhookPort: 8080,
  llmProvider: "openai_compatible",
  llmApiBase: "https://example.test/v1",
  llmApiKey: "sk-secret-value",
  llmModel: "test-model",
  llmTimeoutMs: 1000,
  llmRetries: 0,
  maxContextMessages: 80,
  recentContextLimit: 30,
  messageTtlMinutes: 180,
  rateLimitPerMinute: 3,
  groupRateLimitPerMinute: 20,
  cooldownMs: 0,
  maxMessageLength: 2000,
  defaultReplyLength: "short",
  defaultHumorLevel: 1,
  defaultRoastLevel: 1,
  groupProfilePath: "private_context/group.json",
  memberProfilesPath: "private_context/members.json",
  startupCheckOnly: false,
  ambientRepliesEnabled: true,
  ambientMaxPerMinute: 2,
  ambientCooldownSeconds: 60,
  ambientContextMessages: 20,
  ambientMinMessageLength: 3,
};

Deno.test("debug LLM status does not expose API key", () => {
  const output = formatDebugLlmStatus(config, {
    provider: "openai_compatible",
    configured: true,
    apiKeyPresent: true,
    model: "test-model",
    ok: false,
    category: "http_error",
    httpStatus: 401,
    timestamp: "2026-01-01T00:00:00Z",
  });
  assert(
    !output.includes("sk-secret-value"),
    "debug output must not include API key",
  );
  assert(
    output.includes("api key present: yes"),
    "debug output should include safe key presence",
  );
});

Deno.test("fallback is distinct from generic greeting", () => {
  const output = fallbackResponse();
  assert(
    !output.includes("ဘယ်လိုကူညီ"),
    "fallback should not be generic help greeting",
  );
  assert(
    output.includes("server"),
    "fallback should clearly indicate temporary backend issue",
  );
});

Deno.test("structured logger redacts secret fields", () => {
  const originalWarn = console.warn;
  let line = "";
  console.warn = (message?: unknown) => {
    line = String(message);
  };
  try {
    logger.warn("test_secret_redaction", {
      apiKey: "sk-secret-value",
      prompt: "full prompt",
      safe: "ok",
    });
  } finally {
    console.warn = originalWarn;
  }
  assert(
    !line.includes("sk-secret-value"),
    "logs must not include API key values",
  );
  assert(!line.includes("full prompt"), "logs must not include prompt values");
  assert(line.includes("[redacted]"), "logs should show redaction marker");
});
