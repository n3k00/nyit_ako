import type { CachedMessage } from "../types.ts";

export interface ContextCacheOptions {
  ttlMs: number;
  maxMessages: number;
}

class InMemoryContextCache {
  private messages: Map<number, CachedMessage[]> = new Map();

  constructor(private readonly options: ContextCacheOptions) {}

  private cleanup(chatId: number): void {
    const now = Date.now();
    const ttlMs = this.options.ttlMs;
    const retained = (this.messages.get(chatId) || [])
      .filter((message) => now - message.timestamp < ttlMs)
      .slice(-this.options.maxMessages);
    if (retained.length === 0) this.messages.delete(chatId);
    else this.messages.set(chatId, retained);
  }

  addMessage(chatId: number, message: Omit<CachedMessage, "timestamp">): void {
    const content = message.content.trim();
    if (!content) return;

    const messages = this.messages.get(chatId) || [];
    const last = messages.at(-1);
    if (last?.message_id === message.message_id) return;

    messages.push({ ...message, content, timestamp: Date.now() });
    this.messages.set(chatId, messages);
    this.cleanup(chatId);
  }

  getRecentMessages(chatId: number, limit: number): CachedMessage[] {
    this.cleanup(chatId);
    return (this.messages.get(chatId) || []).slice(-limit);
  }

  clearMessages(chatId: number): void {
    this.messages.delete(chatId);
  }
}

let cache = new InMemoryContextCache({
  ttlMs: 180 * 60 * 1000,
  maxMessages: 80,
});

export function configureCache(options: ContextCacheOptions): void {
  cache = new InMemoryContextCache(options);
}

export function addMessage(
  chatId: number,
  message: Omit<CachedMessage, "timestamp">,
): void {
  cache.addMessage(chatId, message);
}

export function getRecentMessages(chatId: number, limit = 30): CachedMessage[] {
  return cache.getRecentMessages(chatId, limit);
}

export function clearMessages(chatId: number): void {
  cache.clearMessages(chatId);
}
