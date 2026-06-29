import { Bot } from "grammy";
import { config } from "../config.ts";
import { getOrCreateGroup, checkRateLimit, getMemories } from "../db/local.ts";
import { getRecentMessages } from "../services/cache.ts";
import { buildMentionPrompt } from "../services/prompt.ts";
import { callMimo, startTypingLoop } from "../services/llm.ts";
import { checkSafety, sanitizeResponse } from "../services/safety.ts";

export function setupReplyHandler(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
      return;
    }

    const replied = ctx.message.reply_to_message;
    if (!replied || !replied.from || !replied.from.is_bot) return;
    if (replied.from.username !== config.botUsername) return;

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id || 0;
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";

    if (!await checkRateLimit(chatId, userId)) {
      await ctx.reply("Chill bro, ခဏနားလိုက်ဦး။ 😅");
      return;
    }

    const group = await getOrCreateGroup(chatId, ctx.chat.title || "");
    const recent = await getRecentMessages(chatId, 5);
    const memories = await getMemories(chatId);
    const memoryFacts = memories.map((m) => m.fact);

    const replyToText = replied.text || "";
    const triggerText = ctx.message.text || "";

    const messages = buildMentionPrompt(
      group.personality,
      group.roast_level,
      recent,
      username,
      triggerText,
      replyToText,
      memoryFacts.length > 0 ? memoryFacts : null,
    );

    try {
      const typingLoop = startTypingLoop(ctx);
      
      let response = await callMimo(messages);
      typingLoop.stop();
      response = sanitizeResponse(response);

      const { safe } = checkSafety(response);
      if (!safe) {
        response = "ဒီဟာကတော့ မပြောတတ်ဘူး။ 🤐";
      }

      await ctx.reply(response, { reply_to_message_id: ctx.message.message_id });
    } catch (error) {
      console.error("Error in reply handler:", error);
      await ctx.reply("Error ဖြစ်သွားတယ်။ ခဏနောက်မှပြန်ကြိုးစားပါ။");
    }
  });
}
