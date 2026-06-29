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
  if (!replyToMessageId) {
    await ctx.reply(text);
    return;
  }

  try {
    await ctx.reply(text, { reply_to_message_id: replyToMessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("message to be replied not found")) throw error;
    await ctx.reply(text);
  }
}
