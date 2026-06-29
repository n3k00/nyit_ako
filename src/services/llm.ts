import { config } from "../config.ts";

export async function callMimo(messages: Array<{ role: string; content: string }>, temperature: number = 0.7, maxTokens: number = 256): Promise<string> {
  const startTime = Date.now();
  const response = await fetch(`${config.mimoApiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.mimoApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.mimoModel,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const elapsed = Date.now() - startTime;
  console.log(`[LLM] ${config.mimoModel} responded in ${elapsed}ms`);
  return data.choices[0].message.content;
}

export function startTypingLoop(ctx: { chat: { id: number }; api: { sendChatAction: (chatId: number, action: string) => Promise<void> } }): { stop: () => void } {
  let running = true;
  const sendTyping = async () => {
    while (running) {
      try {
        await ctx.api.sendChatAction(ctx.chat.id, "typing");
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };
  sendTyping();
  return {
    stop: () => {
      running = false;
    },
  };
}
