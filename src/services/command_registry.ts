export interface BotCommandDefinition {
  command: string;
  description: string;
  adminOnly?: boolean;
}

export const PUBLIC_COMMANDS: BotCommandDefinition[] = [
  { command: "help", description: "ဘာလုပ်လို့ရလဲ" },
  { command: "status", description: "bot အခြေအနေ" },
  { command: "recap", description: "ဒီနေ့ chat recap" },
  { command: "judge", description: "reply တစ်ခုကို verdict ပေး" },
  { command: "vibe", description: "group mood" },
  { command: "privacy", description: "data/privacy" },
  { command: "learning", description: "ဘာတွေ learn လုပ်လဲ" },
  { command: "myprofile", description: "ကိုယ့် reply-style hints" },
  { command: "forget", description: "ကိုယ့် data ဖျက်" },
  { command: "dontroast", description: "ကိုယ့်ကို roast မလုပ်စေ" },
  { command: "allowroast", description: "roast preference ပြန်ဖွင့်" },
];

export const ADMIN_COMMANDS: BotCommandDefinition[] = [
  { command: "debug_llm", description: "LLM diagnostics", adminOnly: true },
  { command: "groupforget", description: "group data clear", adminOnly: true },
  { command: "botstyle", description: "bot style settings", adminOnly: true },
];

export function parseCommandName(
  text: string | undefined,
  botUsername: string,
): string | null {
  const match = text?.trim().match(/^\/([a-z_]+)(?:@([a-zA-Z0-9_]+))?(?:\s|$)/);
  if (!match) return null;
  const [, command, target] = match;
  if (target && target.toLowerCase() !== botUsername.toLowerCase()) return null;
  return command.toLowerCase();
}

export function normalizeTargetedCommandText(
  text: string | undefined,
  botUsername: string,
): string | undefined {
  if (!text) return text;
  const escaped = botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`^/([a-z_]+)@${escaped}(?=\\s|$)`, "i"),
    "/$1",
  );
}

export function isSupportedCommand(
  text: string | undefined,
  botUsername: string,
): boolean {
  const command = parseCommandName(text, botUsername);
  return [...PUBLIC_COMMANDS, ...ADMIN_COMMANDS].some((entry) =>
    entry.command === command
  );
}

export function canUseAdminCommand(status: string | undefined): boolean {
  return status === "administrator" || status === "creator";
}

type PublicCommandScope = { type: "all_private_chats" } | {
  type: "all_group_chats";
};

export async function registerTelegramCommandMenu(api: {
  setMyCommands: (
    commands: ReadonlyArray<{ command: string; description: string }>,
    other?: { scope?: PublicCommandScope },
  ) => Promise<unknown>;
}): Promise<void> {
  const commands = PUBLIC_COMMANDS.map(({ command, description }) => ({
    command,
    description,
  }));
  await api.setMyCommands(commands, { scope: { type: "all_private_chats" } });
  await api.setMyCommands(commands, { scope: { type: "all_group_chats" } });
}
