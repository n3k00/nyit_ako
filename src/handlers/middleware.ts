import type { Context, NextFunction } from "grammy";
import { addMessage } from "../services/cache.ts";
import { isSupportedCommand } from "../services/command_registry.ts";
import { UpdateDeduplicator } from "../services/idempotency.ts";

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
      !ctx.from?.is_bot &&
      !isSupportedCommand(ctx.message.text, ctx.me.username)
    ) {
      addMessage(ctx.chat.id, {
        message_id: ctx.message.message_id,
        user_id: ctx.from?.id || 0,
        username: ctx.from?.username || ctx.from?.first_name || "unknown",
        content: ctx.message.text,
      });
    }
  }
  await next();
}
