import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
function cleanHeaders(input) {
  const blocked = new Set([...hopHeaders, ...String(input.connection || '').split(',').map(name => name.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(input).filter(([name]) => !blocked.has(name.toLowerCase())));
}
function unavailable(res) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '5' });
  res.end(JSON.stringify({ success: false, error: { code: 'BACKEND_UNAVAILABLE', message: 'Store services are temporarily unavailable. Please retry shortly.' } }));
}

/** Stream requests without changing signed webhooks, uploads or session cookies. */
export async function proxyCommerce(req, res, { backendUrl, secret, origin, production = true }) {
  const target = new URL(backendUrl);
  if (!secret || secret.length < 32 || target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
      (target.protocol !== 'https:' && !(production === false && target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname)))) {
    unavailable(res); return;
  }
  const headers = cleanHeaders(req.headers);
  for (const name of Object.keys(headers)) {
    if (name === 'host' || name === 'forwarded' || name.startsWith('x-forwarded-') || name.startsWith('x-vercel-') || name.startsWith('x-avaruchi-') || name === 'x-real-ip') delete headers[name];
  }
  const forwarded = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const clientIp = process.env.VERCEL === '1' && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
  headers.host = target.host;
  headers.origin ||= origin;
  headers['x-avaruchi-proxy-key'] = secret;
  if (clientIp && isIP(clientIp)) headers['x-avaruchi-client-ip'] = clientIp;
  return new Promise(resolve => {
    const upstream = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: req.method, path: req.url || '/', headers, timeout: 50_000,
    }, response => {
      const responseHeaders = cleanHeaders(response.headers);
      delete responseHeaders['x-avaruchi-proxy-key'];
      res.writeHead(response.statusCode || 502, responseHeaders);
      response.on('error', () => { res.destroy(); resolve(); });
      response.on('end', resolve);
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
    upstream.on('error', () => { unavailable(res); resolve(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
}

/** Only a verified storefront proxy may supply client identity headers. */
export function authorizeCommerceProxy(req, res, { secret, origin }) {
  if (!secret) return true;
  const supplied = req.headers['x-avaruchi-proxy-key'];
  const suppliedBytes = Buffer.from(typeof supplied === 'string' ? supplied : '');
  const secretBytes = Buffer.from(secret);
  const valid = secretBytes.length >= 32 && suppliedBytes.length === secretBytes.length && timingSafeEqual(suppliedBytes, secretBytes);
  if (!valid) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'STOREFRONT_PROXY_REQUIRED', message: 'Use the Avaruchi storefront to access this service.' } }));
    return false;
  }
  const clientIp = req.headers['x-avaruchi-client-ip'];
  delete req.headers['x-avaruchi-proxy-key'];
  delete req.headers['x-avaruchi-client-ip'];
  delete req.headers.forwarded;
  for (const name of Object.keys(req.headers)) if (name.startsWith('x-forwarded-')) delete req.headers[name];
  if (typeof clientIp === 'string' && isIP(clientIp)) req.headers['x-forwarded-for'] = clientIp;
  req.headers['x-forwarded-host'] = new URL(origin).host;
  req.headers['x-forwarded-proto'] = new URL(origin).protocol.slice(0, -1);
  return true;
}
