import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { storefrontDocument } from '../server/storefront.mjs';
import { defaultStorefrontConfig } from '../commerce-api/dist/src/storefront-config.js';

// Exercise the actual compiled SSR bundle while no API is listening at PORT.
// This reproduces hosted environments where same-process loopback fetch fails.
process.env.PORT = '9';
process.env.APP_URL = 'https://avaruchi.example';
let catalog = [];
const readerKey = Symbol.for('avaruchi.publicCatalogReader');
globalThis[readerKey] = () => catalog;
const settingsReaderKey = Symbol.for('avaruchi.publicStorefrontReader');
let storefrontSettings = { ...defaultStorefrontConfig, manualDeliveryEnabled: true, deliveryCharge: 62, freeShippingThreshold: 800 };
globalThis[settingsReaderKey] = async () => storefrontSettings;
const server = createServer(async (req, res) => {
  const result = await storefrontDocument({ url: req.url, origin: process.env.APP_URL, storefront: storefrontSettings, products: catalog });
  res.writeHead(result.status, result.headers);
  res.end(result.html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const request = path => new Promise((resolve, reject) => {
  get({ hostname: '127.0.0.1', port, path }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    response.on('error', reject);
  }).on('error', reject);
});

try {
  const nonces = new Set();
  const pages = ['/', '/shop', '/cart', '/checkout', '/login', '/track', '/account', '/privacy', '/terms', '/shipping-returns', '/contact', '/our-story', '/journal', '/wishlist', '/shipping', '/returns',
    ...['overview', 'products', 'orders', 'customers', 'returns', 'support', 'inventory', 'payments', 'shipping', 'marketing', 'analytics', 'integrations', 'settings'].map(section => `/admin/${section}`)];
  for (const path of pages) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} must render without loopback API access`);
    assert.ok(!response.body.includes('google-site-verification'), 'do not inherit another client’s verification metadata');
    assert.ok(!response.body.includes('Cold Pressed Groundnut Oil'), 'an empty live catalog must not render sample products');
    assert.ok(!response.body.includes('new Error("fetch failed")'));
    assert.equal((response.body.match(/<link\b[^>]*rel="canonical"/g) || []).length, 1, 'render one canonical URL');
    const csp = response.headers['content-security-policy'];
    const nonce = csp?.match(/'nonce-([A-Za-z0-9_-]{43})'/)?.[1];
    assert.ok(nonce, `${path}: send a document-specific CSP nonce`);
    assert.ok(!nonces.has(nonce), 'never reuse a document nonce'); nonces.add(nonce);
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    for (const script of response.body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!script[2].trim() || /type="application\/ld\+json"/.test(script[1])) continue;
      assert.ok(script[1].includes(`nonce="${nonce}"`), `${path}: bootstrap scripts must carry the framework nonce`);
    }
  }
  const home = await request('/');
  assert.ok(home.body.includes('reference-hero'), 'render the reference pickle hero');
  assert.ok(home.body.includes('The taste of home, in every jar.'), 'render the reference heading');
  assert.ok(home.body.includes('/images/hero.png') && home.body.includes('/brand/avaruchi-logo-small.webp'), 'use the reference photography and brand artwork');
  assert.ok(home.body.includes('reference-story'), 'render the reference brand story');
  assert.ok(home.body.includes('Our collection is coming together.'), 'an empty backend must stay empty in the new UI');
  assert.ok(home.body.includes('₹62 delivery') && home.body.includes('₹800'), 'SSR must use saved delivery prices before hydration');
  storefrontSettings = { ...storefrontSettings, heroImageUrl: '/uploads/admin-hero.png', heroImageAlt: 'Pickles selected by the store administrator' };
  const customHero = await request('/');
  assert.ok(customHero.body.includes('src="/uploads/admin-hero.png"') && customHero.body.includes('alt="Pickles selected by the store administrator"'), 'SSR must render the published hero image and description');
  storefrontSettings = { ...storefrontSettings, heroImageUrl: '', heroImageAlt: '' };
  assert.ok((await request('/')).body.includes('src="/images/hero.png"'), 'resetting the hero restores the bundled image');
  storefrontSettings = { ...storefrontSettings, deliveryCharge: 89, freeShippingThreshold: 799 };
  const updatedShop = await request('/shop');
  assert.ok(updatedShop.body.includes('₹89 delivery') && updatedShop.body.includes('₹799'), 'fresh SSR must read the replacement policy');
  assert.ok(!updatedShop.body.includes('₹62 delivery') && !updatedShop.body.includes('₹999'), 'old shipping prices must not remain in rendered markup');
  const missing = await request('/product/not-a-real-product');
  assert.equal(missing.status, 404);
  assert.ok(missing.body.includes('We couldn’t find this page.'));
  const unknown = await request('/this-page-does-not-exist');
  assert.equal(unknown.status, 404);
  assert.ok(unknown.body.includes('Explore the shop'));
  assert.ok(unknown.body.includes('Page not found | Avaruchi'));
  const malformed = await request('/product/%E0%A4%A');
  assert.equal(malformed.status, 404, 'malformed product encoding must not crash SSR');
  assert.ok(malformed.body.includes('noindex, nofollow'));
  assert.ok((await request('/wishlist')).body.includes('name="robots" content="noindex, nofollow"'), 'saved customer favourites must remain private after hydration');
  assert.ok((await request('/shipping')).body.includes('rel="canonical" href="https://avaruchi.example/shipping-returns"'), 'duplicate policy routes share their canonical');
  const transaction = await request('/transaction/AVA-smoke');
  assert.equal(transaction.status, 200);
  assert.ok(transaction.body.includes('noindex, nofollow'));
  assert.equal(transaction.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(transaction.headers['cache-control'], 'private, no-store');
  catalog = [{
    id: 'smoke-groundnut-oil', name: 'Smoke test groundnut oil', category: 'Cooking oils', description: 'A local smoke-test fixture only.', status: 'ACTIVE', taxRate: 5,
    media: [{ type: 'IMAGE', url: '/uploads/groundnut-oil.jpg', alt: 'Groundnut oil', position: 0 }],
    variants: [
      { id: 'oil-500', sku: 'AVA500', title: '500 ml', price: 129, mrp: 149, stock: 5, reserved: 0, attributes: { Volume: '500 ml' } },
      { id: 'oil-1000', sku: 'AVA1000', title: '1 L', price: 279.5, mrp: 299, stock: 3, reserved: 0, attributes: { Volume: '1 L' } },
    ],
  }];
  const product = await request('/product/smoke-groundnut-oil?variant=oil-1000');
  assert.equal(product.status, 200);
  assert.match(product.body, /detail-price[^>]*>₹293\.48/);
  assert.ok(product.body.includes('"price":"293.48"'));
  assert.ok(product.body.includes('variant=oil-1000'));
  assert.ok(product.body.includes('name="description" content="A local smoke-test fixture only."'), 'use the product description in SSR metadata');
  assert.ok(product.body.includes('property="og:image" content="https://avaruchi.example/uploads/groundnut-oil.jpg"'));
  assert.ok(product.body.includes('Shop pickles') && !product.body.includes('Shop oils'), 'structured breadcrumbs use the current brand catalog');
  const legacyProduct = await request('/shop/smoke-groundnut-oil');
  assert.ok(legacyProduct.body.includes('rel="canonical" href="https://avaruchi.example/product/smoke-groundnut-oil"'), 'legacy product aliases point to the published product canonical');
  const category = await request('/shop?category=Cooking+oils');
  assert.equal(category.status, 200);
  assert.ok(category.body.includes('Smoke test groundnut oil') && category.body.includes('Cooking oils'), 'category routes render matching products');
  assert.ok(!category.body.includes('>Bold flavours</a>'), 'navigation must not send customers to hard-coded empty categories');
  const untrustedText = '</script><script>alert("storefront-xss")</script>';
  catalog[0].description = untrustedText;
  storefrontSettings = { ...storefrontSettings, storeName: `Avaruchi ${untrustedText}` };
  const escaped = await request('/product/smoke-groundnut-oil');
  assert.equal(escaped.status, 200);
  assert.ok(!escaped.body.includes(untrustedText), 'merchant text must not escape the HTML or bootstrap script');
  assert.ok(escaped.body.includes('\\u003c/script>'), 'bootstrap data must escape opening angle brackets');
  console.log(`Built SSR smoke passed: ${pages.length} storefront/account/admin pages render with security headers and distinct bootstrap nonces; real 404s, private transaction caching and variant prices verified.`);
} finally {
  delete globalThis[readerKey];
  delete globalThis[settingsReaderKey];
  await new Promise(resolve => server.close(resolve));
}
