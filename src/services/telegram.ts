export async function safeReply(
  ctx: {
    reply: (
      text: string,
      other?: { reply_to_message_id?: number },
    ) => Promise<unknown>;
  },
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  const chunks = splitTelegramMessage(text);
  if (!replyToMessageId) {
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
    return;
  }

  try {
    await ctx.reply(chunks[0], { reply_to_message_id: replyToMessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("message to be replied not found")) throw error;
    await ctx.reply(chunks[0]);
  }

  for (const chunk of chunks.slice(1)) {
    await ctx.reply(chunk);
  }
}

export function splitTelegramMessage(text: string, limit = 3900): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return [clean || " "];

  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const breakAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf("။ "),
      window.lastIndexOf(". "),
      window.lastIndexOf(" "),
    );
    const cut = breakAt > Math.floor(limit * 0.6) ? breakAt + 1 : limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
