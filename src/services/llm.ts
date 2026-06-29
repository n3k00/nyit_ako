import type { AppConfig } from "../config.ts";
import { logger } from "../logging.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmProvider {
  complete(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string>;
}

export interface LlmRequestStatus {
  provider: string;
  configured: boolean;
  apiKeyPresent: boolean;
  model: string;
  ok: boolean;
  category:
    | "not_called"
    | "success"
    | "http_error"
    | "timeout"
    | "empty_response"
    | "network_error"
    | "parse_error";
  httpStatus?: number;
  durationMs?: number;
  timestamp?: string;
}

let lastRequestStatus: LlmRequestStatus = {
  provider: "unknown",
  configured: false,
  apiKeyPresent: false,
  model: "",
  ok: false,
  category: "not_called",
};

export function getLastLlmRequestStatus(): LlmRequestStatus {
  return { ...lastRequestStatus };
}

function updateLastRequestStatus(status: LlmRequestStatus): void {
  lastRequestStatus = { ...status };
}

function categorizeError(error: unknown): LlmRequestStatus["category"] {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }
  if (error instanceof SyntaxError) return "parse_error";
  if (error instanceof Error && error.message.includes("empty response")) {
    return "empty_response";
  }
  return "network_error";
}

export class MockLlmProvider implements LlmProvider {
  complete(): Promise<string> {
    updateLastRequestStatus({
      provider: "mock",
      configured: true,
      apiKeyPresent: true,
      model: "mock",
      ok: true,
      category: "success",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });
    return Promise.resolve("အခုတော့ mock response နဲ့ပြန်ထားတယ်။");
  }
}

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(private readonly config: AppConfig) {}

  async complete(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    const provider = "openai_compatible";
    const body = JSON.stringify({
      model: this.config.llmModel,
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 350,
    });

    for (let attempt = 0; attempt <= this.config.llmRetries; attempt++) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.llmTimeoutMs,
      );
      let httpStatus: number | undefined;
      try {
        const response = await fetch(
          `${this.config.llmApiBase.replace(/\/$/, "")}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.config.llmApiKey}`,
              "Content-Type": "application/json",
            },
            body,
            signal: controller.signal,
          },
        );
        httpStatus = response.status;

        if (!response.ok) {
          await response.body?.cancel();
          const durationMs = Date.now() - startedAt;
          updateLastRequestStatus({
            provider,
            configured: true,
            apiKeyPresent: this.config.llmApiKey.length > 0,
            model: this.config.llmModel,
            ok: false,
            category: "http_error",
            httpStatus,
            durationMs,
            timestamp: new Date().toISOString(),
          });
          throw new Error(`LLM provider returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim().length === 0) {
          throw new Error("LLM provider returned an empty response");
        }
        updateLastRequestStatus({
          provider,
          configured: true,
          apiKeyPresent: this.config.llmApiKey.length > 0,
          model: this.config.llmModel,
          ok: true,
          category: "success",
          httpStatus,
          durationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        });
        return content;
      } catch (error) {
        const finalAttempt = attempt >= this.config.llmRetries;
        const category = httpStatus !== undefined && error instanceof Error &&
            error.message.includes("HTTP")
          ? "http_error"
          : categorizeError(error);
        const status: LlmRequestStatus = {
          provider,
          configured: true,
          apiKeyPresent: this.config.llmApiKey.length > 0,
          model: this.config.llmModel,
          ok: false,
          category,
          httpStatus,
          durationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        };
        updateLastRequestStatus(status);
        logger.warn("llm_request_failed", {
          provider,
          attempt,
          finalAttempt,
          category,
          httpStatus,
          durationMs: status.durationMs,
        });
        if (finalAttempt) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error("LLM provider failed");
  }
}

export function createLlmProvider(config: AppConfig): LlmProvider {
  if (config.llmProvider === "mock") return new MockLlmProvider();
  return new OpenAICompatibleProvider(config);
}

export function estimatePromptChars(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

export function fallbackResponse(): string {
  return "ခဏလေး၊ ငါ့နှောက် server က တချက်တက်နေတယ် 😵‍💫";
}

export function startTypingLoop(
  ctx: {
    chat: { id: number };
    api: {
      sendChatAction: (chatId: number, action: "typing") => Promise<unknown>;
    };
  },
): {
  stop: () => void;
} {
  let running = true;
  const sendTyping = async () => {
    while (running) {
      try {
        await ctx.api.sendChatAction(ctx.chat.id, "typing");
      } catch {
        // Chat action failures should not fail a reply.
      }
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  };
  sendTyping();
  return { stop: () => running = false };
}
