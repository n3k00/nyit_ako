import { config } from "../config.ts";

interface CachedMessage {
  user_id: number;
  username: string;
  content: string;
  timestamp: number;
}

class InMemoryCache {
  private messages: Map<number, CachedMessage[]> = new Map();

  private cleanup(chatId: number): void {
    const now = Date.now();
    const ttlMs = config.messageTtlHours * 3600 * 1000;
    let messages = this.messages.get(chatId) || [];

    messages = messages.filter((m) => now - m.timestamp < ttlMs);

    if (messages.length > config.maxContextMessages) {
      messages = messages.slice(-config.maxContextMessages);
    }

    this.messages.set(chatId, messages);
  }

  async addMessage(chatId: number, userId: number, username: string, content: string): Promise<void> {
    const messages = this.messages.get(chatId) || [];
    messages.push({
      user_id: userId,
      username: username,
      content: content,
      timestamp: Date.now(),
    });
    this.messages.set(chatId, messages);
    this.cleanup(chatId);
  }

  async getRecentMessages(chatId: number, limit: number = 50): Promise<CachedMessage[]> {
    this.cleanup(chatId);
    const messages = this.messages.get(chatId) || [];
    return messages.slice(-limit);
  }

  async clearMessages(chatId: number): Promise<void> {
    this.messages.delete(chatId);
  }
}

export const cache = new InMemoryCache();

export async function addMessage(chatId: number, userId: number, username: string, content: string): Promise<void> {
  await cache.addMessage(chatId, userId, username, content);
}

export async function getRecentMessages(chatId: number, limit: number = 50): Promise<CachedMessage[]> {
  return await cache.getRecentMessages(chatId, limit);
}

export async function clearMessages(chatId: number): Promise<void> {
  await cache.clearMessages(chatId);
}
