import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { proxyCommerce, authorizeCommerceProxy } from '../server/commerce-proxy.mjs';

const secret = 'isolated-proxy-test-'.repeat(4);
const publicOrigin = 'https://avaruchi.vercel.app';
const seen = [];
const backend = createServer(async (req, res) => {
  if (!authorizeCommerceProxy(req, res, { secret, origin: publicOrigin })) return;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  seen.push({ url: req.url, headers: req.headers, body });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Set-Cookie', ['avaruchi_refresh_token=rotated; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict', 'other=value; Path=/']);
  res.setHeader('x-cart-token', 'persistent-guest-cart');
  if (req.url === '/redirect') { res.writeHead(302, { Location: publicOrigin + '/account' }); res.end(); return; }
  if (req.method === 'HEAD') { res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
  res.end(body);
});
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
const backendUrl = `http://127.0.0.1:${backend.address().port}`;
const storefront = createServer((req, res) => proxyCommerce(req, res, { backendUrl, secret, origin: publicOrigin, production: false }));
await new Promise(resolve => storefront.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${storefront.address().port}`;
try {
  const raw = Buffer.from('{ "webhook": "signed raw JSON", "value": "₹199" }');
  const response = await fetch(origin + '/webhooks/cashfree?event=123', {
    method: 'POST', body: raw,
    headers: { authorization: 'Bearer test-session', cookie: 'avaruchi_refresh_token=existing', 'x-cart-token': 'existing-cart', 'x-webhook-signature': 'signed-value', 'x-forwarded-for': '203.0.113.77', 'x-avaruchi-client-ip': '203.0.113.77' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), raw);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('x-cart-token'), 'persistent-guest-cart');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(seen[0].url, '/webhooks/cashfree?event=123');
  assert.equal(seen[0].headers.origin, publicOrigin);
  assert.equal(seen[0].headers.authorization, 'Bearer test-session');
  assert.equal(seen[0].headers.cookie, 'avaruchi_refresh_token=existing');
  assert.equal(seen[0].headers['x-webhook-signature'], 'signed-value');
  assert.equal(seen[0].headers['x-cart-token'], 'existing-cart');
  assert.notEqual(seen[0].headers['x-forwarded-for'], '203.0.113.77', 'untrusted client IP headers must be discarded');
  assert.equal(seen[0].headers['x-forwarded-host'], 'avaruchi.vercel.app');
  assert.equal(seen[0].headers['x-avaruchi-proxy-key'], undefined);
  const upload = Buffer.from([0, 255, 13, 10, 128, 0, 1]);
  const uploaded = await fetch(origin + '/api/v1/admin/products/assets', { method: 'POST', body: upload, headers: { 'Content-Type': 'multipart/form-data; boundary=test' } });
  assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), upload);
  assert.equal((await fetch(origin + '/redirect', { redirect: 'manual' })).headers.get('location'), publicOrigin + '/account');
  assert.equal((await fetch(origin + '/health', { method: 'HEAD' })).status, 200);
  for (const supplied of [undefined, 'wrong', 'é'.repeat(secret.length)]) {
    assert.equal((await fetch(backendUrl + '/api/v1/auth/me', { headers: supplied ? { 'x-avaruchi-proxy-key': supplied } : {} })).status, 403);
  }
  await new Promise(resolve => backend.close(resolve));
  const unavailable = await fetch(origin + '/api/v1/products');
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'BACKEND_UNAVAILABLE');
  console.log('Commerce proxy smoke passed: raw webhooks, binary uploads, auth cookies, cart tokens, redirects, spoofed-header rejection and service failures.');
} finally {
  await new Promise(resolve => storefront.close(resolve));
  if (backend.listening) await new Promise(resolve => backend.close(resolve));
}
