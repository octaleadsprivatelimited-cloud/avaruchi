import { expect, it, vi } from "vitest";

const modulePath = "../../src/lib/cart-synchronization.ts";
const { CartSynchronization } = await import(modulePath);
type Entry = { productId: string; variantId: string; quantity: number };
const item = (id: string, quantity = 1): Entry => ({ productId: `product-${id}`, variantId: id, quantity });
const remote = (entries: Entry[]) => entries.map(entry => ({ product: { id: entry.productId }, variantId: entry.variantId, quantity: entry.quantity }));
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

it("shares hydration and blocks combo requests until a saved remote bag is loaded", async () => {
  let local: Entry[] = [];
  const wait = deferred();
  const readRemote = vi.fn(async () => { await wait.promise; return remote([item("saved", 3)]); });
  const controller = new CartSynchronization({ read: () => local, write: (next: Entry[]) => { local = next; }, remote: readRemote, put: vi.fn(), changed: vi.fn() });
  const first = controller.hydrate(), second = controller.hydrate();
  expect(first).toBe(second);
  const add = vi.fn(async (baseline: Entry[]) => ({ lines: [...baseline, item("combo")] }));
  await expect(controller.addCombo(add)).rejects.toThrow("Load your saved bag");
  expect(add).not.toHaveBeenCalled();
  wait.resolve(); await first;
  expect(readRemote).toHaveBeenCalledTimes(1);
  await controller.addCombo(add);
  expect(add).toHaveBeenCalledWith([item("saved", 3)]);
  expect(local).toEqual([item("saved", 3), item("combo")]);
});

it("keeps combo adding disabled after hydration failure and allows an explicit successful retry", async () => {
  let local: Entry[] = [];
  const readRemote = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue(remote([item("saved")]));
  const controller = new CartSynchronization({ read: () => local, write: (next: Entry[]) => { local = next; }, remote: readRemote, put: vi.fn(), changed: vi.fn() });
  await expect(controller.hydrate()).rejects.toThrow("Network unavailable");
  const add = vi.fn();
  await expect(controller.addCombo(add)).rejects.toThrow("Load your saved bag");
  expect(add).not.toHaveBeenCalled();
  expect(controller.snapshot()).toMatchObject({ hydrated: false, error: "Network unavailable" });
  await controller.hydrate(true);
  expect(controller.snapshot()).toMatchObject({ hydrated: true, error: "" });
});

it("drains ordinary pending writes before capturing the combo baseline", async () => {
  let local: Entry[] = [];
  const wait = deferred();
  const put = vi.fn(async () => { await wait.promise; });
  const controller = new CartSynchronization({ read: () => local, write: (next: Entry[]) => { local = next; }, remote: async () => [], put, changed: vi.fn() });
  await controller.hydrate();
  local = [item("ordinary", 2)];
  const sync = controller.sync(local, []);
  const add = vi.fn(async (baseline: Entry[]) => ({ lines: [...baseline, item("combo")] }));
  const adding = controller.addCombo(add);
  await Promise.resolve();
  expect(add).not.toHaveBeenCalled();
  expect(controller.canMutate()).toBe(false);
  wait.resolve(); await sync; await adding;
  expect(add).toHaveBeenCalledWith([item("ordinary", 2)]);
  expect(controller.canMutate()).toBe(true);
});

it("does not start a combo if an ordinary remote write failed", async () => {
  let local: Entry[] = [];
  const controller = new CartSynchronization({ read: () => local, write: (next: Entry[]) => { local = next; }, remote: async () => [], put: async () => { throw new Error("Write failed"); }, changed: vi.fn() });
  await controller.hydrate();
  local = [item("ordinary")];
  const sync = controller.sync(local, []);
  const add = vi.fn();
  const adding = controller.addCombo(add);
  await expect(sync).rejects.toThrow("Write failed");
  await expect(adding).rejects.toThrow("has not synchronized");
  expect(add).not.toHaveBeenCalled();
});

it("refreshes and preserves remotely changed items on a compare-and-swap conflict", async () => {
  let local: Entry[] = [];
  let saved = [item("saved")];
  const controller = new CartSynchronization({ read: () => local, write: (next: Entry[]) => { local = next; }, remote: async () => remote(saved), put: vi.fn(), changed: vi.fn() });
  await controller.hydrate();
  saved = [item("saved"), item("other-window", 4)];
  const conflict = Object.assign(new Error("Review your changed bag"), { code: "CART_CHANGED" });
  await expect(controller.addCombo(async () => { throw conflict; })).rejects.toThrow("Review your changed bag");
  expect(local).toEqual(saved);
  expect(controller.snapshot().hydrated).toBe(true);
});
