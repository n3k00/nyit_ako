import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Bot, webhookCallback } from "https://deno.land/x/grammy@v1.25.0/mod.ts";

import { messageCacheMiddleware } from "../../../src/handlers/middleware.ts";
import { setupMentionHandler } from "../../../src/handlers/mention.ts";
import { setupReplyHandler } from "../../../src/handlers/reply.ts";
import { setupCommandHandlers } from "../../../src/handlers/commands.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") || "NekoBot";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIMO_API_BASE = Deno.env.get("MIMO_API_BASE") || "https://api.xiaomimimo.com/v1";
const MIMO_API_KEY = Deno.env.get("MIMO_API_KEY")!;
const MIMO_MODEL = Deno.env.get("MIMO_MODEL") || "mimo-v2.5-pro";

const bot = new Bot(BOT_TOKEN);

bot.use(messageCacheMiddleware);
setupCommandHandlers(bot);
setupMentionHandler(bot);
setupReplyHandler(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

const handleUpdate = webhookCallback(bot, "std/http");

serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/webhook") {
    return handleUpdate(req);
  }
  return new Response("OK", { status: 200 });
});
