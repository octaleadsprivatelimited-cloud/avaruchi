export type SyncedCartEntry = { productId: string; variantId?: string; quantity: number };
export type RemoteCartEntry = { product: { id: string }; variantId: string; quantity: number };
export type CartSyncState = { hydrated: boolean; busy: boolean; error: string };

type Adapters = {
  read: () => SyncedCartEntry[];
  write: (entries: SyncedCartEntry[]) => void;
  remote: () => Promise<RemoteCartEntry[]>;
  put: (variantId: string, quantity: number) => Promise<unknown>;
  changed: () => void;
};
const signature = (entries: SyncedCartEntry[]) => JSON.stringify(entries.map(item => [item.variantId, item.quantity]).sort(([a], [b]) => String(a).localeCompare(String(b))));

/** One queue shared by every cart hook: hydrate first, then drain ordinary writes. */
export class CartSynchronization {
  private queue = Promise.resolve();
  private pending = 0;
  private comboPending = false;
  private epoch = 0;
  private hydration?: { epoch: number; promise: Promise<void> };
  private state: CartSyncState = { hydrated: false, busy: false, error: "" };
  constructor(private adapters: Adapters) {}
  snapshot() { return this.state; }
  canMutate() { return !this.comboPending; }
  private update(patch: Partial<CartSyncState> = {}) {
    this.state = { ...this.state, ...patch, busy: this.pending > 0 || this.comboPending };
    this.adapters.changed();
  }
  private enqueue<T>(work: () => Promise<T>) {
    this.pending++; this.update();
    const result = this.queue.then(work);
    this.queue = result.then(() => undefined, () => undefined);
    return result.finally(() => { this.pending--; this.update(); });
  }
  private async writeChanges(next: SyncedCartEntry[], previous: SyncedCartEntry[]) {
    const wanted = new Map(next.filter(item => item.variantId).map(item => [item.variantId!, item.quantity]));
    const before = new Map(previous.filter(item => item.variantId).map(item => [item.variantId!, item.quantity]));
    for (const [variantId, quantity] of wanted)
      if (before.get(variantId) !== quantity) await this.adapters.put(variantId, quantity);
    for (const variantId of before.keys()) if (!wanted.has(variantId)) await this.adapters.put(variantId, 0);
  }
  sync(next: SyncedCartEntry[], previous: SyncedCartEntry[]) {
    return this.enqueue(async () => {
      try { await this.writeChanges(next, previous); }
      catch (error) {
        this.update({ hydrated: false, error: error instanceof Error ? error.message : "Your bag could not be synchronized." });
        throw error;
      }
    });
  }
  hydrate(force = false) {
    if (force) this.epoch++;
    if (this.hydration?.epoch === this.epoch) return this.hydration.promise;
    const epoch = this.epoch;
    this.update({ hydrated: false, error: "" });
    const promise = this.enqueue(async () => {
      if (epoch !== this.epoch) return;
      const remote = await this.adapters.remote();
      if (epoch !== this.epoch) return;
      const previous = remote.map(item => ({ productId: item.product.id, variantId: item.variantId, quantity: item.quantity }));
      const merged = new Map(previous.map(item => [item.variantId, item]));
      for (const item of this.adapters.read()) if (item.variantId) {
        const current = merged.get(item.variantId);
        merged.set(item.variantId, { ...item, variantId: item.variantId, quantity: Math.max(item.quantity, current?.quantity || 0) });
      }
      const next = [...merged.values()];
      this.adapters.write(next);
      await this.writeChanges(next, previous);
      if (epoch === this.epoch) this.update({ hydrated: true, error: "" });
    }).catch(error => {
      if (epoch === this.epoch) this.update({ hydrated: false, error: error instanceof Error ? error.message : "Your saved bag could not be loaded." });
      throw error;
    }).finally(() => { if (this.hydration?.promise === promise) this.hydration = undefined; });
    this.hydration = { epoch, promise };
    return promise;
  }
  async addCombo<T extends { lines: SyncedCartEntry[] }>(request: (baseline: SyncedCartEntry[]) => Promise<T>) {
    if (!this.state.hydrated || this.hydration)
      throw new Error("Load your saved bag successfully before adding a combo. Please try the bag connection again.");
    if (this.comboPending) throw new Error("Wait for the current combo to finish adding.");
    this.comboPending = true; this.update();
    try {
      return await this.enqueue(async () => {
        if (!this.state.hydrated) throw new Error("Your bag has not synchronized. Please retry the bag connection.");
        const baseline = this.adapters.read();
        if (baseline.some(item => !item.variantId)) throw new Error("Review unavailable items in your bag before adding a combo.");
        const result = await request(baseline);
        if (signature(this.adapters.read()) !== signature(baseline)) {
          const error = new Error("Your bag changed while this combo was being added. Review your bag before trying again.");
          Object.assign(error, { code: "CART_CHANGED" });
          throw error;
        }
        this.adapters.write(result.lines);
        return result;
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "CART_CHANGED")
        await this.hydrate(true).catch(() => undefined);
      throw error;
    } finally { this.comboPending = false; this.update(); }
  }
}
