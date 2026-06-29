import { Bot, webhookCallback } from "grammy";
import { config } from "./config.ts";
import { initLocalDB } from "./db/local.ts";
import { messageCacheMiddleware } from "./handlers/middleware.ts";
import { setupMentionHandler } from "./handlers/mention.ts";
import { setupReplyHandler } from "./handlers/reply.ts";
import { setupCommandHandlers } from "./handlers/commands.ts";

await initLocalDB();

const bot = new Bot(config.botToken);

bot.use(messageCacheMiddleware);

setupCommandHandlers(bot);
setupMentionHandler(bot);
setupReplyHandler(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

const isWebhook = !!Deno.env.get("WEBHOOK_URL");

if (isWebhook) {
  const handleUpdate = webhookCallback(bot, "std/http");
  Deno.serve({ port: config.webhookPort || 8080 }, async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/webhook") {
      return handleUpdate(req);
    }
    return new Response("OK", { status: 200 });
  });

  const webhookUrl = Deno.env.get("WEBHOOK_URL")!;
  const webhookInfo = await bot.api.getWebhookInfo();
  if (webhookInfo.url !== webhookUrl) {
    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: ["message", "edited_message"],
    });
    console.log(`Webhook set to ${webhookUrl}`);
  }
} else {
  console.log("Starting polling mode...");
  bot.start({
    allowed_updates: ["message", "edited_message"],
  });
}

console.log(`Bot @${config.botUsername} started`);
