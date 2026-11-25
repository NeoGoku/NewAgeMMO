/** Serialize operations on the same key, including after a failed operation. */
export class WriteOrder {
  private pending = new Map<string, Promise<unknown>>();

  async drain() { await Promise.all(this.pending.values()); }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const result = (this.pending.get(key) ?? Promise.resolve()).then(task);
    // Track a settled tail so a failure doesn't skip the next write.
    const tail = result.then(() => {}, () => {});
    this.pending.set(key, tail);
    void tail.then(() => {
      if (this.pending.get(key) === tail) this.pending.delete(key);
    });
    return result;
  }
}
