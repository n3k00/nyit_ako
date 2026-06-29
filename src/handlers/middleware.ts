import { Context, NextFunction } from "grammy";
import { addMessage } from "../services/cache.ts";

export async function messageCacheMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  if (ctx.message && ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
    if (ctx.message.text) {
      const username = ctx.from?.username || ctx.from?.first_name || "unknown";
      const userId = ctx.from?.id || 0;
      await addMessage(ctx.chat.id, userId, username, ctx.message.text);
    }
  }
  await next();
}
