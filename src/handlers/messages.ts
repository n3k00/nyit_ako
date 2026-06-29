import type { Bot } from "grammy";
import type { AppConfig } from "../config.ts";
import {
  getMemberGuidance,
  getMemories,
  getOrCreateGroup,
} from "../db/local.ts";
import { logger } from "../logging.ts";
import {
  fallbackResponse,
  LlmProvider,
  startTypingLoop,
} from "../services/llm.ts";
import { generateModelReply } from "../services/message_reply.ts";
import { selectResponseMode } from "../services/mode.ts";
import {
  loadGroupBehaviorProfile,
  loadMemberInteractionGuidance,
} from "../services/profiles.ts";
import { RateLimiter } from "../services/rate_limit.ts";
import { getRecentMessages } from "../services/cache.ts";
import { safeReply } from "../services/telegram.ts";
import { stripBotMention } from "../services/text.ts";

export function isMentioned(text: string, botUsername: string): boolean {
  return new RegExp(
    `(^|\\s)@${botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  ).test(text);
}

export function shouldHandleTextMessage(input: {
  text: string | undefined;
  botUsername: string;
  fromBot: boolean;
  replyFromBotUsername?: string;
}): boolean {
  const text = input.text?.trim();
  if (!text || input.fromBot || text.startsWith("/")) return false;
  const repliedToBot = input.replyFromBotUsername?.toLowerCase() ===
    input.botUsername.toLowerCase();
  return repliedToBot || isMentioned(text, input.botUsername);
}

export function setupMessageHandler(
  bot: Bot,
  config: AppConfig,
  llm: LlmProvider,
  rateLimiter: RateLimiter,
): void {
  bot.on("message:text", async (ctx) => {
    if (
      !ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
    ) return;
    if (!ctx.message?.text || !ctx.from || ctx.from.is_bot) return;
    if (ctx.message.text.trim().startsWith("/")) return;

    const replied = ctx.message.reply_to_message;
    if (
      !shouldHandleTextMessage({
        text: ctx.message.text,
        botUsername: config.botUsername,
        fromBot: ctx.from.is_bot,
        replyFromBotUsername: replied?.from?.is_bot
          ? replied.from.username
          : undefined,
      })
    ) return;

    if (ctx.message.text.length > config.maxMessageLength) {
      await ctx.reply("Message က နည်းနည်းရှည်နေတယ်။ အတိုချုံးပြီး ပြန် mention လုပ်ပေးပါ။");
      return;
    }

    const limit = rateLimiter.check(ctx.chat.id, ctx.from.id);
    if (!limit.allowed) {
      await ctx.reply("ခဏနားပြီးမှ ပြန်ခေါ်ပေးပါ။");
      return;
    }

    const group = await getOrCreateGroup(ctx.chat.id, ctx.chat.title || "", {
      reply_length: config.defaultReplyLength,
      humor_level: config.defaultHumorLevel,
      roast_level: config.defaultRoastLevel,
    });
    const repliedText = replied?.text || undefined;
    const cleanTriggerText = stripBotMention(
      ctx.message.text,
      config.botUsername,
    );
    const mode = selectResponseMode(cleanTriggerText, repliedText);
    const recentMessages = getRecentMessages(
      ctx.chat.id,
      config.recentContextLimit,
    )
      .filter((message) => message.message_id !== ctx.message.message_id)
      .slice(-config.recentContextLimit);
    const groupProfile = await loadGroupBehaviorProfile(
      config.groupProfilePath,
    );
    const storedGuidance = await getMemberGuidance(ctx.chat.id, ctx.from.id);
    const fileGuidance = storedGuidance
      ? null
      : await loadMemberInteractionGuidance(
        config.memberProfilesPath,
        ctx.chat.id,
        ctx.from.id,
      );
    const memberGuidance = storedGuidance || fileGuidance;
    const memories = group.memory_enabled
      ? await getMemories(ctx.chat.id, 8)
      : [];

    const typingLoop = startTypingLoop(ctx);
    try {
      const result = await generateModelReply({
        llm,
        mode,
        group,
        triggerUser: ctx.from.username || ctx.from.first_name || "unknown",
        triggerText: cleanTriggerText || ctx.message.text,
        repliedText,
        recentMessages,
        groupProfile,
        memberGuidance,
        memories,
      });
      await safeReply(ctx, result.response, ctx.message.message_id);
      logger.info("bot_reply_sent", {
        chatId: ctx.chat.id,
        mode,
        promptChars: result.promptChars,
      });
    } catch (error) {
      logger.error("bot_reply_failed", {
        chatId: ctx.chat.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await safeReply(ctx, fallbackResponse(), ctx.message.message_id);
    } finally {
      typingLoop.stop();
    }
  });
}
