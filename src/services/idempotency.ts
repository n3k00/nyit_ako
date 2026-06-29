export class UpdateDeduplicator {
  private readonly seen = new Map<number, number>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 1_000,
  ) {}

  seenBefore(updateId: number): boolean {
    const now = Date.now();
    for (const [id, timestamp] of this.seen.entries()) {
      if (now - timestamp > this.ttlMs || this.seen.size > this.maxEntries) {
        this.seen.delete(id);
      }
    }

    if (this.seen.has(updateId)) return true;
    this.seen.set(updateId, now);
    return false;
  }
}
