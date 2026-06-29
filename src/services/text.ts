export function stripBotMention(text: string, botUsername: string): string {
  const escaped = botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`@${escaped}\\b`, "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
}
