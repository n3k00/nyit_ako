import type { Bot, Context } from "grammy";
import type { AppConfig } from "../config.ts";
import {
  clearGroupData,
  clearMemberGuidance,
  getGroupBehaviorProfile,
  getMemberGuidance,
  getMemories,
  getOrCreateGroup,
  saveMemberGuidance,
  updateGroup,
} from "../db/local.ts";
import { clearMessages, getRecentMessages } from "../services/cache.ts";
import {
  canUseAdminCommand,
  normalizeTargetedCommandText,
} from "../services/command_registry.ts";
import {
  formatDebugLlmStatus,
  formatRuntimeStatus,
} from "../services/diagnostics.ts";
import {
  fallbackResponse,
  getLastLlmRequestStatus,
  type LlmProvider,
  startTypingLoop,
} from "../services/llm.ts";
import { generateModelReply } from "../services/message_reply.ts";
import {
  loadGroupBehaviorProfile,
  loadMemberInteractionGuidance,
} from "../services/profiles.ts";
import { safeReply } from "../services/telegram.ts";
import { guidanceSummary } from "../services/learning.ts";
import type { ResponseMode } from "../types.ts";
import { logger } from "../logging.ts";

async function isGroupAdmin(ctx: Context): Promise<boolean> {
  if (
    !ctx.chat || !ctx.from ||
    (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
  ) return false;
  const member = await ctx.getChatMember(ctx.from.id);
  return canUseAdminCommand(member.status);
}

function isGroup(ctx: Context): boolean {
  return !!ctx.chat &&
    (ctx.chat.type === "group" || ctx.chat.type === "supergroup");
}

function isSupportedChat(ctx: Context): boolean {
  return !!ctx.chat &&
    (ctx.chat.type === "private" || ctx.chat.type === "group" ||
      ctx.chat.type === "supergroup");
}

function helpText(config: AppConfig): string {
  return [
    `@${config.botUsername} ကို mention လုပ်ရင်၊ bot message ကို reply လုပ်ရင်၊ command သုံးရင်ပဲ ပြန်ဖြေမယ်။`,
    "",
    "Commands:",
    "/help - ဘာလုပ်လို့ရလဲ",
    "/status - bot အခြေအနေ",
    "/recap - ဒီနေ့ chat recap",
    "/judge - reply တစ်ခုကို verdict ပေး",
    "/vibe - group mood",
    "/privacy - data/privacy",
    "/learning - bot ကဘာတွေ learn လုပ်လဲ",
    "/myprofile - ကိုယ့် safe reply-style hints ကြည့်",
    "/forget - ကိုယ့် data ဖျက်",
    "/dontroast - ကိုယ့်ကို roast မလုပ်စေ",
    "/allowroast - roast preference ပြန်ဖွင့်",
  ].join("\n");
}

async function commandLlmReply(
  ctx: Context,
  config: AppConfig,
  llm: LlmProvider,
  mode: ResponseMode,
  triggerText: string,
  repliedText?: string,
): Promise<void> {
  if (!isGroup(ctx) || !ctx.chat || !ctx.from) return;

  const group = await getOrCreateGroup(ctx.chat.id, ctx.chat.title || "", {
    reply_length: config.defaultReplyLength,
    humor_level: config.defaultHumorLevel,
    roast_level: config.defaultRoastLevel,
  });
  const recentMessages = getRecentMessages(
    ctx.chat.id,
    config.recentContextLimit,
  );
  const storedGroupProfile = getGroupBehaviorProfile(ctx.chat.id);
  const fileGroupProfile = storedGroupProfile
    ? null
    : await loadGroupBehaviorProfile(config.groupProfilePath);
  const groupProfile = storedGroupProfile || fileGroupProfile;
  const storedGuidance = await getMemberGuidance(ctx.chat.id, ctx.from.id);
  const fileGuidance = storedGuidance
    ? null
    : await loadMemberInteractionGuidance(
      config.memberProfilesPath,
      ctx.chat.id,
      ctx.from.id,
    );

  const typingLoop = startTypingLoop({ chat: ctx.chat, api: ctx.api });
  try {
    const result = await generateModelReply({
      llm,
      mode,
      group,
      triggerUser: ctx.from.username || ctx.from.first_name || "unknown",
      triggerText,
      repliedText,
      recentMessages,
      groupProfile,
      memberGuidance: storedGuidance || fileGuidance,
      memories: group.memory_enabled ? await getMemories(ctx.chat.id, 8) : [],
    });

    await safeReply(ctx, result.response, ctx.message?.message_id);
  } catch (error) {
    logger.error("command_reply_failed", {
      chatId: ctx.chat.id,
      mode,
      error: error instanceof Error ? error.message : String(error),
    });
    await safeReply(ctx, fallbackResponse(), ctx.message?.message_id);
  } finally {
    typingLoop.stop();
  }
}

export function setupCommandHandlers(
  bot: Bot,
  config: AppConfig,
  llm: LlmProvider,
): void {
  bot.use(async (ctx, next) => {
    if (ctx.message?.text) {
      const normalized = normalizeTargetedCommandText(
        ctx.message.text,
        config.botUsername,
      );
      if (normalized !== ctx.message.text) {
        ctx.message.text = normalized;
      }
    }
    await next();
  });

  bot.command(["start", "help"], async (ctx) => {
    if (!isSupportedChat(ctx)) return;
    await ctx.reply(helpText(config));
  });

  bot.command("status", async (ctx) => {
    if (!isSupportedChat(ctx)) return;
    await ctx.reply(formatRuntimeStatus(config, getLastLlmRequestStatus()));
  });

  bot.command("debug_llm", async (ctx) => {
    if (!await isGroupAdmin(ctx)) {
      await ctx.reply("ဒီ command က group admin တွေအတွက်ပဲပါ။");
      return;
    }
    await ctx.reply(formatDebugLlmStatus(config, getLastLlmRequestStatus()));
  });

  bot.command("recap", async (ctx) => {
    if (!isGroup(ctx)) return;
    await commandLlmReply(
      ctx,
      config,
      llm,
      "default",
      "ဒီနေ့ chat ကို ၃ ကြောင်းလောက် recap လုပ်ပေး။",
    );
  });

  bot.command("judge", async (ctx) => {
    if (!isGroup(ctx)) return;
    const repliedText = ctx.message?.reply_to_message?.text;
    if (!repliedText) {
      await ctx.reply("/judge ကို verdict ပေးချင်တဲ့ message ကို reply လုပ်ပြီးသုံးပါ။");
      return;
    }
    await commandLlmReply(
      ctx,
      config,
      llm,
      "referee",
      "ဒီ discussion ကို မျှမျှတတ judge လုပ်ပေး။",
      repliedText,
    );
  });

  bot.command("vibe", async (ctx) => {
    if (!isGroup(ctx)) return;
    await commandLlmReply(
      ctx,
      config,
      llm,
      "banter",
      "အခု group vibe ကို short funny line နဲ့ပြောပေး။",
    );
  });

  bot.command("privacy", async (ctx) => {
    if (!isSupportedChat(ctx)) return;
    await ctx.reply(
      [
        "Recent group context ကို short-lived memory အနေနဲ့ပဲသိမ်းတယ်။",
        "Repeated interaction တွေကနေ reply-style preference hints လေးတွေ learn လုပ်နိုင်တယ်၊ AI model weights ကို train မလုပ်ဘူး။",
        "Sensitive personal profiling မသိမ်းဘူး။ ကိုယ့် hints ကို /myprofile နဲ့ကြည့်ပြီး /forget နဲ့ဖျက်လို့ရတယ်။",
        "/groupforget က admin-only group context/memory/learned group data clear လုပ်တယ်။",
      ].join("\n"),
    );
  });

  bot.command("learning", async (ctx) => {
    if (!isSupportedChat(ctx)) return;
    await ctx.reply(
      [
        "Learning ဆိုတာ model training မဟုတ်ပါ။",
        "Bot က repeated group interaction တွေကနေ reply style hints ပဲသိမ်းတယ်: short/detail ကြိုက်လား၊ practical answer ကြိုက်လား၊ light banter OK လား စတာမျိုး။",
        "မသိမ်းတာတွေ: health/mental state, relationship, family, money, religion/politics/ethnicity/sexuality, insult labels, personality flaws.",
        "ကိုယ့် hints ကို /myprofile နဲ့ကြည့်၊ /forget နဲ့ဖျက်၊ roast မလုပ်စေချင်ရင် /dontroast သုံးပါ။",
      ].join("\n"),
    );
  });

  bot.command("myprofile", async (ctx) => {
    if (!isGroup(ctx) || !ctx.from || !ctx.chat) return;
    await ctx.reply(
      guidanceSummary(getMemberGuidance(ctx.chat.id, ctx.from.id)),
    );
  });

  bot.command("forget", async (ctx) => {
    if (!isGroup(ctx) || !ctx.from || !ctx.chat) return;
    await clearMemberGuidance(ctx.chat.id, ctx.from.id);
    await ctx.reply("သင့် interaction guidance ကိုဖျက်ပြီးပါပြီ။");
  });

  bot.command("dontroast", async (ctx) => {
    if (!isGroup(ctx) || !ctx.from || !ctx.chat) return;
    const now = new Date().toISOString();
    const current = getMemberGuidance(ctx.chat.id, ctx.from.id);
    await saveMemberGuidance({
      user_id: ctx.from.id,
      chat_id: ctx.chat.id,
      preferred_reply_style: current?.preferred_reply_style || "medium",
      humor_tolerance: "low",
      tech_detail_preference: current?.tech_detail_preference || "basic",
      likely_group_role: current?.likely_group_role || "unknown",
      avoid_topics: [
        ...new Set([
          ...(current?.avoid_topics || []),
          "personal jokes or roasting",
        ]),
      ],
      confidence: 1,
      evidence_count: (current?.evidence_count || 0) + 1,
      last_observed_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 180 * 24 * 3600_000).toISOString(),
      explicit_no_roast: true,
    });
    await ctx.reply("မှတ်ထားပြီ။ သင့်ကို personal roast/joke မလုပ်အောင်ထားမယ်။");
  });

  bot.command("allowroast", async (ctx) => {
    if (!isGroup(ctx) || !ctx.from || !ctx.chat) return;
    const current = getMemberGuidance(ctx.chat.id, ctx.from.id);
    if (!current) {
      await ctx.reply("ပြန်ဖွင့်စရာ no-roast preference မရှိသေးပါ။");
      return;
    }
    await saveMemberGuidance({
      ...current,
      avoid_topics: (current.avoid_topics || []).filter((topic) =>
        topic !== "personal jokes or roasting"
      ),
      explicit_no_roast: false,
      updated_at: new Date().toISOString(),
    });
    await ctx.reply("OK, no-roast preference ကိုဖယ်ပြီးပါပြီ။");
  });

  bot.command("groupforget", async (ctx) => {
    if (!isGroup(ctx) || !ctx.chat) return;
    if (!await isGroupAdmin(ctx)) {
      await ctx.reply("ဒီ command က group admin တွေအတွက်ပဲပါ။");
      return;
    }
    clearMessages(ctx.chat.id);
    await clearGroupData(ctx.chat.id);
    await ctx.reply(
      "Group recent context နဲ့ approved memories ကို clear လုပ်ပြီးပါပြီ။",
    );
  });

  bot.command("botstyle", async (ctx) => {
    if (!isGroup(ctx) || !ctx.chat) return;

    const group = await getOrCreateGroup(ctx.chat.id, ctx.chat.title || "", {
      reply_length: config.defaultReplyLength,
      humor_level: config.defaultHumorLevel,
      roast_level: config.defaultRoastLevel,
    });
    const text = ctx.message?.text || "";
    const [, key, value] = text.trim().split(/\s+/);

    if (!key || !value) {
      await ctx.reply(
        `Current style: reply_length=${group.reply_length}, humor_level=${group.humor_level}, roast_level=${group.roast_level}\n` +
          "Admin update: /botstyle reply_length short|medium OR /botstyle humor_level 0-3 OR /botstyle roast_level 0-2",
      );
      return;
    }

    if (!await isGroupAdmin(ctx)) {
      await ctx.reply("Style ပြောင်းဖို့ group admin ဖြစ်ဖို့လိုပါတယ်။");
      return;
    }

    if (key === "reply_length" && (value === "short" || value === "medium")) {
      await updateGroup(ctx.chat.id, { reply_length: value });
    } else if (key === "humor_level" && /^[0-3]$/.test(value)) {
      await updateGroup(ctx.chat.id, { humor_level: Number(value) });
    } else if (key === "roast_level" && /^[0-2]$/.test(value)) {
      await updateGroup(ctx.chat.id, { roast_level: Number(value) });
    } else {
      await ctx.reply(
        "Invalid style value ပါ။ /botstyle နဲ့ current options ကိုကြည့်ပါ။",
      );
      return;
    }

    await ctx.reply("Bot style updated ပါပြီ။");
  });
}
