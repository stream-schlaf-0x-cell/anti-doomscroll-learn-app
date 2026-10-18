/**
 * BoundedIdSet
 *
 * A bounded FIFO set for tracking recently served or rendered feed item IDs.
 * Unlike a simple set with a hard .clear() threshold, BoundedIdSet evicts the oldest
 * entries first when exceeding capacity. The history NEVER drops to 0, preventing
 * abrupt recycling of round 1 items during feed rotation.
 */
export class BoundedIdSet {
  private readonly capacity: number;
  private readonly set: Set<string>;
  private readonly queue: string[];

  constructor(capacity = 200, initialIds: Iterable<string> = []) {
    this.capacity = Math.max(1, capacity);
    this.set = new Set<string>();
    this.queue = [];
    this.addMany(initialIds);
  }

  public add(id: string): this {
    if (!id || typeof id !== 'string') return this;
    if (this.set.has(id)) {
      // Re-adding a known ID moves it to the back (most recent)
      const idx = this.queue.indexOf(id);
      if (idx !== -1) {
        this.queue.splice(idx, 1);
        this.queue.push(id);
      }
      return this;
    }

    // Evict oldest if at capacity
    while (this.queue.length >= this.capacity) {
      const oldest = this.queue.shift();
      if (oldest) {
        this.set.delete(oldest);
      }
    }

    this.set.add(id);
    this.queue.push(id);
    return this;
  }

  public addMany(ids: Iterable<string>): this {
    for (const id of ids) {
      this.add(id);
    }
    return this;
  }

  public has(id: string): boolean {
    return this.set.has(id);
  }

  public get size(): number {
    return this.set.size;
  }

  public toSet(): Set<string> {
    return new Set(this.set);
  }

  public toArray(): string[] {
    return [...this.queue];
  }

  public clear(): void {
    this.set.clear();
    this.queue.length = 0;
  }
}
