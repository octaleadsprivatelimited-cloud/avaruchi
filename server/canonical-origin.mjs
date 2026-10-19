/** Redirect only the configured site's www alias, never a caller-supplied origin. */
export function canonicalWwwRedirect({ origin, authority, url = '/' }) {
  const canonical = new URL(origin);
  const hostname = canonical.hostname.toLowerCase().replace(/\.$/, '');
  const incomingHost = typeof authority === 'string'
    ? authority.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') : '';
  if (hostname.startsWith('www.') || incomingHost !== `www.${hostname}`) return;
  // Parse the path independently, then copy it onto the fixed trusted origin.
  // Protocol-relative and absolute request targets cannot become open redirects.
  const incoming = new URL(url, canonical.origin);
  canonical.pathname = incoming.pathname;
  canonical.search = incoming.search;
  canonical.hash = '';
  return canonical.href;
}
