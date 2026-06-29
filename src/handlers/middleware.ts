import type { Context, NextFunction } from "grammy";
import { getMemberGuidance } from "../db/local.ts";
import { addMessage, getRecentMessages } from "../services/cache.ts";
import { isSupportedCommand } from "../services/command_registry.ts";
import { UpdateDeduplicator } from "../services/idempotency.ts";
import { observeAndLearnFromMessage } from "../services/learning.ts";

export function createDeduplicationMiddleware(
  deduplicator = new UpdateDeduplicator(),
) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (deduplicator.seenBefore(ctx.update.update_id)) return;
    await next();
  };
}

export async function ignoreBotMessagesMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (ctx.message && ctx.from?.is_bot) return;
  await next();
}

export async function messageCacheMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (
    ctx.message?.text && ctx.chat &&
    (ctx.chat.type === "group" || ctx.chat.type === "supergroup")
  ) {
    if (
      ctx.from &&
      !ctx.from.is_bot &&
      !isSupportedCommand(ctx.message.text, ctx.me.username)
    ) {
      addMessage(ctx.chat.id, {
        message_id: ctx.message.message_id,
        user_id: ctx.from.id,
        username: ctx.from.username || ctx.from.first_name || "unknown",
        content: ctx.message.text,
      });
      await observeAndLearnFromMessage({
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        messageId: ctx.message.message_id,
        text: ctx.message.text,
        recentMessages: getRecentMessages(ctx.chat.id, 30),
        existingGuidance: getMemberGuidance(ctx.chat.id, ctx.from.id),
      });
    }
  }
  await next();
}
