import { webhookCallback } from "grammy";
import { createBot } from "./app.ts";
import { loadConfig } from "./config.ts";
import { logger } from "./logging.ts";

const config = loadConfig();
const bot = await createBot(config);

if (config.startupCheckOnly) {
  logger.info("bot_startup_check_ok", { username: config.botUsername });
} else if (config.webhookUrl) {
  const handleUpdate = webhookCallback(bot, "std/http");
  Deno.serve({ port: config.webhookPort }, (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, bot: config.botUsername });
    }
    if (url.pathname === "/webhook") {
      return handleUpdate(req);
    }
    return new Response("OK", { status: 200 });
  });

  const webhookInfo = await bot.api.getWebhookInfo();
  if (webhookInfo.url !== config.webhookUrl) {
    await bot.api.setWebhook(config.webhookUrl, {
      allowed_updates: ["message", "edited_message"],
    });
  }
  logger.info("bot_started", {
    mode: "webhook",
    username: config.botUsername,
    port: config.webhookPort,
  });
} else {
  logger.info("bot_started", { mode: "polling", username: config.botUsername });
  bot.start({ allowed_updates: ["message", "edited_message"] });
}
