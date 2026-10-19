import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { canonicalWwwRedirect } from '../server/canonical-origin.mjs';

const canonicalOrigin = 'https://aavaruchi.in';
assert.equal(canonicalWwwRedirect({ origin: canonicalOrigin, authority: 'WWW.AAVARUCHI.IN:443', url: '/shop?category=Pickles&q=mango%20pickle' }), `${canonicalOrigin}/shop?category=Pickles&q=mango%20pickle`);
assert.equal(canonicalWwwRedirect({ origin: canonicalOrigin, authority: 'www.aavaruchi.in.', url: '//untrusted.example/contact?source=www' }), `${canonicalOrigin}/contact?source=www`);
for (const authority of ['aavaruchi.in', 'aavaruchi.in:443', 'www.aavaruchi.in.attacker.example', 'attacker.example', undefined])
  assert.equal(canonicalWwwRedirect({ origin: canonicalOrigin, authority, url: '/' }), undefined);

// A database that accepts TCP but never completes its handshake reproduces
// slow hosted migrations without touching any real database or credentials.
const connections = new Set();
const database = createTcpServer(socket => {
  connections.add(socket);
  socket.on('close', () => connections.delete(socket));
});
await new Promise(resolve => database.listen(0, '127.0.0.1', resolve));
const reservation = createHttpServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const began = Date.now();
const child = spawn(process.execPath, ['hostinger.mjs'], {
  cwd: new URL('../', import.meta.url),
  detached: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    PORT: String(port),
    APP_URL: canonicalOrigin,
    NODE_ENV: 'production',
    USE_DATABASE: 'true',
    DATABASE_URL: `mysql://startup_test:unused@127.0.0.1:${database.address().port}/unused?connect_timeout=15`,
  },
});

try {
  let response;
  while (Date.now() - began < 3000) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(200) });
      break;
    } catch {
      await delay(25);
    }
  }
  assert.ok(response, 'Hostinger must receive a listening port within three seconds, even while MySQL is unresponsive');
  assert.equal(response.status, 503, 'an uninitialized app must never report readiness');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '1');
  assert.equal((await response.json()).error.code, 'SERVICE_STARTING');
  for (const method of ['GET', 'POST']) {
    const redirect = await new Promise((resolve, reject) => {
      const request = httpRequest(`http://127.0.0.1:${port}/contact?source=www%20check`, {
        method, headers: { host: 'www.aavaruchi.in' },
      }, response => { response.resume(); resolve(response); });
      request.setTimeout(1000, () => request.destroy(new Error('www redirect waited for database startup')));
      request.on('error', reject);
      request.end();
    });
    assert.equal(redirect.statusCode, 308, 'www must redirect without waiting for database initialization');
    assert.equal(redirect.headers.location, `${canonicalOrigin}/contact?source=www%20check`);
    assert.equal(redirect.headers['cache-control'], 'no-store');
  }
  await assert.rejects(
    fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(150) }),
    { name: 'TimeoutError' },
    'customer requests should wait for initialization instead of receiving an immediate cold-start error',
  );
  console.log('Hostinger startup smoke passed: www redirects preserve paths, queries and methods before MySQL initializes; apex readiness and startup waiting remain intact.');
} finally {
  // Terminate the Prisma child processes along with the server under test.
  try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error('Could not terminate the startup smoke test process group.');
      process.exitCode = 1;
    }
  }
  for (const socket of connections) socket.destroy();
  await new Promise(resolve => database.close(resolve));
}
