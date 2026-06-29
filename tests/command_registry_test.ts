import {
  canUseAdminCommand,
  isSupportedCommand,
  normalizeTargetedCommandText,
  parseCommandName,
  registerTelegramCommandMenu,
} from "../src/services/command_registry.ts";
import { shouldHandleTextMessage } from "../src/handlers/messages.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("/help@bot_username is routed as a command", () => {
  assertEquals(parseCommandName("/help@nyit_ako_bot", "nyit_ako_bot"), "help");
  assert(
    isSupportedCommand("/help@nyit_ako_bot", "nyit_ako_bot"),
    "help command should be supported",
  );
});

Deno.test("targeted command text is normalized for command handlers", () => {
  assertEquals(
    normalizeTargetedCommandText(
      "/judge@nyit_ako_bot please",
      "nyit_ako_bot",
    ),
    "/judge please",
  );
  assertEquals(
    normalizeTargetedCommandText("/judge@other_bot", "nyit_ako_bot"),
    "/judge@other_bot",
  );
});

Deno.test("commands do not reach mention handler", () => {
  assertEquals(
    shouldHandleTextMessage({
      text: "/help@nyit_ako_bot",
      botUsername: "nyit_ako_bot",
      fromBot: false,
    }),
    false,
  );
});

Deno.test("registerTelegramCommandMenu configures private and group scopes", async () => {
  const calls: unknown[] = [];
  await registerTelegramCommandMenu({
    setMyCommands(commands, other) {
      calls.push({ commands, other });
      return Promise.resolve();
    },
  });
  assertEquals(calls.length, 2);
  assert(
    JSON.stringify(calls).includes("all_private_chats"),
    "private scope should be registered",
  );
  assert(
    JSON.stringify(calls).includes("all_group_chats"),
    "group scope should be registered",
  );
});

Deno.test("debug_llm rejects non-admin users", () => {
  assertEquals(canUseAdminCommand("member"), false);
  assertEquals(canUseAdminCommand("administrator"), true);
});
