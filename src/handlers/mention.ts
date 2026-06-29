import { Bot } from "grammy";
import { config } from "../config.ts";
import { getOrCreateGroup, checkRateLimit, getMemories } from "../db/local.ts";
import { getRecentMessages } from "../services/cache.ts";
import { buildMentionPrompt } from "../services/prompt.ts";
import { callMimo, startTypingLoop } from "../services/llm.ts";
import { checkSafety, sanitizeResponse } from "../services/safety.ts";

export function setupMentionHandler(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
      return;
    }

    const text = ctx.message.text;
    if (!text) return;

    const botUsername = config.botUsername.toLowerCase();
    const isMentioned = text.toLowerCase().includes(`@${botUsername}`);

    if (!isMentioned) return;

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id || 0;
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";

    if (!await checkRateLimit(chatId, userId)) {
      await ctx.reply("Chill bro, mention ခဏနားလိုက်ဦး။ 😅");
      return;
    }

    const group = await getOrCreateGroup(chatId, ctx.chat.title || "");
    const recent = await getRecentMessages(chatId, 5);
    const memories = await getMemories(chatId);
    const memoryFacts = memories.map((m) => m.fact);

    let replyToText: string | null = null;
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      replyToText = ctx.message.reply_to_message.text;
    }

    const messages = buildMentionPrompt(
      group.personality,
      group.roast_level,
      recent,
      username,
      text,
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
      console.error("Error in mention handler:", error);
      await ctx.reply("Error ဖြစ်သွားတယ်။ ခဏနောက်မှပြန်ကြိုးစားပါ။");
    }
  });
}
