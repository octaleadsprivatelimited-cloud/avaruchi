import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";

it("keeps the API alive after trailing bytes on a compressed JSON request", async () => {
  // Isolate the historical uncaught decoder error from the test worker. This
  // exercises the application's real parser without touching any live service.
  const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import { createApp } from './src/app.ts';
    const { app } = await createApp({ config: {
      NODE_ENV: 'test', PORT: 4010, USE_DATABASE: false, DATABASE_URL: 'mysql://unused:unused@localhost/unused',
      JWT_SECRET: 'parser-test-access-secret-at-least-32-characters',
      JWT_REFRESH_SECRET: 'parser-test-refresh-secret-at-least-32-characters',
      INTEGRATION_ENCRYPTION_KEY: 'parser-test-encryption-key-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:5180', TRUST_PROXY: '', UPLOAD_DIR: 'uploads', PUBLIC_UPLOAD_BASE_URL: 'http://localhost:4010/uploads'
    }, persistence: null });
    const server = app.listen(0, '127.0.0.1', () => console.log('READY:' + server.address().port));
  `], { cwd: new URL("../", import.meta.url), stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Parser test API did not start")), 8_000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error(`Parser test API exited before startup: ${output}`)); });
      let startup = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        startup += chunk;
        const match = startup.match(/READY:(\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    const base = `http://127.0.0.1:${port}`;
    const request = (body: Buffer) => fetch(`${base}/api/v1/auth/google`, {
      method: "POST", headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: new Uint8Array(body), signal: AbortSignal.timeout(3_000),
    });
    const normal = await request(gzipSync("{}"));
    expect(normal.status).toBe(400);
    expect((await normal.json()).error.code).toBe("VALIDATION_ERROR");
    const malformed = await request(Buffer.concat([gzipSync("{}"), Buffer.from("trailing-bytes")]));
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    await malformed.arrayBuffer();
    await new Promise(resolve => setTimeout(resolve, 50));
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3_000) });
    expect(health.status).toBe(200);
    expect(child.exitCode).toBeNull();
    expect(output).not.toMatch(/Unhandled|uncaughtException/i);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await stopped;
    }
  }
}, 15_000);
