import { webhookCallback } from "grammy";
import { createBot } from "../../../src/app.ts";
import { loadConfig } from "../../../src/config.ts";

const config = loadConfig();
const bot = await createBot(config);
const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") {
    return Response.json({ ok: true, bot: config.botUsername });
  }
  if (url.pathname === "/webhook") {
    return handleUpdate(req);
  }
  return new Response("OK", { status: 200 });
});
