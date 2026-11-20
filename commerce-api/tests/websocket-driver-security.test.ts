import { createRequire } from "node:module";
import { setImmediate } from "node:timers/promises";
import { describe, expect, it } from "vitest";

const rootRequire = createRequire(new URL("../../package.json", import.meta.url));
const apiRequire = createRequire(new URL("../package.json", import.meta.url));
const rootDatabase = createRequire(rootRequire.resolve("firebase/database")).resolve("@firebase/database");
const apiCompat = createRequire(apiRequire.resolve("firebase-admin/database")).resolve("@firebase/database-compat");
const apiDatabase = createRequire(apiCompat).resolve("@firebase/database");
const owners = [["storefront", rootDatabase], ["backend", apiDatabase]] as const;

// Resolve through the actual Firebase -> Faye dependency chain in each install.
// All protocol traffic below stays between memory streams; no ports, network
// connections, application credentials or production systems are involved.
for (const [name, database] of owners) describe(`${name} websocket dependency`, () => {
  const faye = createRequire(database).resolve("faye-websocket");
  const fayeRequire = createRequire(faye);
  const driver = fayeRequire("websocket-driver");
  const handshake = (headers: string[] = []) => Buffer.from([
    "GET / HTTP/1.1", "Host: fixture.invalid", "Connection: upgrade", "Upgrade: websocket", ...headers, "", "",
  ].join("\r\n"));
  const draft76 = ["Sec-WebSocket-Key1: 12 34", "Sec-WebSocket-Key2: 56 78"];
  it("resolves a release with the upstream protocol fixes", () => {
    const version: string = fayeRequire("websocket-driver/package.json").version;
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const [major, minor] = version.split(".").map(Number);
    expect(major! > 0 || minor! >= 8).toBe(true);
  });

  it.each(["draft75", "draft76"])("rejects a valid %s handshake by default", protocol => {
    const socket = driver.server();
    const chunks: Buffer[] = [];
    socket.io.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("connect", () => socket.start());
    socket.io.write(protocol === "draft76" ? handshake(draft76) : handshake());
    expect(Buffer.concat(chunks).toString()).toMatch(/^HTTP\/1\.1 400 Bad Request/);
  });

  it("retains modern client/server messages and ping callbacks", async () => {
    const client = driver.client("wss://fixture.invalid/socket", { maxLength: 1024, protocols: [] });
    const peer = driver.server({ maxLength: 1024 });
    const received: string[] = [], replies: string[] = [];
    peer.on("connect", () => peer.start());
    peer.on("message", (event: { data: string }) => received.push(event.data));
    client.on("message", (event: { data: string }) => replies.push(event.data));
    // Defer delivery like real I/O; synchronous recursion can deliver the
    // handshake response before the initiating start() has returned.
    const toClient = (chunk: Buffer) => queueMicrotask(() => client.io.write(chunk));
    const toPeer = (chunk: Buffer) => queueMicrotask(() => peer.io.write(chunk));
    peer.io.on("data", toClient);
    client.io.on("data", toPeer);
    try {
      expect(client.start()).toBe(true);
      await setImmediate();
      client.text("client message");
      peer.text("server reply");
      await setImmediate();
      expect(received).toEqual(["client message"]);
      expect(replies).toEqual(["server reply"]);
      let acknowledgements = 0;
      client.ping("heartbeat", () => acknowledgements++);
      await setImmediate();
      expect(acknowledgements).toBe(1);
      client.text("still connected");
      await setImmediate();
      expect(received).toEqual(["client message", "still connected"]);
    } finally {
      peer.io.removeListener("data", toClient);
      client.io.removeListener("data", toPeer);
    }
  });
});
