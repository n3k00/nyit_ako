import type { AppConfig } from "../config.ts";
import type { LlmRequestStatus } from "./llm.ts";

export function formatDebugLlmStatus(
  config: AppConfig,
  last: LlmRequestStatus,
): string {
  return [
    "LLM debug:",
    `provider configured: ${config.llmProvider ? "yes" : "no"}`,
    `api key present: ${config.llmApiKey ? "yes" : "no"}`,
    `provider: ${config.llmProvider}`,
    `model: ${config.llmModel}`,
    `last status: ${last.category}`,
    `last http: ${last.httpStatus ?? "n/a"}`,
    `last timestamp: ${last.timestamp ?? "not called"}`,
  ].join("\n");
}

export function formatRuntimeStatus(
  config: AppConfig,
  last: LlmRequestStatus,
): string {
  return [
    "Status:",
    `LLM provider: ${config.llmProvider}`,
    `API key present: ${config.llmApiKey ? "yes" : "no"}`,
    `Model: ${config.llmModel}`,
    `Last LLM: ${last.category}${
      last.httpStatus ? ` (${last.httpStatus})` : ""
    }`,
    `Context: enabled, recent limit ${config.recentContextLimit}`,
    "Commands: /help /status /recap /judge /vibe /privacy /learning /myprofile /forget /dontroast /allowroast",
  ].join("\n");
}
