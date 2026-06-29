import { Bot } from "grammy";
import type { AppConfig } from "./config.ts";
import { initLocalDB } from "./db/local.ts";
import { logger } from "./logging.ts";
import {
  createDeduplicationMiddleware,
  ignoreBotMessagesMiddleware,
  messageCacheMiddleware,
} from "./handlers/middleware.ts";
import { setupCommandHandlers } from "./handlers/commands.ts";
import { setupMessageHandler } from "./handlers/messages.ts";
import { configureCache } from "./services/cache.ts";
import { registerTelegramCommandMenu } from "./services/command_registry.ts";
import { createLlmProvider, type LlmProvider } from "./services/llm.ts";
import { RateLimiter } from "./services/rate_limit.ts";

export async function createBot(
  config: AppConfig,
  llm: LlmProvider = createLlmProvider(config),
): Promise<Bot> {
  await initLocalDB();
  configureCache({
    ttlMs: config.messageTtlMinutes * 60 * 1000,
    maxMessages: config.maxContextMessages,
  });

  const bot = new Bot(config.botToken);
  const rateLimiter = new RateLimiter(
    config.rateLimitPerMinute,
    config.groupRateLimitPerMinute,
    config.cooldownMs,
  );

  bot.use(createDeduplicationMiddleware());
  bot.use(ignoreBotMessagesMiddleware);
  setupCommandHandlers(bot, config, llm);
  bot.use(messageCacheMiddleware);
  setupMessageHandler(bot, config, llm, rateLimiter);
  if (!config.startupCheckOnly) {
    await registerTelegramCommandMenu(bot.api);
  }

  bot.catch((err) => {
    logger.error("telegram_bot_error", {
      updateId: err.ctx.update.update_id,
      error: err.error instanceof Error ? err.error.message : String(err.error),
    });
  });

  return bot;
}
