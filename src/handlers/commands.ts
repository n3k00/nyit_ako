import { Bot } from "grammy";
import { config } from "../config.ts";
import { getOrCreateGroup, updateGroup, checkRateLimit, addMemory, getMemories, PERSONALITIES } from "../db/local.ts";
import { getRecentMessages } from "../services/cache.ts";
import { buildRecapPrompt, buildJudgePrompt } from "../services/prompt.ts";
import { callMimo, startTypingLoop } from "../services/llm.ts";
import { checkSafety, sanitizeResponse } from "../services/safety.ts";

export function setupCommandHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    await ctx.reply(
      `မင်္ဂလာပါ! ကျွန်တော် ${config.botUsername} ပါ။\n` +
      `Group ထဲမှာ @mention လုပ်ပြီး ခေါ်ပါ။\n\n` +
      `Commands:\n` +
      `/personality [name] - Bot personality ပြောင်း\n` +
      `/roast [0-3] - Roast level သတ်မှတ်\n` +
      `/remember [fact] - Group memory သိမ်း\n` +
      `/lore - Group memories ကြည့်\n` +
      `/recap - ဒီနေ့ group recap\n` +
      `/judge - Reply လုပ်ထားတဲ့ discussion ကို verdict ပေး\n` +
      `/help - ဒီစာပြန်ပြ`,
    );
  });

  bot.command("help", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    const personalityNames = Object.keys(PERSONALITIES).join(", ");
    await ctx.reply(
      `Commands:\n` +
      `/personality [name] - Personality ပြောင်း (${personalityNames})\n` +
      `/roast [0-3] - Roast level သတ်မှတ်\n` +
      `/remember [fact] - Group memory သိမ်း\n` +
      `/lore - Group memories ကြည့်\n` +
      `/recap - ဒီနေ့ group recap\n` +
      `/judge - Reply လုပ်ထားတဲ့ discussion ကို verdict ပေး\n` +
      `/vibe - Group mood ကို ဟာသပုံစံနဲ့ပြ`,
    );
  });

  bot.command("personality", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;
    if (!ctx.message) return;

    const text = ctx.message.text || "";
    const args = text.split(" ").slice(1).join(" ").trim();

    if (!args || !PERSONALITIES[args]) {
      const available = Object.keys(PERSONALITIES).join(", ");
      await ctx.reply(`Personality ရွေးပါ: ${available}`);
      return;
    }

    await updateGroup(ctx.chat.id, { personality: args } as any);
    await ctx.reply(`Personality ကို ${args} ပြောင်းပြီးပြီ။ ✅`);
  });

  bot.command("roast", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;
    if (!ctx.message) return;

    const text = ctx.message.text || "";
    const args = text.split(" ").slice(1).join(" ").trim();

    const level = parseInt(args);
    if (isNaN(level) || level < 0 || level > 3) {
      await ctx.reply("Roast level 0-3 ထည့်ပါ။");
      return;
    }

    await updateGroup(ctx.chat.id, { roast_level: level } as any);
    await ctx.reply(`Roast level ကို ${level} ပြောင်းပြီးပြီ။ 🔥`);
  });

  bot.command("remember", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;
    if (!ctx.message) return;

    const text = ctx.message.text || "";
    const args = text.split(" ").slice(1).join(" ").trim();

    if (!args) {
      await ctx.reply("ဘာသိမ်းမလဲ? /remember Ko Min က meeting တိုင်းနောက်ကျတယ်");
      return;
    }

    const userId = ctx.from?.id || 0;
    await addMemory(ctx.chat.id, args, userId);
    await ctx.reply("Memory သိမ်းပြီးပြီ။ 📝");
  });

  bot.command("lore", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    const memories = await getMemories(ctx.chat.id);
    if (memories.length === 0) {
      await ctx.reply("Group lore မရှိသေးဘူး။ /remember နဲ့ စသိမ်းလိုက်ပါ။");
      return;
    }

    let loreText = "Group Lore 📜\n\n";
    for (const m of memories.slice(0, 20)) {
      loreText += `• ${m.fact}\n`;
    }
    await ctx.reply(loreText);
  });

  bot.command("recap", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id || 0;
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";

    if (!await checkRateLimit(chatId, userId)) {
      await ctx.reply("Chill bro, ခဏနားလိုက်ဦး။ 😅");
      return;
    }

    const recent = await getRecentMessages(chatId, 50);
    if (recent.length === 0) {
      await ctx.reply("စကားပြောစရာမရှိသေးဘူး။ 🤷");
      return;
    }

    const group = await getOrCreateGroup(chatId, ctx.chat.title || "");
    const memories = await getMemories(chatId);
    const memoryFacts = memories.map((m) => m.fact);

    const messages = buildRecapPrompt(
      group.personality,
      group.roast_level,
      recent,
      username,
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

      await ctx.reply(response);
    } catch (error) {
      console.error("Error in recap command:", error);
      await ctx.reply("Error ဖြစ်သွားတယ်။ ခဏနောက်မှပြန်ကြိုးစားပါ။");
    }
  });

  bot.command("judge", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;
    if (!ctx.message) return;

    if (!ctx.message.reply_to_message) {
      await ctx.reply("Discussion တခုကို reply လုပ်ပြီး /judge ပါ။");
      return;
    }

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id || 0;
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";

    if (!await checkRateLimit(chatId, userId)) {
      await ctx.reply("Chill bro, ခဏနားလိုက်ဦး။ 😅");
      return;
    }

    const recent = await getRecentMessages(chatId, 50);
    const group = await getOrCreateGroup(chatId, ctx.chat.title || "");
    const memories = await getMemories(chatId);
    const memoryFacts = memories.map((m) => m.fact);

    const messages = buildJudgePrompt(
      group.personality,
      group.roast_level,
      recent.slice(-20),
      username,
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

      await ctx.reply(response, { reply_to_message_id: ctx.message.reply_to_message.message_id });
    } catch (error) {
      console.error("Error in judge command:", error);
      await ctx.reply("Error ဖြစ်သွားတယ်။ ခဏနောက်မှပြန်ကြိုးစားပါ။");
    }
  });

  bot.command("vibe", async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id || 0;

    if (!await checkRateLimit(chatId, userId)) {
      await ctx.reply("Chill bro, ခဏနားလိုက်ဦး။ 😅");
      return;
    }

    const recent = await getRecentMessages(chatId, 30);
    if (recent.length === 0) {
      await ctx.reply("Group vibe ကိုဖတ်ဖို့ စကားပြောပါဦး။ 🤷");
      return;
    }

    const system = "You are a fun group chat member. Someone asked about the group's current vibe/mood. Give a short, funny one-liner about the current mood based on the recent messages.";
    let chat = "";
    for (const msg of recent) {
      chat += `[${msg.username}]: ${msg.content}\n`;
    }

    const messages = [
      { role: "system", content: system },
      { role: "user", content: `What's the group vibe right now?\n${chat}` },
    ];

    try {
      const typingLoop = startTypingLoop(ctx);
      
      let response = await callMimo(messages, 0.7, 200);
      typingLoop.stop();
      response = sanitizeResponse(response);
      await ctx.reply(response);
    } catch (error) {
      console.error("Error in vibe command:", error);
      await ctx.reply("Error ဖြစ်သွားတယ်။");
    }
  });
}
