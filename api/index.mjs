import { storefrontProductDto } from '../commerce-api/dist/src/admin-products.js';
import { buildMerchantFeed, buildRobots, buildSitemap } from '../commerce-api/dist/src/catalog-discovery.js';
import { defaultStorefrontConfig } from '../commerce-api/dist/src/storefront-config.js';
import { serveStorefront } from '../server/storefront.mjs';
import { proxyCommerce } from '../server/commerce-proxy.mjs';

let backendPromise;
function deploymentOrigin() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return new URL(process.env.APP_URL || (host ? `https://${host}` : 'http://localhost:5180')).origin;
}
async function backend() {
  if (!backendPromise) {
    const origin = deploymentOrigin();
    process.env.CORS_ORIGINS ||= origin;
    process.env.PUBLIC_UPLOAD_BASE_URL ||= `${origin}/uploads`;
    process.env.USE_DATABASE ||= 'true';
    backendPromise = import('../commerce-api/dist/bundle/commerce-entry.js')
      .then(({ createApp }) => createApp())
      .catch(error => { backendPromise = undefined; throw error; });
  }
  return backendPromise;
}

export default async function handler(req, res) {
  const origin = deploymentOrigin();
  if (process.env.COMMERCE_BACKEND_URL) return proxyCommerce(req, res, {
    backendUrl: process.env.COMMERCE_BACKEND_URL,
    secret: process.env.AVARUCHI_PROXY_SECRET,
    origin,
  });
  const path = new URL(req.url || '/', origin).pathname;
  const apiPath = /^\/(api|webhooks|uploads)(\/|$)/.test(path) || ['/health', '/ready'].includes(path);
  let runtime;
  try { runtime = await backend(); }
  catch {
    if (apiPath) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Store services are not configured. Please try again later.' } }));
      return;
    }
  }
  if (apiPath && runtime) return runtime.app(req, res);
  const products = runtime ? [...runtime.store.products.values()] : [];
  if (path === '/robots.txt') { res.setHeader('Content-Type', 'text/plain'); res.end(buildRobots(origin)); return; }
  if (/^\/sitemap(?:-\d+)?\.xml$/.test(path)) {
    const sitemap = buildSitemap(products, origin, path);
    res.statusCode = sitemap ? 200 : 404;
    res.setHeader('Content-Type', 'application/xml'); res.end(sitemap || 'Sitemap not found'); return;
  }
  if (path === '/merchant-feed.xml') { res.setHeader('Content-Type', 'application/xml'); res.end(buildMerchantFeed(products, origin).xml); return; }
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  return serveStorefront(req, res, {
    origin,
    storefront: runtime ? await runtime.readStorefront(new URL(origin).hostname) : defaultStorefrontConfig,
    products: products.filter(product => product.status === 'ACTIVE').map(storefrontProductDto),
  });
}
