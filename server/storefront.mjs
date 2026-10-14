import { readFile } from 'node:fs/promises';
import { renderStorefront } from '../.output/server/entry-server.js';
import { createDocumentNonce, documentSecurityHeaders } from '../commerce-api/dist/src/http-security.js';

let templatePromise;
export async function storefrontDocument({ url, origin, storefront, products }) {
  const template = await (templatePromise ||= readFile(new URL('../.output/public/index.html', import.meta.url), 'utf8'));
  const rendered = renderStorefront({ url, origin, storefront, products });
  const nonce = createDocumentNonce();
  const bootstrap = JSON.stringify(rendered.bootstrap).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const html = template.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+name="description"[^>]*>/i, '').replace('<!--app-head-->', rendered.head)
    .replace('<!--app-html-->', rendered.html)
    .replace('<!--app-data-->', `<script nonce="${nonce}">window.__AVARUCHI_BOOTSTRAP__=${bootstrap};</script>`);
  const pathname = new URL(url, origin).pathname;
  const privatePage = /^\/(admin|account|cart|checkout|login|track|transaction|wishlist)(\/|$)/.test(pathname);
  return { html, status: rendered.status, headers: {
    ...documentSecurityHeaders(nonce, true), 'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': privatePage ? 'private, no-store' : 'no-store',
    ...(privatePage ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
  } };
}

export async function serveStorefront(req, res, data) {
  try {
    const result = await storefrontDocument({ ...data, url: req.url || '/' });
    res.writeHead(result.status, result.headers);
    res.end(req.method === 'HEAD' ? undefined : result.html);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('The store is temporarily unavailable. Please refresh and try again.');
  }
}
