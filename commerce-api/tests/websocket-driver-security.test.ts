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
  const driver = createRequire(faye)("websocket-driver");
  const handshake = (headers: string[] = [], body = "") => Buffer.from([
    "GET / HTTP/1.1", "Host: fixture.invalid", "Connection: upgrade", "Upgrade: websocket", ...headers, "", body,
  ].join("\r\n"));
  const draft76 = ["Sec-WebSocket-Key1: 858 993 4592", "Sec-WebSocket-Key2: 1 1"];
  const server = (options = {}) => {
    const socket = driver.server(options);
    const messages: string[] = [], chunks: Buffer[] = [];
    socket.io.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("message", (event: { data: string }) => messages.push(event.data));
    socket.on("connect", () => socket.start());
    return { socket, messages, response: () => Buffer.concat(chunks).toString() };
  };

  it.each(["draft75", "draft76"])("rejects %s by default before accepting legacy messages", protocol => {
    const captured = server();
    expect(() => captured.socket.io.write(protocol === "draft76" ? handshake(draft76) : handshake())).not.toThrow();
    expect(captured.response()).toMatch(/^HTTP\/1\.1 400 Bad Request/);
    if (protocol === "draft76") captured.socket.io.write(Buffer.from("12345678"));
    expect(() => captured.socket.io.write(Buffer.from([0x80, 0x01, 0xff]))).not.toThrow();
    expect(captured.messages).toEqual([]);
  });

  it.each([false, true])("safely parses legacy length frames with prior message=%s when explicitly opted in", priorMessage => {
    // Opt-in is exercised only to verify the upstream parser repair; the
    // application does not enable legacy draft protocols.
    const captured = server({ allowDrafts: true });
    captured.socket.io.write(handshake());
    expect(captured.response()).toMatch(/^HTTP\/1\.1 101/);
    if (priorMessage) captured.socket.io.write(Buffer.from([0x00, 0x48, 0x69, 0xff]));
    expect(() => captured.socket.io.write(Buffer.from([0x80, 0x01, 0xff]))).not.toThrow();
    captured.socket.io.write(Buffer.from([0x00, 0x4f, 0x4b, 0xff]));
    expect(captured.messages).toEqual(priorMessage ? ["Hi", "OK"] : ["OK"]);
  });

  it("rejects overflowing draft76 key values even with explicit legacy opt-in", () => {
    const captured = server({ allowDrafts: true });
    expect(() => captured.socket.io.write(handshake(draft76, "12345678"))).not.toThrow();
    expect(captured.response()).toMatch(/^HTTP\/1\.1 400 Bad Request/);
    expect(captured.messages).toEqual([]);
  });

  it("retains modern client/server messages and ping callbacks without prototype-pong crashes", async () => {
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
      for (const payload of ["__proto__", "hasOwnProperty"]) {
        expect(() => client.pong(payload)).not.toThrow();
        // An unmasked server pong exercises the actual Firebase-facing client
        // parser too, rather than a no-op on the generic server wrapper.
        const pong = Buffer.concat([Buffer.from([0x8a, payload.length]), Buffer.from(payload)]);
        expect(() => client.io.write(pong)).not.toThrow();
      }
      client.text("still connected");
      await setImmediate();
      expect(received).toEqual(["client message", "still connected"]);
    } finally {
      peer.io.removeListener("data", toClient);
      client.io.removeListener("data", toPeer);
    }
  });
});
