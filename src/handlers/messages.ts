import type { Bot } from "grammy";
import type { AppConfig } from "../config.ts";
import {
  getGroupBehaviorProfile,
  getMemberGuidance,
  getMemories,
  getOrCreateGroup,
} from "../db/local.ts";
import { logger } from "../logging.ts";
import {
  buildAmbientContextBundle,
  decideAmbientReply,
} from "../services/ambient.ts";
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
  ambientEligible?: boolean;
}): boolean {
  const text = input.text?.trim();
  if (!text || input.fromBot || text.startsWith("/")) return false;
  const repliedToBot = input.replyFromBotUsername?.toLowerCase() ===
    input.botUsername.toLowerCase();
  return repliedToBot || isMentioned(text, input.botUsername) ||
    input.ambientEligible === true;
}

type TriggerKind = "mention" | "reply_to_bot" | "ambient";

export function resolveTriggerKind(input: {
  text: string;
  botUsername: string;
  replyFromBotUsername?: string;
  ambientEligible: boolean;
}): TriggerKind | null {
  const repliedToBot = input.replyFromBotUsername?.toLowerCase() ===
    input.botUsername.toLowerCase();
  if (repliedToBot) return "reply_to_bot";
  if (isMentioned(input.text, input.botUsername)) return "mention";
  if (input.ambientEligible) return "ambient";
  return null;
}

export function setupMessageHandler(
  bot: Bot,
  config: AppConfig,
  llm: LlmProvider,
  rateLimiter: RateLimiter,
): void {
  const recentAmbientBotReplies = new Map<number, string[]>();

  bot.on("message:text", async (ctx) => {
    if (
      !ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
    ) return;
    if (!ctx.message?.text || !ctx.from || ctx.from.is_bot) return;
    if (ctx.message.text.trim().startsWith("/")) return;

    const replied = ctx.message.reply_to_message;
    const replyFromBotUsername = replied?.from?.is_bot
      ? replied.from.username
      : undefined;
    const directlyAddressed = resolveTriggerKind({
      text: ctx.message.text,
      botUsername: config.botUsername,
      replyFromBotUsername,
      ambientEligible: false,
    });
    const ambientRecentMessages = getRecentMessages(
      ctx.chat.id,
      config.ambientContextMessages,
    );
    const ambientBundleResult = !directlyAddressed &&
        config.ambientRepliesEnabled
      ? buildAmbientContextBundle(ambientRecentMessages, {
        maxMessages: config.ambientContextMessages,
        minMessages: config.ambientMinMessages,
      })
      : { eligible: false, reason: "directly_addressed_or_disabled" };
    const ambientEligible = ambientBundleResult.eligible;
    const triggerKind = resolveTriggerKind({
      text: ctx.message.text,
      botUsername: config.botUsername,
      replyFromBotUsername,
      ambientEligible,
    });

    if (
      !shouldHandleTextMessage({
        text: ctx.message.text,
        botUsername: config.botUsername,
        fromBot: ctx.from.is_bot,
        replyFromBotUsername,
        ambientEligible,
      })
    ) return;
    if (!triggerKind) return;

    if (ctx.message.text.length > config.maxMessageLength) {
      await ctx.reply("Message က နည်းနည်းရှည်နေတယ်။ အတိုချုံးပြီး ပြန် mention လုပ်ပေးပါ။");
      return;
    }

    if (triggerKind === "mention") {
      const limit = rateLimiter.check(ctx.chat.id, ctx.from.id);
      if (!limit.allowed) {
        await ctx.reply("ခဏနားပြီးမှ ပြန်ခေါ်ပေးပါ။");
        return;
      }
    }

    if (triggerKind === "ambient") {
      const bundle = ambientBundleResult.bundle;
      if (!bundle) return;
      try {
        const decision = await decideAmbientReply(
          llm,
          bundle,
          recentAmbientBotReplies.get(ctx.chat.id) || [],
        );
        if (!decision.ok || !decision.reply) {
          logger.info("ambient_silence", {
            chatId: ctx.chat.id,
            reason: decision.reason,
            category: bundle.category,
          });
          return;
        }

        await safeReply(ctx, decision.reply, ctx.message.message_id);
        const previous = (recentAmbientBotReplies.get(ctx.chat.id) || []).slice(
          -8,
        );
        previous.push(decision.reply);
        recentAmbientBotReplies.set(ctx.chat.id, previous);
        logger.info("bot_reply_sent", {
          chatId: ctx.chat.id,
          mode: "default",
          triggerKind,
          ambientCategory: bundle.category,
          topicFingerprint: bundle.topicFingerprint,
        });
      } catch (error) {
        logger.error("ambient_reply_failed", {
          chatId: ctx.chat.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
    const storedGroupProfile = getGroupBehaviorProfile(ctx.chat.id);
    const fileGroupProfile = storedGroupProfile
      ? null
      : await loadGroupBehaviorProfile(
        config.groupProfilePath,
      );
    const groupProfile = storedGroupProfile || fileGroupProfile;
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
        allowLongAnswer: mode === "helpful",
        ambient: false,
      });
      await safeReply(ctx, result.response, ctx.message.message_id);
      logger.info("bot_reply_sent", {
        chatId: ctx.chat.id,
        mode,
        triggerKind,
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
