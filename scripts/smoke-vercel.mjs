import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exercise the deployed Node adapter against an isolated in-memory test store.
const unconfigured = process.argv.includes('--unconfigured');
Object.assign(process.env, {
  NODE_ENV: 'test', USE_DATABASE: 'false', DATABASE_URL: 'mysql://unused:unused@localhost/adapter_test',
  APP_URL: 'http://localhost:5180', JWT_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64),
  INTEGRATION_ENCRYPTION_KEY: 'c'.repeat(64), STORE_ADMIN_EMAIL: '',
  FIREBASE_PROJECT_ID: '', FIREBASE_API_KEY: '', FIREBASE_AUTH_DOMAIN: '', FIREBASE_APP_ID: '',
});
if (unconfigured) {
  process.env.NODE_ENV = 'production';
  process.env.USE_DATABASE = 'true';
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY']) delete process.env[key];
}
for (const key of ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME', 'DATABASE_PORT']) delete process.env[key];
const { default: handler } = await import('../api/index.mjs');
const server = createServer(handler);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  if (unconfigured) {
    const catalog = await fetch(`${origin}/api/v1/products`);
    assert.equal(catalog.status, 503);
    assert.equal((await catalog.json()).error.code, 'BACKEND_NOT_CONFIGURED');
    const page = await fetch(origin);
    assert.equal(page.status, 200, 'public pages must render before production services are configured');
    assert.ok((await page.text()).includes('Avaruchi'));
    console.log('Vercel unconfigured deployment smoke passed: public storefront renders and API returns 503.');
  } else {
  const catalog = await fetch(`${origin}/api/v1/products`);
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).data.length, 8, 'the adapter must pass requests to the existing API');
  const privateApi = await fetch(`${origin}/api/v1/auth/me`);
  assert.equal(privateApi.status, 401, 'the existing authentication guard must remain active');
  const auth = await (await fetch(`${origin}/api/v1/auth/providers`)).json();
  assert.equal(auth.data.firebase.enabled, false);
  const shop = await fetch(`${origin}/shop`);
  assert.equal(shop.status, 200);
  assert.ok((await shop.text()).includes('THE COLLECTION'));
  const account = await fetch(`${origin}/account`);
  assert.equal(account.headers.get('cache-control'), 'private, no-store');
  assert.equal(account.headers.get('x-robots-tag'), 'noindex, nofollow');
  const missing = await fetch(`${origin}/this-page-is-missing`);
  assert.equal(missing.status, 404);
  const form = await fetch(`${origin}/shop`, { method: 'POST', body: 'not-an-api-request' });
  assert.equal(form.status, 405);
  console.log('Vercel adapter smoke passed: API routing, authentication, Vite rendering, private caching and 404/405 responses verified.');
  }
} finally { await new Promise(resolve => server.close(resolve)); }
if (!unconfigured) execFileSync(process.execPath, ['--no-experimental-require-module', fileURLToPath(import.meta.url), '--unconfigured'], { stdio: 'inherit' });
